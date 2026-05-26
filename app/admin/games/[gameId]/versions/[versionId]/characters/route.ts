import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../../../../lib/admin-permissions";
import { createAppUrl } from "../../../../../../lib/app-url";
import { upsertGameCharacter } from "../../../../../../lib/admin-characters";
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

function getCharacterError(reason: string) {
  switch (reason) {
    case "duplicate-key":
      return "duplicate-character";
    case "published-version":
      return "published-version";
    case "required-character":
      return "required-character";
    case "invalid-character":
      return "invalid-character";
    default:
      return "invalid-character";
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
    return redirectToGame(request, gameId, "invalid-character");
  }

  const result = await upsertGameCharacter({
    gameId,
    versionId,
    characterId: getFormValue(formData, "characterId") || undefined,
    key: getFormValue(formData, "key"),
    name: getFormValue(formData, "name"),
    publicBio: getFormValue(formData, "publicBio"),
    privateBio: getFormValue(formData, "privateBio"),
    isRequired: getFormValue(formData, "isRequired") === "on",
    sortOrder: getIntFormValue(formData, "sortOrder")
  });

  if (!result.ok) {
    return redirectToGame(request, gameId, getCharacterError(result.reason));
  }

  await logAuditEvent({
    action: result.action === "created" ? "admin.gameCharacter.created" : "admin.gameCharacter.updated",
    userId: user.id,
    entityType: "GameCharacter",
    entityId: result.characterId,
    metadata: {
      gameId,
      versionId,
      key: result.key,
      previousKey: result.previousKey ?? null
    }
  });

  return redirectToGame(request, gameId);
}
