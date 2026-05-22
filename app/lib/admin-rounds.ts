import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export const CARD_VISIBILITIES = ["PUBLIC", "PLAYER_PRIVATE", "HOST_SAFE", "SPOILER_PROTECTED"] as const;

export type CardVisibility = (typeof CARD_VISIBILITIES)[number];

export type UpsertGameRoundInput = {
  gameId: string;
  versionId: string;
  roundId?: string;
  key: string;
  title: string;
  summary: string;
  sortOrder: number;
};

export type UpsertGameCardInput = {
  gameId: string;
  versionId: string;
  cardId?: string;
  roundId: string;
  characterId?: string;
  key: string;
  title: string;
  body: string;
  visibility: string;
  sortOrder: number;
};

export type UpsertGameRoundResult =
  | {
      ok: true;
      action: "created" | "updated";
      roundId: string;
      previousKey?: string;
      key: string;
    }
  | {
      ok: false;
      reason: "not-found" | "published-version" | "invalid-round" | "duplicate-key";
    };

export type UpsertGameCardResult =
  | {
      ok: true;
      action: "created" | "updated";
      cardId: string;
      previousKey?: string;
      key: string;
    }
  | {
      ok: false;
      reason:
        | "not-found"
        | "published-version"
        | "invalid-card"
        | "duplicate-key"
        | "invalid-character";
    };

const CONTENT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const MAX_TITLE_LENGTH = 160;
const MAX_SUMMARY_LENGTH = 5000;
const MAX_CARD_BODY_LENGTH = 10000;

function normalizeContentKey(key: string) {
  return key.trim().toLowerCase();
}

function normalizeVisibility(visibility: string) {
  return visibility.trim().toUpperCase();
}

function isValidRoundInput(input: UpsertGameRoundInput) {
  const key = normalizeContentKey(input.key);
  return (
    CONTENT_KEY_PATTERN.test(key) &&
    input.title.trim().length > 0 &&
    input.title.trim().length <= MAX_TITLE_LENGTH &&
    input.summary.trim().length <= MAX_SUMMARY_LENGTH &&
    Number.isInteger(input.sortOrder)
  );
}

function isValidCardInput(input: UpsertGameCardInput) {
  const key = normalizeContentKey(input.key);
  const visibility = normalizeVisibility(input.visibility);
  return (
    CONTENT_KEY_PATTERN.test(key) &&
    input.roundId.trim().length > 0 &&
    input.title.trim().length > 0 &&
    input.title.trim().length <= MAX_TITLE_LENGTH &&
    input.body.trim().length > 0 &&
    input.body.trim().length <= MAX_CARD_BODY_LENGTH &&
    CARD_VISIBILITIES.includes(visibility as CardVisibility) &&
    Number.isInteger(input.sortOrder)
  );
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function upsertGameRound(input: UpsertGameRoundInput): Promise<UpsertGameRoundResult> {
  const key = normalizeContentKey(input.key);

  if (!isValidRoundInput(input)) {
    return { ok: false, reason: "invalid-round" };
  }

  const version = await prisma.gameVersion.findFirst({
    where: {
      id: input.versionId,
      gameId: input.gameId
    },
    select: {
      id: true,
      status: true,
      rounds: {
        select: {
          id: true,
          key: true
        }
      }
    }
  });

  if (!version) {
    return { ok: false, reason: "not-found" };
  }
  if (version.status !== "DRAFT") {
    return { ok: false, reason: "published-version" };
  }

  const existingRound = input.roundId ? version.rounds.find((round) => round.id === input.roundId) : null;
  if (input.roundId && !existingRound) {
    return { ok: false, reason: "not-found" };
  }

  const duplicateRound = version.rounds.find((round) => round.key === key && round.id !== input.roundId);
  if (duplicateRound) {
    return { ok: false, reason: "duplicate-key" };
  }

  const data = {
    key,
    title: input.title.trim(),
    summary: input.summary.trim(),
    sortOrder: input.sortOrder
  };

  try {
    if (existingRound) {
      const updatedRound = await prisma.gameRound.update({
        where: { id: existingRound.id },
        data,
        select: { id: true, key: true }
      });
      return {
        ok: true,
        action: "updated",
        roundId: updatedRound.id,
        previousKey: existingRound.key,
        key: updatedRound.key
      };
    }

    const createdRound = await prisma.gameRound.create({
      data: {
        gameVersionId: input.versionId,
        ...data
      },
      select: { id: true, key: true }
    });
    return {
      ok: true,
      action: "created",
      roundId: createdRound.id,
      key: createdRound.key
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "duplicate-key" };
    }
    throw error;
  }
}

export async function upsertGameCard(input: UpsertGameCardInput): Promise<UpsertGameCardResult> {
  const key = normalizeContentKey(input.key);
  const visibility = normalizeVisibility(input.visibility);
  const characterId = input.characterId?.trim() || undefined;

  if (!isValidCardInput(input)) {
    return { ok: false, reason: "invalid-card" };
  }
  if (visibility === "PLAYER_PRIVATE" && !characterId) {
    return { ok: false, reason: "invalid-character" };
  }

  const version = await prisma.gameVersion.findFirst({
    where: {
      id: input.versionId,
      gameId: input.gameId
    },
    select: {
      id: true,
      status: true,
      rounds: {
        select: {
          id: true,
          cards: {
            select: {
              id: true,
              key: true
            }
          }
        }
      },
      characters: {
        select: {
          id: true
        }
      }
    }
  });

  if (!version) {
    return { ok: false, reason: "not-found" };
  }
  if (version.status !== "DRAFT") {
    return { ok: false, reason: "published-version" };
  }

  const selectedRound = version.rounds.find((round) => round.id === input.roundId);
  if (!selectedRound) {
    return { ok: false, reason: "not-found" };
  }

  if (characterId && !version.characters.some((character) => character.id === characterId)) {
    return { ok: false, reason: "invalid-character" };
  }

  const existingCard = input.cardId
    ? version.rounds.flatMap((round) => round.cards).find((card) => card.id === input.cardId)
    : null;
  if (input.cardId && !existingCard) {
    return { ok: false, reason: "not-found" };
  }

  const duplicateCard = selectedRound.cards.find((card) => card.key === key && card.id !== input.cardId);
  if (duplicateCard) {
    return { ok: false, reason: "duplicate-key" };
  }

  const data = {
    gameRoundId: input.roundId,
    characterId: characterId ?? null,
    key,
    title: input.title.trim(),
    body: input.body.trim(),
    visibility,
    sortOrder: input.sortOrder
  };

  try {
    if (existingCard) {
      const updatedCard = await prisma.gameCard.update({
        where: { id: existingCard.id },
        data,
        select: { id: true, key: true }
      });
      return {
        ok: true,
        action: "updated",
        cardId: updatedCard.id,
        previousKey: existingCard.key,
        key: updatedCard.key
      };
    }

    const createdCard = await prisma.gameCard.create({
      data,
      select: { id: true, key: true }
    });
    return {
      ok: true,
      action: "created",
      cardId: createdCard.id,
      key: createdCard.key
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "duplicate-key" };
    }
    throw error;
  }
}
