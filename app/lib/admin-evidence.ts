import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export const CONTENT_VISIBILITIES = ["PUBLIC", "PLAYER_PRIVATE", "HOST_SAFE", "SPOILER_PROTECTED"] as const;
export const EVIDENCE_TYPES = ["TEXT", "DOCUMENT", "NOTE", "IMAGE", "AUDIO", "VIDEO", "EMAIL", "MESSAGE"] as const;
export const MEDIA_ASSET_TYPES = ["IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "EMAIL", "MESSAGE", "LINK"] as const;

type ContentVisibility = (typeof CONTENT_VISIBILITIES)[number];
type EvidenceType = (typeof EVIDENCE_TYPES)[number];
type MediaAssetType = (typeof MEDIA_ASSET_TYPES)[number];

export type UpsertGameEvidenceInput = {
  gameId: string;
  versionId: string;
  evidenceId?: string;
  gameRoundId?: string;
  characterId?: string;
  key: string;
  title: string;
  body: string;
  evidenceType: string;
  visibility: string;
  sortOrder: number;
};

export type UpsertGameMediaInput = {
  gameId: string;
  versionId: string;
  mediaId?: string;
  gameRoundId?: string;
  characterId?: string;
  evidenceId?: string;
  key: string;
  title: string;
  description: string;
  assetType: string;
  url: string;
  mimeType: string;
  visibility: string;
  sortOrder: number;
};

export type UpsertGameEvidenceResult =
  | {
      ok: true;
      action: "created" | "updated";
      evidenceId: string;
      previousKey?: string;
      key: string;
    }
  | {
      ok: false;
      reason:
        | "not-found"
        | "published-version"
        | "invalid-evidence"
        | "duplicate-key"
        | "invalid-linkage";
    };

export type UpsertGameMediaResult =
  | {
      ok: true;
      action: "created" | "updated";
      mediaId: string;
      previousKey?: string;
      key: string;
    }
  | {
      ok: false;
      reason: "not-found" | "published-version" | "invalid-media" | "duplicate-key" | "invalid-linkage";
    };

const CONTENT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const MAX_TITLE_LENGTH = 160;
const MAX_BODY_LENGTH = 10000;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_URL_LENGTH = 2000;
const MAX_MIME_LENGTH = 120;

function normalizeContentKey(key: string) {
  return key.trim().toLowerCase();
}

function normalizeValue(value: string) {
  return value.trim().toUpperCase();
}

function normalizeOptionalId(value?: string) {
  return value?.trim() || undefined;
}

function isValidAssetUrl(url: string) {
  const trimmed = url.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_URL_LENGTH && (trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed));
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isValidEvidenceInput(input: UpsertGameEvidenceInput) {
  const key = normalizeContentKey(input.key);
  const evidenceType = normalizeValue(input.evidenceType);
  const visibility = normalizeValue(input.visibility);
  return (
    CONTENT_KEY_PATTERN.test(key) &&
    input.title.trim().length > 0 &&
    input.title.trim().length <= MAX_TITLE_LENGTH &&
    input.body.trim().length > 0 &&
    input.body.trim().length <= MAX_BODY_LENGTH &&
    EVIDENCE_TYPES.includes(evidenceType as EvidenceType) &&
    CONTENT_VISIBILITIES.includes(visibility as ContentVisibility) &&
    Number.isInteger(input.sortOrder)
  );
}

function isValidMediaInput(input: UpsertGameMediaInput) {
  const key = normalizeContentKey(input.key);
  const assetType = normalizeValue(input.assetType);
  const visibility = normalizeValue(input.visibility);
  return (
    CONTENT_KEY_PATTERN.test(key) &&
    input.title.trim().length > 0 &&
    input.title.trim().length <= MAX_TITLE_LENGTH &&
    input.description.trim().length <= MAX_DESCRIPTION_LENGTH &&
    MEDIA_ASSET_TYPES.includes(assetType as MediaAssetType) &&
    isValidAssetUrl(input.url) &&
    input.mimeType.trim().length <= MAX_MIME_LENGTH &&
    CONTENT_VISIBILITIES.includes(visibility as ContentVisibility) &&
    Number.isInteger(input.sortOrder)
  );
}

export async function upsertGameEvidence(input: UpsertGameEvidenceInput): Promise<UpsertGameEvidenceResult> {
  const key = normalizeContentKey(input.key);
  const visibility = normalizeValue(input.visibility);
  const gameRoundId = normalizeOptionalId(input.gameRoundId);
  const characterId = normalizeOptionalId(input.characterId);

  if (!isValidEvidenceInput(input)) {
    return { ok: false, reason: "invalid-evidence" };
  }
  if (visibility === "PLAYER_PRIVATE" && !characterId) {
    return { ok: false, reason: "invalid-linkage" };
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
        select: { id: true }
      },
      characters: {
        select: { id: true }
      },
      evidence: {
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

  const existingEvidence = input.evidenceId
    ? version.evidence.find((evidence) => evidence.id === input.evidenceId)
    : null;
  if (input.evidenceId && !existingEvidence) {
    return { ok: false, reason: "not-found" };
  }
  if (gameRoundId && !version.rounds.some((round) => round.id === gameRoundId)) {
    return { ok: false, reason: "invalid-linkage" };
  }
  if (characterId && !version.characters.some((character) => character.id === characterId)) {
    return { ok: false, reason: "invalid-linkage" };
  }

  const duplicateEvidence = version.evidence.find((evidence) => evidence.key === key && evidence.id !== input.evidenceId);
  if (duplicateEvidence) {
    return { ok: false, reason: "duplicate-key" };
  }

  const data = {
    gameRoundId: gameRoundId ?? null,
    characterId: characterId ?? null,
    key,
    title: input.title.trim(),
    body: input.body.trim(),
    evidenceType: normalizeValue(input.evidenceType),
    visibility,
    sortOrder: input.sortOrder
  };

  try {
    if (existingEvidence) {
      const updatedEvidence = await prisma.gameEvidence.update({
        where: { id: existingEvidence.id },
        data,
        select: { id: true, key: true }
      });
      return {
        ok: true,
        action: "updated",
        evidenceId: updatedEvidence.id,
        previousKey: existingEvidence.key,
        key: updatedEvidence.key
      };
    }

    const createdEvidence = await prisma.gameEvidence.create({
      data: {
        gameVersionId: input.versionId,
        ...data
      },
      select: { id: true, key: true }
    });
    return {
      ok: true,
      action: "created",
      evidenceId: createdEvidence.id,
      key: createdEvidence.key
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "duplicate-key" };
    }
    throw error;
  }
}

export async function upsertGameMedia(input: UpsertGameMediaInput): Promise<UpsertGameMediaResult> {
  const key = normalizeContentKey(input.key);
  const visibility = normalizeValue(input.visibility);
  const gameRoundId = normalizeOptionalId(input.gameRoundId);
  const characterId = normalizeOptionalId(input.characterId);
  const evidenceId = normalizeOptionalId(input.evidenceId);

  if (!isValidMediaInput(input)) {
    return { ok: false, reason: "invalid-media" };
  }
  if (visibility === "PLAYER_PRIVATE" && !characterId) {
    return { ok: false, reason: "invalid-linkage" };
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
        select: { id: true }
      },
      characters: {
        select: { id: true }
      },
      evidence: {
        select: { id: true }
      },
      mediaAssets: {
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

  const existingMedia = input.mediaId ? version.mediaAssets.find((media) => media.id === input.mediaId) : null;
  if (input.mediaId && !existingMedia) {
    return { ok: false, reason: "not-found" };
  }
  if (gameRoundId && !version.rounds.some((round) => round.id === gameRoundId)) {
    return { ok: false, reason: "invalid-linkage" };
  }
  if (characterId && !version.characters.some((character) => character.id === characterId)) {
    return { ok: false, reason: "invalid-linkage" };
  }
  if (evidenceId && !version.evidence.some((evidence) => evidence.id === evidenceId)) {
    return { ok: false, reason: "invalid-linkage" };
  }

  const duplicateMedia = version.mediaAssets.find((media) => media.key === key && media.id !== input.mediaId);
  if (duplicateMedia) {
    return { ok: false, reason: "duplicate-key" };
  }

  const data = {
    gameRoundId: gameRoundId ?? null,
    characterId: characterId ?? null,
    evidenceId: evidenceId ?? null,
    key,
    title: input.title.trim(),
    description: input.description.trim(),
    assetType: normalizeValue(input.assetType),
    url: input.url.trim(),
    mimeType: input.mimeType.trim().toLowerCase(),
    visibility,
    sortOrder: input.sortOrder
  };

  try {
    if (existingMedia) {
      const updatedMedia = await prisma.gameMediaAsset.update({
        where: { id: existingMedia.id },
        data,
        select: { id: true, key: true }
      });
      return {
        ok: true,
        action: "updated",
        mediaId: updatedMedia.id,
        previousKey: existingMedia.key,
        key: updatedMedia.key
      };
    }

    const createdMedia = await prisma.gameMediaAsset.create({
      data: {
        gameVersionId: input.versionId,
        ...data
      },
      select: { id: true, key: true }
    });
    return {
      ok: true,
      action: "created",
      mediaId: createdMedia.id,
      key: createdMedia.key
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "duplicate-key" };
    }
    throw error;
  }
}
