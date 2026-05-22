import assert from "node:assert/strict";
import test from "node:test";

import { POST as handleStripeWebhook } from "../app/api/webhooks/payments/stripe/route";
import { createPaymentCheckoutSession, createPendingOrderForProduct, getPaymentProvider } from "../app/lib/payments";
import { createStripeTestSignature } from "../app/lib/stripe";
import { deleteCommerceFixture, prisma, uniqueTestLabel } from "./helpers/test-data";

async function createPaymentFixture() {
  const label = uniqueTestLabel("payment");
  const slug = label;
  const emailDomain = `@${label}.example`;

  await deleteCommerceFixture(slug, emailDomain);

  const user = await prisma.user.create({
    data: {
      email: `buyer${emailDomain}`,
      name: "Payment Test Buyer"
    }
  });
  const game = await prisma.game.create({
    data: {
      slug,
      title: "Payment Test Game",
      tagline: "A paid test game",
      description: "A game for payment flow testing.",
      minPlayers: 6,
      maxPlayers: 10,
      durationMin: 120,
      durationMax: 180,
      status: "PUBLISHED"
    }
  });
  const product = await prisma.product.create({
    data: {
      gameId: game.id,
      slug: `${slug}-access`,
      name: "Payment Test Access",
      priceCents: 4900,
      currency: "USD",
      status: "ACTIVE"
    }
  });

  return { label, slug, emailDomain, user, product };
}

test("getPaymentProvider normalizes configured provider names", () => {
  assert.equal(getPaymentProvider({ PAYMENT_PROVIDER: " Stripe " }), "stripe");
  assert.equal(getPaymentProvider({ PAYMENT_PROVIDER: "" }), null);
});

test("createPendingOrderForProduct creates a pending order with line item", async () => {
  const fixture = await createPaymentFixture();

  try {
    const checkout = await createPendingOrderForProduct({
      productId: fixture.product.id,
      userId: fixture.user.id,
      email: fixture.user.email
    });

    assert.ok(checkout);
    assert.equal(checkout.order.status, "PENDING");
    assert.equal(checkout.order.totalCents, 4900);
    assert.equal(checkout.order.items.length, 1);
    assert.equal(checkout.order.items[0].productId, fixture.product.id);
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("createPaymentCheckoutSession creates a Stripe checkout session when configured", async () => {
  const fixture = await createPaymentFixture();

  try {
    const checkout = await createPendingOrderForProduct({
      productId: fixture.product.id,
      userId: fixture.user.id,
      email: fixture.user.email
    });
    assert.ok(checkout);

    let body: URLSearchParams | null = null;
    const result = await createPaymentCheckoutSession({
      order: checkout.order,
      product: checkout.product,
      requestUrl: "https://maca.example/games/test",
      env: {
        PAYMENT_PROVIDER: "stripe",
        STRIPE_SECRET_KEY: "sk_test_123",
        APP_URL: "https://maca.example"
      },
      fetcher: async (_url, init) => {
        body = init.body;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "cs_test_123", url: "https://checkout.stripe.test/session" }),
          text: async () => ""
        };
      }
    });

    assert.equal(result.status, "REDIRECT");
    assert.equal(result.orderId, checkout.order.id);
    const checkoutBody = body as URLSearchParams | null;
    assert.ok(checkoutBody);
    assert.equal(checkoutBody.get("client_reference_id"), checkout.order.id);
    assert.equal(checkoutBody.get("metadata[orderId]"), checkout.order.id);
    assert.equal(checkoutBody.get("line_items[0][price_data][unit_amount]"), "4900");
    assert.equal(
      checkoutBody.get("success_url"),
      `https://maca.example/host/create?game=${fixture.slug}&checkout=success`
    );
    assert.equal(checkoutBody.get("cancel_url"), `https://maca.example/games/${fixture.slug}?checkout=cancelled`);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.order.id } });
    assert.equal(order.paymentProvider, "stripe");
    assert.equal(order.paymentReference, "cs_test_123");
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("createPaymentCheckoutSession marks checkout failures on the order", async () => {
  const fixture = await createPaymentFixture();

  try {
    const checkout = await createPendingOrderForProduct({
      productId: fixture.product.id,
      userId: fixture.user.id,
      email: fixture.user.email
    });
    assert.ok(checkout);

    const result = await createPaymentCheckoutSession({
      order: checkout.order,
      product: checkout.product,
      requestUrl: "https://maca.example/games/test",
      env: {
        PAYMENT_PROVIDER: "stripe",
        STRIPE_SECRET_KEY: "sk_test_123",
        APP_URL: "https://maca.example"
      },
      fetcher: async () => ({
        ok: false,
        status: 400,
        json: async () => ({}),
        text: async () => "checkout failed"
      })
    });

    assert.equal(result.status, "FAILED");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.order.id } });
    assert.equal(order.status, "FAILED");
    assert.equal(order.paymentProvider, "stripe");
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("Stripe checkout.completed webhook marks orders paid and grants access", async () => {
  const fixture = await createPaymentFixture();
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const webhookSecret = "whsec_route_test";
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

  try {
    const checkout = await createPendingOrderForProduct({
      productId: fixture.product.id,
      userId: fixture.user.id,
      email: fixture.user.email
    });
    assert.ok(checkout);

    const payload = {
      id: `evt_${fixture.label}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_route_test",
          client_reference_id: checkout.order.id,
          payment_intent: "pi_route_test",
          payment_status: "paid",
          status: "complete",
          metadata: {
            orderId: checkout.order.id
          }
        }
      }
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createStripeTestSignature(rawBody, webhookSecret, timestamp);
    const request = new Request("https://maca.example/api/webhooks/payments/stripe", {
      method: "POST",
      headers: {
        "stripe-signature": signature
      },
      body: rawBody
    });

    const response = await handleStripeWebhook(request);
    assert.equal(response.status, 200);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.order.id } });
    assert.equal(order.status, "PAID");
    assert.equal(order.paymentProvider, "stripe");
    assert.equal(order.paymentReference, "pi_route_test");

    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameId: {
          userId: fixture.user.id,
          gameId: checkout.product.gameId
        }
      }
    });
    assert.equal(access?.status, "ACTIVE");

    const duplicateResponse = await handleStripeWebhook(
      new Request("https://maca.example/api/webhooks/payments/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": signature
        },
        body: rawBody
      })
    );
    assert.equal(duplicateResponse.status, 200);
    const duplicateBody = await duplicateResponse.json();
    assert.equal(duplicateBody.duplicate, true);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
    }
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});
