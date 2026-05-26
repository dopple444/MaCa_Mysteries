import { NextResponse } from "next/server";

import { queueAccountRecoveryRiskAlert } from "../../../lib/account-recovery";
import { hasAdminPermission } from "../../../lib/admin-permissions";
import { createAppUrl } from "../../../lib/app-url";
import { logAuditEvent } from "../../../lib/audit-log";
import { getCurrentUser } from "../../../lib/auth";
import { verifyCsrfToken } from "../../../lib/csrf";

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
  if (!hasAdminPermission(actor, "support")) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToRecovery(request, { error: "csrf" });
  }

  const result = await queueAccountRecoveryRiskAlert();
  await logAuditEvent({
    action: "accountRecovery.riskAlertQueued",
    userId: actor.id,
    entityType: "OutboundMessage",
    metadata: {
      status: result.status,
      queuedCount: result.queuedCount,
      skippedDuplicateCount: result.skippedDuplicateCount,
      recipientCount: result.recipients.length,
      summary: {
        caseCount: result.summary.caseCount,
        activeCaseCount: result.summary.activeCaseCount,
        repeatedEmailCount: result.summary.repeatedEmailCount,
        failedVerificationCount: result.summary.failedVerificationCount,
        windowDays: result.summary.windowDays,
        repeatedEmailThreshold: result.summary.repeatedEmailThreshold,
        failedVerificationThreshold: result.summary.failedVerificationThreshold
      }
    }
  });

  if (result.status === "NOT_CONFIGURED") return redirectToRecovery(request, { error: "alerts-not-configured" });
  if (result.status === "NO_ALERTS") return redirectToRecovery(request, { updated: "risk-alert-none" });
  if (result.status === "DUPLICATE") return redirectToRecovery(request, { updated: "risk-alert-duplicate" });
  return redirectToRecovery(request, { updated: "risk-alert" });
}
