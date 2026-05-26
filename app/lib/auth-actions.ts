"use server";

import { redirect } from "next/navigation";

import { queueEmailVerificationMessage } from "./account-security";
import {
  createSession,
  clearSession,
  getCurrentUser,
  getRequestSessionMetadata,
  hashPassword,
  verifyPassword
} from "./auth";
import { logAuthAuditEvent } from "./auth-audit";
import { isAccountLocked, queueAccountLockoutAlert, recordFailedLogin, recordSuccessfulLogin } from "./account-lockout";
import { getPostLoginRedirectPath } from "./auth-flow";
import { verifyCsrfToken } from "./csrf";
import { prisma } from "./prisma";
import { checkRateLimit } from "./rate-limit";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function login(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    await logAuthAuditEvent({ action: "auth.login.failed", reason: "csrf" });
    redirect("/login?error=invalid");
  }
  const email = getFormValue(formData, "email").toLowerCase();
  const password = getFormValue(formData, "password");
  const rateLimit = await checkRateLimit({
    scope: "login",
    key: email,
    limit: 10,
    windowSeconds: 15 * 60
  });

  if (!rateLimit.allowed) {
    await logAuthAuditEvent({ action: "auth.login.rateLimited", email, reason: "rate_limit" });
    redirect("/login?error=rate-limited");
  }

  if (!email || !password) {
    await logAuthAuditEvent({ action: "auth.login.failed", email, reason: "missing_credentials" });
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && isAccountLocked(user)) {
    await logAuthAuditEvent({
      action: "auth.login.locked",
      userId: user.id,
      email,
      reason: "account_locked",
      metadata: {
        lockedUntil: user.lockedUntil?.toISOString() ?? ""
      }
    });
    redirect("/login?error=locked");
  }

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    const failedState = user ? await recordFailedLogin(user) : null;
    await logAuthAuditEvent({
      action: "auth.login.failed",
      userId: user?.id,
      email,
      reason: failedState?.locked ? "account_locked_after_failures" : "invalid_credentials",
      metadata: {
        failedLoginCount: failedState?.failedLoginCount ?? 0,
        lockedUntil: failedState?.lockedUntil?.toISOString() ?? ""
      }
    });
    if (user && failedState?.locked) {
      await queueAccountLockoutAlert({
        userId: user.id,
        email: user.email,
        failedLoginCount: failedState.failedLoginCount,
        lockedUntil: failedState.lockedUntil
      });
    }
    redirect(failedState?.locked ? "/login?error=locked" : "/login?error=invalid");
  }

  const sessionMetadata = await getRequestSessionMetadata("LOGIN");
  await createSession(user.id, sessionMetadata);
  await recordSuccessfulLogin(user.id);
  await logAuthAuditEvent({
    action: "auth.login.success",
    userId: user.id,
    email: user.email,
    reason: user.emailVerifiedAt ? "verified" : "email_verification_required",
    metadata: {
      ipAddress: sessionMetadata.ipAddress ?? "",
      userAgent: sessionMetadata.userAgent ?? ""
    }
  });
  const destination = getPostLoginRedirectPath(user);
  if (!user.emailVerifiedAt) {
    await queueEmailVerificationMessage(user.id);
  }
  redirect(destination);
}

export async function signup(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/signup?error=invalid");
  }
  const name = getFormValue(formData, "name");
  const email = getFormValue(formData, "email").toLowerCase();
  const password = getFormValue(formData, "password");
  const rateLimit = await checkRateLimit({
    scope: "signup",
    key: email,
    limit: 5,
    windowSeconds: 60 * 60
  });

  if (!rateLimit.allowed) {
    redirect("/signup?error=rate-limited");
  }

  if (!name || !email || !password) {
    redirect("/signup?error=invalid");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/signup?error=exists");
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: "HOST",
      passwordHash: hashPassword(password)
    }
  });

  await createSession(user.id, await getRequestSessionMetadata("SIGNUP"));
  await logAuthAuditEvent({ action: "account.created", userId: user.id, email: user.email });
  redirect("/dashboard");
}

export async function logout(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/dashboard");
  }
  const user = await getCurrentUser();
  await clearSession();
  if (user) {
    await logAuthAuditEvent({ action: "auth.logout", userId: user.id, email: user.email });
  }
  redirect("/");
}
