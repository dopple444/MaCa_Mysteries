import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { markPaymentWebhookEventProcessed, recordPaymentWebhookEvent } from "../app/lib/payment-webhooks";

const prisma = new PrismaClient();

test("recordPaymentWebhookEvent stores provider events idempotently", async () => {
  const provider = `test-provider-${crypto.randomBytes(6).toString("hex")}`;
  const eventId = `evt_${crypto.randomBytes(6).toString("hex")}`;

  try {
    const first = await recordPaymentWebhookEvent({
      provider,
      eventId,
      eventType: "checkout.session.completed",
      payload: { ok: true }
    });
    assert.equal(first.duplicate, false);
    assert.ok(first.event);
    assert.equal(first.event.provider, provider);
    assert.equal(first.event.status, "RECEIVED");

    const second = await recordPaymentWebhookEvent({
      provider,
      eventId,
      eventType: "checkout.session.completed"
    });
    assert.equal(second.duplicate, true);
    assert.equal(second.event?.id, first.event.id);

    const processed = await markPaymentWebhookEventProcessed(first.event.id);
    assert.equal(processed.status, "PROCESSED");
    assert.ok(processed.processedAt);
  } finally {
    await prisma.paymentWebhookEvent.deleteMany({ where: { provider } });
  }
});

test("recordPaymentWebhookEvent rejects incomplete provider events", async () => {
  const result = await recordPaymentWebhookEvent({
    provider: "",
    eventId: "",
    eventType: ""
  });

  assert.deepEqual(result, { event: null, duplicate: false });
});
