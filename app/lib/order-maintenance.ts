import { fulfillPaidOrder } from "./game-access";
import { prisma } from "./prisma";

const DEFAULT_STALE_PENDING_ORDER_MINUTES = 24 * 60;

type MaintenanceInput = {
  now?: Date;
  olderThanMinutes?: number;
  limit?: number;
};

type ReconcileInput = {
  orderId?: string;
  limit?: number;
};

function normalizeLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit) || limit < 1) return 100;
  return Math.min(Math.floor(limit), 500);
}

export function getStalePendingOrderCutoff({
  now = new Date(),
  olderThanMinutes = DEFAULT_STALE_PENDING_ORDER_MINUTES
}: MaintenanceInput = {}) {
  const minutes =
    Number.isFinite(olderThanMinutes) && olderThanMinutes > 0
      ? olderThanMinutes
      : DEFAULT_STALE_PENDING_ORDER_MINUTES;
  return new Date(now.getTime() - minutes * 60 * 1000);
}

export async function cancelStalePendingOrders(input: MaintenanceInput = {}) {
  const cutoff = getStalePendingOrderCutoff(input);
  const staleOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff }
    },
    orderBy: { createdAt: "asc" },
    take: normalizeLimit(input.limit),
    select: {
      id: true,
      paymentProvider: true,
      paymentReference: true,
      createdAt: true
    }
  });

  const orderIds = staleOrders.map((order) => order.id);
  if (!orderIds.length) {
    return {
      cancelledCount: 0,
      cutoff,
      orderIds,
      oldestCancelledAt: null as Date | null
    };
  }

  const result = await prisma.order.updateMany({
    where: {
      id: { in: orderIds },
      status: "PENDING"
    },
    data: {
      status: "CANCELLED"
    }
  });

  return {
    cancelledCount: result.count,
    cutoff,
    orderIds,
    oldestCancelledAt: staleOrders[0]?.createdAt ?? null
  };
}

export async function reconcilePaidOrderAccess(input: ReconcileInput = {}) {
  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PAID",
      ...(input.orderId ? { id: input.orderId } : {}),
      userId: { not: null }
    },
    orderBy: { createdAt: "asc" },
    take: normalizeLimit(input.limit),
    include: {
      items: {
        include: {
          product: {
            select: {
              gameId: true
            }
          }
        }
      }
    }
  });

  let checkedOrderCount = 0;
  let repairedOrderCount = 0;
  let accessRecordsTouched = 0;

  for (const order of paidOrders) {
    if (!order.userId) continue;
    checkedOrderCount += 1;
    const gameIds = [...new Set(order.items.map((item) => item.product.gameId))];
    const existingAccess = await prisma.userGameAccess.findMany({
      where: {
        userId: order.userId,
        gameId: { in: gameIds },
        status: "ACTIVE"
      },
      select: {
        gameId: true
      }
    });
    const existingGameIds = new Set(existingAccess.map((grant) => grant.gameId));
    const missingGameIds = gameIds.filter((gameId) => !existingGameIds.has(gameId));

    const fulfillment = await fulfillPaidOrder(order.id);
    accessRecordsTouched += fulfillment.grantedAccessCount;
    if (missingGameIds.length) repairedOrderCount += 1;
  }

  return {
    checkedOrderCount,
    repairedOrderCount,
    accessRecordsTouched
  };
}
