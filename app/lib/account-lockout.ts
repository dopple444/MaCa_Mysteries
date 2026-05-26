import type { User } from "@prisma/client";

import { prisma } from "./prisma";

export const ACCOUNT_LOCKOUT_THRESHOLD = 5;
export const ACCOUNT_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

type LockoutUser = Pick<User, "id" | "failedLoginCount" | "lastFailedLoginAt" | "lockedUntil">;

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
