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

export function getOutboundProvider(channel: string, env: EnvMap = process.env) {
  const normalizedChannel = channel.trim().toUpperCase();
  if (normalizedChannel === "EMAIL") {
    return env.EMAIL_PROVIDER?.trim() || null;
  }
  if (normalizedChannel === "SMS") {
    return env.SMS_PROVIDER?.trim() || null;
  }
  return null;
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
  return prisma.outboundMessage.update({
    where: { id },
    data: {
      provider,
      providerMessageId,
      status: "SENT",
      sentAt: new Date(),
      errorMessage: ""
    }
  });
}

export async function markOutboundMessageFailed(id: string, provider: string, errorMessage: string) {
  return prisma.outboundMessage.update({
    where: { id },
    data: {
      provider,
      status: "FAILED",
      errorMessage
    }
  });
}

export async function retryOutboundMessage(id: string) {
  return prisma.outboundMessage.update({
    where: { id },
    data: {
      status: "PENDING",
      errorMessage: "",
      providerMessageId: "",
      sentAt: null
    }
  });
}
