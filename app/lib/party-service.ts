import crypto from "crypto";

import { getHostGameAccess } from "./game-access";
import { parseGuestInvites } from "./guest-invites";
import { queuePartyInvitationMessages } from "./notifications";
import { prisma } from "./prisma";

function generateCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function generateToken() {
  return crypto.randomBytes(16).toString("base64url");
}

type CreatePartyRecordInput = {
  hostId: string;
  title: string;
  gameSlug: string;
  guestInvites?: string;
  allowDevelopmentAccessBypass?: boolean;
};

export async function createPartyRecord(input: CreatePartyRecordInput) {
  const title = input.title.trim();
  const gameSlug = input.gameSlug.trim();
  if (!title || !gameSlug) return null;

  const game = await prisma.game.findFirst({
    where: {
      slug: gameSlug,
      status: "PUBLISHED"
    },
    include: {
      versions: {
        where: { status: "PUBLISHED" },
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    }
  });
  const version = game?.versions[0];
  if (!game || !version) return null;

  const access = await getHostGameAccess({
    userId: input.hostId,
    gameId: game.id,
    allowDevelopmentBypass: input.allowDevelopmentAccessBypass
  });
  if (!access.canHost) return null;

  const guests = parseGuestInvites(input.guestInvites ?? "");
  const rounds = await prisma.gameRound.findMany({
    where: { gameVersionId: version.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true }
  });
  const finalReveal = await prisma.gameFinalReveal.findUnique({
    where: { gameVersionId: version.id },
    select: { id: true }
  });

  const party = await prisma.party.create({
    data: {
      title,
      gameSlug,
      gameId: game.id,
      gameVersionId: version.id,
      hostId: input.hostId,
      inviteCode: generateCode(),
      guests: {
        create: guests.map((guest) => ({
          name: guest.name,
          email: guest.email,
          guestToken: generateToken()
        }))
      },
      roundStates: {
        create: rounds.map((round) => ({
          gameRoundId: round.id
        }))
      },
      finalRevealState: finalReveal
        ? {
            create: {
              finalRevealId: finalReveal.id
            }
          }
        : undefined
    },
    include: {
      guests: true
    }
  });

  await queuePartyInvitationMessages({
    hostId: input.hostId,
    partyId: party.id,
    partyTitle: party.title,
    inviteCode: party.inviteCode,
    guests: party.guests
  });

  return party;
}
