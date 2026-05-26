import { NextResponse } from "next/server";

import { queueAccountRecoveryPasswordReset } from "../../../../lib/account-recovery";
import { createAppUrl } from "../../../../lib/app-url";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";

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
  const result = await queueAccountRecoveryPasswordReset({ actor, caseId });

  switch (result.status) {
    case "QUEUED":
      return redirectToRecovery(request, { updated: "reset" });
    case "NOT_FOUND":
      return redirectToRecovery(request, { error: "missing-case" });
    case "CLOSED":
      return redirectToRecovery(request, { error: "closed" });
    case "NO_TARGET":
      return redirectToRecovery(request, { error: "no-target" });
    case "NEEDS_VERIFICATION":
      return redirectToRecovery(request, { error: "needs-verification" });
    case "NOT_QUEUED":
      return redirectToRecovery(request, { error: "not-queued" });
    default:
      return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }
}
