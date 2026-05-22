import { NextResponse } from "next/server";

import { upsertGameMedia } from "../../../../../../lib/admin-evidence";
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
  const url = new URL(`/admin/games/${gameId}`, request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

function getMediaError(reason: string) {
  switch (reason) {
    case "duplicate-key":
      return "duplicate-media";
    case "published-version":
      return "published-version";
    case "invalid-linkage":
      return "invalid-media-linkage";
    case "invalid-media":
      return "invalid-media";
    default:
      return "invalid-media";
  }
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
    return redirectToGame(request, gameId, "invalid-media");
  }

  const result = await upsertGameMedia({
    gameId,
    versionId,
    mediaId: getFormValue(formData, "mediaId") || undefined,
    gameRoundId: getFormValue(formData, "gameRoundId") || undefined,
    characterId: getFormValue(formData, "characterId") || undefined,
    evidenceId: getFormValue(formData, "evidenceId") || undefined,
    key: getFormValue(formData, "key"),
    title: getFormValue(formData, "title"),
    description: getFormValue(formData, "description"),
    assetType: getFormValue(formData, "assetType"),
    url: getFormValue(formData, "url"),
    mimeType: getFormValue(formData, "mimeType"),
    visibility: getFormValue(formData, "visibility"),
    sortOrder: getIntFormValue(formData, "sortOrder")
  });

  if (!result.ok) {
    return redirectToGame(request, gameId, getMediaError(result.reason));
  }

  await logAuditEvent({
    action: result.action === "created" ? "admin.gameMedia.created" : "admin.gameMedia.updated",
    userId: user.id,
    entityType: "GameMediaAsset",
    entityId: result.mediaId,
    metadata: {
      gameId,
      versionId,
      key: result.key,
      previousKey: result.previousKey ?? null
    }
  });

  return redirectToGame(request, gameId);
}
