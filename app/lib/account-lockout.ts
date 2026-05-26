import type { User } from "@prisma/client";

import { getAdminAlertRecipients, getAdminAlertUrl, getAlertDedupeCutoff } from "./admin-alerts";
import { queueEmailMessage } from "./outbound-delivery";
import { prisma } from "./prisma";

export const ACCOUNT_LOCKOUT_THRESHOLD = 5;
export const ACCOUNT_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const DEFAULT_ACCOUNT_SECURITY_ALERT_DEDUPE_MINUTES = 60;

type LockoutUser = Pick<User, "id" | "failedLoginCount" | "lastFailedLoginAt" | "lockedUntil">;
type EnvMap = Partial<Record<string, string | undefined>>;

type AccountLockoutAlertInput = {
  userId: string;
  email: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
  now?: Date;
  env?: EnvMap;
  dedupeMinutes?: number;
};

export function isAccountLocked(user: Pick<User, "lockedUntil">, now = new Date()) {
  return Boolean(user.lockedUntil && user.lockedUntil > now);
}

export function getNextFailedLoginCount(user: Pick<User, "failedLoginCount" | "lastFailedLoginAt">, now = new Date()) {
  const previousFailureStillRelevant =
    user.lastFailedLoginAt && now.getTime() - user.lastFailedLoginAt.getTime() <= ACCOUNT_LOCKOUT_WINDOW_MS;
  return previousFailureStillRelevant ? user.failedLoginCount + 1 : 1;
}

export async function recordFailedLogin(user: LockoutUser, now = new Date()) {
  if (isAccountLocked(user, now)) {
    return {
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      locked: true
    };
  }

  const failedLoginCount = getNextFailedLoginCount(user, now);
  const lockedUntil =
    failedLoginCount >= ACCOUNT_LOCKOUT_THRESHOLD ? new Date(now.getTime() + ACCOUNT_LOCKOUT_DURATION_MS) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount,
      lastFailedLoginAt: now,
      lockedUntil
    }
  });

  return {
    failedLoginCount,
    lockedUntil,
    locked: Boolean(lockedUntil)
  };
}

export async function recordSuccessfulLogin(userId: string, now = new Date()) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      lastLoginAt: now
    }
  });
}

export async function clearAccountLockout(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      lockedUntil: null
    }
  });
}

export function getAccountSecurityAlertRecipients(env: EnvMap = process.env) {
  return getAdminAlertRecipients(env);
}

export async function queueAccountLockoutAlert(input: AccountLockoutAlertInput) {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const recipients = getAccountSecurityAlertRecipients(env);

  if (!recipients.length) {
    return {
      status: "NOT_CONFIGURED" as const,
      queuedCount: 0,
      skippedDuplicateCount: 0,
      recipients
    };
  }

  const email = input.email.trim().toLowerCase();
  const adminUrl = getAdminAlertUrl(env, "/admin/users");
  const lockedUntil = input.lockedUntil?.toISOString() ?? "";
  const bodyPreview = [
    "Account security alert.",
    `${email} was temporarily locked after ${input.failedLoginCount} failed sign-in attempts.`,
    lockedUntil ? `Locked until: ${lockedUntil}.` : "",
    `Review: ${adminUrl}`
  ]
    .filter(Boolean)
    .join(" ");
  const dedupeCutoff = getAlertDedupeCutoff(
    now,
    input.dedupeMinutes,
    DEFAULT_ACCOUNT_SECURITY_ALERT_DEDUPE_MINUTES
  );
  let queuedCount = 0;
  let skippedDuplicateCount = 0;

  for (const recipient of recipients) {
    const existing = await prisma.outboundMessage.findFirst({
      where: {
        channel: "EMAIL",
        recipient,
        templateKey: "account_lockout_alert",
        bodyPreview: { contains: email },
        createdAt: { gte: dedupeCutoff }
      },
      select: { id: true }
    });

    if (existing) {
      skippedDuplicateCount += 1;
      continue;
    }

    const message = await queueEmailMessage({
      userId: input.userId,
      recipient,
      templateKey: "account_lockout_alert",
      subject: "MaCa Mysteries account lockout alert",
      bodyPreview
    });

    if (message) queuedCount += 1;
  }

  return {
    status: queuedCount ? ("QUEUED" as const) : ("DUPLICATE" as const),
    queuedCount,
    skippedDuplicateCount,
    recipients
  };
}
