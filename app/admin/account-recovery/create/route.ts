import { NextResponse } from "next/server";

import { createAccountRecoveryCase } from "../../../lib/account-recovery";
import { createAppUrl } from "../../../lib/app-url";
import { getCurrentUser } from "../../../lib/auth";
import { verifyCsrfToken } from "../../../lib/csrf";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToRecovery(request: Request, params: Record<string, string> = {}) {
  const url = createAppUrl("/admin/account-recovery", request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToRecovery(request, { error: "csrf" });
  }

  const result = await createAccountRecoveryCase({
    actor,
    email: getFormValue(formData, "email"),
    supportTicketId: getFormValue(formData, "supportTicketId"),
    requestType: getFormValue(formData, "requestType"),
    notes: getFormValue(formData, "notes")
  });

  switch (result.status) {
    case "CREATED":
      return redirectToRecovery(request, { updated: "created" });
    case "EXISTS":
      return redirectToRecovery(request, { updated: "exists" });
    case "INVALID_EMAIL":
      return redirectToRecovery(request, { error: "invalid-email" });
    case "MISSING_TICKET":
      return redirectToRecovery(request, { error: "missing-ticket" });
    case "EMAIL_TICKET_MISMATCH":
      return redirectToRecovery(request, { error: "ticket-email-mismatch" });
    default:
      return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }
}
