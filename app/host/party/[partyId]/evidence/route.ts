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
  const evidenceId = getFormValue(formData, "evidenceId");
  const action = getFormValue(formData, "action");

  if (!partyId || !evidenceId || !action) {
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
          gameRoundId: true,
          status: true
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

  const evidence = await prisma.gameEvidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      gameVersionId: true,
      gameRoundId: true
    }
  });

  if (!evidence || evidence.gameVersionId !== party.gameVersionId) {
    return redirectToParty(request, partyId);
  }

  if (action === "hide") {
    await prisma.partyEvidenceReveal.deleteMany({
      where: {
        partyId,
        evidenceId
      }
    });
    await logAuditEvent({
      action: "party.evidence.hidden",
      userId: user.id,
      partyId,
      entityType: "GameEvidence",
      entityId: evidenceId
    });
    return redirectToParty(request, partyId);
  }

  if (action === "reveal") {
    const roundState = evidence.gameRoundId
      ? party.roundStates.find((state) => state.gameRoundId === evidence.gameRoundId)
      : null;
    const canReveal = !roundState || ["UNLOCKED", "ACTIVE", "COMPLETED"].includes(roundState.status);

    if (canReveal) {
      await prisma.partyEvidenceReveal.upsert({
        where: {
          partyId_evidenceId: {
            partyId,
            evidenceId
          }
        },
        update: {
          revealedByUserId: user.id,
          revealedAt: new Date()
        },
        create: {
          partyId,
          evidenceId,
          revealedByUserId: user.id
        }
      });
      await logAuditEvent({
        action: "party.evidence.revealed",
        userId: user.id,
        partyId,
        entityType: "GameEvidence",
        entityId: evidenceId
      });
    }
  }

  return redirectToParty(request, partyId);
}
