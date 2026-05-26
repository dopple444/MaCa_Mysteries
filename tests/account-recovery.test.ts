import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccountRecoveryCase,
  queueAccountRecoveryEmailVerification,
  queueAccountRecoveryPasswordReset,
  reviewAccountRecoveryCase
} from "../app/lib/account-recovery";
import { hashPassword } from "../app/lib/auth";
import { deleteCommerceFixture, prisma, uniqueTestLabel } from "./helpers/test-data";

async function createAccountRecoveryFixture(prefix: string) {
  const label = uniqueTestLabel(prefix);
  const emailDomain = `@${label}.example`;

  await deleteCommerceFixture(label, emailDomain);

  const [support, host, target] = await Promise.all([
    prisma.user.create({
      data: {
        email: `support${emailDomain}`,
        name: "Recovery Support",
        role: "SUPPORT"
      }
    }),
    prisma.user.create({
      data: {
        email: `host${emailDomain}`,
        name: "Recovery Host",
        role: "HOST"
      }
    }),
    prisma.user.create({
      data: {
        email: `target${emailDomain}`,
        name: "Recovery Target",
        role: "HOST",
        passwordHash: hashPassword("old-password")
      }
    })
  ]);

  const supportTicket = await prisma.supportTicket.create({
    data: {
      userId: target.id,
      email: target.email,
      subject: "I cannot access my account",
      message: "Please help me recover access."
    }
  });

  return { label, emailDomain, support, host, target, supportTicket };
}

test("createAccountRecoveryCase links target account and support ticket", async () => {
  const fixture = await createAccountRecoveryFixture("account-recovery-create");

  try {
    const mismatch = await createAccountRecoveryCase({
      actor: fixture.support,
      email: fixture.host.email,
      supportTicketId: fixture.supportTicket.id,
      requestType: "PASSWORD_RESET"
    });
    assert.equal(mismatch.status, "EMAIL_TICKET_MISMATCH");

    const result = await createAccountRecoveryCase({
      actor: fixture.support,
      email: fixture.target.email.toUpperCase(),
      supportTicketId: fixture.supportTicket.id,
      requestType: "password_reset",
      notes: "Customer wrote in from the account email."
    });

    assert.equal(result.status, "CREATED");
    assert.ok(result.caseId);

    const recoveryCase = await prisma.accountRecoveryCase.findUniqueOrThrow({
      where: { id: result.caseId }
    });
    assert.equal(recoveryCase.email, fixture.target.email);
    assert.equal(recoveryCase.targetUserId, fixture.target.id);
    assert.equal(recoveryCase.supportTicketId, fixture.supportTicket.id);
    assert.equal(recoveryCase.requestType, "PASSWORD_RESET");
    assert.equal(recoveryCase.status, "OPEN");
    assert.equal(recoveryCase.verificationStatus, "PENDING");

    const duplicate = await createAccountRecoveryCase({
      actor: fixture.support,
      email: fixture.target.email,
      requestType: "ACCOUNT_ACCESS"
    });
    assert.equal(duplicate.status, "EXISTS");

    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: fixture.support.id,
        action: "accountRecovery.case.created",
        entityId: result.caseId
      }
    });
    assert.ok(audit);
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("account recovery password reset requires identity verification and queues email only", async () => {
  const fixture = await createAccountRecoveryFixture("account-recovery-reset");

  try {
    const created = await createAccountRecoveryCase({
      actor: fixture.support,
      email: fixture.target.email,
      supportTicketId: fixture.supportTicket.id,
      requestType: "PASSWORD_RESET"
    });
    assert.equal(created.status, "CREATED");
    assert.ok(created.caseId);

    const blocked = await queueAccountRecoveryPasswordReset({
      actor: fixture.support,
      caseId: created.caseId
    });
    assert.equal(blocked.status, "NEEDS_VERIFICATION");

    const reviewed = await reviewAccountRecoveryCase({
      actor: fixture.support,
      caseId: created.caseId,
      verificationStatus: "VERIFIED"
    });
    assert.equal(reviewed.status, "UPDATED");

    const resetQueued = await queueAccountRecoveryPasswordReset({
      actor: fixture.support,
      caseId: created.caseId
    });
    assert.equal(resetQueued.status, "QUEUED");

    const resetMessages = await prisma.outboundMessage.findMany({
      where: {
        recipient: fixture.target.email,
        templateKey: "account_password_reset"
      }
    });
    assert.equal(resetMessages.length, 1);
    assert.match(resetMessages[0]?.bodyPreview ?? "", /reset your MaCa Mysteries password/i);

    const updatedCase = await prisma.accountRecoveryCase.findUniqueOrThrow({
      where: { id: created.caseId }
    });
    assert.equal(updatedCase.status, "ACTIONED");
    assert.ok(updatedCase.passwordResetQueuedAt);

    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: fixture.support.id,
        action: "accountRecovery.passwordResetQueued",
        entityId: created.caseId
      }
    });
    assert.ok(audit);
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("account recovery can queue email verification and close cases", async () => {
  const fixture = await createAccountRecoveryFixture("account-recovery-verification");

  try {
    const forbidden = await createAccountRecoveryCase({
      actor: fixture.host,
      email: fixture.target.email,
      requestType: "EMAIL_VERIFICATION"
    });
    assert.equal(forbidden.status, "FORBIDDEN");

    const created = await createAccountRecoveryCase({
      actor: fixture.support,
      email: fixture.target.email,
      requestType: "EMAIL_VERIFICATION"
    });
    assert.equal(created.status, "CREATED");
    assert.ok(created.caseId);

    const verificationQueued = await queueAccountRecoveryEmailVerification({
      actor: fixture.support,
      caseId: created.caseId
    });
    assert.equal(verificationQueued.status, "QUEUED");

    const verificationMessages = await prisma.outboundMessage.findMany({
      where: {
        recipient: fixture.target.email,
        templateKey: "account_email_verification"
      }
    });
    assert.equal(verificationMessages.length, 1);

    const closed = await reviewAccountRecoveryCase({
      actor: fixture.support,
      caseId: created.caseId,
      resolutionStatus: "CLOSED"
    });
    assert.equal(closed.status, "UPDATED");
    assert.equal(closed.recoveryCase.status, "CLOSED");

    const blocked = await queueAccountRecoveryEmailVerification({
      actor: fixture.support,
      caseId: created.caseId
    });
    assert.equal(blocked.status, "CLOSED");
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});
