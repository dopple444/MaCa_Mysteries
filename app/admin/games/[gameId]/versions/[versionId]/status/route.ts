import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../../../../lib/admin-permissions";
import { createAppUrl } from "../../../../../../lib/app-url";
import { updateGameVersionStatus } from "../../../../../../lib/admin-version-status";
import { getCurrentUser } from "../../../../../../lib/auth";
import { verifyCsrfToken } from "../../../../../../lib/csrf";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToGame(request: Request, gameId: string, error?: string) {
  const url = createAppUrl(`/admin/games/${gameId}`, request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
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
    return redirectToGame(request, gameId);
  }
  const result = await updateGameVersionStatus({
    gameId,
    versionId,
    userId: user.id,
    status: getFormValue(formData, "status")
  });

  if (!result.ok) {
    return redirectToGame(request, gameId, result.reason === "publish-readiness" ? "publish-readiness" : undefined);
  }

  return redirectToGame(request, gameId);
}
