import { NextResponse } from "next/server";

import { upsertGameEvidence } from "../../../../../../lib/admin-evidence";
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

function getEvidenceError(reason: string) {
  switch (reason) {
    case "duplicate-key":
      return "duplicate-evidence";
    case "published-version":
      return "published-version";
    case "invalid-linkage":
      return "invalid-evidence-linkage";
    case "invalid-evidence":
      return "invalid-evidence";
    default:
      return "invalid-evidence";
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
    return redirectToGame(request, gameId, "invalid-evidence");
  }

  const result = await upsertGameEvidence({
    gameId,
    versionId,
    evidenceId: getFormValue(formData, "evidenceId") || undefined,
    gameRoundId: getFormValue(formData, "gameRoundId") || undefined,
    characterId: getFormValue(formData, "characterId") || undefined,
    key: getFormValue(formData, "key"),
    title: getFormValue(formData, "title"),
    body: getFormValue(formData, "body"),
    evidenceType: getFormValue(formData, "evidenceType"),
    visibility: getFormValue(formData, "visibility"),
    sortOrder: getIntFormValue(formData, "sortOrder")
  });

  if (!result.ok) {
    return redirectToGame(request, gameId, getEvidenceError(result.reason));
  }

  await logAuditEvent({
    action: result.action === "created" ? "admin.gameEvidence.created" : "admin.gameEvidence.updated",
    userId: user.id,
    entityType: "GameEvidence",
    entityId: result.evidenceId,
    metadata: {
      gameId,
      versionId,
      key: result.key,
      previousKey: result.previousKey ?? null
    }
  });

  return redirectToGame(request, gameId);
}
