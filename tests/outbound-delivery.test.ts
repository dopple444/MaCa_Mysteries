import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import {
  getOutboundProvider,
  markOutboundMessageFailed,
  markOutboundMessageSent,
  queueEmailMessage,
  queueSmsMessage,
  retryOutboundMessage,
  sendPendingEmailMessages
} from "../app/lib/outbound-delivery";

const prisma = new PrismaClient();

async function createInvitationDeliveryFixture() {
  const label = crypto.randomBytes(6).toString("hex");
  const email = `invite-delivery-${label}@example.com`;
  const host = await prisma.user.create({
    data: {
      email: `host-${email}`,
      name: "Invitation Delivery Host"
    }
  });
  const party = await prisma.party.create({
    data: {
      title: "Invitation Delivery Party",
      gameSlug: `invite-delivery-${label}`,
      hostId: host.id,
      inviteCode: label.slice(0, 8).toUpperCase()
    }
  });
  const guest = await prisma.guest.create({
    data: {
      partyId: party.id,
      name: "Invitation Delivery Guest",
      email,
      guestToken: `invite-delivery-token-${label}`,
      invitationStatus: "QUEUED",
      invitationLastQueuedAt: new Date()
    }
  });
  const message = await prisma.outboundMessage.create({
    data: {
      userId: host.id,
      partyId: party.id,
      channel: "EMAIL",
      recipient: guest.email,
      templateKey: "party_invitation",
      subject: "Invitation Delivery Test",
      bodyPreview: "Invitation delivery state test.",
      status: "PENDING"
    }
  });

  return { host, party, guest, message };
}

async function deleteInvitationDeliveryFixture(input: { hostId: string; partyId: string }) {
  await prisma.outboundMessage.deleteMany({ where: { partyId: input.partyId } });
  await prisma.guest.deleteMany({ where: { partyId: input.partyId } });
  await prisma.party.deleteMany({ where: { id: input.partyId } });
  await prisma.user.deleteMany({ where: { id: input.hostId } });
}

test("getOutboundProvider reads configured providers by channel", () => {
  assert.equal(getOutboundProvider("EMAIL", { EMAIL_PROVIDER: "resend" }), "resend");
  assert.equal(getOutboundProvider("SMS", { SMS_PROVIDER: "twilio" }), "twilio");
  assert.equal(getOutboundProvider("PUSH", {}), null);
});

test("queueSmsMessage creates pending SMS and delivery markers update status", async () => {
  const message = await queueSmsMessage({
    recipient: "+15555550123",
    templateKey: "test_sms",
    bodyPreview: "Test message"
  });
  assert.ok(message);

  try {
    assert.equal(message.channel, "SMS");
    assert.equal(message.status, "PENDING");

    const sent = await markOutboundMessageSent(message.id, "twilio", "SM123");
    assert.equal(sent.status, "SENT");
    assert.equal(sent.provider, "twilio");
    assert.equal(sent.providerMessageId, "SM123");
    assert.ok(sent.sentAt);

    const failed = await markOutboundMessageFailed(message.id, "twilio", "test failure");
    assert.equal(failed.status, "FAILED");
    assert.equal(failed.errorMessage, "test failure");
  } finally {
    await prisma.outboundMessage.deleteMany({ where: { id: message.id } });
  }
});

test("queueEmailMessage creates retryable provider-ready email jobs", async () => {
  const recipient = `email-${crypto.randomBytes(6).toString("hex")}@example.com`;

  try {
    const message = await queueEmailMessage({
      recipient,
      templateKey: "test_email",
      subject: "Test email",
      bodyPreview: "This is a test email."
    });
    assert.ok(message);
    assert.equal(message.channel, "EMAIL");
    assert.equal(message.status, "PENDING");
    assert.equal(message.recipient, recipient);

    const failed = await markOutboundMessageFailed(message.id, "test-provider", "Temporary provider error");
    assert.equal(failed.status, "FAILED");
    assert.equal(failed.errorMessage, "Temporary provider error");

    const retried = await retryOutboundMessage(message.id);
    assert.equal(retried.status, "PENDING");
    assert.equal(retried.errorMessage, "");
    assert.equal(retried.providerMessageId, "");
  } finally {
    await prisma.outboundMessage.deleteMany({ where: { recipient } });
  }
});

