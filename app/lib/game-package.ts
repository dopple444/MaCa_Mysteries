import {
  BUILDER_ARTIFACT_TYPES,
  BUILDER_TARGET_TYPES,
  BUILDER_VISIBILITIES,
  CHARACTER_TOOL_TYPES,
  UNLOCK_CODE_MODES,
  UNLOCK_RULE_STATUSES,
  UNLOCK_RULE_TYPES,
  UNLOCK_SCOPES,
  UNLOCK_TRIGGER_TYPES
} from "./admin-builder";
import { EVIDENCE_TYPES, MEDIA_ASSET_TYPES } from "./admin-evidence";
import { CARD_VISIBILITIES } from "./admin-rounds";

export const GAME_PACKAGE_SCHEMA_VERSION = "maca-game-package/v1";

export const GAME_PACKAGE_SOURCE_KINDS = ["MANUAL", "AI_ASSISTED", "IMPORT"] as const;

export type GamePackageSourceKind = (typeof GAME_PACKAGE_SOURCE_KINDS)[number];

export type GamePackageSource = {
  kind: GamePackageSourceKind;
  toolName?: string;
  toolVersion?: string;
  notes?: string;
};

export type GamePackageContent = {
  schemaVersion: typeof GAME_PACKAGE_SCHEMA_VERSION;
  source?: GamePackageSource;
  game: {
    slug: string;
    title: string;
    tagline: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    durationMin: number;
    durationMax: number;
    themes?: string[];
    contentWarnings?: string[];
  };
  characters: Array<{
    key: string;
    name: string;
    publicBio: string;
    privateBio?: string;
    isRequired?: boolean;
    relationships?: string[];
    objectives?: string[];
    secrets?: string[];
    sortOrder?: number;
  }>;
  rounds: Array<{
    key: string;
    title: string;
    summary?: string;
    sortOrder?: number;
    cards?: Array<{
      key: string;
      title: string;
      body: string;
      visibility: string;
      characterKey?: string;
      requiredUnlockRuleKey?: string;
      sortOrder?: number;
    }>;
  }>;
  evidence?: Array<{
    key: string;
    title: string;
    body: string;
    evidenceType: string;
    visibility: string;
    roundKey?: string;
    characterKey?: string;
    requiredUnlockRuleKey?: string;
    sortOrder?: number;
  }>;
  mediaAssets?: Array<{
    key: string;
    title: string;
    description?: string;
    assetType: string;
    url: string;
    mimeType?: string;
    visibility: string;
    roundKey?: string;
    characterKey?: string;
    evidenceKey?: string;
    requiredUnlockRuleKey?: string;
    sortOrder?: number;
  }>;
  digitalArtifacts?: Array<{
    key: string;
    title: string;
    description?: string;
    artifactType: string;
    visibility: string;
    content?: Record<string, unknown>;
    roundKey?: string;
    characterKey?: string;
    evidenceKey?: string;
    mediaAssetKey?: string;
    requiredUnlockRuleKey?: string;
    sortOrder?: number;
  }>;
  characterTools?: Array<{
    key: string;
    title: string;
    description?: string;
    toolType: string;
    visibility: string;
    characterKey: string;
    config?: Record<string, unknown>;
    sortOrder?: number;
  }>;
  unlockRules?: Array<{
    key: string;
    title: string;
    description?: string;
    ruleType: string;
    triggerType: string;
    targetType: string;
    targetKey: string;
    targetRoundKey?: string;
    unlockScope: string;
    codeMode?: string;
    requiredRoundKey?: string;
    requiredCharacterKey?: string;
    sourceToolKey?: string;
    config?: Record<string, unknown>;
    effect?: Record<string, unknown>;
    status?: string;
    sortOrder?: number;
  }>;
  finalReveal?: {
    title: string;
    victimCharacterKey?: string;
    killerCharacterKey?: string;
    victimRevealText?: string;
    killerRevealText?: string;
    solutionText: string;
    epilogueText?: string;
  };
};

export type GamePackageValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type GamePackageSummary = {
  characters: number;
  requiredCharacters: number;
  optionalCharacters: number;
  rounds: number;
  cards: number;
  evidence: number;
  mediaAssets: number;
  digitalArtifacts: number;
  characterTools: number;
  unlockRules: number;
  hasFinalReveal: boolean;
  sourceKind: string;
};

