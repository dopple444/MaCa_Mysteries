"use server";

import { redirect } from "next/navigation";

import { createSession, getCurrentUser, getRequestSessionMetadata } from "./auth";
import { verifyCsrfToken } from "./csrf";
import {
  queueEmailVerificationMessage,
  queuePasswordResetMessage,
  resetUserPasswordWithToken
} from "./account-security";
import { checkRateLimit } from "./rate-limit";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function requestCurrentUserEmailVerification(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/account/verify-email?error=invalid");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rateLimit = await checkRateLimit({
    scope: "email-verification",
    key: user.id,
    limit: 5,
    windowSeconds: 60 * 60
  });

  if (!rateLimit.allowed) {
    redirect("/account/verify-email?error=rate-limited");
  }

  const result = await queueEmailVerificationMessage(user.id);
  if (result.alreadyVerified) {
    redirect("/account/verify-email?verified=1");
  }
  redirect("/account/verify-email?sent=1");
}

export async function requestPasswordReset(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/forgot-password?sent=1");
  }

  const email = getFormValue(formData, "email").toLowerCase();
  const rateLimit = await checkRateLimit({
    scope: "password-reset",
    key: email || "anonymous",
    limit: 5,
    windowSeconds: 60 * 60
  });

  if (rateLimit.allowed && email) {
    await queuePasswordResetMessage(email);
  }

  redirect("/forgot-password?sent=1");
}

export async function resetPassword(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/forgot-password?reset=invalid");
  }

  const token = getFormValue(formData, "token");
  const password = getFormValue(formData, "password");
  if (!token || password.length < 8) {
    redirect("/forgot-password?reset=invalid");
  }

  const result = await resetUserPasswordWithToken(token, password);
  if (!result.reset || !result.userId) {
    redirect("/forgot-password?reset=invalid");
  }

  await createSession(result.userId, await getRequestSessionMetadata("PASSWORD_RESET"));
  redirect("/dashboard?password=reset");
}
