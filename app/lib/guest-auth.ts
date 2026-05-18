import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "./prisma";

const GUEST_COOKIE = "maca_guest";
const GUEST_DAYS = 14;

export async function createGuestSession(guestToken: string) {
  const expiresAt = new Date(Date.now() + GUEST_DAYS * 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();

  cookieStore.set(GUEST_COOKIE, guestToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function getCurrentGuest() {
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(GUEST_COOKIE)?.value;
  if (!guestToken) return null;

  const guest = await prisma.guest.findUnique({
    where: { guestToken },
    include: {
      party: {
        include: {
          game: true,
          gameVersion: true
        }
      }
    }
  });

  if (!guest) {
    cookieStore.delete(GUEST_COOKIE);
    return null;
  }

  return guest;
}

export async function requireGuest() {
  const guest = await getCurrentGuest();
  if (!guest) redirect("/join");
  return guest;
}
