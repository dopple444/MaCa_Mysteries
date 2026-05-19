import assert from "node:assert/strict";
import test from "node:test";

import { createStripeTestSignature, verifyStripeWebhookSignature } from "../app/lib/stripe";

test("verifyStripeWebhookSignature accepts a valid current signature", () => {
  const rawBody = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
  const secret = "whsec_test";
  const timestamp = 1_800_000_000;
  const header = createStripeTestSignature(rawBody, secret, timestamp);

  assert.equal(
    verifyStripeWebhookSignature(rawBody, header, secret, {
      nowSeconds: timestamp
    }),
    true
  );
});

test("verifyStripeWebhookSignature rejects stale or mismatched signatures", () => {
  const rawBody = JSON.stringify({ id: "evt_test" });
  const secret = "whsec_test";
  const timestamp = 1_800_000_000;
  const header = createStripeTestSignature(rawBody, secret, timestamp);

  assert.equal(
    verifyStripeWebhookSignature(rawBody, header, "wrong-secret", {
      nowSeconds: timestamp
    }),
    false
  );
  assert.equal(
    verifyStripeWebhookSignature(rawBody, header, secret, {
      nowSeconds: timestamp + 10_000
    }),
    false
  );
});
