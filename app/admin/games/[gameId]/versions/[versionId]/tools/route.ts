import { NextResponse } from "next/server";

import { upsertGameCharacterTool } from "../../../../../../lib/admin-builder";
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
  const url = new URL(`/admin/games/${gameId}`, request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

function getToolError(reason: string) {
  switch (reason) {
    case "duplicate-key":
      return "duplicate-tool";
    case "published-version":
      return "published-version";
    case "invalid-linkage":
      return "invalid-tool-linkage";
    case "invalid-tool":
      return "invalid-tool";
    default:
      return "invalid-tool";
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
    return redirectToGame(request, gameId, "invalid-tool");
  }

  const config = getJsonObjectFormValue(formData, "config");
  if (!config) {
    return redirectToGame(request, gameId, "invalid-tool");
  }

  const result = await upsertGameCharacterTool({
    gameId,
    versionId,
    toolId: getFormValue(formData, "toolId") || undefined,
    characterId: getFormValue(formData, "characterId") || undefined,
    key: getFormValue(formData, "key"),
    title: getFormValue(formData, "title"),
    description: getFormValue(formData, "description"),
    toolType: getFormValue(formData, "toolType"),
    visibility: getFormValue(formData, "visibility"),
    config,
    sortOrder: getIntFormValue(formData, "sortOrder")
  });

  if (!result.ok) {
    return redirectToGame(request, gameId, getToolError(result.reason));
  }

  await logAuditEvent({
    action: result.action === "created" ? "admin.gameCharacterTool.created" : "admin.gameCharacterTool.updated",
    userId: user.id,
    entityType: "GameCharacterTool",
    entityId: result.toolId,
    metadata: {
      gameId,
      versionId,
      key: result.key,
      previousKey: result.previousKey ?? null
    }
  });

  return redirectToGame(request, gameId);
}
