import { NextResponse } from "next/server";

import { createAppUrl } from "../../../../lib/app-url";
import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { prisma } from "../../../../lib/prisma";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToParty(request: Request, partyId: string) {
  return NextResponse.redirect(createAppUrl(`/host/party/${partyId}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToParty(request, partyId);
  }
  const characterId = getFormValue(formData, "characterId");
  const guestId = getFormValue(formData, "guestId");

  if (!partyId || !characterId) {
    return NextResponse.redirect(createAppUrl("/host?error=missing", request.url), 303);
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: {
      id: true,
      hostId: true,
      gameVersionId: true,
      status: true
    }
  });

  if (!party || party.hostId !== user.id) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }
  if (party.status === "COMPLETED") {
    return redirectToParty(request, partyId);
  }

  const character = await prisma.gameCharacter.findUnique({
    where: { id: characterId },
    select: { id: true, gameVersionId: true }
  });

  if (!character || character.gameVersionId !== party.gameVersionId) {
    return redirectToParty(request, partyId);
  }

  if (!guestId) {
    await prisma.partyCharacterAssignment.deleteMany({
      where: {
        partyId,
        characterId
      }
    });
    await logAuditEvent({
      action: "party.assignment.cleared",
      userId: user.id,
      partyId,
      entityType: "GameCharacter",
      entityId: characterId
    });
    return redirectToParty(request, partyId);
  }

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true, partyId: true, status: true }
  });

  if (!guest || guest.partyId !== partyId || !["INVITED", "JOINED"].includes(guest.status)) {
    return redirectToParty(request, partyId);
  }

  await prisma.$transaction([
    prisma.partyCharacterAssignment.deleteMany({
      where: {
        partyId,
        OR: [{ characterId }, { guestId }]
      }
    }),
    prisma.partyCharacterAssignment.create({
      data: {
        partyId,
        characterId,
        guestId
      }
    })
  ]);
  await logAuditEvent({
    action: "party.assignment.saved",
    userId: user.id,
    partyId,
    entityType: "GameCharacter",
    entityId: characterId,
    metadata: { guestId }
  });

  return redirectToParty(request, partyId);
}
