import { NextResponse } from "next/server";

import { logAuditEvent } from "../../lib/audit-log";
import { verifyCsrfToken } from "../../lib/csrf";
import { getCurrentGuest } from "../../lib/guest-auth";
import { prisma } from "../../lib/prisma";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const guest = await getCurrentGuest();

  if (!guest) {
    return NextResponse.redirect(new URL("/join", request.url), 303);
  }

  if (guest.status !== "JOINED") {
    return NextResponse.redirect(new URL("/play", request.url), 303);
  }
  if (guest.party.status === "COMPLETED") {
    return NextResponse.redirect(new URL("/play", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return NextResponse.redirect(new URL("/play", request.url), 303);
  }
  const suspectCharacterId = getFormValue(formData, "suspectCharacterId");
  const motiveNotes = getFormValue(formData, "motiveNotes");
  const evidenceNotes = getFormValue(formData, "evidenceNotes");
  const accusationText = getFormValue(formData, "accusationText");

  if (!suspectCharacterId && !motiveNotes && !evidenceNotes && !accusationText) {
    return NextResponse.redirect(new URL("/play", request.url), 303);
  }

  let validSuspectCharacterId: string | null = null;
  if (suspectCharacterId) {
    const suspect = await prisma.gameCharacter.findUnique({
      where: { id: suspectCharacterId },
      select: {
        id: true,
        gameVersionId: true
      }
    });

    if (suspect?.gameVersionId === guest.party.gameVersionId) {
      validSuspectCharacterId = suspect.id;
    }
  }

  const accusation = await prisma.partyAccusation.upsert({
    where: {
      partyId_guestId: {
        partyId: guest.partyId,
        guestId: guest.id
      }
    },
    update: {
      suspectCharacterId: validSuspectCharacterId,
      motiveNotes,
      evidenceNotes,
      accusationText
    },
    create: {
      partyId: guest.partyId,
      guestId: guest.id,
      suspectCharacterId: validSuspectCharacterId,
      motiveNotes,
      evidenceNotes,
      accusationText
    }
  });
  await logAuditEvent({
    action: "party.accusation.submitted",
    partyId: guest.partyId,
    entityType: "PartyAccusation",
    entityId: accusation.id,
    metadata: {
      guestId: guest.id,
      suspectCharacterId: validSuspectCharacterId
    }
  });

  return NextResponse.redirect(new URL("/play", request.url), 303);
}
