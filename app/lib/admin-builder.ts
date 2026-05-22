import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export const BUILDER_ARTIFACT_TYPES = [
  "DOCUMENT",
  "EMAIL",
  "MESSAGE",
  "IMAGE",
  "AUDIO",
  "VIDEO",
  "INVESTIGATION_SHEET",
  "INVENTORY_ITEM",
  "TOOL_PAYLOAD"
] as const;
export const CHARACTER_TOOL_TYPES = ["GENERIC", "ACCESS_CODE_GENERATOR", "DECODER", "KEY", "SCANNER", "NOTEBOOK"] as const;
export const UNLOCK_RULE_TYPES = [
  "MANUAL",
  "ACCESS_CODE",
  "ASSET_VIEWED",
  "PLAYER_INTERACTION",
  "HOST_APPROVAL",
  "ROUND_STATE",
  "REVEAL_STATE"
] as const;
export const UNLOCK_TRIGGER_TYPES = [
  "HOST_APPROVAL",
  "CODE_ENTRY",
  "ASSET_VIEWED",
  "PLAYER_INTERACTION",
  "ROUND_STARTED",
  "VICTIM_REVEALED",
  "FINAL_REVEALED"
] as const;
export const UNLOCK_SCOPES = ["PLAYER", "ALL_PLAYERS", "HOST", "HOST_AND_PLAYERS", "PARTY"] as const;
export const UNLOCK_RULE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const UNLOCK_CODE_MODES = ["", "PARTY_TOOL_CODE", "STATIC_CODE"] as const;
export const BUILDER_TARGET_TYPES = ["GameCard", "GameEvidence", "GameMediaAsset", "GameDigitalArtifact"] as const;
export const BUILDER_VISIBILITIES = ["PUBLIC", "PLAYER_PRIVATE", "HOST_SAFE", "SPOILER_PROTECTED"] as const;

type BuilderArtifactType = (typeof BUILDER_ARTIFACT_TYPES)[number];
type CharacterToolType = (typeof CHARACTER_TOOL_TYPES)[number];
type UnlockRuleType = (typeof UNLOCK_RULE_TYPES)[number];
type UnlockTriggerType = (typeof UNLOCK_TRIGGER_TYPES)[number];
type UnlockScope = (typeof UNLOCK_SCOPES)[number];
type UnlockRuleStatus = (typeof UNLOCK_RULE_STATUSES)[number];
type UnlockCodeMode = (typeof UNLOCK_CODE_MODES)[number];
type BuilderTargetType = (typeof BUILDER_TARGET_TYPES)[number];
type BuilderVisibility = (typeof BUILDER_VISIBILITIES)[number];

export type UpsertGameDigitalArtifactInput = {
  gameId: string;
  versionId: string;
  artifactId?: string;
  gameRoundId?: string;
  characterId?: string;
  evidenceId?: string;
  mediaAssetId?: string;
  requiredUnlockRuleId?: string;
  key: string;
  title: string;
  description: string;
  artifactType: string;
  visibility: string;
  content: Record<string, unknown>;
  sortOrder: number;
};

export type UpsertGameCharacterToolInput = {
  gameId: string;
  versionId: string;
  toolId?: string;
  characterId?: string;
  key: string;
  title: string;
  description: string;
  toolType: string;
  visibility: string;
  config: Record<string, unknown>;
  sortOrder: number;
};

export type UpsertGameUnlockRuleInput = {
  gameId: string;
  versionId: string;
  unlockRuleId?: string;
  requiredRoundId?: string;
  requiredCharacterId?: string;
  sourceToolId?: string;
  key: string;
  title: string;
  description: string;
  ruleType: string;
  triggerType: string;
  targetType: string;
  targetId: string;
  unlockScope: string;
  codeMode: string;
  config: Record<string, unknown>;
  effect: Record<string, unknown>;
  status: string;
  sortOrder: number;
};

export type UpsertGameDigitalArtifactResult =
  | {
      ok: true;
      action: "created" | "updated";
      artifactId: string;
      previousKey?: string;
      key: string;
    }
  | {
      ok: false;
      reason: "not-found" | "published-version" | "invalid-artifact" | "duplicate-key" | "invalid-linkage";
    };

