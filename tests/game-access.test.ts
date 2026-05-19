import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { fulfillPaidOrder, getHostGameAccess } from "../app/lib/game-access";

const prisma = new PrismaClient();

async function deleteTestData(slugPrefix: string, emailDomain: string) {
  const games = await prisma.game.findMany({
    where: { slug: { startsWith: slugPrefix } },
    select: { id: true }
  });
  const gameIds = games.map((game) => game.id);

  const users = await prisma.user.findMany({
    where: { email: { endsWith: emailDomain } },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : ["__none__"] } },
        { email: { endsWith: emailDomain } }
      ]
    },
    select: { id: true }
  });
  const orderIds = orders.map((order) => order.id);

  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds.length ? orderIds : ["__none__"] } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds.length ? orderIds : ["__none__"] } } });
  await prisma.userGameAccess.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : ["__none__"] } },
        { gameId: { in: gameIds.length ? gameIds : ["__none__"] } }
      ]
    }
  });
  await prisma.product.deleteMany({ where: { gameId: { in: gameIds.length ? gameIds : ["__none__"] } } });
  await prisma.gameVersion.deleteMany({ where: { gameId: { in: gameIds.length ? gameIds : ["__none__"] } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds.length ? gameIds : ["__none__"] } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds.length ? userIds : ["__none__"] } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds.length ? userIds : ["__none__"] } } });
}

async function createGame(slug: string) {
  return prisma.game.create({
    data: {
      slug,
      title: "Game Access Test Game",
      tagline: "Disposable access test",
      description: "Used only by game access tests.",
      minPlayers: 4,
      maxPlayers: 8,
      durationMin: 120,
      durationMax: 180,
      status: "PUBLISHED",
      versions: {
        create: {
          versionNumber: 1,
          status: "PUBLISHED",
          themes: ["test"]
        }
      }
    }
  });
}

test("getHostGameAccess gates active products and honors user access", async () => {
  const label = crypto.randomBytes(6).toString("hex");
  const slugPrefix = "test-game-access-";
  const slug = `${slugPrefix}${label}`;
  const freeSlug = `${slug}-free`;
  const emailDomain = `@${slug}.example`;

  await deleteTestData(slugPrefix, emailDomain);

  const user = await prisma.user.create({
    data: {
      name: "Game Access Host",
      email: `host${emailDomain}`,
      role: "HOST",
      passwordHash: "test"
    }
  });
  const game = await createGame(slug);
  const freeGame = await createGame(freeSlug);
  const product = await prisma.product.create({
    data: {
      gameId: game.id,
      slug: `${slug}-product`,
      name: "Game Access Product",
      priceCents: 2999,
      currency: "USD",
      status: "ACTIVE"
    }
  });

  try {
    const freeAccess = await getHostGameAccess({
      userId: user.id,
      gameId: freeGame.id,
      allowDevelopmentBypass: false
    });
    assert.equal(freeAccess.canHost, true);
    assert.equal(freeAccess.requiresPurchase, false);

    const deniedAccess = await getHostGameAccess({
      userId: user.id,
      gameId: game.id,
      allowDevelopmentBypass: false
    });
    assert.equal(deniedAccess.canHost, false);
    assert.equal(deniedAccess.requiresPurchase, true);
    assert.equal(deniedAccess.product?.id, product.id);

    const developmentAccess = await getHostGameAccess({
      userId: user.id,
      gameId: game.id,
      allowDevelopmentBypass: true
    });
    assert.equal(developmentAccess.canHost, true);
    assert.equal(developmentAccess.requiresPurchase, true);

    await prisma.userGameAccess.create({
      data: {
        userId: user.id,
        gameId: game.id,
        productId: product.id,
        source: "ORDER",
        status: "ACTIVE"
      }
    });

    const grantedAccess = await getHostGameAccess({
      userId: user.id,
      gameId: game.id,
      allowDevelopmentBypass: false
    });
    assert.equal(grantedAccess.canHost, true);
    assert.equal(grantedAccess.requiresPurchase, false);
  } finally {
    await deleteTestData(slugPrefix, emailDomain);
  }
});

test("fulfillPaidOrder grants game access idempotently", async () => {
  const label = crypto.randomBytes(6).toString("hex");
  const slugPrefix = "test-order-access-";
  const slug = `${slugPrefix}${label}`;
  const emailDomain = `@${slug}.example`;

  await deleteTestData(slugPrefix, emailDomain);

  const user = await prisma.user.create({
    data: {
      name: "Paid Order Host",
      email: `buyer${emailDomain}`,
      role: "HOST",
      passwordHash: "test"
    }
  });
  const game = await createGame(slug);
  const product = await prisma.product.create({
    data: {
      gameId: game.id,
      slug: `${slug}-product`,
      name: "Paid Order Product",
      priceCents: 2999,
      currency: "USD",
      status: "ACTIVE"
    }
  });
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      email: user.email,
      status: "PAID",
      subtotalCents: product.priceCents,
      totalCents: product.priceCents,
      currency: product.currency,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          unitPriceCents: product.priceCents,
          totalPriceCents: product.priceCents
        }
      }
    }
  });

  try {
    const firstFulfillment = await fulfillPaidOrder(order.id);
    assert.equal(firstFulfillment.grantedAccessCount, 1);

    const accessAfterFirstFulfillment = await prisma.userGameAccess.findMany({
      where: {
        userId: user.id,
        gameId: game.id
      }
    });
    assert.equal(accessAfterFirstFulfillment.length, 1);
    assert.equal(accessAfterFirstFulfillment[0].status, "ACTIVE");

    const secondFulfillment = await fulfillPaidOrder(order.id);
    assert.equal(secondFulfillment.grantedAccessCount, 1);

    const accessAfterSecondFulfillment = await prisma.userGameAccess.findMany({
      where: {
        userId: user.id,
        gameId: game.id
      }
    });
    assert.equal(accessAfterSecondFulfillment.length, 1);
  } finally {
    await deleteTestData(slugPrefix, emailDomain);
  }
});
