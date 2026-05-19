import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { fulfillPaidOrder } from "../../../../lib/game-access";
import { markPaymentWebhookEventProcessed, recordPaymentWebhookEvent } from "../../../../lib/payment-webhooks";
import { prisma } from "../../../../lib/prisma";
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
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
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
    return NextResponse.json({ error: "Incomplete Stripe webhook event." }, { status: 400 });
  }

  if (recorded.duplicate) {
    return NextResponse.json({ received: true, duplicate: true });
  }

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
      await fulfillPaidOrder(orderId);
    }
  }

  await markPaymentWebhookEventProcessed(recorded.event.id);

  return NextResponse.json({ received: true });
}
