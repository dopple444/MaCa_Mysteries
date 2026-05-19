import crypto from "node:crypto";

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export function uniqueTestLabel(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}

export async function deleteCommerceFixture(slugPrefix: string, emailDomain: string) {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: emailDomain } },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);

  const games = await prisma.game.findMany({
    where: { slug: { startsWith: slugPrefix } },
    select: { id: true }
  });
  const gameIds = games.map((game) => game.id);

  const products = await prisma.product.findMany({
    where: { gameId: { in: gameIds } },
    select: { id: true }
  });
  const productIds = products.map((product) => product.id);

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId: { in: userIds } }, { email: { endsWith: emailDomain } }]
    },
    select: { id: true }
  });
  const orderIds = orders.map((order) => order.id);

  await prisma.paymentWebhookEvent.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.userGameAccess.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { gameId: { in: gameIds } }] } });
  await prisma.orderItem.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { productId: { in: productIds } }] } });
  await prisma.order.deleteMany({
    where: {
      OR: [{ id: { in: orderIds } }, { userId: { in: userIds } }, { email: { endsWith: emailDomain } }]
    }
  });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.gameVersion.deleteMany({ where: { gameId: { in: gameIds } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.outboundMessage.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.supportTicket.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { email: { endsWith: emailDomain } }] } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