export type GamePackageValidationResult =
  | {
      ok: true;
      package: GamePackageContent;
      summary: GamePackageSummary;
      warnings: GamePackageValidationIssue[];
      errors: [];
    }
  | {
      ok: false;
      summary: GamePackageSummary;
      warnings: GamePackageValidationIssue[];
      errors: GamePackageValidationIssue[];
    };

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,95}$/;
const MAX_TITLE_LENGTH = 160;
const MAX_SHORT_TEXT_LENGTH = 5000;
const MAX_LONG_TEXT_LENGTH = 20000;
const MAX_URL_LENGTH = 2000;
const MAX_COLLECTION_ITEMS = 500;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getObject(value: unknown, path: string, errors: GamePackageValidationIssue[]) {
  if (!isPlainObject(value)) {
    errors.push({
      code: "INVALID_OBJECT",
      path,
      message: `${path || "package"} must be an object.`
    });
    return null;
  }
  return value;
}

function getArray(value: unknown, path: string, errors: GamePackageValidationIssue[], required = false) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value)) {
    errors.push({
      code: required ? "MISSING_ARRAY" : "INVALID_ARRAY",
      path,
      message: `${path} must be an array.`
    });
    return [];
  }
  if (value.length > MAX_COLLECTION_ITEMS) {
    errors.push({
      code: "TOO_MANY_ITEMS",
      path,
      message: `${path} cannot contain more than ${MAX_COLLECTION_ITEMS} items.`
    });
  }
  return value;
}

function getString(
  object: Record<string, unknown>,
  key: string,
  path: string,
  errors: GamePackageValidationIssue[],
  options: { required?: boolean; maxLength?: number; allowEmpty?: boolean } = {}
) {
  const value = object[key];
  const fullPath = `${path}.${key}`;
  if (value === undefined || value === null) {
    if (options.required) {
      errors.push({ code: "MISSING_STRING", path: fullPath, message: `${fullPath} is required.` });
    }
    return "";
  }
  if (typeof value !== "string") {
    errors.push({ code: "INVALID_STRING", path: fullPath, message: `${fullPath} must be a string.` });
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed && options.required && !options.allowEmpty) {
    errors.push({ code: "EMPTY_STRING", path: fullPath, message: `${fullPath} cannot be empty.` });
  }
  if (options.maxLength && trimmed.length > options.maxLength) {
    errors.push({
      code: "STRING_TOO_LONG",
      path: fullPath,
      message: `${fullPath} cannot exceed ${options.maxLength} characters.`
    });
  }
  return trimmed;
}

function getNumber(
  object: Record<string, unknown>,
  key: string,
  path: string,
  errors: GamePackageValidationIssue[],
  options: { required?: boolean; min?: number } = {}
) {
  const value = object[key];
  const fullPath = `${path}.${key}`;
  if (value === undefined || value === null) {
    if (options.required) {
      errors.push({ code: "MISSING_NUMBER", path: fullPath, message: `${fullPath} is required.` });
    }
    return 0;
  }
  if (!Number.isInteger(value)) {
    errors.push({ code: "INVALID_NUMBER", path: fullPath, message: `${fullPath} must be an integer.` });
    return 0;
  }
  const numericValue = value as number;
  if (options.min !== undefined && numericValue < options.min) {
    errors.push({ code: "NUMBER_TOO_SMALL", path: fullPath, message: `${fullPath} must be at least ${options.min}.` });
  }
  return numericValue;
}

function getOptionalNumber(object: Record<string, unknown>, key: string, path: string, errors: GamePackageValidationIssue[]) {
  if (object[key] === undefined || object[key] === null) return 0;
  return getNumber(object, key, path, errors);
}

function assertAllowed(
  value: string,
  allowed: readonly string[],
  path: string,
  errors: GamePackageValidationIssue[],
  code = "INVALID_VALUE"
) {
  if (!allowed.includes(value.trim().toUpperCase())) {
    errors.push({
      code,
      path,
      message: `${path} must be one of: ${allowed.join(", ")}.`
    });
  }
}

function assertKey(key: string, path: string, errors: GamePackageValidationIssue[]) {
  if (!KEY_PATTERN.test(key)) {
    errors.push({
      code: "INVALID_KEY",
      path,
      message: `${path} must use lowercase letters, numbers, and hyphens, and be 2-64 characters long.`
    });
  }
}

