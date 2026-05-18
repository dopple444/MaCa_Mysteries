"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";

import { createGuestSession } from "./guest-auth";
import { prisma } from "./prisma";

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
  const code = getFormValue(formData, "code").toUpperCase();
  const name = getFormValue(formData, "name");
  const email = getFormValue(formData, "email").toLowerCase();

  if (!code || !name || !email) {
    joinRedirect(code, "missing");
  }

  const party = await prisma.party.findUnique({
    where: { inviteCode: code },
    select: { id: true }
  });

  if (!party) {
    joinRedirect(code, "invalid");
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
          status: "JOINED",
          joinedAt
        }
      })
    : await prisma.guest.create({
        data: {
          partyId: party.id,
          name,
          email,
          status: "JOINED",
          joinedAt,
          guestToken: generateToken()
        }
      });

  await createGuestSession(guest.guestToken);
  redirect("/play");
}
