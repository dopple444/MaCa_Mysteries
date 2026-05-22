import { NextResponse } from "next/server";

import { logAuditEvent } from "../../../lib/audit-log";
import { getCurrentUser } from "../../../lib/auth";
import { verifyCsrfToken } from "../../../lib/csrf";
import { cancelStalePendingOrders, reconcilePaidOrderAccess } from "../../../lib/order-maintenance";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

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

  const operation = getFormValue(formData, "operation");
  if (operation === "cancel-stale-pending") {
    const result = await cancelStalePendingOrders();
    await logAuditEvent({
      action: "payment.orders.stalePendingCancelled",
      userId: user.id,
      entityType: "Order",
      metadata: {
        cancelledCount: result.cancelledCount,
        cutoff: result.cutoff.toISOString(),
        orderIds: result.orderIds
      }
    });
    return NextResponse.redirect(new URL("/admin?orderStatus=CANCELLED", request.url), 303);
  }

  if (operation === "reconcile-paid-access") {
    const result = await reconcilePaidOrderAccess();
    await logAuditEvent({
      action: "payment.orders.paidAccessReconciled",
      userId: user.id,
      entityType: "Order",
      metadata: result
    });
    return NextResponse.redirect(new URL("/admin?orderStatus=PAID", request.url), 303);
  }

  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
