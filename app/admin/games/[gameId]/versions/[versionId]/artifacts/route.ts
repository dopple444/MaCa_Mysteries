import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../../../../lib/admin-permissions";
import { createAppUrl } from "../../../../../../lib/app-url";
import { upsertGameDigitalArtifact } from "../../../../../../lib/admin-builder";
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

function getJsonObjectFormValue(formData: FormData, key: string) {
  const rawValue = getFormValue(formData, key);
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function redirectToGame(request: Request, gameId: string, error?: string) {
  const url = createAppUrl(`/admin/games/${gameId}`, request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

function getArtifactError(reason: string) {
  switch (reason) {
    case "duplicate-key":
      return "duplicate-artifact";
    case "published-version":
      return "published-version";
    case "invalid-linkage":
      return "invalid-artifact-linkage";
    case "invalid-artifact":
      return "invalid-artifact";
    default:
      return "invalid-artifact";
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
    return redirectToGame(request, gameId, "invalid-artifact");
  }

  const content = getJsonObjectFormValue(formData, "content");
  if (!content) {
    return redirectToGame(request, gameId, "invalid-artifact");
  }

  const result = await upsertGameDigitalArtifact({
    gameId,
    versionId,
    artifactId: getFormValue(formData, "artifactId") || undefined,
    gameRoundId: getFormValue(formData, "gameRoundId") || undefined,
    characterId: getFormValue(formData, "characterId") || undefined,
    evidenceId: getFormValue(formData, "evidenceId") || undefined,
    mediaAssetId: getFormValue(formData, "mediaAssetId") || undefined,
    requiredUnlockRuleId: getFormValue(formData, "requiredUnlockRuleId") || undefined,
    key: getFormValue(formData, "key"),
    title: getFormValue(formData, "title"),
    description: getFormValue(formData, "description"),
    artifactType: getFormValue(formData, "artifactType"),
    visibility: getFormValue(formData, "visibility"),
    content,
    sortOrder: getIntFormValue(formData, "sortOrder")
  });

  if (!result.ok) {
    return redirectToGame(request, gameId, getArtifactError(result.reason));
  }

  await logAuditEvent({
    action: result.action === "created" ? "admin.gameDigitalArtifact.created" : "admin.gameDigitalArtifact.updated",
    userId: user.id,
    entityType: "GameDigitalArtifact",
    entityId: result.artifactId,
    metadata: {
      gameId,
      versionId,
      key: result.key,
      previousKey: result.previousKey ?? null
    }
  });

  return redirectToGame(request, gameId);
}
