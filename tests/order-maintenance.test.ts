import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelStalePendingOrders,
  getPaymentOperationsAlertRecipients,
  queuePaymentOperationsAlert,
  reconcileCompletedStripeCheckoutSessions,
  reconcilePaidOrderAccess
} from "../app/lib/order-maintenance";
import { deleteCommerceFixture, prisma, uniqueTestLabel } from "./helpers/test-data";

async function createOrderMaintenanceFixture(prefix: string) {
  const label = uniqueTestLabel(prefix);
  const slug = label;
  const emailDomain = `@${label}.example`;

  await deleteCommerceFixture(slug, emailDomain);

  const user = await prisma.user.create({
    data: {
      email: `buyer${emailDomain}`,
      name: "Order Maintenance Buyer"
    }
  });
  const game = await prisma.game.create({
    data: {
      slug,
      title: "Order Maintenance Game",
      tagline: "Payment operations test",
      description: "A game for order maintenance testing.",
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
      name: "Order Maintenance Access",
      priceCents: 2900,
      currency: "USD",
      status: "ACTIVE"
    }
  });

  return { label, slug, emailDomain, user, game, product };
}

async function createOrder({
  userId,
  email,
  productId,
  status,
  createdAt
}: {
  userId: string;
  email: string;
  productId: string;
  status: string;
  createdAt: Date;
}) {
  return prisma.order.create({
    data: {
      userId,
      email,
      status,
      paymentProvider: "stripe",
      paymentReference: `cs_${status.toLowerCase()}_${createdAt.getTime()}`,
      subtotalCents: 2900,
      totalCents: 2900,
      currency: "USD",
      createdAt,
      items: {
        create: {
          productId,
          quantity: 1,
          unitPriceCents: 2900,
          totalPriceCents: 2900
        }
      }
    }
  });
}

