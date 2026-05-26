import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccountRecoveryCase,
  getAccountRecoveryReport,
  getAccountRecoveryRiskSummary,
  queueAccountRecoveryRiskAlert,
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

test("account recovery report summarizes active, stale, and recent actioned cases", async () => {
  const fixture = await createAccountRecoveryFixture("account-recovery-report");
  const now = new Date("2026-05-26T12:00:00.000Z");
  const staleCreatedAt = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const recentActionAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  try {
    await prisma.accountRecoveryCase.createMany({
      data: [
        {
          requestedByUserId: fixture.support.id,
          targetUserId: fixture.target.id,
          email: `open-pending${fixture.emailDomain}`,
          status: "OPEN",
          verificationStatus: "PENDING",
          createdAt: staleCreatedAt
        },
        {
          requestedByUserId: fixture.support.id,
          targetUserId: fixture.target.id,
          email: `open-verified${fixture.emailDomain}`,
          status: "OPEN",
          verificationStatus: "VERIFIED",
          createdAt: now
        },
        {
          requestedByUserId: fixture.support.id,
          targetUserId: fixture.target.id,
          email: `actioned-reset${fixture.emailDomain}`,
          status: "ACTIONED",
          verificationStatus: "VERIFIED",
          createdAt: staleCreatedAt,
          passwordResetQueuedAt: recentActionAt
        },
        {
          requestedByUserId: fixture.support.id,
          targetUserId: fixture.target.id,
          email: `actioned-verification${fixture.emailDomain}`,
          status: "ACTIONED",
          verificationStatus: "VERIFIED",
          createdAt: now,
          emailVerificationQueuedAt: recentActionAt
        },
        {
          requestedByUserId: fixture.support.id,
          targetUserId: fixture.target.id,
          reviewedByUserId: fixture.support.id,
          email: `closed${fixture.emailDomain}`,
          status: "CLOSED",
          verificationStatus: "VERIFIED",
          createdAt: now,
          reviewedAt: recentActionAt
        },
        {
          requestedByUserId: fixture.support.id,
          targetUserId: fixture.target.id,
          reviewedByUserId: fixture.support.id,
          email: `denied${fixture.emailDomain}`,
          status: "DENIED",
          verificationStatus: "FAILED",
          createdAt: now,
          reviewedAt: recentActionAt
        }
      ]
    });

    const report = await getAccountRecoveryReport({
      now,
      staleAfterHours: 48,
      recentDays: 7,
      emailDomain: fixture.emailDomain
    });

    assert.equal(report.openCaseCount, 2);
    assert.equal(report.actionedCaseCount, 2);
    assert.equal(report.pendingVerificationCount, 1);
    assert.equal(report.verifiedOpenCaseCount, 1);
    assert.equal(report.staleOpenCaseCount, 2);
    assert.equal(report.passwordResetQueuedRecentCount, 1);
    assert.equal(report.emailVerificationQueuedRecentCount, 1);
    assert.equal(report.closedRecentCount, 1);
    assert.equal(report.deniedRecentCount, 1);
    assert.equal(report.repeatedEmailRiskCount, 0);
    assert.equal(report.failedVerificationRiskCount, 1);
    assert.equal(report.shouldQueueRiskAlert, false);
    assert.equal(report.staleCutoff.toISOString(), "2026-05-24T12:00:00.000Z");
    assert.equal(report.recentCutoff.toISOString(), "2026-05-19T12:00:00.000Z");
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("account recovery risk summary and alerts flag repeated requests", async () => {
  const fixture = await createAccountRecoveryFixture("account-recovery-risk");
  const now = new Date("2026-05-26T12:00:00.000Z");
  const repeatedEmail = `repeat${fixture.emailDomain}`;
  const alertRecipient = `security${fixture.emailDomain}`;

  try {
    await prisma.accountRecoveryCase.createMany({
      data: [
        {
          requestedByUserId: fixture.support.id,
          targetUserId: fixture.target.id,
          reviewedByUserId: fixture.support.id,
          email: repeatedEmail,
          status: "CLOSED",
          verificationStatus: "VERIFIED",
          createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          reviewedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
        },
        {
          requestedByUserId: fixture.support.id,
          targetUserId: fixture.target.id,
          reviewedByUserId: fixture.support.id,
          email: repeatedEmail,
          status: "DENIED",
          verificationStatus: "FAILED",
          createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          reviewedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          requestedByUserId: fixture.support.id,
          targetUserId: fixture.target.id,
          email: repeatedEmail,
          status: "OPEN",
          verificationStatus: "PENDING",
          createdAt: now
        }
      ]
    });

    const summary = await getAccountRecoveryRiskSummary({
      now,
      windowDays: 30,
      repeatedEmailThreshold: 3,
      failedVerificationThreshold: 3,
      emailDomain: fixture.emailDomain
    });

    assert.equal(summary.caseCount, 3);
    assert.equal(summary.activeCaseCount, 1);
    assert.equal(summary.repeatedEmailCount, 1);
    assert.equal(summary.failedVerificationCount, 1);
    assert.equal(summary.shouldAlert, true);

    const result = await queueAccountRecoveryRiskAlert({
      now,
      windowDays: 30,
      repeatedEmailThreshold: 3,
      failedVerificationThreshold: 3,
      emailDomain: fixture.emailDomain,
      dedupeMinutes: 360,
      env: {
        ADMIN_ALERT_EMAILS: `${alertRecipient}, ${alertRecipient.toUpperCase()}`,
        APP_URL: "https://staging.macamysteries.com"
      }
    });

    assert.equal(result.status, "QUEUED");
    assert.equal(result.queuedCount, 1);
    assert.equal(result.skippedDuplicateCount, 0);

    const message = await prisma.outboundMessage.findFirstOrThrow({
      where: {
        recipient: alertRecipient,
        templateKey: "account_recovery_risk_alert"
      }
    });
    assert.match(message.bodyPreview, /Repeated account emails: 1/);
    assert.match(message.bodyPreview, /https:\/\/staging\.macamysteries\.com\/admin\/account-recovery/);

    const duplicate = await queueAccountRecoveryRiskAlert({
      now,
      windowDays: 30,
      repeatedEmailThreshold: 3,
      failedVerificationThreshold: 3,
      emailDomain: fixture.emailDomain,
      dedupeMinutes: 360,
      env: {
        ADMIN_ALERT_EMAILS: alertRecipient,
        APP_URL: "https://staging.macamysteries.com"
      }
    });

    assert.equal(duplicate.status, "DUPLICATE");
    assert.equal(duplicate.queuedCount, 0);
    assert.equal(duplicate.skippedDuplicateCount, 1);
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});
