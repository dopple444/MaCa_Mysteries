import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../lib/admin-permissions";
import { createAppUrl } from "../../../lib/app-url";
import { logAuditEvent } from "../../../lib/audit-log";
import { getCurrentUser } from "../../../lib/auth";
import { verifyCsrfToken } from "../../../lib/csrf";
import {
  cancelStalePendingOrders,
  queuePaymentOperationsAlert,
  reconcileCompletedStripeCheckoutSessions,
  reconcilePaidOrderAccess
} from "../../../lib/order-maintenance";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
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
    return NextResponse.redirect(createAppUrl("/admin?orderStatus=CANCELLED", request.url), 303);
  }

  if (operation === "reconcile-paid-access") {
    const result = await reconcilePaidOrderAccess();
    await logAuditEvent({
      action: "payment.orders.paidAccessReconciled",
      userId: user.id,
      entityType: "Order",
      metadata: result
    });
    return NextResponse.redirect(createAppUrl("/admin?orderStatus=PAID", request.url), 303);
  }

  if (operation === "reconcile-stripe-checkouts") {
    const result = await reconcileCompletedStripeCheckoutSessions();
    await logAuditEvent({
      action: "payment.orders.stripeCheckoutsReconciled",
      userId: user.id,
      entityType: "Order",
      metadata: {
        ...result,
        cutoff: result.cutoff.toISOString()
      }
    });
    return NextResponse.redirect(createAppUrl(result.paidOrderCount ? "/admin?orderStatus=PAID" : "/admin?orderStatus=PENDING", request.url), 303);
  }

  if (operation === "queue-payment-alert") {
    const result = await queuePaymentOperationsAlert();
    await logAuditEvent({
      action: "payment.operations.alertQueued",
      userId: user.id,
      entityType: "OutboundMessage",
      metadata: {
        status: result.status,
        queuedCount: result.queuedCount,
        skippedDuplicateCount: result.skippedDuplicateCount,
        recipientCount: result.recipients.length,
        summary: {
          failedWebhookEventCount: result.summary.failedWebhookEventCount,
          stalePendingOrderCount: result.summary.stalePendingOrderCount,
          recoverableStripeCheckoutCount: result.summary.recoverableStripeCheckoutCount
        }
      }
    });
    return NextResponse.redirect(createAppUrl("/admin?messageChannel=EMAIL&messageStatus=PENDING", request.url), 303);
  }

  return NextResponse.redirect(createAppUrl("/admin", request.url), 303);
}
