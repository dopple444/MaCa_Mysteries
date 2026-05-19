import { prisma } from "./prisma";

type CreateSupportTicketInput = {
  userId?: string | null;
  email: string;
  subject: string;
  message: string;
};

export async function createSupportTicket(input: CreateSupportTicketInput) {
  const email = input.email.trim().toLowerCase();
  const subject = input.subject.trim();
  const message = input.message.trim();

  if (!email.includes("@") || !subject || !message) return null;

  return prisma.supportTicket.create({
    data: {
      userId: input.userId ?? null,
      email,
      subject,
      message
    }
  });
}
