import { prisma } from "./prisma";
import { getOutboundProvider } from "./outbound-delivery";

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