test("cancelStalePendingOrders cancels only pending orders older than the cutoff", async () => {
  const fixture = await createOrderMaintenanceFixture("order-maintenance-stale");
  const now = new Date("2001-05-21T12:00:00.000Z");

  try {
    const stalePending = await createOrder({
      userId: fixture.user.id,
      email: fixture.user.email,
      productId: fixture.product.id,
      status: "PENDING",
      createdAt: new Date("2001-05-21T09:30:00.000Z")
    });
    const freshPending = await createOrder({
      userId: fixture.user.id,
      email: fixture.user.email,
      productId: fixture.product.id,
      status: "PENDING",
      createdAt: new Date("2001-05-21T11:45:00.000Z")
    });
    const paidOrder = await createOrder({
      userId: fixture.user.id,
      email: fixture.user.email,
      productId: fixture.product.id,
      status: "PAID",
      createdAt: new Date("2001-05-21T08:00:00.000Z")
    });

    const result = await cancelStalePendingOrders({ now, olderThanMinutes: 60 });
    assert.equal(result.cancelledCount, 1);
    assert.deepEqual(result.orderIds, [stalePending.id]);

    const statuses = await prisma.order.findMany({
      where: { id: { in: [stalePending.id, freshPending.id, paidOrder.id] } },
      select: { id: true, status: true }
    });
    const statusById = new Map(statuses.map((order) => [order.id, order.status]));
    assert.equal(statusById.get(stalePending.id), "CANCELLED");
    assert.equal(statusById.get(freshPending.id), "PENDING");
    assert.equal(statusById.get(paidOrder.id), "PAID");
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("reconcilePaidOrderAccess repairs missing access for paid orders idempotently", async () => {
  const fixture = await createOrderMaintenanceFixture("order-maintenance-reconcile");

  try {
    const order = await createOrder({
      userId: fixture.user.id,
      email: fixture.user.email,
      productId: fixture.product.id,
      status: "PAID",
      createdAt: new Date()
    });

    const firstResult = await reconcilePaidOrderAccess({ orderId: order.id });
    assert.equal(firstResult.checkedOrderCount, 1);
    assert.equal(firstResult.repairedOrderCount, 1);
    assert.equal(firstResult.accessRecordsTouched, 1);

    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameId: {
          userId: fixture.user.id,
          gameId: fixture.game.id
        }
      }
    });
    assert.equal(access?.status, "ACTIVE");

    const secondResult = await reconcilePaidOrderAccess({ orderId: order.id });
    assert.equal(secondResult.checkedOrderCount, 1);
    assert.equal(secondResult.repairedOrderCount, 0);
    assert.equal(secondResult.accessRecordsTouched, 1);
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("reconcileCompletedStripeCheckoutSessions fulfills completed pending Stripe checkouts", async () => {
  const fixture = await createOrderMaintenanceFixture("order-maintenance-stripe-recovery");
  const now = new Date("2001-05-21T12:00:00.000Z");

  try {
    const paidPending = await createOrder({
      userId: fixture.user.id,
      email: fixture.user.email,
      productId: fixture.product.id,
      status: "PENDING",
      createdAt: new Date("2001-05-21T11:30:00.000Z")
    });
    const openPending = await createOrder({
      userId: fixture.user.id,
      email: fixture.user.email,
      productId: fixture.product.id,
      status: "PENDING",
      createdAt: new Date("2001-05-21T11:25:00.000Z")
    });

    const result = await reconcileCompletedStripeCheckoutSessions({
      now,
      olderThanMinutes: 10,
      env: { STRIPE_SECRET_KEY: "sk_test_recovery" },
      fetcher: async (url) => {
        if (url.endsWith(encodeURIComponent(paidPending.paymentReference))) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: paidPending.paymentReference,
              payment_intent: "pi_recovered_paid",
              payment_status: "paid",
              status: "complete"
            }),
            text: async () => ""
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: openPending.paymentReference,
            payment_status: "unpaid",
            status: "open"
          }),
          text: async () => ""
        };
      }
    });

    assert.equal(result.status, "COMPLETED");
    assert.equal(result.checkedOrderCount, 2);
    assert.equal(result.paidOrderCount, 1);
    assert.deepEqual(result.orderIds, [paidPending.id]);

    const orders = await prisma.order.findMany({
      where: { id: { in: [paidPending.id, openPending.id] } },
      select: { id: true, status: true, paymentReference: true }
    });
    const orderById = new Map(orders.map((order) => [order.id, order]));
    assert.equal(orderById.get(paidPending.id)?.status, "PAID");
    assert.equal(orderById.get(paidPending.id)?.paymentReference, "pi_recovered_paid");
    assert.equal(orderById.get(openPending.id)?.status, "PENDING");

    const access = await prisma.userGameAccess.findUnique({
      where: {
        userId_gameId: {
          userId: fixture.user.id,
          gameId: fixture.game.id
        }
      }
    });
    assert.equal(access?.status, "ACTIVE");

    const confirmationCount = await prisma.outboundMessage.count({
      where: {
        userId: fixture.user.id,
        templateKey: "purchase_confirmation"
      }
    });
    assert.equal(confirmationCount, 1);
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("reconcileCompletedStripeCheckoutSessions skips recovery when Stripe is not configured", async () => {
  const result = await reconcileCompletedStripeCheckoutSessions({
    env: {}
  });

  assert.equal(result.status, "NOT_CONFIGURED");
  assert.equal(result.checkedOrderCount, 0);
});

test("getPaymentOperationsAlertRecipients normalizes configured recipients", () => {
  const recipients = getPaymentOperationsAlertRecipients({
    ADMIN_ALERT_EMAILS: "Ops-A@example.com, ops-b@example.com\nops-a@example.com"
  });

  assert.deepEqual(recipients, ["ops-a@example.com", "ops-b@example.com"]);
});

test("queuePaymentOperationsAlert queues deduped admin alert emails for payment risks", async () => {
  const fixture = await createOrderMaintenanceFixture("order-maintenance-alert");
  const now = new Date("2001-05-21T12:00:00.000Z");
  const recipients = [`ops-a-${fixture.label}@example.com`, `ops-b-${fixture.label}@example.com`];

  try {
    const stalePending = await createOrder({
      userId: fixture.user.id,
      email: fixture.user.email,
      productId: fixture.product.id,
      status: "PENDING",
      createdAt: new Date("2001-05-21T10:00:00.000Z")
    });
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: "stripe",
        eventId: `evt_${fixture.label}`,
        eventType: "checkout.session.completed",
        status: "FAILED",
        orderId: stalePending.id,
        payload: {}
      }
    });

    const result = await queuePaymentOperationsAlert({
      now,
      olderThanMinutes: 60,
      dedupeMinutes: 120,
      env: {
        ADMIN_ALERT_EMAILS: recipients.join(","),
        APP_URL: "https://staging.macamysteries.com"
      }
    });

    assert.equal(result.status, "QUEUED");
    assert.equal(result.queuedCount, 2);
    assert.equal(result.skippedDuplicateCount, 0);
    assert.ok(result.summary.failedWebhookEventCount >= 1);
    assert.ok(result.summary.stalePendingOrderCount >= 1);
    assert.ok(result.summary.recoverableStripeCheckoutCount >= 1);

    const messages = await prisma.outboundMessage.findMany({
      where: {
        recipient: { in: recipients },
        templateKey: "payment_operations_alert"
      },
      orderBy: { recipient: "asc" }
    });

    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.status, "PENDING");
    assert.equal(messages[0]?.subject, "MaCa Mysteries payment operations alert");
    assert.match(messages[0]?.bodyPreview ?? "", new RegExp(`Failed webhooks: ${result.summary.failedWebhookEventCount}`));
    assert.match(messages[0]?.bodyPreview ?? "", new RegExp(`Stale pending orders: ${result.summary.stalePendingOrderCount}`));
    assert.match(
      messages[0]?.bodyPreview ?? "",
      new RegExp(`Recoverable Stripe checkouts: ${result.summary.recoverableStripeCheckoutCount}`)
    );
    assert.match(messages[0]?.bodyPreview ?? "", /https:\/\/staging\.macamysteries\.com\/admin/);

    const duplicateResult = await queuePaymentOperationsAlert({
      now,
      olderThanMinutes: 60,
      dedupeMinutes: 120,
      env: {
        ADMIN_ALERT_EMAILS: recipients.join(","),
        APP_URL: "https://staging.macamysteries.com"
      }
    });

    assert.equal(duplicateResult.status, "DUPLICATE");
    assert.equal(duplicateResult.queuedCount, 0);
    assert.equal(duplicateResult.skippedDuplicateCount, 2);
  } finally {
    await prisma.outboundMessage.deleteMany({
      where: {
        recipient: { in: recipients },
        templateKey: "payment_operations_alert"
      }
    });
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});
