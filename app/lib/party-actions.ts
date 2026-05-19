"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";

import { requireUser } from "./auth";
import { verifyCsrfToken } from "./csrf";
import { queuePartyInvitationMessages } from "./notifications";
import { createPartyRecord } from "./party-service";
import { prisma } from "./prisma";

function generateToken() {
  return crypto.randomBytes(16).toString("base64url");
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createParty(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/host?error=missing");
  }
  const user = await requireUser();
  const title = getFormValue(formData, "title");
  const gameSlug = getFormValue(formData, "gameSlug");
  const guestInvites = getFormValue(formData, "guestInvites");

  const party = await createPartyRecord({
    hostId: user.id,
    title,
    gameSlug,
    guestInvites
  });

  if (!party) {
    redirect("/host?error=missing");
  }

  redirect(`/host/party/${party.id}`);
}

export async function addGuest(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/host?error=missing");
  }
  const user = await requireUser();
  const partyId = getFormValue(formData, "partyId");
  const name = getFormValue(formData, "name");
  const email = getFormValue(formData, "email").toLowerCase();

  if (!partyId || !name || !email) {
    redirect("/host?error=missing");
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { id: true, hostId: true, status: true, title: true, inviteCode: true }
  });

  if (!party || party.hostId !== user.id) {
    redirect("/dashboard");
  }
  if (party.status === "COMPLETED") {
    redirect(`/host/party/${partyId}`);
  }

  const guest = await prisma.guest.create({
    data: {
      partyId,
      name,
      email,
      guestToken: generateToken()
    }
  });
  await queuePartyInvitationMessages({
    hostId: user.id,
    partyId,
    partyTitle: party.title,
    inviteCode: party.inviteCode,
    guests: [guest]
  });

  redirect(`/host/party/${partyId}`);
}

export async function approveGuest(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/host?error=missing");
  }
  const user = await requireUser();
  const partyId = getFormValue(formData, "partyId");
  const guestId = getFormValue(formData, "guestId");

  if (!partyId || !guestId) {
    redirect("/host?error=missing");
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { id: true, hostId: true, status: true }
  });

  if (!party || party.hostId !== user.id) {
    redirect("/dashboard");
  }
  if (party.status === "COMPLETED") {
    redirect(`/host/party/${partyId}`);
  }

  await prisma.guest.updateMany({
    where: {
      id: guestId,
      partyId
    },
    data: { status: "JOINED" }
  });

  redirect(`/host/party/${partyId}`);
}
