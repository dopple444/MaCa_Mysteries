import { prisma } from "./prisma";
import { getOutboundProvider, queueEmailMessage } from "./outbound-delivery";

type InvitationRecipient = {
  id?: string;
  name: string;
  email: string;
};

type QueuePartyInvitationInput = {
  hostId: string;
  partyId: string;
  partyTitle: string;
  inviteCode: string;
  guests: InvitationRecipient[];
  isResend?: boolean;
};

export async function queuePartyInvitationMessages(input: QueuePartyInvitationInput) {
  const recipients = input.guests.filter((guest) => guest.email.includes("@"));
  if (!recipients.length) return { queuedCount: 0 };
  const queuedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.outboundMessage.createMany({
      data: recipients.map((guest) => ({
        userId: input.hostId,
        partyId: input.partyId,
        channel: "EMAIL",
        recipient: guest.email,
        templateKey: "party_invitation",
        subject: `Invitation: ${input.partyTitle}`,
        bodyPreview: `Hi ${guest.name || guest.email}, you are invited to ${input.partyTitle}. Join with code ${input.inviteCode}.`,
        provider: getOutboundProvider("EMAIL") ?? "",
        status: "PENDING"
      }))
    });

    for (const guest of recipients) {
      await tx.guest.updateMany({
        where: {
          partyId: input.partyId,
          ...(guest.id ? { id: guest.id } : { email: { equals: guest.email, mode: "insensitive" } })
        },
        data: {
          invitationStatus: "QUEUED",
          invitationLastQueuedAt: queuedAt,
          invitationFailedAt: null,
          invitationFailureDetail: "",
          ...(input.isResend ? { invitationResendCount: { increment: 1 } } : {})
        }
      });
    }
  });

  return { queuedCount: recipients.length };
}

type PurchaseConfirmationOrder = {
  id: string;
  userId: string | null;
  email: string;
  totalCents: number;
  currency: string;
  items: Array<{
    quantity: number;
    product: {
      name: string;
    };
  }>;
};

function formatOrderTotal(order: PurchaseConfirmationOrder) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: order.currency || "USD"
  }).format(order.totalCents / 100);
}

export async function queuePurchaseConfirmationMessage(order: PurchaseConfirmationOrder) {
  if (!order.userId || !order.email.includes("@")) return { queued: false, reason: "missing-recipient" as const };

  const recipient = order.email.trim().toLowerCase();
  const purchasedItems = order.items
    .map((item) => `${item.quantity} x ${item.product.name}`)
    .join(", ");
  const bodyPreview = `Order ${order.id} is confirmed for ${formatOrderTotal(order)}. Access is ready for ${purchasedItems}.`;

  const existing = await prisma.outboundMessage.findFirst({
    where: {
      userId: order.userId,
      channel: "EMAIL",
      recipient,
      templateKey: "purchase_confirmation",
      bodyPreview
    },
    select: { id: true }
  });

  if (existing) return { queued: false, reason: "already-queued" as const, messageId: existing.id };

  const message = await queueEmailMessage({
    userId: order.userId,
    recipient,
    templateKey: "purchase_confirmation",
    subject: "Your MaCa Mysteries purchase is ready",
    bodyPreview
  });

  return { queued: Boolean(message), reason: message ? "queued" as const : "invalid-recipient" as const, messageId: message?.id };
}
