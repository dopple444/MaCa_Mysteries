import { prisma } from "./prisma";

type QueueSmsMessageInput = {
  userId?: string | null;
  partyId?: string | null;
  recipient: string;
  templateKey: string;
  bodyPreview: string;
};

type QueueEmailMessageInput = QueueSmsMessageInput & {
  subject: string;
};

type EnvMap = Partial<Record<string, string | undefined>>;

type EmailFetcher = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

type SendPendingEmailInput = {
  limit?: number;
  messageIds?: string[];
  env?: EnvMap;
  fetcher?: EmailFetcher;
};

type InvitationDeliveryMessage = {
  partyId: string | null;
  recipient: string;
  templateKey: string;
};

export function getOutboundProvider(channel: string, env: EnvMap = process.env) {
  const normalizedChannel = channel.trim().toUpperCase();
  if (normalizedChannel === "EMAIL") {
    return env.EMAIL_PROVIDER?.trim().toLowerCase() || null;
  }
  if (normalizedChannel === "SMS") {
    return env.SMS_PROVIDER?.trim().toLowerCase() || null;
  }
  return null;
}

function normalizeLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit) || limit < 1) return 25;
  return Math.min(Math.floor(limit), 100);
}

function getStringField(value: unknown, field: string) {
  if (!value || typeof value !== "object" || !(field in value)) return "";
  const result = (value as Record<string, unknown>)[field];
  return typeof result === "string" ? result : "";
}

async function updateInvitationDeliveryState(
  message: InvitationDeliveryMessage,
  data: {
    invitationStatus: string;
    invitationLastSentAt?: Date | null;
    invitationLastQueuedAt?: Date | null;
    invitationFailedAt?: Date | null;
    invitationFailureDetail?: string;
  }
) {
  if (message.templateKey !== "party_invitation" || !message.partyId || !message.recipient.includes("@")) {
    return;
  }

  await prisma.guest.updateMany({
    where: {
      partyId: message.partyId,
      email: { equals: message.recipient, mode: "insensitive" }
    },
    data
  });
}

export async function queueSmsMessage(input: QueueSmsMessageInput) {
  const recipient = input.recipient.trim();
  if (!recipient) return null;

  return prisma.outboundMessage.create({
    data: {
      userId: input.userId ?? null,
      partyId: input.partyId ?? null,
      channel: "SMS",
      recipient,
      templateKey: input.templateKey,
      bodyPreview: input.bodyPreview,
      status: "PENDING"
    }
  });
}

export async function queueEmailMessage(input: QueueEmailMessageInput) {
  const recipient = input.recipient.trim().toLowerCase();
  if (!recipient || !recipient.includes("@")) return null;

  return prisma.outboundMessage.create({
    data: {
      userId: input.userId ?? null,
      partyId: input.partyId ?? null,
      channel: "EMAIL",
      recipient,
      templateKey: input.templateKey,
      subject: input.subject.trim(),
      bodyPreview: input.bodyPreview,
      status: "PENDING"
    }
  });
}

export async function markOutboundMessageSent(id: string, provider: string, providerMessageId: string) {
  const sent = await prisma.outboundMessage.update({
    where: { id },
    data: {
      provider,
      providerMessageId,
      status: "SENT",
      sentAt: new Date(),
      errorMessage: ""
    }
  });

  await updateInvitationDeliveryState(sent, {
    invitationStatus: "SENT",
    invitationLastSentAt: sent.sentAt ?? new Date(),
    invitationFailedAt: null,
    invitationFailureDetail: ""
  });

  return sent;
}

export async function markOutboundMessageFailed(id: string, provider: string, errorMessage: string) {
  const failedAt = new Date();
  const failed = await prisma.outboundMessage.update({
    where: { id },
    data: {
      provider,
      status: "FAILED",
      errorMessage
    }
  });

  await updateInvitationDeliveryState(failed, {
    invitationStatus: "FAILED",
    invitationFailedAt: failedAt,
    invitationFailureDetail: errorMessage
  });

  return failed;
}

export async function retryOutboundMessage(id: string) {
  const queuedAt = new Date();
  const retried = await prisma.outboundMessage.update({
    where: { id },
    data: {
      status: "PENDING",
      errorMessage: "",
      providerMessageId: "",
      sentAt: null
    }
  });

  await updateInvitationDeliveryState(retried, {
    invitationStatus: "QUEUED",
    invitationLastQueuedAt: queuedAt,
    invitationFailedAt: null,
    invitationFailureDetail: ""
  });

  return retried;
}

export async function sendPendingEmailMessages(input: SendPendingEmailInput = {}) {
  const env = input.env ?? process.env;
  const provider = getOutboundProvider("EMAIL", env);
  const limit = normalizeLimit(input.limit);

  if (!provider) {
    return {
      status: "NOT_CONFIGURED" as const,
      provider: "",
      checkedCount: 0,
      sentCount: 0,
      failedCount: 0,
      message: "EMAIL_PROVIDER is not configured."
    };
  }

  if (!["console", "resend"].includes(provider)) {
    return {
      status: "NOT_CONFIGURED" as const,
      provider,
      checkedCount: 0,
      sentCount: 0,
      failedCount: 0,
      message: `Unsupported EMAIL_PROVIDER "${provider}".`
    };
  }

  const pendingMessages = await prisma.outboundMessage.findMany({
    where: {
      channel: "EMAIL",
      status: "PENDING",
      ...(input.messageIds?.length ? { id: { in: input.messageIds } } : {})
    },
    orderBy: { createdAt: "asc" },
    take: limit
  });

  if (provider === "console") {
    for (const message of pendingMessages) {
      console.info(
        JSON.stringify({
          area: "outbound",
          event: "email.console.sent",
          messageId: message.id,
          recipient: message.recipient,
          templateKey: message.templateKey,
          timestamp: new Date().toISOString()
        })
      );
      await markOutboundMessageSent(message.id, "console", `console_${message.id}`);
    }

    return {
      status: "DELIVERED" as const,
      provider,
      checkedCount: pendingMessages.length,
      sentCount: pendingMessages.length,
      failedCount: 0,
      message: "Console email delivery completed."
    };
  }

  const apiKey = env.EMAIL_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return {
      status: "NOT_CONFIGURED" as const,
      provider,
      checkedCount: pendingMessages.length,
      sentCount: 0,
      failedCount: 0,
      message: "Resend delivery requires EMAIL_API_KEY and EMAIL_FROM."
    };
  }

  const fetcher = input.fetcher ?? fetch;
  let sentCount = 0;
  let failedCount = 0;

  for (const message of pendingMessages) {
    const body = {
      from,
      to: [message.recipient],
      subject: message.subject || message.templateKey,
      text: message.bodyPreview,
      headers: {
        "X-MaCa-Message-Id": message.id
      }
    };

    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.id,
        "User-Agent": "MaCa Mysteries/0.1"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      await markOutboundMessageFailed(message.id, "resend", errorText || `Resend returned ${response.status}`);
      failedCount += 1;
      continue;
    }

    const payload = await response.json();
    await markOutboundMessageSent(message.id, "resend", getStringField(payload, "id") || `resend_${message.id}`);
    sentCount += 1;
  }

  return {
    status: failedCount ? ("PARTIAL" as const) : ("DELIVERED" as const),
    provider,
    checkedCount: pendingMessages.length,
    sentCount,
    failedCount,
    message: "Resend email delivery completed."
  };
}