export type UpsertGameCharacterToolResult =
  | {
      ok: true;
      action: "created" | "updated";
      toolId: string;
      previousKey?: string;
      key: string;
    }
  | {
      ok: false;
      reason: "not-found" | "published-version" | "invalid-tool" | "duplicate-key" | "invalid-linkage";
    };

export type UpsertGameUnlockRuleResult =
  | {
      ok: true;
      action: "created" | "updated";
      unlockRuleId: string;
      previousKey?: string;
      key: string;
    }
  | {
      ok: false;
      reason: "not-found" | "published-version" | "invalid-rule" | "duplicate-key" | "invalid-linkage";
    };

const CONTENT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;

function normalizeContentKey(key: string) {
  return key.trim().toLowerCase();
}

function normalizeValue(value: string) {
  return value.trim().toUpperCase();
}

function normalizeOptionalId(value?: string) {
  return value?.trim() || undefined;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidCommonContent(key: string, title: string, description: string, sortOrder: number) {
  return (
    CONTENT_KEY_PATTERN.test(normalizeContentKey(key)) &&
    title.trim().length > 0 &&
    title.trim().length <= MAX_TITLE_LENGTH &&
    description.trim().length <= MAX_DESCRIPTION_LENGTH &&
    Number.isInteger(sortOrder)
  );
}

function isValidArtifactInput(input: UpsertGameDigitalArtifactInput) {
  const artifactType = normalizeValue(input.artifactType);
  const visibility = normalizeValue(input.visibility);
  return (
    isValidCommonContent(input.key, input.title, input.description, input.sortOrder) &&
    BUILDER_ARTIFACT_TYPES.includes(artifactType as BuilderArtifactType) &&
    BUILDER_VISIBILITIES.includes(visibility as BuilderVisibility) &&
    isPlainObject(input.content)
  );
}

function isValidToolInput(input: UpsertGameCharacterToolInput) {
  const toolType = normalizeValue(input.toolType);
  const visibility = normalizeValue(input.visibility);
  return (
    isValidCommonContent(input.key, input.title, input.description, input.sortOrder) &&
    CHARACTER_TOOL_TYPES.includes(toolType as CharacterToolType) &&
    BUILDER_VISIBILITIES.includes(visibility as BuilderVisibility) &&
    isPlainObject(input.config)
  );
}

function isValidRuleInput(input: UpsertGameUnlockRuleInput) {
  const ruleType = normalizeValue(input.ruleType);
  const triggerType = normalizeValue(input.triggerType);
  const targetType = input.targetType.trim();
  const unlockScope = normalizeValue(input.unlockScope);
  const codeMode = normalizeValue(input.codeMode);
  const status = normalizeValue(input.status);
  return (
    isValidCommonContent(input.key, input.title, input.description, input.sortOrder) &&
    UNLOCK_RULE_TYPES.includes(ruleType as UnlockRuleType) &&
    UNLOCK_TRIGGER_TYPES.includes(triggerType as UnlockTriggerType) &&
    BUILDER_TARGET_TYPES.includes(targetType as BuilderTargetType) &&
    input.targetId.trim().length > 0 &&
    UNLOCK_SCOPES.includes(unlockScope as UnlockScope) &&
    UNLOCK_CODE_MODES.includes(codeMode as UnlockCodeMode) &&
    UNLOCK_RULE_STATUSES.includes(status as UnlockRuleStatus) &&
    isPlainObject(input.config) &&
    isPlainObject(input.effect)
  );
}

export async function upsertGameDigitalArtifact(
  input: UpsertGameDigitalArtifactInput
): Promise<UpsertGameDigitalArtifactResult> {
  const key = normalizeContentKey(input.key);
  const visibility = normalizeValue(input.visibility);
  const gameRoundId = normalizeOptionalId(input.gameRoundId);
  const characterId = normalizeOptionalId(input.characterId);
  const evidenceId = normalizeOptionalId(input.evidenceId);
  const mediaAssetId = normalizeOptionalId(input.mediaAssetId);
  const requiredUnlockRuleId = normalizeOptionalId(input.requiredUnlockRuleId);

  if (!isValidArtifactInput(input)) {
    return { ok: false, reason: "invalid-artifact" };
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
      rounds: { select: { id: true } },
      characters: { select: { id: true } },
      evidence: { select: { id: true } },
      mediaAssets: { select: { id: true } },
      unlockRules: { select: { id: true } },
      digitalArtifacts: {
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

  const existingArtifact = input.artifactId
    ? version.digitalArtifacts.find((artifact) => artifact.id === input.artifactId)
    : null;
  if (input.artifactId && !existingArtifact) {
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
  if (mediaAssetId && !version.mediaAssets.some((media) => media.id === mediaAssetId)) {
    return { ok: false, reason: "invalid-linkage" };
  }
  if (requiredUnlockRuleId && !version.unlockRules.some((rule) => rule.id === requiredUnlockRuleId)) {
    return { ok: false, reason: "invalid-linkage" };
  }

  const duplicateArtifact = version.digitalArtifacts.find(
    (artifact) => artifact.key === key && artifact.id !== input.artifactId
  );
  if (duplicateArtifact) {
    return { ok: false, reason: "duplicate-key" };
  }

  const data = {
    gameRoundId: gameRoundId ?? null,
    characterId: characterId ?? null,
    evidenceId: evidenceId ?? null,
    mediaAssetId: mediaAssetId ?? null,
    requiredUnlockRuleId: requiredUnlockRuleId ?? "",
    key,
    title: input.title.trim(),
    description: input.description.trim(),
    artifactType: normalizeValue(input.artifactType),
    visibility,
    content: input.content as Prisma.InputJsonValue,
    sortOrder: input.sortOrder
  };

  try {
    if (existingArtifact) {
      const updatedArtifact = await prisma.gameDigitalArtifact.update({
        where: { id: existingArtifact.id },
        data,
        select: { id: true, key: true }
      });
      return {
        ok: true,
        action: "updated",
        artifactId: updatedArtifact.id,
        previousKey: existingArtifact.key,
        key: updatedArtifact.key
      };
    }

    const createdArtifact = await prisma.gameDigitalArtifact.create({
      data: {
        gameVersionId: input.versionId,
        ...data
      },
      select: { id: true, key: true }
    });
    return {
      ok: true,
      action: "created",
      artifactId: createdArtifact.id,
      key: createdArtifact.key
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "duplicate-key" };
    }
    throw error;
  }
}

export async function upsertGameCharacterTool(
  input: UpsertGameCharacterToolInput
): Promise<UpsertGameCharacterToolResult> {
  const key = normalizeContentKey(input.key);
  const characterId = normalizeOptionalId(input.characterId);

  if (!isValidToolInput(input) || !characterId) {
    return { ok: false, reason: "invalid-tool" };
  }

  const version = await prisma.gameVersion.findFirst({
    where: {
      id: input.versionId,
      gameId: input.gameId
    },
    select: {
      id: true,
      status: true,
      characters: { select: { id: true } },
      characterTools: {
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
  if (!version.characters.some((character) => character.id === characterId)) {
    return { ok: false, reason: "invalid-linkage" };
  }

  const existingTool = input.toolId ? version.characterTools.find((tool) => tool.id === input.toolId) : null;
  if (input.toolId && !existingTool) {
    return { ok: false, reason: "not-found" };
  }

  const duplicateTool = version.characterTools.find((tool) => tool.key === key && tool.id !== input.toolId);
  if (duplicateTool) {
    return { ok: false, reason: "duplicate-key" };
  }

  const data = {
    characterId,
    key,
    title: input.title.trim(),
    description: input.description.trim(),
    toolType: normalizeValue(input.toolType),
    visibility: normalizeValue(input.visibility),
    config: input.config as Prisma.InputJsonValue,
    sortOrder: input.sortOrder
  };

  try {
    if (existingTool) {
      const updatedTool = await prisma.gameCharacterTool.update({
        where: { id: existingTool.id },
        data,
        select: { id: true, key: true }
      });
      return {
        ok: true,
        action: "updated",
        toolId: updatedTool.id,
        previousKey: existingTool.key,
        key: updatedTool.key
      };
    }

    const createdTool = await prisma.gameCharacterTool.create({
      data: {
        gameVersionId: input.versionId,
        ...data
      },
      select: { id: true, key: true }
    });
    return {
      ok: true,
      action: "created",
      toolId: createdTool.id,
      key: createdTool.key
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "duplicate-key" };
    }
    throw error;
  }
}

function getTargetIds(version: {
  rounds: { cards: { id: string }[] }[];
  evidence: { id: string }[];
  mediaAssets: { id: string }[];
  digitalArtifacts: { id: string }[];
}) {
  return {
    GameCard: new Set(version.rounds.flatMap((round) => round.cards.map((card) => card.id))),
    GameEvidence: new Set(version.evidence.map((evidence) => evidence.id)),
    GameMediaAsset: new Set(version.mediaAssets.map((media) => media.id)),
    GameDigitalArtifact: new Set(version.digitalArtifacts.map((artifact) => artifact.id))
  };
}

export async function upsertGameUnlockRule(input: UpsertGameUnlockRuleInput): Promise<UpsertGameUnlockRuleResult> {
  const key = normalizeContentKey(input.key);
  const requiredRoundId = normalizeOptionalId(input.requiredRoundId);
  const requiredCharacterId = normalizeOptionalId(input.requiredCharacterId);
  const sourceToolId = normalizeOptionalId(input.sourceToolId);
  const ruleType = normalizeValue(input.ruleType);
  const triggerType = normalizeValue(input.triggerType);
  const targetType = input.targetType.trim() as BuilderTargetType;
  const codeMode = normalizeValue(input.codeMode);

  if (!isValidRuleInput(input)) {
    return { ok: false, reason: "invalid-rule" };
  }
  if ((ruleType === "ACCESS_CODE" || triggerType === "CODE_ENTRY" || codeMode === "PARTY_TOOL_CODE") && !sourceToolId) {
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
        select: {
          id: true,
          cards: { select: { id: true } }
        }
      },
      characters: { select: { id: true } },
      evidence: { select: { id: true } },
      mediaAssets: { select: { id: true } },
      digitalArtifacts: { select: { id: true } },
      characterTools: {
        select: {
          id: true,
          toolType: true
        }
      },
      unlockRules: {
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

  const existingRule = input.unlockRuleId ? version.unlockRules.find((rule) => rule.id === input.unlockRuleId) : null;
  if (input.unlockRuleId && !existingRule) {
    return { ok: false, reason: "not-found" };
  }
  if (requiredRoundId && !version.rounds.some((round) => round.id === requiredRoundId)) {
    return { ok: false, reason: "invalid-linkage" };
  }
  if (requiredCharacterId && !version.characters.some((character) => character.id === requiredCharacterId)) {
    return { ok: false, reason: "invalid-linkage" };
  }

  const sourceTool = sourceToolId ? version.characterTools.find((tool) => tool.id === sourceToolId) : null;
  if (sourceToolId && !sourceTool) {
    return { ok: false, reason: "invalid-linkage" };
  }
  if ((ruleType === "ACCESS_CODE" || triggerType === "CODE_ENTRY") && sourceTool?.toolType !== "ACCESS_CODE_GENERATOR") {
    return { ok: false, reason: "invalid-linkage" };
  }

  const targetIds = getTargetIds(version);
  if (!targetIds[targetType].has(input.targetId.trim())) {
    return { ok: false, reason: "invalid-linkage" };
  }

  const duplicateRule = version.unlockRules.find((rule) => rule.key === key && rule.id !== input.unlockRuleId);
  if (duplicateRule) {
    return { ok: false, reason: "duplicate-key" };
  }

  const data = {
    requiredRoundId: requiredRoundId ?? null,
    requiredCharacterId: requiredCharacterId ?? null,
    sourceToolId: sourceToolId ?? null,
    key,
    title: input.title.trim(),
    description: input.description.trim(),
    ruleType,
    triggerType,
    targetType,
    targetId: input.targetId.trim(),
    unlockScope: normalizeValue(input.unlockScope),
    codeMode,
    config: input.config as Prisma.InputJsonValue,
    effect: input.effect as Prisma.InputJsonValue,
    status: normalizeValue(input.status),
    sortOrder: input.sortOrder
  };

  try {
    if (existingRule) {
      const updatedRule = await prisma.gameUnlockRule.update({
        where: { id: existingRule.id },
        data,
        select: { id: true, key: true }
      });
      return {
        ok: true,
        action: "updated",
        unlockRuleId: updatedRule.id,
        previousKey: existingRule.key,
        key: updatedRule.key
      };
    }

    const createdRule = await prisma.gameUnlockRule.create({
      data: {
        gameVersionId: input.versionId,
        ...data
      },
      select: { id: true, key: true }
    });
    return {
      ok: true,
      action: "created",
      unlockRuleId: createdRule.id,
      key: createdRule.key
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "duplicate-key" };
    }
    throw error;
  }
}
