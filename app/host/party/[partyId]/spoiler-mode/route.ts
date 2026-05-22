import { NextResponse } from "next/server";

import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
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

  const confirmation = getFormValue(formData, "confirmSpoilerMode");
  if (confirmation !== "on") {
    return redirectToParty(request, partyId);
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: {
      id: true,
      hostId: true,
      hostSpoilerUnlockedAt: true
    }
  });

  if (!party || party.hostId !== user.id) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  if (!party.hostSpoilerUnlockedAt) {
    const unlockedAt = new Date();
    await prisma.party.update({
      where: { id: partyId },
      data: {
        hostSpoilerUnlockedAt: unlockedAt,
        hostSpoilerUnlockedByUserId: user.id
      }
    });
    await logAuditEvent({
      action: "party.spoilerMode.unlocked",
      userId: user.id,
      partyId,
      entityType: "Party",
      entityId: partyId,
      metadata: {
        unlockedAt: unlockedAt.toISOString()
      }
    });
  }

  return redirectToParty(request, partyId);
}
