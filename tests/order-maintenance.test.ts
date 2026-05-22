import assert from "node:assert/strict";
import test from "node:test";

import { cancelStalePendingOrders, reconcilePaidOrderAccess } from "../app/lib/order-maintenance";
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
