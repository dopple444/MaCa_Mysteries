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
  const roundStateId = getFormValue(formData, "roundStateId");
  const action = getFormValue(formData, "action");

  if (!roundStateId || !action) {
    return NextResponse.redirect(createAppUrl("/host?error=missing", request.url), 303);
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { id: true, hostId: true, status: true }
  });

  if (!party || party.hostId !== user.id) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }
  if (party.status === "COMPLETED") {
    return redirectToParty(request, partyId);
  }

  const roundState = await prisma.partyRoundState.findUnique({
    where: { id: roundStateId },
    select: { id: true, partyId: true, status: true }
  });

  if (!roundState || roundState.partyId !== partyId) {
    return redirectToParty(request, partyId);
  }

  const now = new Date();

  if (action === "unlock" && roundState.status === "LOCKED") {
    await prisma.partyRoundState.update({
      where: { id: roundStateId },
      data: {
        status: "UNLOCKED",
        unlockedAt: now
      }
    });
    await logAuditEvent({
      action: "party.round.unlocked",
      userId: user.id,
      partyId,
      entityType: "PartyRoundState",
      entityId: roundStateId
    });
  }

  if (action === "start" && ["LOCKED", "UNLOCKED", "COMPLETED"].includes(roundState.status)) {
    await prisma.$transaction([
      prisma.partyRoundState.updateMany({
        where: {
          partyId,
          status: "ACTIVE",
          id: { not: roundStateId }
        },
        data: {
          status: "COMPLETED",
          completedAt: now
        }
      }),
      prisma.partyRoundState.update({
        where: { id: roundStateId },
        data: {
          status: "ACTIVE",
          unlockedAt: now,
          completedAt: null
        }
      })
    ]);
    await logAuditEvent({
      action: "party.round.started",
      userId: user.id,
      partyId,
      entityType: "PartyRoundState",
      entityId: roundStateId
    });
  }

  if (action === "complete" && roundState.status === "ACTIVE") {
    await prisma.partyRoundState.update({
      where: { id: roundStateId },
      data: {
        status: "COMPLETED",
        completedAt: now
      }
    });
    await logAuditEvent({
      action: "party.round.completed",
      userId: user.id,
      partyId,
      entityType: "PartyRoundState",
      entityId: roundStateId
    });
  }

  return redirectToParty(request, partyId);
}
