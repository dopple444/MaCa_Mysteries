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
  const action = getFormValue(formData, "action");

  if (!partyId || !action) {
    return NextResponse.redirect(createAppUrl("/host?error=missing", request.url), 303);
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: {
      id: true,
      hostId: true,
      status: true,
      gameVersionId: true,
      roundStates: {
        select: {
          status: true,
          gameRound: {
            select: {
              sortOrder: true
            }
          }
        }
      },
      finalRevealState: {
        select: {
          id: true,
          victimRevealedAt: true,
          finalRevealedAt: true
        }
      }
    }
  });

  if (!party || party.hostId !== user.id) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }
  if (party.status === "COMPLETED") {
    return redirectToParty(request, partyId);
  }

  let finalRevealState = party.finalRevealState;
  if (!finalRevealState && party.gameVersionId) {
    const finalReveal = await prisma.gameFinalReveal.findUnique({
      where: { gameVersionId: party.gameVersionId },
      select: { id: true }
    });

    if (finalReveal) {
      finalRevealState = await prisma.partyFinalRevealState.create({
        data: {
          partyId,
          finalRevealId: finalReveal.id
        },
        select: {
          id: true,
          victimRevealedAt: true,
          finalRevealedAt: true
        }
      });
    }
  }

  if (!finalRevealState) {
    return redirectToParty(request, partyId);
  }

  const now = new Date();
  const roundTwoStarted = party.roundStates.some(
    (state) => state.gameRound.sortOrder >= 2 && ["ACTIVE", "COMPLETED"].includes(state.status)
  );
  const roundThreeStarted = party.roundStates.some(
    (state) => state.gameRound.sortOrder >= 3 && ["ACTIVE", "COMPLETED"].includes(state.status)
  );

  if (action === "reveal-victim" && roundTwoStarted) {
    await prisma.partyFinalRevealState.update({
      where: { id: finalRevealState.id },
      data: {
        victimRevealedAt: finalRevealState.victimRevealedAt ?? now,
        revealedByUserId: user.id
      }
    });
    await logAuditEvent({
      action: "party.finalReveal.victimRevealed",
      userId: user.id,
      partyId,
      entityType: "PartyFinalRevealState",
      entityId: finalRevealState.id
    });
  }

  if (action === "hide-victim") {
    await prisma.partyFinalRevealState.update({
      where: { id: finalRevealState.id },
      data: {
        victimRevealedAt: null,
        finalRevealedAt: null,
        revealedByUserId: user.id
      }
    });
    await logAuditEvent({
      action: "party.finalReveal.victimHidden",
      userId: user.id,
      partyId,
      entityType: "PartyFinalRevealState",
      entityId: finalRevealState.id
    });
  }

  if (action === "reveal-final" && roundThreeStarted) {
    await prisma.partyFinalRevealState.update({
      where: { id: finalRevealState.id },
      data: {
        victimRevealedAt: finalRevealState.victimRevealedAt ?? now,
        finalRevealedAt: finalRevealState.finalRevealedAt ?? now,
        revealedByUserId: user.id
      }
    });
    await logAuditEvent({
      action: "party.finalReveal.solutionRevealed",
      userId: user.id,
      partyId,
      entityType: "PartyFinalRevealState",
      entityId: finalRevealState.id
    });
  }

  if (action === "hide-final") {
    await prisma.partyFinalRevealState.update({
      where: { id: finalRevealState.id },
      data: {
        finalRevealedAt: null,
        revealedByUserId: user.id
      }
    });
    await logAuditEvent({
      action: "party.finalReveal.solutionHidden",
      userId: user.id,
      partyId,
      entityType: "PartyFinalRevealState",
      entityId: finalRevealState.id
    });
  }

  return redirectToParty(request, partyId);
}
