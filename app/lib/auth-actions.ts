"use server";

import { redirect } from "next/navigation";

import { createSession, clearSession, hashPassword, verifyPassword } from "./auth";
import { verifyCsrfToken } from "./csrf";
import { prisma } from "./prisma";
import { checkRateLimit } from "./rate-limit";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function login(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
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
    redirect("/login?error=rate-limited");
  }

  if (!email || !password) {
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=invalid");
  }

  await createSession(user.id);
  redirect("/dashboard");
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

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/dashboard");
  }
  await clearSession();
  redirect("/");
}
