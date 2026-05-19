"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";

import { createGuestSession } from "./guest-auth";
import { verifyCsrfToken } from "./csrf";
import { prisma } from "./prisma";
import { checkRateLimit } from "./rate-limit";

function generateToken() {
  return crypto.randomBytes(16).toString("base64url");
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function joinRedirect(code: string, error: string): never {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  params.set("error", error);
  redirect(`/join?${params.toString()}`);
}

export async function joinParty(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    joinRedirect("", "missing");
  }
  const code = getFormValue(formData, "code").toUpperCase();
  const name = getFormValue(formData, "name");
  const email = getFormValue(formData, "email").toLowerCase();
  const rateLimit = await checkRateLimit({
    scope: "join",
    key: `${code}:${email}`,
    limit: 15,
    windowSeconds: 10 * 60
  });

  if (!rateLimit.allowed) {
    joinRedirect(code, "rate-limited");
  }

  if (!code || !name || !email || !email.includes("@")) {
    joinRedirect(code, "missing");
  }

  const party = await prisma.party.findUnique({
    where: { inviteCode: code },
    select: { id: true, status: true }
  });

  if (!party) {
    joinRedirect(code, "invalid");
  }
  if (party.status === "COMPLETED") {
    joinRedirect(code, "closed");
  }

  const existingGuest = await prisma.guest.findFirst({
    where: {
      partyId: party.id,
      email
    }
  });

  const joinedAt = new Date();
  const guest = existingGuest
    ? await prisma.guest.update({
        where: { id: existingGuest.id },
        data: {
          name,
          status: existingGuest.status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "JOINED",
          joinedAt
        }
      })
    : await prisma.guest.create({
        data: {
          partyId: party.id,
          name,
          email,
          status: "PENDING_APPROVAL",
          joinedAt,
          guestToken: generateToken()
        }
      });

  await createGuestSession(guest.guestToken);
  redirect("/play");
}
