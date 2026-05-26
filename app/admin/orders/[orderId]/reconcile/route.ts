import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../../lib/admin-permissions";
import { createAppUrl } from "../../../../lib/app-url";
import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { reconcilePaidOrderAccess } from "../../../../lib/order-maintenance";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }
  if (!hasAdminPermission(user, "payment")) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return NextResponse.redirect(createAppUrl("/admin", request.url), 303);
  }

  const { orderId } = await params;
  const result = await reconcilePaidOrderAccess({ orderId });
  await logAuditEvent({
    action: "payment.order.accessReconciled",
    userId: user.id,
    entityType: "Order",
    entityId: orderId,
    metadata: result
  });

  return NextResponse.redirect(createAppUrl(`/admin/orders/${orderId}`, request.url), 303);
}
