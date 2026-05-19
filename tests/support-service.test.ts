import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { createSupportTicket } from "../app/lib/support-service";

const prisma = new PrismaClient();

async function deleteTestData(emailDomain: string) {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: emailDomain } },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);

  await prisma.supportTicket.deleteMany({
    where: {
      OR: [
        { email: { endsWith: emailDomain } },
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
