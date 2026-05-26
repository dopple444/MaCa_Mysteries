import { NextResponse } from "next/server";

import { createAppUrl } from "../../../../../lib/app-url";
import { getCurrentUser } from "../../../../../lib/auth";
import { revokeManagedUserSessions } from "../../../../../lib/admin-users";
import { verifyCsrfToken } from "../../../../../lib/csrf";

function redirectToUsers(request: Request, params: Record<string, string> = {}) {
  const requestUrl = new URL(request.url);
  const url = createAppUrl("/admin/users", request.url);
  for (const key of ["q", "role"]) {
    const value = requestUrl.searchParams.get(key);
    if (value) url.searchParams.set(key, value);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }

  const { userId } = await params;
  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToUsers(request, { error: "csrf" });
  }

  const result = await revokeManagedUserSessions({
    actor,
    targetUserId: userId
  });

  switch (result.status) {
    case "REVOKED":
      return redirectToUsers(request, { updated: "sessions" });
    case "NOT_FOUND":
      return redirectToUsers(request, { error: "missing-user" });
    default:
      return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }
}
