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
  retryOutboundMessage
} from "../app/lib/outbound-delivery";

const prisma = new PrismaClient();

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
