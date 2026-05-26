import { fulfillPaidOrder } from "./game-access";
import { queueEmailMessage } from "./outbound-delivery";
import { prisma } from "./prisma";
import { logPaymentEvent } from "./server-logging";

const DEFAULT_STALE_PENDING_ORDER_MINUTES = 24 * 60;
const DEFAULT_STRIPE_CHECKOUT_RECOVERY_MINUTES = 10;
const DEFAULT_PAYMENT_ALERT_DEDUPE_MINUTES = 60;

type EnvMap = Partial<Record<string, string | undefined>>;

type StripeSessionFetcher = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

type MaintenanceInput = {
  now?: Date;
  olderThanMinutes?: number;
  limit?: number;
};

type StripeCheckoutRecoveryInput = MaintenanceInput & {
  env?: EnvMap;
  fetcher?: StripeSessionFetcher;
};

type PaymentOperationsAlertInput = MaintenanceInput & {
  env?: EnvMap;
  dedupeMinutes?: number;
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

export function getRecoverableStripeCheckoutCutoff({
  now = new Date(),
  olderThanMinutes = DEFAULT_STRIPE_CHECKOUT_RECOVERY_MINUTES
}: MaintenanceInput = {}) {
  const minutes =
    Number.isFinite(olderThanMinutes) && olderThanMinutes > 0
      ? olderThanMinutes
      : DEFAULT_STRIPE_CHECKOUT_RECOVERY_MINUTES;
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function getStripeSecretKey(env: EnvMap) {
  return env.STRIPE_SECRET_KEY?.trim() || null;
}

function getStringField(value: unknown, field: string) {
  if (!value || typeof value !== "object" || !(field in value)) return "";
  const result = (value as Record<string, unknown>)[field];
  return typeof result === "string" ? result : "";
}

export function getPaymentOperationsAlertRecipients(env: EnvMap = process.env) {
  const raw = env.ADMIN_ALERT_EMAILS?.trim() || env.ADMIN_ALERT_EMAIL?.trim() || "";
  if (!raw) return [];

  return [
    ...new Set(
      raw
        .split(/[,\n;]/)
        .map((recipient) => recipient.trim().toLowerCase())
        .filter((recipient) => recipient.includes("@"))
    )
  ];
}

function getAlertDedupeCutoff(now: Date, dedupeMinutes: number | undefined) {
  const minutes =
    Number.isFinite(dedupeMinutes) && dedupeMinutes && dedupeMinutes > 0
      ? dedupeMinutes
      : DEFAULT_PAYMENT_ALERT_DEDUPE_MINUTES;
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function getAdminAlertUrl(env: EnvMap) {
  const baseUrl = env.APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
  return `${baseUrl}/admin`;
}

function shouldQueuePaymentAlert(summary: {
  failedWebhookEventCount: number;
  stalePendingOrderCount: number;
  recoverableStripeCheckoutCount: number;
}) {
  return (
    summary.failedWebhookEventCount > 0 ||
    summary.stalePendingOrderCount > 0 ||
    summary.recoverableStripeCheckoutCount > 0
  );
}

export async function getPaymentOperationsAlertSummary(input: MaintenanceInput = {}) {
  const now = input.now ?? new Date();
  const stalePendingOrderCutoff = getStalePendingOrderCutoff({ ...input, now });
  const recoverableStripeCheckoutCutoff = getRecoverableStripeCheckoutCutoff({ ...input, now });

  const [failedWebhookEventCount, stalePendingOrderCount, recoverableStripeCheckoutCount] = await Promise.all([
    prisma.paymentWebhookEvent.count({ where: { status: "FAILED" } }),
    prisma.order.count({
      where: {
        status: "PENDING",
        createdAt: { lt: stalePendingOrderCutoff }
      }
    }),
    prisma.order.count({
      where: {
        status: "PENDING",
        paymentProvider: "stripe",
        paymentReference: { not: "" },
        createdAt: { lt: recoverableStripeCheckoutCutoff }
      }
    })
  ]);

  return {
    failedWebhookEventCount,
    stalePendingOrderCount,
    recoverableStripeCheckoutCount,
    stalePendingOrderCutoff,
    recoverableStripeCheckoutCutoff
  };
}

export async function queuePaymentOperationsAlert(input: PaymentOperationsAlertInput = {}) {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const recipients = getPaymentOperationsAlertRecipients(env);
  const summary = await getPaymentOperationsAlertSummary({ ...input, now });

  if (!recipients.length) {
    return {
      status: "NOT_CONFIGURED" as const,
      queuedCount: 0,
      skippedDuplicateCount: 0,
      recipients,
      summary
    };
  }

  if (!shouldQueuePaymentAlert(summary)) {
    return {
      status: "NO_ALERTS" as const,
      queuedCount: 0,
      skippedDuplicateCount: 0,
      recipients,
      summary
    };
  }

  const adminUrl = getAdminAlertUrl(env);
  const bodyPreview = [
    "Payment operations attention needed.",
    `Failed webhooks: ${summary.failedWebhookEventCount}.`,
    `Stale pending orders: ${summary.stalePendingOrderCount}.`,
    `Recoverable Stripe checkouts: ${summary.recoverableStripeCheckoutCount}.`,
    `Review: ${adminUrl}`
  ].join(" ");
  const dedupeCutoff = getAlertDedupeCutoff(now, input.dedupeMinutes);
  let queuedCount = 0;
  let skippedDuplicateCount = 0;

  for (const recipient of recipients) {
    const existing = await prisma.outboundMessage.findFirst({
      where: {
        channel: "EMAIL",
        recipient,
        templateKey: "payment_operations_alert",
        createdAt: { gte: dedupeCutoff }
      },
      select: { id: true }
    });

    if (existing) {
      skippedDuplicateCount += 1;
      continue;
    }

    const message = await queueEmailMessage({
      recipient,
      templateKey: "payment_operations_alert",
      subject: "MaCa Mysteries payment operations alert",
      bodyPreview
    });

    if (message) queuedCount += 1;
  }

  return {
    status: queuedCount ? ("QUEUED" as const) : ("DUPLICATE" as const),
    queuedCount,
    skippedDuplicateCount,
    recipients,
    summary
  };
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

export async function reconcileCompletedStripeCheckoutSessions(input: StripeCheckoutRecoveryInput = {}) {
  const env = input.env ?? process.env;
  const secretKey = getStripeSecretKey(env);
  const cutoff = getRecoverableStripeCheckoutCutoff(input);

  if (!secretKey) {
    return {
      status: "NOT_CONFIGURED" as const,
      checkedOrderCount: 0,
      paidOrderCount: 0,
      accessRecordsTouched: 0,
      failedLookupCount: 0,
      cutoff,
      orderIds: [] as string[]
    };
  }

  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentProvider: "stripe",
      paymentReference: { not: "" },
      createdAt: { lt: cutoff }
    },
    orderBy: { createdAt: "asc" },
    take: normalizeLimit(input.limit),
    select: {
      id: true,
      paymentReference: true
    }
  });

  const fetcher = input.fetcher ?? fetch;
  let checkedOrderCount = 0;
  let paidOrderCount = 0;
  let accessRecordsTouched = 0;
  let failedLookupCount = 0;
  const orderIds: string[] = [];

  for (const order of orders) {
    checkedOrderCount += 1;
    const response = await fetcher(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(order.paymentReference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`
        }
      }
    );

    if (!response.ok) {
      failedLookupCount += 1;
      logPaymentEvent("warn", "stripe.checkout.recovery_lookup_failed", {
        orderId: order.id,
        status: response.status
      });
      continue;
    }

    const session = await response.json();
    const paymentStatus = getStringField(session, "payment_status");
    const checkoutStatus = getStringField(session, "status");
    if (paymentStatus !== "paid" && checkoutStatus !== "complete") {
      continue;
    }

    const paymentReference = getStringField(session, "payment_intent") || getStringField(session, "id") || order.paymentReference;
    const update = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING"
      },
      data: {
        status: "PAID",
        paymentProvider: "stripe",
        paymentReference
      }
    });

    if (!update.count) continue;

    const fulfillment = await fulfillPaidOrder(order.id);
    paidOrderCount += 1;
    accessRecordsTouched += fulfillment.grantedAccessCount;
    orderIds.push(order.id);
    logPaymentEvent("info", "stripe.checkout.recovered_completed_session", {
      orderId: order.id,
      accessRecordsTouched: fulfillment.grantedAccessCount
    });
  }

  return {
    status: "COMPLETED" as const,
    checkedOrderCount,
    paidOrderCount,
    accessRecordsTouched,
    failedLookupCount,
    cutoff,
    orderIds
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
