import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import {
  addSupportTicketInternalNote,
  addSupportTicketReply,
  createSupportTicket
} from "../app/lib/support-service";

const prisma = new PrismaClient();

async function deleteTestData(emailDomain: string) {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: emailDomain } },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);

  const tickets = await prisma.supportTicket.findMany({
    where: {
      OR: [
        { email: { endsWith: emailDomain } },
        { userId: { in: userIds.length ? userIds : ["__none__"] } }
      ]
    },
    select: { id: true }
  });
  const ticketIds = tickets.map((ticket) => ticket.id);

  await prisma.supportTicketMessage.deleteMany({ where: { ticketId: { in: ticketIds.length ? ticketIds : ["__none__"] } } });
  await prisma.supportTicket.deleteMany({
    where: { id: { in: ticketIds.length ? ticketIds : ["__none__"] } }
  });
  await prisma.outboundMessage.deleteMany({
    where: {
      OR: [
        { recipient: { endsWith: emailDomain } },
        { userId: { in: userIds.length ? userIds : ["__none__"] } }
      ]
    }
  });
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds.length ? userIds : ["__none__"] } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds.length ? userIds : ["__none__"] } } });
}

test("createSupportTicket stores normalized support requests", async () => {
  const label = crypto.randomBytes(6).toString("hex");
  const emailDomain = `@test-support-${label}.example`;

  await deleteTestData(emailDomain);

  const user = await prisma.user.create({
    data: {
      name: "Support Test User",
      email: `user${emailDomain}`,
      role: "HOST",
      passwordHash: "test"
    }
  });

  try {
    const ticket = await createSupportTicket({
      userId: user.id,
      email: ` USER${emailDomain.toUpperCase()} `,
      subject: "  Party setup help  ",
      message: "  I need help with invitations.  "
    });

    assert.ok(ticket);
    assert.equal(ticket.userId, user.id);
    assert.equal(ticket.email, `user${emailDomain}`);
    assert.equal(ticket.subject, "Party setup help");
    assert.equal(ticket.message, "I need help with invitations.");
    assert.equal(ticket.status, "OPEN");
    const initialMessages = await prisma.supportTicketMessage.findMany({
      where: { ticketId: ticket.id },
      select: {
        authorUserId: true,
        messageType: true,
        body: true
      }
    });
    assert.deepEqual(initialMessages, [
      {
        authorUserId: user.id,
        messageType: "CUSTOMER_MESSAGE",
        body: "I need help with invitations."
      }
    ]);

    const missingTicket = await createSupportTicket({
      email: "not-an-email",
      subject: "Missing",
      message: "Missing"
    });
    assert.equal(missingTicket, null);
  } finally {
    await deleteTestData(emailDomain);
  }
});

test("support replies queue email and internal notes stay private", async () => {
  const label = crypto.randomBytes(6).toString("hex");
  const emailDomain = `@test-support-reply-${label}.example`;

  await deleteTestData(emailDomain);

  const [customer, admin] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Support Reply Customer",
        email: `customer${emailDomain}`,
        role: "HOST",
        passwordHash: "test"
      }
    }),
    prisma.user.create({
      data: {
        name: "Support Reply Admin",
        email: `admin${emailDomain}`,
        role: "ADMIN",
        passwordHash: "test"
      }
    })
  ]);

  try {
    const ticket = await createSupportTicket({
      userId: customer.id,
      email: customer.email,
      subject: "Need help",
      message: "Original support request."
    });
    assert.ok(ticket);

    const note = await addSupportTicketInternalNote({
      ticketId: ticket.id,
      authorUserId: admin.id,
      body: "  Check the order history before replying.  "
    });
    assert.ok(note);
    assert.equal(note.messageType, "INTERNAL_NOTE");
    assert.equal(note.body, "Check the order history before replying.");

    const reply = await addSupportTicketReply({
      ticketId: ticket.id,
      authorUserId: admin.id,
      body: "  Thanks, we are checking this now.  "
    });
    assert.ok(reply);
    assert.equal(reply.message.messageType, "CUSTOMER_REPLY");
    assert.equal(reply.message.body, "Thanks, we are checking this now.");
    assert.equal(reply.outboundMessage.recipient, customer.email);
    assert.equal(reply.outboundMessage.templateKey, "support_reply");
    assert.equal(reply.outboundMessage.subject, "Re: Need help");

    const updatedTicket = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id },
      select: { status: true }
    });
    assert.equal(updatedTicket.status, "PENDING");

    const messages = await prisma.supportTicketMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "asc" },
      select: { messageType: true }
    });
    assert.deepEqual(messages.map((message) => message.messageType), [
      "CUSTOMER_MESSAGE",
      "INTERNAL_NOTE",
      "CUSTOMER_REPLY"
    ]);
  } finally {
    await deleteTestData(emailDomain);
  }
});
