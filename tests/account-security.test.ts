import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccountActionToken,
  queueEmailVerificationMessage,
  queuePasswordResetMessage,
  resetUserPasswordWithToken,
  verifyAccountActionToken,
  verifyUserEmail
} from "../app/lib/account-security";
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
    const result = await resetUserPasswordWithToken(token, "new-password-456");
    assert.equal(result.reset, true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    assert.ok(user.passwordHash);
    assert.equal(verifyPassword("new-password-456", user.passwordHash), true);

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
