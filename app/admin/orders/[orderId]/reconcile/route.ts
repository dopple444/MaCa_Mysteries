import { NextResponse } from "next/server";

import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { reconcilePaidOrderAccess } from "../../../../lib/order-maintenance";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
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

  const { orderId } = await params;
  const result = await reconcilePaidOrderAccess({ orderId });
  await logAuditEvent({
    action: "payment.order.accessReconciled",
    userId: user.id,
    entityType: "Order",
    entityId: orderId,
    metadata: result
  });

  return NextResponse.redirect(new URL(`/admin/orders/${orderId}`, request.url), 303);
}