function collectKeyedObjects(
  packageObject: Record<string, unknown>,
  key: string,
  errors: GamePackageValidationIssue[],
  required = false
) {
  const items = getArray(packageObject[key], key, errors, required);
  const objects: Array<Record<string, unknown>> = [];
  const keys = new Set<string>();

  items.forEach((item, index) => {
    const path = `${key}[${index}]`;
    const object = getObject(item, path, errors);
    if (!object) return;
    const itemKey = getString(object, "key", path, errors, { required: true, maxLength: 64 });
    assertKey(itemKey, `${path}.key`, errors);
    if (itemKey) {
      if (keys.has(itemKey)) {
        errors.push({
          code: "DUPLICATE_KEY",
          path: `${path}.key`,
          message: `${key} contains duplicate key "${itemKey}".`
        });
      }
      keys.add(itemKey);
    }
    objects.push(object);
  });

  return { objects, keys };
}

function assertReference(
  value: string,
  keys: Set<string>,
  path: string,
  errors: GamePackageValidationIssue[],
  targetLabel: string
) {
  if (value && !keys.has(value)) {
    errors.push({
      code: "INVALID_REFERENCE",
      path,
      message: `${path} references missing ${targetLabel} "${value}".`
    });
  }
}

function getStringArray(object: Record<string, unknown>, key: string, path: string, errors: GamePackageValidationIssue[]) {
  const value = object[key];
  const fullPath = `${path}.${key}`;
  if (value === undefined) return;
  const items = getArray(value, fullPath, errors);
  items.forEach((item, index) => {
    if (typeof item !== "string") {
      errors.push({
        code: "INVALID_STRING",
        path: `${fullPath}[${index}]`,
        message: `${fullPath}[${index}] must be a string.`
      });
    }
  });
}

function validateGameObject(packageObject: Record<string, unknown>, errors: GamePackageValidationIssue[]) {
  const game = getObject(packageObject.game, "game", errors);
  if (!game) return;

  const slug = getString(game, "slug", "game", errors, { required: true, maxLength: 96 });
  if (slug && !SLUG_PATTERN.test(slug)) {
    errors.push({
      code: "INVALID_SLUG",
      path: "game.slug",
      message: "game.slug must use lowercase letters, numbers, and hyphens."
    });
  }
  getString(game, "title", "game", errors, { required: true, maxLength: MAX_TITLE_LENGTH });
  getString(game, "tagline", "game", errors, { required: true, maxLength: MAX_TITLE_LENGTH });
  getString(game, "description", "game", errors, { required: true, maxLength: MAX_SHORT_TEXT_LENGTH });
  const minPlayers = getNumber(game, "minPlayers", "game", errors, { required: true, min: 1 });
  const maxPlayers = getNumber(game, "maxPlayers", "game", errors, { required: true, min: 1 });
  const durationMin = getNumber(game, "durationMin", "game", errors, { required: true, min: 1 });
  const durationMax = getNumber(game, "durationMax", "game", errors, { required: true, min: 1 });
  if (minPlayers && maxPlayers && minPlayers > maxPlayers) {
    errors.push({ code: "INVALID_RANGE", path: "game.maxPlayers", message: "maxPlayers must be >= minPlayers." });
  }
  if (durationMin && durationMax && durationMin > durationMax) {
    errors.push({ code: "INVALID_RANGE", path: "game.durationMax", message: "durationMax must be >= durationMin." });
  }
  getStringArray(game, "themes", "game", errors);
  getStringArray(game, "contentWarnings", "game", errors);
}

function validateSource(packageObject: Record<string, unknown>, errors: GamePackageValidationIssue[], warnings: GamePackageValidationIssue[]) {
  if (packageObject.source === undefined) return "UNSPECIFIED";
  const source = getObject(packageObject.source, "source", errors);
  if (!source) return "INVALID";
  const kind = getString(source, "kind", "source", errors, { required: true, maxLength: 40 }).toUpperCase();
  assertAllowed(kind, GAME_PACKAGE_SOURCE_KINDS, "source.kind", errors);
  getString(source, "toolName", "source", errors, { maxLength: MAX_TITLE_LENGTH });
  getString(source, "toolVersion", "source", errors, { maxLength: MAX_TITLE_LENGTH });
  getString(source, "notes", "source", errors, { maxLength: MAX_SHORT_TEXT_LENGTH });
  if (kind === "AI_ASSISTED") {
    warnings.push({
      code: "AI_REVIEW_REQUIRED",
      path: "source.kind",
      message: "AI-assisted packages must be imported as drafts and manually reviewed before publishing."
    });
  }
  return kind || "UNSPECIFIED";
}

