import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../../../../lib/admin-permissions";
import { createAppUrl } from "../../../../../../lib/app-url";
import { upsertGameRound } from "../../../../../../lib/admin-rounds";
import { logAuditEvent } from "../../../../../../lib/audit-log";
import { getCurrentUser } from "../../../../../../lib/auth";
import { verifyCsrfToken } from "../../../../../../lib/csrf";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getIntFormValue(formData: FormData, key: string) {
  const value = Number.parseInt(getFormValue(formData, key), 10);
  return Number.isFinite(value) ? value : Number.NaN;
}

function redirectToGame(request: Request, gameId: string, error?: string) {
  const url = createAppUrl(`/admin/games/${gameId}`, request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

function getRoundError(reason: string) {
  switch (reason) {
    case "duplicate-key":
      return "duplicate-round";
    case "published-version":
      return "published-version";
    case "invalid-round":
      return "invalid-round";
    default:
      return "invalid-round";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; versionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }
  if (!hasAdminPermission(user, "content")) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }

  const { gameId, versionId } = await params;
  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToGame(request, gameId, "invalid-round");
  }

  const result = await upsertGameRound({
    gameId,
    versionId,
    roundId: getFormValue(formData, "roundId") || undefined,
    key: getFormValue(formData, "key"),
    title: getFormValue(formData, "title"),
    summary: getFormValue(formData, "summary"),
    sortOrder: getIntFormValue(formData, "sortOrder")
  });

  if (!result.ok) {
    return redirectToGame(request, gameId, getRoundError(result.reason));
  }

  await logAuditEvent({
    action: result.action === "created" ? "admin.gameRound.created" : "admin.gameRound.updated",
    userId: user.id,
    entityType: "GameRound",
    entityId: result.roundId,
    metadata: {
      gameId,
      versionId,
      key: result.key,
      previousKey: result.previousKey ?? null
    }
  });

  return redirectToGame(request, gameId);
}
