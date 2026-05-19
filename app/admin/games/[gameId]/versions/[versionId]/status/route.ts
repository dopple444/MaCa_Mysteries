import { NextResponse } from "next/server";

import { logAuditEvent } from "../../../../../../lib/audit-log";
import { getCurrentUser } from "../../../../../../lib/auth";
import { verifyCsrfToken } from "../../../../../../lib/csrf";
import { prisma } from "../../../../../../lib/prisma";

const ALLOWED_STATUSES = new Set(["DRAFT", "PUBLISHED"]);

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToGame(request: Request, gameId: string, error?: string) {
  const url = new URL(`/admin/games/${gameId}`, request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; versionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  if (user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  const { gameId, versionId } = await params;
  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToGame(request, gameId);
  }
  const status = getFormValue(formData, "status").toUpperCase();

  if (!ALLOWED_STATUSES.has(status)) {
    return redirectToGame(request, gameId);
  }

  const version = await prisma.gameVersion.findFirst({
    where: {
      id: versionId,
      gameId
    },
    select: {
      id: true,
      status: true,
      finalReveal: {
        select: { id: true }
      },
      _count: {
        select: {
          characters: true,
          rounds: true
        }
      }
    }
  });

  if (!version) {
    return redirectToGame(request, gameId);
  }

  if (status === "PUBLISHED" && (!version.finalReveal || version._count.characters === 0 || version._count.rounds === 0)) {
    return redirectToGame(request, gameId, "incomplete-version");
  }

  await prisma.gameVersion.update({
    where: { id: versionId },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null
    }
  });
  await logAuditEvent({
    action: "admin.gameVersion.statusChanged",
    userId: user.id,
    entityType: "GameVersion",
    entityId: versionId,
    metadata: {
      previousStatus: version.status,
      status
    }
  });

  return redirectToGame(request, gameId);
}