function validateCharacters(objects: Array<Record<string, unknown>>, errors: GamePackageValidationIssue[], warnings: GamePackageValidationIssue[]) {
  let requiredCharacters = 0;
  objects.forEach((character, index) => {
    const path = `characters[${index}]`;
    getString(character, "name", path, errors, { required: true, maxLength: 120 });
    getString(character, "publicBio", path, errors, { required: true, maxLength: MAX_SHORT_TEXT_LENGTH });
    getString(character, "privateBio", path, errors, { maxLength: MAX_SHORT_TEXT_LENGTH });
    getOptionalNumber(character, "sortOrder", path, errors);
    getStringArray(character, "relationships", path, errors);
    getStringArray(character, "objectives", path, errors);
    getStringArray(character, "secrets", path, errors);
    if (character.isRequired === undefined || character.isRequired === true) requiredCharacters += 1;
    if (character.isRequired !== undefined && typeof character.isRequired !== "boolean") {
      errors.push({
        code: "INVALID_BOOLEAN",
        path: `${path}.isRequired`,
        message: `${path}.isRequired must be a boolean.`
      });
    }
  });
  if (!objects.length) {
    warnings.push({ code: "MISSING_CHARACTERS", path: "characters", message: "Package has no characters." });
  } else if (requiredCharacters < 1) {
    errors.push({
      code: "MISSING_REQUIRED_CHARACTERS",
      path: "characters",
      message: "At least one required character is needed."
    });
  }
  return requiredCharacters;
}

function validateRoundsAndCards(
  rounds: Array<Record<string, unknown>>,
  roundKeys: Set<string>,
  characterKeys: Set<string>,
  unlockRuleKeys: Set<string>,
  errors: GamePackageValidationIssue[],
  warnings: GamePackageValidationIssue[]
) {
  const cardKeys = new Set<string>();
  let cardCount = 0;

  rounds.forEach((round, roundIndex) => {
    const roundPath = `rounds[${roundIndex}]`;
    const roundKey = getString(round, "key", roundPath, errors, { required: true, maxLength: 64 });
    getString(round, "title", roundPath, errors, { required: true, maxLength: MAX_TITLE_LENGTH });
    getString(round, "summary", roundPath, errors, { maxLength: MAX_SHORT_TEXT_LENGTH });
    getOptionalNumber(round, "sortOrder", roundPath, errors);

    const cards = getArray(round.cards, `${roundPath}.cards`, errors);
    const roundCardKeys = new Set<string>();
    cards.forEach((card, cardIndex) => {
      const cardPath = `${roundPath}.cards[${cardIndex}]`;
      const cardObject = getObject(card, cardPath, errors);
      if (!cardObject) return;
      const cardKey = getString(cardObject, "key", cardPath, errors, { required: true, maxLength: 64 });
      assertKey(cardKey, `${cardPath}.key`, errors);
      if (roundCardKeys.has(cardKey)) {
        errors.push({
          code: "DUPLICATE_KEY",
          path: `${cardPath}.key`,
          message: `Round "${roundKey}" contains duplicate card key "${cardKey}".`
        });
      }
      roundCardKeys.add(cardKey);
      cardKeys.add(`${roundKey}/${cardKey}`);
      cardCount += 1;
      getString(cardObject, "title", cardPath, errors, { required: true, maxLength: MAX_TITLE_LENGTH });
      getString(cardObject, "body", cardPath, errors, { required: true, maxLength: MAX_LONG_TEXT_LENGTH });
      const visibility = getString(cardObject, "visibility", cardPath, errors, { required: true, maxLength: 80 }).toUpperCase();
      assertAllowed(visibility, CARD_VISIBILITIES, `${cardPath}.visibility`, errors);
      const characterKey = getString(cardObject, "characterKey", cardPath, errors, { maxLength: 64 });
      assertReference(characterKey, characterKeys, `${cardPath}.characterKey`, errors, "character");
      if (visibility === "PLAYER_PRIVATE" && !characterKey) {
        errors.push({
          code: "MISSING_CHARACTER_REFERENCE",
          path: `${cardPath}.characterKey`,
          message: "Player-private cards require characterKey."
        });
      }
      const requiredUnlockRuleKey = getString(cardObject, "requiredUnlockRuleKey", cardPath, errors, { maxLength: 64 });
      assertReference(requiredUnlockRuleKey, unlockRuleKeys, `${cardPath}.requiredUnlockRuleKey`, errors, "unlock rule");
      getOptionalNumber(cardObject, "sortOrder", cardPath, errors);
    });
  });

  if (!rounds.length) warnings.push({ code: "MISSING_ROUNDS", path: "rounds", message: "Package has no rounds." });
  if (rounds.length && !cardCount) {
    warnings.push({ code: "MISSING_CARDS", path: "rounds", message: "Package has rounds but no cards." });
  }

  for (const roundKey of roundKeys) {
    if (!roundKey) continue;
  }

  return { cardKeys, cardCount };
}

