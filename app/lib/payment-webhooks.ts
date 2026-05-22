import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

type RecordPaymentWebhookEventInput = {
  provider: string;
  eventId: string;
  eventType: string;
  orderId?: string | null;
  payload?: Prisma.InputJsonValue;
};

export async function recordPaymentWebhookEvent(input: RecordPaymentWebhookEventInput) {
  const provider = input.provider.trim().toLowerCase();
  const eventId = input.eventId.trim();
  const eventType = input.eventType.trim();

  if (!provider || !eventId || !eventType) {
    return { event: null, duplicate: false };
  }

  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider,
        eventId
      }
    }
  });

  if (existing) {
    return { event: existing, duplicate: true };
  }

  const event = await prisma.paymentWebhookEvent.create({
    data: {
      provider,
      eventId,
      eventType,
      orderId: input.orderId ?? null,
      payload: input.payload ?? {}
    }
  });

  return { event, duplicate: false };
}

export async function markPaymentWebhookEventProcessed(id: string) {
  return prisma.paymentWebhookEvent.update({
    where: { id },
    data: {
      status: "PROCESSED",
      processedAt: new Date()
    }
  });
}

export async function markPaymentWebhookEventFailed(id: string) {
  return prisma.paymentWebhookEvent.update({
    where: { id },
    data: {
      status: "FAILED"
    }
  });
}
