import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextFailedLoginCount,
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin
} from "../app/lib/account-lockout";
import {
  createAccountActionToken,
  queueEmailVerificationMessage,
  queuePasswordResetMessage,
  resetUserPasswordWithToken,
  verifyAccountActionToken,
  verifyUserEmail
} from "../app/lib/account-security";
import { logAuthAuditEvent } from "../app/lib/auth-audit";
import { getPostLoginRedirectPath } from "../app/lib/auth-flow";
import { hashPassword, verifyPassword } from "../app/lib/auth";
import { deleteCommerceFixture, prisma, uniqueTestLabel } from "./helpers/test-data";

async function createAccountSecurityFixture(prefix: string) {
  const label = uniqueTestLabel(prefix);
  const slug = label;
  const emailDomain = `@${label}.example`;

  await deleteCommerceFixture(slug, emailDomain);

  const user = await prisma.user.create({
    data: {
      email: `host${emailDomain}`,
      name: "Account Security Host",
      passwordHash: hashPassword("old-password-123")
    }
  });

  return { label, slug, emailDomain, user };
}

test("email verification tokens verify users and mark email verified", async () => {
  const fixture = await createAccountSecurityFixture("account-security-verify");

  try {
    const queued = await queueEmailVerificationMessage(fixture.user.id);
    assert.equal(queued.queued, true);

    const message = await prisma.outboundMessage.findFirstOrThrow({
      where: {
        userId: fixture.user.id,
        templateKey: "account_email_verification"
      }
    });
    assert.match(message.bodyPreview, /\/account\/verify-email\/confirm\?token=/);

    const token = createAccountActionToken({
      user: fixture.user,
      purpose: "email-verification",
      expiresInMinutes: 10
    });
    const verifiedUser = await verifyAccountActionToken(token, "email-verification");
    assert.equal(verifiedUser?.id, fixture.user.id);

    const result = await verifyUserEmail(token);
    assert.equal(result.verified, true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    assert.ok(user.emailVerifiedAt);
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("login redirects verified users to the dashboard and unverified users to email verification", () => {
  assert.equal(getPostLoginRedirectPath({ emailVerifiedAt: new Date() }), "/dashboard");
  assert.equal(getPostLoginRedirectPath({ emailVerifiedAt: null }), "/account/verify-email?sent=1");
});

test("password reset tokens queue email and become invalid after password reset", async () => {
  const fixture = await createAccountSecurityFixture("account-security-reset");
  const previousAppUrl = process.env.APP_URL;
  process.env.APP_URL = "https://maca.example";

  try {
    const queued = await queuePasswordResetMessage(fixture.user.email);
    assert.equal(queued.queued, true);

    const message = await prisma.outboundMessage.findFirstOrThrow({
      where: {
        userId: fixture.user.id,
        templateKey: "account_password_reset"
      }
    });
    assert.match(message.bodyPreview, /https:\/\/maca\.example\/reset-password\?token=/);

    const token = createAccountActionToken({
      user: fixture.user,
      purpose: "password-reset",
      expiresInMinutes: 10
    });
    await prisma.user.update({
      where: { id: fixture.user.id },
      data: {
        failedLoginCount: 5,
        lastFailedLoginAt: new Date(),
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000)
      }
    });
    await prisma.userSession.create({
      data: {
        userId: fixture.user.id,
        tokenHash: `${fixture.label}-reset-session`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    const result = await resetUserPasswordWithToken(token, "new-password-456");
    assert.equal(result.reset, true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    assert.ok(user.passwordHash);
    assert.equal(verifyPassword("new-password-456", user.passwordHash), true);
    assert.equal(user.failedLoginCount, 0);
    assert.equal(user.lockedUntil, null);

    const resetRevokedSession = await prisma.userSession.findFirstOrThrow({
      where: {
        userId: fixture.user.id,
        revokeReason: "PASSWORD_RESET"
      }
    });
    assert.ok(resetRevokedSession.revokedAt);

    const reused = await verifyAccountActionToken(token, "password-reset");
    assert.equal(reused, null);
  } finally {
    if (previousAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = previousAppUrl;
    }
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("account lockout tracks consecutive failures and clears after success", async () => {
  const fixture = await createAccountSecurityFixture("account-security-lockout");
  const now = new Date();

  try {
    assert.equal(getNextFailedLoginCount({ failedLoginCount: 2, lastFailedLoginAt: now }, now), 3);
    assert.equal(
      getNextFailedLoginCount({
        failedLoginCount: 2,
        lastFailedLoginAt: new Date(now.getTime() - 20 * 60 * 1000)
      }),
      1
    );

    let user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    assert.equal(isAccountLocked(user, now), false);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const state = await recordFailedLogin(user, now);
      user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
      assert.equal(state.failedLoginCount, attempt);
    }

    assert.equal(user.failedLoginCount, 5);
    assert.ok(user.lockedUntil);
    assert.equal(isAccountLocked(user, now), true);

    await recordSuccessfulLogin(user.id, now);
    user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    assert.equal(user.failedLoginCount, 0);
    assert.equal(user.lockedUntil, null);
    assert.ok(user.lastLoginAt);
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("expired account action tokens are rejected", async () => {
  const fixture = await createAccountSecurityFixture("account-security-expired");

  try {
    const token = createAccountActionToken({
      user: fixture.user,
      purpose: "password-reset",
      expiresInMinutes: -1
    });
    const verifiedUser = await verifyAccountActionToken(token, "password-reset");
    assert.equal(verifiedUser, null);
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});

test("auth audit events record normalized account security metadata", async () => {
  const fixture = await createAccountSecurityFixture("account-security-auth-audit");

  try {
    await logAuthAuditEvent({
      action: "auth.login.failed",
      userId: fixture.user.id,
      email: `HOST${fixture.emailDomain.toUpperCase()}`,
      reason: "invalid_credentials"
    });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        userId: fixture.user.id,
        action: "auth.login.failed"
      }
    });

    assert.equal(audit.entityType, "User");
    assert.equal(audit.entityId, fixture.user.id);
    assert.equal((audit.metadata as Record<string, string>).email, fixture.user.email);
    assert.equal((audit.metadata as Record<string, string>).reason, "invalid_credentials");
  } finally {
    await deleteCommerceFixture(fixture.slug, fixture.emailDomain);
  }
});
