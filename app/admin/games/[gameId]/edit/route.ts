import { NextResponse } from "next/server";

import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { prisma } from "../../../../lib/prisma";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getIntFormValue(formData: FormData, key: string) {
  const value = Number.parseInt(getFormValue(formData, key), 10);
  return Number.isFinite(value) ? value : null;
}

function redirectToGame(request: Request, gameId: string, error?: string) {
  const url = new URL(`/admin/games/${gameId}`, request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  if (user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  const { gameId } = await params;
  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToGame(request, gameId, "invalid-game");
  }
  const title = getFormValue(formData, "title");
  const tagline = getFormValue(formData, "tagline");
  const description = getFormValue(formData, "description");
  const minPlayers = getIntFormValue(formData, "minPlayers");
  const maxPlayers = getIntFormValue(formData, "maxPlayers");
  const durationMin = getIntFormValue(formData, "durationMin");
  const durationMax = getIntFormValue(formData, "durationMax");

  if (
    !title ||
    !tagline ||
    !description ||
    !minPlayers ||
    !maxPlayers ||
    !durationMin ||
    !durationMax ||
    minPlayers < 1 ||
    maxPlayers < minPlayers ||
    durationMin < 1 ||
    durationMax < durationMin
  ) {
    return redirectToGame(request, gameId, "invalid-game");
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, title: true }
  });

  if (!game) {
    return redirectToGame(request, gameId);
  }

  await prisma.game.update({
    where: { id: gameId },
    data: {
      title,
      tagline,
      description,
      minPlayers,
      maxPlayers,
      durationMin,
      durationMax
    }
  });
  await logAuditEvent({
    action: "admin.game.updated",
    userId: user.id,
    entityType: "Game",
    entityId: gameId,
    metadata: {
      previousTitle: game.title,
      title
    }
  });

  return redirectToGame(request, gameId);
}
