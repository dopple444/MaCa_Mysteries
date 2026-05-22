import { prisma } from "./prisma";
import { queuePurchaseConfirmationMessage } from "./notifications";

type HostGameAccessInput = {
  userId: string;
  gameId: string;
  allowDevelopmentBypass?: boolean;
};

export async function getHostGameAccess(input: HostGameAccessInput) {
  const allowDevelopmentBypass = input.allowDevelopmentBypass ?? process.env.NODE_ENV !== "production";
  const [activeProduct, activeAccess] = await Promise.all([
    prisma.product.findFirst({
      where: {
        gameId: input.gameId,
        status: "ACTIVE"
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        priceCents: true,
        currency: true
      }
    }),
    prisma.userGameAccess.findUnique({
      where: {
        userId_gameId: {
          userId: input.userId,
          gameId: input.gameId
        }
      },
      select: {
        id: true,
        status: true
      }
    })
  ]);

  if (!activeProduct) {
    return {
      canHost: true,
      requiresPurchase: false,
      reason: "No active product gate is configured for this game.",
      product: null
    };
  }

  if (activeAccess?.status === "ACTIVE") {
    return {
      canHost: true,
      requiresPurchase: false,
      reason: "User has active access to this game.",
      product: activeProduct
    };
  }

  if (allowDevelopmentBypass) {
    return {
      canHost: true,
      requiresPurchase: true,
      reason: "Development bypass is allowing this paid game before checkout is wired.",
      product: activeProduct
    };
  }

  return {
    canHost: false,
    requiresPurchase: true,
    reason: "This game requires an active purchase before hosting.",
    product: activeProduct
  };
}

export async function fulfillPaidOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });

  if (!order || order.status !== "PAID" || !order.userId) {
    return { grantedAccessCount: 0 };
  }

  let grantedAccessCount = 0;
  for (const item of order.items) {
    await prisma.userGameAccess.upsert({
      where: {
        userId_gameId: {
          userId: order.userId,
          gameId: item.product.gameId
        }
      },
      update: {
        productId: item.productId,
        source: "ORDER",
        status: "ACTIVE"
      },
      create: {
        userId: order.userId,
        gameId: item.product.gameId,
        productId: item.productId,
        source: "ORDER",
        status: "ACTIVE"
      }
    });
    grantedAccessCount += 1;
  }

  await queuePurchaseConfirmationMessage(order);

  return { grantedAccessCount };
}
