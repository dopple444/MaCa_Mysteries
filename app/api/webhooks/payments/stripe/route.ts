import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { fulfillPaidOrder } from "../../../../lib/game-access";
import {
  markPaymentWebhookEventFailed,
  markPaymentWebhookEventProcessed,
  recordPaymentWebhookEvent
} from "../../../../lib/payment-webhooks";
import { prisma } from "../../../../lib/prisma";
import { logPaymentEvent } from "../../../../lib/server-logging";
import { verifyStripeWebhookSignature } from "../../../../lib/stripe";

export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getCheckoutSession(payload: unknown) {
  const event = asRecord(payload);
  return asRecord(asRecord(event.data).object);
}

function getOrderId(session: Record<string, unknown>) {
  return getString(session.client_reference_id) || getString(asRecord(session.metadata).orderId);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

  if (!verifyStripeWebhookSignature(rawBody, signature, webhookSecret)) {
    logPaymentEvent("warn", "stripe.webhook.invalid_signature");
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logPaymentEvent("warn", "stripe.webhook.invalid_json");
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const event = asRecord(payload);
  const eventId = getString(event.id);
  const eventType = getString(event.type);
  const session = getCheckoutSession(payload);
  const orderId = getOrderId(session);

  const recorded = await recordPaymentWebhookEvent({
    provider: "stripe",
    eventId,
    eventType,
    orderId: orderId || null,
    payload: payload as Prisma.InputJsonValue
  });

  if (!recorded.event) {
    logPaymentEvent("warn", "stripe.webhook.incomplete_event", { eventId, eventType, orderId });
    return NextResponse.json({ error: "Incomplete Stripe webhook event." }, { status: 400 });
  }

  if (recorded.duplicate) {
    logPaymentEvent("info", "stripe.webhook.duplicate", { eventId, eventType, orderId });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (eventType === "checkout.session.completed" && orderId) {
      const paymentStatus = getString(session.payment_status);
      const checkoutStatus = getString(session.status);
      const paymentReference = getString(session.payment_intent) || getString(session.id);

      if (paymentStatus === "paid" || checkoutStatus === "complete") {
        await prisma.order.updateMany({
          where: { id: orderId },
          data: {
            status: "PAID",
            paymentProvider: "stripe",
            paymentReference
          }
        });
        const fulfillment = await fulfillPaidOrder(orderId);
        logPaymentEvent("info", "stripe.webhook.checkout_completed", {
          eventId,
          orderId,
          grantedAccessCount: fulfillment.grantedAccessCount
        });
      }
    }

    await markPaymentWebhookEventProcessed(recorded.event.id);
  } catch (error) {
    await markPaymentWebhookEventFailed(recorded.event.id);
    logPaymentEvent("error", "stripe.webhook.processing_failed", {
      eventId,
      eventType,
      orderId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Stripe webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
