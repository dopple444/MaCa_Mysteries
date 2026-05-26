import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../lib/admin-permissions";
import { createAppUrl } from "../../../lib/app-url";
import { logAuditEvent } from "../../../lib/audit-log";
import { getCurrentUser } from "../../../lib/auth";
import { queueConditionalUnlockAlert } from "../../../lib/conditional-activity";
import { verifyCsrfToken } from "../../../lib/csrf";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }
  if (!hasAdminPermission(user, "content") || !hasAdminPermission(user, "payment")) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return NextResponse.redirect(createAppUrl("/admin", request.url), 303);
  }

  const result = await queueConditionalUnlockAlert();
  await logAuditEvent({
    action: "conditional.unlocks.alertQueued",
    userId: user.id,
    entityType: "OutboundMessage",
    metadata: {
      status: result.status,
      queuedCount: result.queuedCount,
      skippedDuplicateCount: result.skippedDuplicateCount,
      recipientCount: result.recipients.length,
      summary: {
        failedCodeAttemptCount: result.summary.failedCodeAttemptCount,
        affectedPartyCount: result.summary.affectedPartyCount,
        affectedPlayerCount: result.summary.affectedPlayerCount,
        windowMinutes: result.summary.windowMinutes,
        threshold: result.summary.threshold
      }
    }
  });

  return NextResponse.redirect(createAppUrl("/admin?messageChannel=EMAIL&messageStatus=PENDING", request.url), 303);
}
