import { prisma } from "./prisma";

const MAX_SUPPORT_MESSAGE_LENGTH = 10000;

type CreateSupportTicketInput = {
  userId?: string | null;
  email: string;
  subject: string;
  message: string;
};

type AddSupportTicketMessageInput = {
  ticketId: string;
  authorUserId: string;
  body: string;
};

function normalizeSupportMessage(value: string) {
  return value.trim().slice(0, MAX_SUPPORT_MESSAGE_LENGTH);
}

function getSupportReplySubject(subject: string) {
  return subject.trim().toLowerCase().startsWith("re:") ? subject.trim() : `Re: ${subject.trim()}`;
}

export async function createSupportTicket(input: CreateSupportTicketInput) {
  const email = input.email.trim().toLowerCase();
  const subject = input.subject.trim();
  const message = normalizeSupportMessage(input.message);

  if (!email.includes("@") || !subject || !message) return null;

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        userId: input.userId ?? null,
        email,
        subject,
        message
      }
    });

    await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorUserId: input.userId ?? null,
        messageType: "CUSTOMER_MESSAGE",
        body: message
      }
    });

    return ticket;
  });
}

export async function addSupportTicketInternalNote(input: AddSupportTicketMessageInput) {
  const body = normalizeSupportMessage(input.body);
  if (!input.ticketId || !input.authorUserId || !body) return null;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    select: { id: true }
  });
  if (!ticket) return null;

  return prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorUserId: input.authorUserId,
      messageType: "INTERNAL_NOTE",
      body
    }
  });
}

export async function addSupportTicketReply(input: AddSupportTicketMessageInput) {
  const body = normalizeSupportMessage(input.body);
  if (!input.ticketId || !input.authorUserId || !body) return null;

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id: input.ticketId },
      select: {
        id: true,
        email: true,
        subject: true
      }
    });
    if (!ticket) return null;

    const outboundMessage = await tx.outboundMessage.create({
      data: {
        userId: input.authorUserId,
        channel: "EMAIL",
        recipient: ticket.email,
        templateKey: "support_reply",
        subject: getSupportReplySubject(ticket.subject),
        bodyPreview: body,
        status: "PENDING"
      }
    });

    const message = await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorUserId: input.authorUserId,
        messageType: "CUSTOMER_REPLY",
        body,
        outboundMessageId: outboundMessage.id
      }
    });

    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "PENDING" }
    });

    return {
      message,
      outboundMessage
    };
  });
}
