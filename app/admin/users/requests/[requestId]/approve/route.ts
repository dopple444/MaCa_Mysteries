import { NextResponse } from "next/server";

import { createAppUrl } from "../../../../../lib/app-url";
import { getCurrentUser } from "../../../../../lib/auth";
import { approveAdminActionRequest } from "../../../../../lib/admin-users";
import { verifyCsrfToken } from "../../../../../lib/csrf";

function redirectToUsers(request: Request, params: Record<string, string> = {}) {
  const url = createAppUrl("/admin/users", request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToUsers(request, { error: "csrf" });
  }

  const { requestId } = await params;
  const result = await approveAdminActionRequest({
    actor,
    requestId
  });

  switch (result.status) {
    case "APPROVED":
      return redirectToUsers(request, { updated: "request-approved" });
    case "LAST_SUPER_ADMIN":
      return redirectToUsers(request, { error: "last-super-admin" });
    case "NOT_FOUND":
      return redirectToUsers(request, { error: "missing-request" });
    case "NOT_PENDING":
      return redirectToUsers(request, { error: "request-not-pending" });
    case "INVALID_ROLE":
      return redirectToUsers(request, { error: "invalid-role" });
    default:
      return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }
}
