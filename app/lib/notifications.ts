import { prisma } from "./prisma";
import { getOutboundProvider } from "./outbound-delivery";

type InvitationRecipient = {
  name: string;
  email: string;
};

type QueuePartyInvitationInput = {
  hostId: string;
  partyId: string;
  partyTitle: string;
  inviteCode: string;
  guests: InvitationRecipient[];
};

export async function queuePartyInvitationMessages(input: QueuePartyInvitationInput) {
  const recipients = input.guests.filter((guest) => guest.email.includes("@"));
  if (!recipients.length) return { queuedCount: 0 };

  await prisma.outboundMessage.createMany({
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

  return { queuedCount: recipients.length };
}
