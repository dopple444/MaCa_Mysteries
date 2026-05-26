import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../../../../lib/admin-permissions";
import { createAppUrl } from "../../../../../../lib/app-url";
import { upsertGameUnlockRule } from "../../../../../../lib/admin-builder";
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

function getTargetRef(formData: FormData) {
  const targetRef = getFormValue(formData, "targetRef");
  const separatorIndex = targetRef.indexOf(":");
  if (separatorIndex > 0) {
    return {
      targetType: targetRef.slice(0, separatorIndex),
      targetId: targetRef.slice(separatorIndex + 1)
    };
  }

  return {
    targetType: getFormValue(formData, "targetType"),
    targetId: getFormValue(formData, "targetId")
  };
}

function redirectToGame(request: Request, gameId: string, error?: string) {
  const url = createAppUrl(`/admin/games/${gameId}`, request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

function getUnlockRuleError(reason: string) {
  switch (reason) {
    case "duplicate-key":
      return "duplicate-unlock-rule";
    case "published-version":
      return "published-version";
    case "invalid-linkage":
      return "invalid-unlock-rule-linkage";
    case "invalid-rule":
      return "invalid-unlock-rule";
    default:
      return "invalid-unlock-rule";
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
    return redirectToGame(request, gameId, "invalid-unlock-rule");
  }

  const config = getJsonObjectFormValue(formData, "config");
  const effect = getJsonObjectFormValue(formData, "effect");
  if (!config || !effect) {
    return redirectToGame(request, gameId, "invalid-unlock-rule");
  }

  const target = getTargetRef(formData);
  const result = await upsertGameUnlockRule({
    gameId,
    versionId,
    unlockRuleId: getFormValue(formData, "unlockRuleId") || undefined,
    requiredRoundId: getFormValue(formData, "requiredRoundId") || undefined,
    requiredCharacterId: getFormValue(formData, "requiredCharacterId") || undefined,
    sourceToolId: getFormValue(formData, "sourceToolId") || undefined,
    key: getFormValue(formData, "key"),
    title: getFormValue(formData, "title"),
    description: getFormValue(formData, "description"),
    ruleType: getFormValue(formData, "ruleType"),
    triggerType: getFormValue(formData, "triggerType"),
    targetType: target.targetType,
    targetId: target.targetId,
    unlockScope: getFormValue(formData, "unlockScope"),
    codeMode: getFormValue(formData, "codeMode"),
    config,
    effect,
    status: getFormValue(formData, "status"),
    sortOrder: getIntFormValue(formData, "sortOrder")
  });

  if (!result.ok) {
    return redirectToGame(request, gameId, getUnlockRuleError(result.reason));
  }

  await logAuditEvent({
    action: result.action === "created" ? "admin.gameUnlockRule.created" : "admin.gameUnlockRule.updated",
    userId: user.id,
    entityType: "GameUnlockRule",
    entityId: result.unlockRuleId,
    metadata: {
      gameId,
      versionId,
      key: result.key,
      previousKey: result.previousKey ?? null
    }
  });

  return redirectToGame(request, gameId);
}
