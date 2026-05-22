import { NextResponse } from "next/server";

import { logAuditEvent } from "../../../lib/audit-log";
import { getCurrentUser } from "../../../lib/auth";
import { verifyCsrfToken } from "../../../lib/csrf";
import { sendPendingEmailMessages } from "../../../lib/outbound-delivery";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  if (user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }

  const result = await sendPendingEmailMessages();
  await logAuditEvent({
    action: "outbound.email.deliveryRun",
    userId: user.id,
    entityType: "OutboundMessage",
    metadata: result
  });

  return NextResponse.redirect(new URL("/admin?messageChannel=EMAIL&messageStatus=PENDING", request.url), 303);
}
