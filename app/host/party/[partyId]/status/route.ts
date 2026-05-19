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
  const action = getFormValue(formData, "action");

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: {
      id: true,
      hostId: true,
      status: true,
      guests: {
        select: {
          status: true
        }
      },
      assignments: {
        select: {
          id: true
        }
      },
      accusations: {
        select: {
          id: true
        }
      },
      evidenceReveals: {
        select: {
          id: true
        }
      },
      finalRevealState: {
        select: {
          finalRevealedAt: true
        }
      }
    }
  });

  if (!party || party.hostId !== user.id) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  if (action === "complete" && party.status !== "COMPLETED" && party.finalRevealState?.finalRevealedAt) {
    const now = new Date();
    const summary = {
      guests: party.guests.length,
      joinedGuests: party.guests.filter((guest) => guest.status === "JOINED").length,
      assignments: party.assignments.length,
      accusations: party.accusations.length,
      evidenceReveals: party.evidenceReveals.length
    };

    await prisma.$transaction([
      prisma.party.update({
        where: { id: partyId },
        data: { status: "COMPLETED" }
      }),
      prisma.partyResult.upsert({
        where: { partyId },
        update: {
          completedByUserId: user.id,
          completedAt: now,
          summary
        },
        create: {
          partyId,
          completedByUserId: user.id,
          completedAt: now,
          summary
        }
      })
    ]);
    await logAuditEvent({
      action: "party.completed",
      userId: user.id,
      partyId,
      entityType: "Party",
      entityId: partyId,
      metadata: summary
    });
  }

  if (action === "reopen" && party.status === "COMPLETED") {
    await prisma.party.update({
      where: { id: partyId },
      data: { status: "ACTIVE" }
    });
    await logAuditEvent({
      action: "party.reopened",
      userId: user.id,
      partyId,
      entityType: "Party",
      entityId: partyId
    });
  }

  return redirectToParty(request, partyId);
}
