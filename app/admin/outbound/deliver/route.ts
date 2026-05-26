import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../lib/admin-permissions";
import { createAppUrl } from "../../../lib/app-url";
import { logAuditEvent } from "../../../lib/audit-log";
import { getCurrentUser } from "../../../lib/auth";
import { verifyCsrfToken } from "../../../lib/csrf";
import { sendPendingEmailMessages } from "../../../lib/outbound-delivery";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }
  if (!hasAdminPermission(user, "outbound")) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return NextResponse.redirect(createAppUrl("/admin", request.url), 303);
  }

  const result = await sendPendingEmailMessages();
  await logAuditEvent({
    action: "outbound.email.deliveryRun",
    userId: user.id,
    entityType: "OutboundMessage",
    metadata: result
  });

  return NextResponse.redirect(createAppUrl("/admin?messageChannel=EMAIL&messageStatus=PENDING", request.url), 303);
}
