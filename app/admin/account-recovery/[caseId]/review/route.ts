import { NextResponse } from "next/server";

import { reviewAccountRecoveryCase } from "../../../../lib/account-recovery";
import { createAppUrl } from "../../../../lib/app-url";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";

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

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToRecovery(request, { error: "csrf" });
  }

  const { caseId } = await params;
  const result = await reviewAccountRecoveryCase({
    actor,
    caseId,
    verificationStatus: getFormValue(formData, "verificationStatus"),
    resolutionStatus: getFormValue(formData, "resolutionStatus"),
    note: getFormValue(formData, "note")
  });

  switch (result.status) {
    case "UPDATED":
      return redirectToRecovery(request, {
        updated: result.recoveryCase.status === "CLOSED" || result.recoveryCase.status === "DENIED" ? "closed" : "reviewed"
      });
    case "NOT_FOUND":
      return redirectToRecovery(request, { error: "missing-case" });
    case "INVALID_STATUS":
      return redirectToRecovery(request, { error: "invalid-status" });
    default:
      return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }
}
