import { NextResponse } from "next/server";

import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { queuePartyInvitationMessages } from "../../../../lib/notifications";
import { prisma } from "../../../../lib/prisma";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToParty(request: Request, partyId: string) {
  return NextResponse.redirect(new URL(`/host/party/${partyId}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToParty(request, partyId);
  }
  const guestId = getFormValue(formData, "guestId");

  if (!partyId || !guestId) {
    return NextResponse.redirect(new URL("/host?error=missing", request.url), 303);
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: {
      id: true,
      hostId: true,
      status: true,
      title: true,
      inviteCode: true
    }
  });

  if (!party || party.hostId !== user.id) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }
  if (party.status === "COMPLETED") {
    return redirectToParty(request, partyId);
  }

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      partyId: true,
      name: true,
      email: true
    }
  });

  if (!guest || guest.partyId !== partyId) {
    return redirectToParty(request, partyId);
  }

  await queuePartyInvitationMessages({
    hostId: user.id,
    partyId,
    partyTitle: party.title,
    inviteCode: party.inviteCode,
    guests: [guest]
  });
  await logAuditEvent({
    action: "party.invitation.resent",
    userId: user.id,
    partyId,
    entityType: "Guest",
    entityId: guestId,
    metadata: {
      recipient: guest.email
    }
  });

  return redirectToParty(request, partyId);
}
