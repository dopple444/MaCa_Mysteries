import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "maca_session";
const GUEST_COOKIE = "maca_guest";
const CSRF_FIELD = "csrfToken";

function getSecret() {
  return process.env.CSRF_SECRET || process.env.DATABASE_URL || "development-csrf-secret";
}

function signCsrfSubject(subject: string) {
  return crypto.createHmac("sha256", getSecret()).update(subject).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function getCsrfSubject() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  const guestToken = cookieStore.get(GUEST_COOKIE)?.value;
  return sessionToken ? `session:${sessionToken}` : guestToken ? `guest:${guestToken}` : "anonymous";
}

export async function getCsrfToken() {
  return signCsrfSubject(await getCsrfSubject());
}

export async function verifyCsrfToken(formData: FormData) {
  const token = formData.get(CSRF_FIELD);
  if (typeof token !== "string" || !token) {
    return process.env.NODE_ENV !== "production";
  }

  return safeEqual(token, await getCsrfToken());
}
