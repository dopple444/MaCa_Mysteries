import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export type UpsertGameCharacterInput = {
  gameId: string;
  versionId: string;
  characterId?: string;
  key: string;
  name: string;
  publicBio: string;
  privateBio: string;
  isRequired: boolean;
  sortOrder: number;
};

export type UpsertGameCharacterResult =
  | {
      ok: true;
      action: "created" | "updated";
      characterId: string;
      previousKey?: string;
      key: string;
    }
  | {
      ok: false;
      reason:
        | "not-found"
        | "published-version"
        | "invalid-character"
        | "duplicate-key"
        | "required-character";
    };

const CHARACTER_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const MAX_NAME_LENGTH = 120;
const MAX_BIO_LENGTH = 5000;

function normalizeCharacterKey(key: string) {
  return key.trim().toLowerCase();
}

function isValidCharacterInput(input: UpsertGameCharacterInput) {
  const key = normalizeCharacterKey(input.key);
  return (
    CHARACTER_KEY_PATTERN.test(key) &&
    input.name.trim().length > 0 &&
    input.name.trim().length <= MAX_NAME_LENGTH &&
    input.publicBio.trim().length > 0 &&
    input.publicBio.trim().length <= MAX_BIO_LENGTH &&
    input.privateBio.trim().length <= MAX_BIO_LENGTH &&
    Number.isInteger(input.sortOrder)
  );
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function upsertGameCharacter(input: UpsertGameCharacterInput): Promise<UpsertGameCharacterResult> {
  const key = normalizeCharacterKey(input.key);

  if (!isValidCharacterInput(input)) {
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
      characters: {
        select: {
          id: true,
          key: true,
          isRequired: true
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

  const existingCharacter = input.characterId
    ? version.characters.find((character) => character.id === input.characterId)
    : null;
  if (input.characterId && !existingCharacter) {
    return { ok: false, reason: "not-found" };
  }

  const duplicateCharacter = version.characters.find(
    (character) => character.key === key && character.id !== input.characterId
  );
  if (duplicateCharacter) {
    return { ok: false, reason: "duplicate-key" };
  }

  const requiredCharacterCount =
    version.characters.filter((character) => character.id !== input.characterId && character.isRequired).length +
    (input.isRequired ? 1 : 0);
  if (requiredCharacterCount < 1) {
    return { ok: false, reason: "required-character" };
  }

  const data = {
    key,
    name: input.name.trim(),
    publicBio: input.publicBio.trim(),
    privateBio: input.privateBio.trim(),
    isRequired: input.isRequired,
    sortOrder: input.sortOrder
  };

  try {
    if (existingCharacter) {
      const updatedCharacter = await prisma.gameCharacter.update({
        where: { id: existingCharacter.id },
        data,
        select: { id: true, key: true }
      });
      return {
        ok: true,
        action: "updated",
        characterId: updatedCharacter.id,
        previousKey: existingCharacter.key,
        key: updatedCharacter.key
      };
    }

    const createdCharacter = await prisma.gameCharacter.create({
      data: {
        gameVersionId: input.versionId,
        ...data
      },
      select: { id: true, key: true }
    });
    return {
      ok: true,
      action: "created",
      characterId: createdCharacter.id,
      key: createdCharacter.key
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "duplicate-key" };
    }
    throw error;
  }
}
