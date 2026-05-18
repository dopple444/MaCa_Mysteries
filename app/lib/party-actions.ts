"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";

import { requireUser } from "./auth";
import { getGameBySlug } from "./games";
import { prisma } from "./prisma";

function generateCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function generateToken() {
  return crypto.randomBytes(16).toString("base64url");
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseGuestLines(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseGuestInvite(input: string) {
  const [namePart, emailPart] = input.split(",").map((item) => item.trim());
  const name = emailPart ? namePart : "";
  const email = emailPart ?? namePart;

  return { name: name || email, email: email.toLowerCase() };
}

function parseGuestInvites(input: string) {
  return parseGuestLines(input).flatMap((line) => {
    const parts = line
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parts.length === 2 && !parts[0].includes("@") && parts[1].includes("@")) {
      return [parseGuestInvite(line)];
    }

    return parts
      .filter((email) => email.includes("@"))
      .map((email) => ({ name: email, email: email.toLowerCase() }));
  });
}

export async function createParty(formData: FormData) {
  const user = await requireUser();
  const title = getFormValue(formData, "title");
  const gameSlug = getFormValue(formData, "gameSlug");
  const guestInvites = getFormValue(formData, "guestInvites");

  const game = gameSlug ? await getGameBySlug(gameSlug) : null;

  if (!title || !gameSlug || !game) {
    redirect("/host?error=missing");
  }

  const guests = parseGuestInvites(guestInvites);

  const party = await prisma.party.create({
    data: {
      title,
      gameSlug,
      gameId: game.id,
      gameVersionId: game.versionId,
      hostId: user.id,
      inviteCode: generateCode(),
      guests: {
        create: guests.map((guest) => ({
          name: guest.name,
          email: guest.email,
          guestToken: generateToken()
        }))
      }
    }
  });

  redirect(`/host/party/${party.id}`);
}

export async function addGuest(formData: FormData) {
  const user = await requireUser();
  const partyId = getFormValue(formData, "partyId");
  const name = getFormValue(formData, "name");
  const email = getFormValue(formData, "email").toLowerCase();

  if (!partyId || !name || !email) {
    redirect("/host?error=missing");
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { id: true, hostId: true }
  });

  if (!party || party.hostId !== user.id) {
    redirect("/dashboard");
  }

  await prisma.guest.create({
    data: {
      partyId,
      name,
      email,
      guestToken: generateToken()
    }
  });

  redirect(`/host/party/${partyId}`);
}