function validateVisibilityAndLinks({
  object,
  path,
  visibility,
  roundKeys,
  characterKeys,
  unlockRuleKeys,
  errors
}: {
  object: Record<string, unknown>;
  path: string;
  visibility: string;
  roundKeys: Set<string>;
  characterKeys: Set<string>;
  unlockRuleKeys: Set<string>;
  errors: GamePackageValidationIssue[];
}) {
  const roundKey = getString(object, "roundKey", path, errors, { maxLength: 64 });
  assertReference(roundKey, roundKeys, `${path}.roundKey`, errors, "round");
  const characterKey = getString(object, "characterKey", path, errors, { maxLength: 64 });
  assertReference(characterKey, characterKeys, `${path}.characterKey`, errors, "character");
  if (visibility === "PLAYER_PRIVATE" && !characterKey) {
    errors.push({
      code: "MISSING_CHARACTER_REFERENCE",
      path: `${path}.characterKey`,
      message: "Player-private content requires characterKey."
    });
  }
  const requiredUnlockRuleKey = getString(object, "requiredUnlockRuleKey", path, errors, { maxLength: 64 });
  assertReference(requiredUnlockRuleKey, unlockRuleKeys, `${path}.requiredUnlockRuleKey`, errors, "unlock rule");
}

function validateEvidence(
  objects: Array<Record<string, unknown>>,
  roundKeys: Set<string>,
  characterKeys: Set<string>,
  unlockRuleKeys: Set<string>,
  errors: GamePackageValidationIssue[]
) {
  objects.forEach((evidence, index) => {
    const path = `evidence[${index}]`;
    getString(evidence, "title", path, errors, { required: true, maxLength: MAX_TITLE_LENGTH });
    getString(evidence, "body", path, errors, { required: true, maxLength: MAX_LONG_TEXT_LENGTH });
    const evidenceType = getString(evidence, "evidenceType", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(evidenceType, EVIDENCE_TYPES, `${path}.evidenceType`, errors);
    const visibility = getString(evidence, "visibility", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(visibility, BUILDER_VISIBILITIES, `${path}.visibility`, errors);
    validateVisibilityAndLinks({ object: evidence, path, visibility, roundKeys, characterKeys, unlockRuleKeys, errors });
    getOptionalNumber(evidence, "sortOrder", path, errors);
  });
}

function validateMedia(
  objects: Array<Record<string, unknown>>,
  roundKeys: Set<string>,
  characterKeys: Set<string>,
  evidenceKeys: Set<string>,
  unlockRuleKeys: Set<string>,
  errors: GamePackageValidationIssue[]
) {
  objects.forEach((media, index) => {
    const path = `mediaAssets[${index}]`;
    getString(media, "title", path, errors, { required: true, maxLength: MAX_TITLE_LENGTH });
    getString(media, "description", path, errors, { maxLength: MAX_SHORT_TEXT_LENGTH });
    const assetType = getString(media, "assetType", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(assetType, MEDIA_ASSET_TYPES, `${path}.assetType`, errors);
    const url = getString(media, "url", path, errors, { required: true, maxLength: MAX_URL_LENGTH });
    if (url && !url.startsWith("/") && !/^https?:\/\//i.test(url)) {
      errors.push({ code: "INVALID_URL", path: `${path}.url`, message: `${path}.url must be relative or HTTP(S).` });
    }
    getString(media, "mimeType", path, errors, { maxLength: 120 });
    const visibility = getString(media, "visibility", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(visibility, BUILDER_VISIBILITIES, `${path}.visibility`, errors);
    validateVisibilityAndLinks({ object: media, path, visibility, roundKeys, characterKeys, unlockRuleKeys, errors });
    const evidenceKey = getString(media, "evidenceKey", path, errors, { maxLength: 64 });
    assertReference(evidenceKey, evidenceKeys, `${path}.evidenceKey`, errors, "evidence");
    getOptionalNumber(media, "sortOrder", path, errors);
  });
}

function validateDigitalArtifacts(
  objects: Array<Record<string, unknown>>,
  roundKeys: Set<string>,
  characterKeys: Set<string>,
  evidenceKeys: Set<string>,
  mediaKeys: Set<string>,
  unlockRuleKeys: Set<string>,
  errors: GamePackageValidationIssue[]
) {
  objects.forEach((artifact, index) => {
    const path = `digitalArtifacts[${index}]`;
    getString(artifact, "title", path, errors, { required: true, maxLength: MAX_TITLE_LENGTH });
    getString(artifact, "description", path, errors, { maxLength: MAX_SHORT_TEXT_LENGTH });
    const artifactType = getString(artifact, "artifactType", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(artifactType, BUILDER_ARTIFACT_TYPES, `${path}.artifactType`, errors);
    const visibility = getString(artifact, "visibility", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(visibility, BUILDER_VISIBILITIES, `${path}.visibility`, errors);
    validateVisibilityAndLinks({ object: artifact, path, visibility, roundKeys, characterKeys, unlockRuleKeys, errors });
    const evidenceKey = getString(artifact, "evidenceKey", path, errors, { maxLength: 64 });
    assertReference(evidenceKey, evidenceKeys, `${path}.evidenceKey`, errors, "evidence");
    const mediaAssetKey = getString(artifact, "mediaAssetKey", path, errors, { maxLength: 64 });
    assertReference(mediaAssetKey, mediaKeys, `${path}.mediaAssetKey`, errors, "media asset");
    if (artifact.content !== undefined && !isPlainObject(artifact.content)) {
      errors.push({ code: "INVALID_OBJECT", path: `${path}.content`, message: `${path}.content must be an object.` });
    }
    getOptionalNumber(artifact, "sortOrder", path, errors);
  });
}

function validateCharacterTools(
  objects: Array<Record<string, unknown>>,
  characterKeys: Set<string>,
  errors: GamePackageValidationIssue[]
) {
  objects.forEach((tool, index) => {
    const path = `characterTools[${index}]`;
    getString(tool, "title", path, errors, { required: true, maxLength: MAX_TITLE_LENGTH });
    getString(tool, "description", path, errors, { maxLength: MAX_SHORT_TEXT_LENGTH });
    const toolType = getString(tool, "toolType", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(toolType, CHARACTER_TOOL_TYPES, `${path}.toolType`, errors);
    const visibility = getString(tool, "visibility", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(visibility, BUILDER_VISIBILITIES, `${path}.visibility`, errors);
    const characterKey = getString(tool, "characterKey", path, errors, { required: true, maxLength: 64 });
    assertReference(characterKey, characterKeys, `${path}.characterKey`, errors, "character");
    if (tool.config !== undefined && !isPlainObject(tool.config)) {
      errors.push({ code: "INVALID_OBJECT", path: `${path}.config`, message: `${path}.config must be an object.` });
    }
    getOptionalNumber(tool, "sortOrder", path, errors);
  });
}

function validateUnlockRules(
  objects: Array<Record<string, unknown>>,
  roundKeys: Set<string>,
  characterKeys: Set<string>,
  cardKeys: Set<string>,
  evidenceKeys: Set<string>,
  mediaKeys: Set<string>,
  artifactKeys: Set<string>,
  toolKeys: Set<string>,
  errors: GamePackageValidationIssue[]
) {
  objects.forEach((rule, index) => {
    const path = `unlockRules[${index}]`;
    getString(rule, "title", path, errors, { required: true, maxLength: MAX_TITLE_LENGTH });
    getString(rule, "description", path, errors, { maxLength: MAX_SHORT_TEXT_LENGTH });
    const ruleType = getString(rule, "ruleType", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(ruleType, UNLOCK_RULE_TYPES, `${path}.ruleType`, errors);
    const triggerType = getString(rule, "triggerType", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(triggerType, UNLOCK_TRIGGER_TYPES, `${path}.triggerType`, errors);
    const targetType = getString(rule, "targetType", path, errors, { required: true, maxLength: 80 });
    if (!(BUILDER_TARGET_TYPES as readonly string[]).includes(targetType)) {
      errors.push({
        code: "INVALID_TARGET_TYPE",
        path: `${path}.targetType`,
        message: `${path}.targetType must be one of: ${BUILDER_TARGET_TYPES.join(", ")}.`
      });
    }
    const targetKey = getString(rule, "targetKey", path, errors, { required: true, maxLength: 64 });
    const targetRoundKey = getString(rule, "targetRoundKey", path, errors, { maxLength: 64 });
    if (targetType === "GameCard") {
      if (!targetRoundKey) {
        errors.push({
          code: "MISSING_ROUND_REFERENCE",
          path: `${path}.targetRoundKey`,
          message: "GameCard targets require targetRoundKey because card keys are round-scoped."
        });
      } else {
        assertReference(`${targetRoundKey}/${targetKey}`, cardKeys, `${path}.targetKey`, errors, "card");
      }
    } else if (targetType === "GameEvidence") {
      assertReference(targetKey, evidenceKeys, `${path}.targetKey`, errors, "evidence");
    } else if (targetType === "GameMediaAsset") {
      assertReference(targetKey, mediaKeys, `${path}.targetKey`, errors, "media asset");
    } else if (targetType === "GameDigitalArtifact") {
      assertReference(targetKey, artifactKeys, `${path}.targetKey`, errors, "digital artifact");
    }

    const unlockScope = getString(rule, "unlockScope", path, errors, { required: true, maxLength: 80 }).toUpperCase();
    assertAllowed(unlockScope, UNLOCK_SCOPES, `${path}.unlockScope`, errors);
    const codeMode = getString(rule, "codeMode", path, errors, { maxLength: 80 }).toUpperCase();
    if (codeMode) assertAllowed(codeMode, UNLOCK_CODE_MODES, `${path}.codeMode`, errors);
    const status = getString(rule, "status", path, errors, { maxLength: 80 }).toUpperCase();
    if (status) assertAllowed(status, UNLOCK_RULE_STATUSES, `${path}.status`, errors);
    const requiredRoundKey = getString(rule, "requiredRoundKey", path, errors, { maxLength: 64 });
    assertReference(requiredRoundKey, roundKeys, `${path}.requiredRoundKey`, errors, "round");
    const requiredCharacterKey = getString(rule, "requiredCharacterKey", path, errors, { maxLength: 64 });
    assertReference(requiredCharacterKey, characterKeys, `${path}.requiredCharacterKey`, errors, "character");
    const sourceToolKey = getString(rule, "sourceToolKey", path, errors, { maxLength: 64 });
    assertReference(sourceToolKey, toolKeys, `${path}.sourceToolKey`, errors, "character tool");
    if (ruleType === "ACCESS_CODE" && !sourceToolKey && codeMode === "PARTY_TOOL_CODE") {
      errors.push({
        code: "MISSING_SOURCE_TOOL",
        path: `${path}.sourceToolKey`,
        message: "Access-code rules using PARTY_TOOL_CODE require sourceToolKey."
      });
    }
    if (rule.config !== undefined && !isPlainObject(rule.config)) {
      errors.push({ code: "INVALID_OBJECT", path: `${path}.config`, message: `${path}.config must be an object.` });
    }
    if (rule.effect !== undefined && !isPlainObject(rule.effect)) {
      errors.push({ code: "INVALID_OBJECT", path: `${path}.effect`, message: `${path}.effect must be an object.` });
    }
    getOptionalNumber(rule, "sortOrder", path, errors);
  });
}

function validateFinalReveal(
  packageObject: Record<string, unknown>,
  characterKeys: Set<string>,
  errors: GamePackageValidationIssue[],
  warnings: GamePackageValidationIssue[]
) {
  if (packageObject.finalReveal === undefined) {
    warnings.push({ code: "MISSING_FINAL_REVEAL", path: "finalReveal", message: "Package has no final reveal." });
    return false;
  }
  const reveal = getObject(packageObject.finalReveal, "finalReveal", errors);
  if (!reveal) return false;
  getString(reveal, "title", "finalReveal", errors, { required: true, maxLength: MAX_TITLE_LENGTH });
  const victimCharacterKey = getString(reveal, "victimCharacterKey", "finalReveal", errors, { maxLength: 64 });
  assertReference(victimCharacterKey, characterKeys, "finalReveal.victimCharacterKey", errors, "character");
  const killerCharacterKey = getString(reveal, "killerCharacterKey", "finalReveal", errors, { maxLength: 64 });
  assertReference(killerCharacterKey, characterKeys, "finalReveal.killerCharacterKey", errors, "character");
  getString(reveal, "victimRevealText", "finalReveal", errors, { maxLength: MAX_LONG_TEXT_LENGTH });
  getString(reveal, "killerRevealText", "finalReveal", errors, { maxLength: MAX_LONG_TEXT_LENGTH });
  getString(reveal, "solutionText", "finalReveal", errors, { required: true, maxLength: MAX_LONG_TEXT_LENGTH });
  getString(reveal, "epilogueText", "finalReveal", errors, { maxLength: MAX_LONG_TEXT_LENGTH });
  return true;
}

function emptySummary(): GamePackageSummary {
  return {
    characters: 0,
    requiredCharacters: 0,
    optionalCharacters: 0,
    rounds: 0,
    cards: 0,
    evidence: 0,
    mediaAssets: 0,
    digitalArtifacts: 0,
    characterTools: 0,
    unlockRules: 0,
    hasFinalReveal: false,
    sourceKind: "UNSPECIFIED"
  };
}

export function validateGamePackage(value: unknown): GamePackageValidationResult {
  const errors: GamePackageValidationIssue[] = [];
  const warnings: GamePackageValidationIssue[] = [];
  const packageObject = getObject(value, "", errors);
  if (!packageObject) {
    return { ok: false, summary: emptySummary(), warnings, errors };
  }

  const schemaVersion = getString(packageObject, "schemaVersion", "package", errors, {
    required: true,
    maxLength: 80
  });
  if (schemaVersion !== GAME_PACKAGE_SCHEMA_VERSION) {
    errors.push({
      code: "UNSUPPORTED_SCHEMA_VERSION",
      path: "schemaVersion",
      message: `schemaVersion must be ${GAME_PACKAGE_SCHEMA_VERSION}.`
    });
  }

  const sourceKind = validateSource(packageObject, errors, warnings);
  validateGameObject(packageObject, errors);

  const { objects: characterObjects, keys: characterKeys } = collectKeyedObjects(packageObject, "characters", errors, true);
  const { objects: roundObjects, keys: roundKeys } = collectKeyedObjects(packageObject, "rounds", errors, true);
  const { objects: evidenceObjects, keys: evidenceKeys } = collectKeyedObjects(packageObject, "evidence", errors);
  const { objects: mediaObjects, keys: mediaKeys } = collectKeyedObjects(packageObject, "mediaAssets", errors);
  const { objects: artifactObjects, keys: artifactKeys } = collectKeyedObjects(packageObject, "digitalArtifacts", errors);
  const { objects: toolObjects, keys: toolKeys } = collectKeyedObjects(packageObject, "characterTools", errors);
  const { objects: unlockRuleObjects, keys: unlockRuleKeys } = collectKeyedObjects(packageObject, "unlockRules", errors);

  const requiredCharacters = validateCharacters(characterObjects, errors, warnings);
  validateEvidence(evidenceObjects, roundKeys, characterKeys, unlockRuleKeys, errors);
  validateMedia(mediaObjects, roundKeys, characterKeys, evidenceKeys, unlockRuleKeys, errors);
  validateDigitalArtifacts(artifactObjects, roundKeys, characterKeys, evidenceKeys, mediaKeys, unlockRuleKeys, errors);
  validateCharacterTools(toolObjects, characterKeys, errors);
  const { cardKeys, cardCount } = validateRoundsAndCards(
    roundObjects,
    roundKeys,
    characterKeys,
    unlockRuleKeys,
    errors,
    warnings
  );
  validateUnlockRules(
    unlockRuleObjects,
    roundKeys,
    characterKeys,
    cardKeys,
    evidenceKeys,
    mediaKeys,
    artifactKeys,
    toolKeys,
    errors
  );
  const hasFinalReveal = validateFinalReveal(packageObject, characterKeys, errors, warnings);

  const summary: GamePackageSummary = {
    characters: characterObjects.length,
    requiredCharacters,
    optionalCharacters: Math.max(characterObjects.length - requiredCharacters, 0),
    rounds: roundObjects.length,
    cards: cardCount,
    evidence: evidenceObjects.length,
    mediaAssets: mediaObjects.length,
    digitalArtifacts: artifactObjects.length,
    characterTools: toolObjects.length,
    unlockRules: unlockRuleObjects.length,
    hasFinalReveal,
    sourceKind
  };

  if (errors.length) {
    return { ok: false, summary, warnings, errors };
  }

  return {
    ok: true,
    package: packageObject as GamePackageContent,
    summary,
    warnings,
    errors: []
  };
}