test("invitation delivery markers update guest invitation state", async () => {
  const fixture = await createInvitationDeliveryFixture();

  try {
    const failed = await markOutboundMessageFailed(fixture.message.id, "resend", "Mailbox unavailable");
    assert.equal(failed.status, "FAILED");
    const failedGuest = await prisma.guest.findUniqueOrThrow({ where: { id: fixture.guest.id } });
    assert.equal(failedGuest.invitationStatus, "FAILED");
    assert.ok(failedGuest.invitationFailedAt);
    assert.equal(failedGuest.invitationFailureDetail, "Mailbox unavailable");

    const retried = await retryOutboundMessage(fixture.message.id);
    assert.equal(retried.status, "PENDING");
    const queuedGuest = await prisma.guest.findUniqueOrThrow({ where: { id: fixture.guest.id } });
    assert.equal(queuedGuest.invitationStatus, "QUEUED");
    assert.ok(queuedGuest.invitationLastQueuedAt);
    assert.equal(queuedGuest.invitationFailureDetail, "");

    const sent = await markOutboundMessageSent(fixture.message.id, "resend", "email_test_invite");
    assert.equal(sent.status, "SENT");
    const sentGuest = await prisma.guest.findUniqueOrThrow({ where: { id: fixture.guest.id } });
    assert.equal(sentGuest.invitationStatus, "SENT");
    assert.ok(sentGuest.invitationLastSentAt);
    assert.equal(sentGuest.invitationFailureDetail, "");
  } finally {
    await deleteInvitationDeliveryFixture({ hostId: fixture.host.id, partyId: fixture.party.id });
  }
});

test("sendPendingEmailMessages supports console delivery", async () => {
  const recipient = `console-${crypto.randomBytes(6).toString("hex")}@example.com`;

  try {
    const message = await queueEmailMessage({
      recipient,
      templateKey: "console_email",
      subject: "Console email",
      bodyPreview: "Console delivery test."
    });
    assert.ok(message);

    const result = await sendPendingEmailMessages({
      messageIds: [message.id],
      env: {
        EMAIL_PROVIDER: "console"
      }
    });

    assert.equal(result.status, "DELIVERED");
    assert.ok(result.sentCount >= 1);

    const delivered = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: message.id } });
    assert.equal(delivered.status, "SENT");
    assert.equal(delivered.provider, "console");
    assert.equal(delivered.providerMessageId, `console_${message.id}`);
  } finally {
    await prisma.outboundMessage.deleteMany({ where: { recipient } });
  }
});

test("sendPendingEmailMessages sends through Resend with idempotency", async () => {
  const recipient = `resend-${crypto.randomBytes(6).toString("hex")}@example.com`;

  try {
    const message = await queueEmailMessage({
      recipient,
      templateKey: "resend_email",
      subject: "Resend email",
      bodyPreview: "Resend delivery test."
    });
    assert.ok(message);

    let requestBody: Record<string, unknown> | null = null;
    let idempotencyKey = "";
    const result = await sendPendingEmailMessages({
      messageIds: [message.id],
      env: {
        EMAIL_PROVIDER: "resend",
        EMAIL_API_KEY: "re_test_123",
        EMAIL_FROM: "MaCa Mysteries <test@example.com>"
      },
      fetcher: async (_url, init) => {
        requestBody = JSON.parse(init.body);
        idempotencyKey = init.headers["Idempotency-Key"];
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "email_test_123" }),
          text: async () => ""
        };
      }
    });

    assert.equal(result.status, "DELIVERED");
    assert.equal(result.sentCount, 1);
    assert.equal(idempotencyKey, message.id);
    const body = requestBody as { to?: unknown; subject?: unknown } | null;
    assert.ok(body);
    assert.deepEqual(body.to, [recipient]);
    assert.equal(body.subject, "Resend email");

    const delivered = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: message.id } });
    assert.equal(delivered.status, "SENT");
    assert.equal(delivered.provider, "resend");
    assert.equal(delivered.providerMessageId, "email_test_123");
  } finally {
    await prisma.outboundMessage.deleteMany({ where: { recipient } });
  }
});

test("sendPendingEmailMessages marks Resend failures as failed", async () => {
  const recipient = `resend-failure-${crypto.randomBytes(6).toString("hex")}@example.com`;

  try {
    const message = await queueEmailMessage({
      recipient,
      templateKey: "resend_failure_email",
      subject: "Resend failure email",
      bodyPreview: "Resend failure delivery test."
    });
    assert.ok(message);

    const result = await sendPendingEmailMessages({
      messageIds: [message.id],
      env: {
        EMAIL_PROVIDER: "resend",
        EMAIL_API_KEY: "re_test_123",
        EMAIL_FROM: "MaCa Mysteries <test@example.com>"
      },
      fetcher: async () => ({
        ok: false,
        status: 422,
        json: async () => ({}),
        text: async () => "Invalid sender"
      })
    });

    assert.equal(result.status, "PARTIAL");
    assert.equal(result.failedCount, 1);

    const failed = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: message.id } });
    assert.equal(failed.status, "FAILED");
    assert.equal(failed.provider, "resend");
    assert.equal(failed.errorMessage, "Invalid sender");
  } finally {
    await prisma.outboundMessage.deleteMany({ where: { recipient } });
  }
});
