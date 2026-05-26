import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "./prisma";

const SESSION_COOKIE = "maca_session";
const SESSION_DAYS = 14;
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;

type UserRole = "HOST" | "PLAYER" | "ADMIN" | "SUPER_ADMIN" | "CONTENT_EDITOR" | "SUPPORT" | "FINANCE";

type CreateSessionMetadata = {
  ipAddress?: string;
  userAgent?: string;
  createdBy?: string;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derived);
}

function normalizeSessionText(value: string | null | undefined, maxLength: number) {
  return (value ?? "").trim().slice(0, maxLength);
}

export async function getRequestSessionMetadata(createdBy = "LOGIN"): Promise<CreateSessionMetadata> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0];
  const realIp = headerStore.get("x-real-ip");

  return {
    ipAddress: normalizeSessionText(forwardedFor || realIp, 100),
    userAgent: normalizeSessionText(headerStore.get("user-agent"), 500),
    createdBy: normalizeSessionText(createdBy, 50)
  };
}

export async function createSession(userId: string, metadata: CreateSessionMetadata = {}) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ipAddress: normalizeSessionText(metadata.ipAddress, 100),
      userAgent: normalizeSessionText(metadata.userAgent, 500),
      createdBy: normalizeSessionText(metadata.createdBy || "LOGIN", 50),
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.userSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokeReason: "LOGOUT"
      }
    });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now || session.user === null) {
    if (session && !session.revokedAt && session.expiresAt <= now) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          revokedAt: now,
          revokeReason: "EXPIRED"
        }
      });
    }
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_WRITE_INTERVAL_MS) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now }
    });
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function getUserRoleLabel(role: UserRole) {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super administrator";
    case "ADMIN":
      return "Administrator";
    case "CONTENT_EDITOR":
      return "Content editor";
    case "SUPPORT":
      return "Support";
    case "FINANCE":
      return "Finance";
    case "PLAYER":
      return "Player";
    default:
      return "Host";
  }
}
