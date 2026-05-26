import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../../lib/admin-permissions";
import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { validateGamePackage } from "../../../../lib/game-package";

const MAX_PACKAGE_BYTES = 512 * 1024;

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getFormTextValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getPackageJsonText(formData: FormData) {
  const pastedJson = getFormTextValue(formData, "packageJson");
  if (pastedJson) return { ok: true as const, text: pastedJson };

  const file = formData.get("packageFile");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Choose a package file or paste package JSON." };
  }
  if (file.size > MAX_PACKAGE_BYTES) {
    return { ok: false as const, error: "Game Package files must be 512 KB or smaller." };
  }

  return { ok: true as const, text: await file.text() };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse("Authentication is required.", 401);
  }
  if (!hasAdminPermission(user, "content")) {
    return errorResponse("Content admin access is required.", 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Submit a multipart or form-encoded Game Package request.");
  }

  if (!(await verifyCsrfToken(formData))) {
    return errorResponse("Your request could not be verified.", 400);
  }

  const packageText = await getPackageJsonText(formData);
  if (!packageText.ok) {
    return errorResponse(packageText.error);
  }
  if (Buffer.byteLength(packageText.text, "utf8") > MAX_PACKAGE_BYTES) {
    return errorResponse("Game Package JSON must be 512 KB or smaller.");
  }

  let parsedPackage: unknown;
  try {
    parsedPackage = JSON.parse(packageText.text);
  } catch {
    await logAuditEvent({
      action: "admin.gamePackage.validated",
      userId: user.id,
      entityType: "GamePackage",
      entityId: "dry-run",
      metadata: {
        valid: false,
        reason: "invalid-json"
      }
    });
    return errorResponse("Game Package JSON could not be parsed.");
  }

  const result = validateGamePackage(parsedPackage);

  await logAuditEvent({
    action: "admin.gamePackage.validated",
    userId: user.id,
    entityType: "GamePackage",
    entityId: "dry-run",
    metadata: {
      valid: result.ok,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      summary: result.summary
    }
  });

  return NextResponse.json({ ok: true, result });
}
