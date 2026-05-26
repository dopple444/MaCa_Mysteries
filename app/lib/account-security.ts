import crypto from "crypto";

import type { User } from "@prisma/client";

import { getAppBaseUrl } from "./app-url";
import { logAuditEvent } from "./audit-log";
import { hashPassword } from "./auth";
import { queueEmailMessage } from "./outbound-delivery";
import { prisma } from "./prisma";

type AccountTokenPurpose = "email-verification" | "password-reset";

type AccountTokenPayload = {
  v: 1;
  purpose: AccountTokenPurpose;
  userId: string;
  email: string;
  exp: number;
  version: string;
};

type CreateAccountTokenInput = {
  user: User;
  purpose: AccountTokenPurpose;
  expiresInMinutes: number;
};

function base64UrlJson(value: AccountTokenPayload) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseBase64UrlJson(value: string): AccountTokenPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const payload = parsed as Partial<AccountTokenPayload>;
    if (
      payload.v !== 1 ||
      (payload.purpose !== "email-verification" && payload.purpose !== "password-reset") ||
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.exp !== "number" ||
      typeof payload.version !== "string"
    ) {
      return null;
    }
    return payload as AccountTokenPayload;
  } catch {
    return null;
  }
}

function getAccountTokenSecret() {
  return process.env.ACCOUNT_TOKEN_SECRET || process.env.CSRF_SECRET || process.env.DATABASE_URL || "development-account-token-secret";
}

function signTokenPayload(payload: string) {
  return crypto.createHmac("sha256", getAccountTokenSecret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function makeUserTokenVersion(user: Pick<User, "id" | "email" | "passwordHash" | "createdAt">, purpose: AccountTokenPurpose) {
  const passwordVersion = purpose === "password-reset" ? user.passwordHash ?? "" : "";
  return crypto
    .createHash("sha256")
    .update(`${purpose}:${user.id}:${user.email}:${passwordVersion}:${user.createdAt.toISOString()}`)
    .digest("base64url");
}

export function createAccountActionToken({ user, purpose, expiresInMinutes }: CreateAccountTokenInput) {
  const payload = base64UrlJson({
    v: 1,
    purpose,
    userId: user.id,
    email: user.email,
    exp: Date.now() + expiresInMinutes * 60 * 1000,
    version: makeUserTokenVersion(user, purpose)
  });
  return `${payload}.${signTokenPayload(payload)}`;
}

export async function verifyAccountActionToken(token: string, purpose: AccountTokenPurpose) {
  const [payloadText, signature] = token.split(".");
  if (!payloadText || !signature || !safeEqual(signature, signTokenPayload(payloadText))) return null;

  const payload = parseBase64UrlJson(payloadText);
  if (!payload || payload.purpose !== purpose || payload.exp < Date.now()) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.email !== payload.email) return null;

  const expectedVersion = makeUserTokenVersion(user, purpose);
  if (!safeEqual(payload.version, expectedVersion)) return null;

  return user;
}

export async function queueEmailVerificationMessage(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { queued: false, alreadyVerified: false };
  if (user.emailVerifiedAt) return { queued: false, alreadyVerified: true };

  const token = createAccountActionToken({
    user,
    purpose: "email-verification",
    expiresInMinutes: 60 * 24 * 7
  });
  const link = `${getAppBaseUrl()}/account/verify-email/confirm?token=${encodeURIComponent(token)}`;
  const message = await queueEmailMessage({
    userId: user.id,
    recipient: user.email,
    templateKey: "account_email_verification",
    subject: "Verify your MaCa Mysteries email",
    bodyPreview: `Hi ${user.name}, verify your MaCa Mysteries account email: ${link}`
  });

  return { queued: Boolean(message), alreadyVerified: false };
}

export async function verifyUserEmail(token: string) {
  const user = await verifyAccountActionToken(token, "email-verification");
  if (!user) return { verified: false, userId: null };
  if (user.emailVerifiedAt) return { verified: true, userId: user.id };

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() }
  });
  await logAuditEvent({
    action: "account.email.verified",
    userId: user.id,
    entityType: "User",
    entityId: user.id
  });

  return { verified: true, userId: user.id };
}

export async function queuePasswordResetMessage(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { queued: false };

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.passwordHash) return { queued: false };

  const token = createAccountActionToken({
    user,
    purpose: "password-reset",
    expiresInMinutes: 60
  });
  const link = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const message = await queueEmailMessage({
    userId: user.id,
    recipient: user.email,
    templateKey: "account_password_reset",
    subject: "Reset your MaCa Mysteries password",
    bodyPreview: `Hi ${user.name}, reset your MaCa Mysteries password: ${link}`
  });

  return { queued: Boolean(message) };
}

export async function resetUserPasswordWithToken(token: string, password: string) {
  const user = await verifyAccountActionToken(token, "password-reset");
  if (!user) return { reset: false, userId: null };

  const passwordHash = hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lastFailedLoginAt: null,
        lockedUntil: null
      }
    }),
    prisma.userSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null
      },
      data: {
        revokedAt: new Date(),
        revokeReason: "PASSWORD_RESET"
      }
    })
  ]);
  await logAuditEvent({
    action: "account.password.reset",
    userId: user.id,
    entityType: "User",
    entityId: user.id
  });

  return { reset: true, userId: user.id };
}
