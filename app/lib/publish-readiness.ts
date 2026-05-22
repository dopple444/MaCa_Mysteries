import { prisma } from "./prisma";

export type PublishReadinessSeverity = "ERROR" | "WARNING";

export type PublishReadinessIssue = {
  severity: PublishReadinessSeverity;
  code: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
};

export type PublishReadinessResult = {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: PublishReadinessIssue[];
};

type ContentTarget = {
  id: string;
  type: "GameCard" | "GameEvidence" | "GameMediaAsset" | "GameDigitalArtifact";
  key: string;
  title: string;
  visibility: string;
  gameRoundId?: string | null;
  characterId?: string | null;
  evidenceId?: string | null;
  mediaAssetId?: string | null;
  requiredUnlockRuleId?: string | null;
};

function isFilled(value?: string | null) {
  return Boolean(value?.trim());
}

function contentLabel(target: ContentTarget) {
  return target.title || target.key || target.id;
}

function targetMapKey(type: string, id: string) {
  return `${type}:${id}`;
}

function addIssue(
  issues: PublishReadinessIssue[],
  severity: PublishReadinessSeverity,
  code: string,
  message: string,
  entity?: { type?: string; id?: string; label?: string }
) {
  issues.push({
    severity,
    code,
    message,
    entityType: entity?.type,
    entityId: entity?.id,
    entityLabel: entity?.label
  });
}

export async function getGameVersionPublishReadiness(input: {
  gameId: string;
  versionId: string;
}): Promise<PublishReadinessResult> {
  const issues: PublishReadinessIssue[] = [];
  const version = await prisma.gameVersion.findFirst({
    where: {
      id: input.versionId,
      gameId: input.gameId
    },
    include: {
      game: true,
      characters: {
        orderBy: [
          { isRequired: "desc" },
          { sortOrder: "asc" },
          { name: "asc" }
        ]
      },
      rounds: {
        orderBy: { sortOrder: "asc" },
        include: {
          cards: {
            orderBy: [
              { sortOrder: "asc" },
              { title: "asc" }
            ]
          }
        }
      },
      evidence: {
        orderBy: [
          { sortOrder: "asc" },
          { title: "asc" }
        ]
      },
      mediaAssets: {
        orderBy: [
          { sortOrder: "asc" },
          { title: "asc" }
        ]
      },
      digitalArtifacts: {
        orderBy: [
          { sortOrder: "asc" },
          { title: "asc" }
        ]
      },
      characterTools: {
        orderBy: [
          { sortOrder: "asc" },
          { title: "asc" }
        ]
      },
      unlockRules: {
        orderBy: [
          { sortOrder: "asc" },
          { title: "asc" }
        ],
        include: {
          sourceTool: true,
          requiredRound: true,
          requiredCharacter: true
        }
      },
      finalReveal: true
    }
  });

  if (!version) {
    addIssue(issues, "ERROR", "VERSION_NOT_FOUND", "Game version was not found.");
    return {
      ok: false,
      errorCount: 1,
      warningCount: 0,
      issues
    };
  }

  const characterIds = new Set(version.characters.map((character) => character.id));
  const roundIds = new Set(version.rounds.map((round) => round.id));
  const evidenceIds = new Set(version.evidence.map((evidence) => evidence.id));
  const mediaIds = new Set(version.mediaAssets.map((media) => media.id));
  const toolIds = new Set(version.characterTools.map((tool) => tool.id));
  const unlockRulesById = new Map(version.unlockRules.map((rule) => [rule.id, rule]));
  const roundSortById = new Map(version.rounds.map((round) => [round.id, round.sortOrder]));

  const cards: ContentTarget[] = version.rounds.flatMap((round) =>
    round.cards.map((card) => ({
      id: card.id,
      type: "GameCard" as const,
      key: card.key,
      title: card.title,
      visibility: card.visibility,
      gameRoundId: round.id,
      characterId: card.characterId,
      requiredUnlockRuleId: card.requiredUnlockRuleId
    }))
  );
  const evidence: ContentTarget[] = version.evidence.map((item) => ({
    id: item.id,
    type: "GameEvidence" as const,
    key: item.key,
    title: item.title,
    visibility: item.visibility,
    gameRoundId: item.gameRoundId,
    characterId: item.characterId,
    requiredUnlockRuleId: item.requiredUnlockRuleId
  }));
  const mediaAssets: ContentTarget[] = version.mediaAssets.map((media) => ({
    id: media.id,
    type: "GameMediaAsset" as const,
    key: media.key,
    title: media.title,
    visibility: media.visibility,
    gameRoundId: media.gameRoundId,
    characterId: media.characterId,
    evidenceId: media.evidenceId,
    requiredUnlockRuleId: media.requiredUnlockRuleId
  }));
  const digitalArtifacts: ContentTarget[] = version.digitalArtifacts.map((artifact) => ({
    id: artifact.id,
    type: "GameDigitalArtifact" as const,
    key: artifact.key,
    title: artifact.title,
    visibility: artifact.visibility,
    gameRoundId: artifact.gameRoundId,
    characterId: artifact.characterId,
    evidenceId: artifact.evidenceId,
    mediaAssetId: artifact.mediaAssetId,
    requiredUnlockRuleId: artifact.requiredUnlockRuleId
  }));
  const contentTargets = [...cards, ...evidence, ...mediaAssets, ...digitalArtifacts];
  const contentTargetsByKey = new Map(contentTargets.map((target) => [targetMapKey(target.type, target.id), target]));

  if (version.characters.length === 0) {
    addIssue(issues, "ERROR", "MISSING_CHARACTERS", "Add at least one character before publishing.");
  }

  const requiredCharacters = version.characters.filter((character) => character.isRequired);
  if (requiredCharacters.length === 0) {
    addIssue(issues, "ERROR", "MISSING_REQUIRED_CHARACTERS", "Mark at least one character as required.");
  }
  if (requiredCharacters.length > version.game.maxPlayers) {
    addIssue(
      issues,
      "ERROR",
      "TOO_MANY_REQUIRED_CHARACTERS",
      "Required character count is higher than the game's maximum player count."
    );
  }
  if (requiredCharacters.length < version.game.minPlayers && version.characters.length < version.game.minPlayers) {
    addIssue(
      issues,
      "WARNING",
      "LOW_CHARACTER_COUNT",
      "The version has fewer total characters than the game's minimum player count."
    );
  }

  if (version.rounds.length === 0) {
    addIssue(issues, "ERROR", "MISSING_ROUNDS", "Add at least one round before publishing.");
  }
  if (version.rounds.length > 0 && version.rounds.length < 3) {
    addIssue(
      issues,
      "WARNING",
      "SHORT_ROUND_STRUCTURE",
      "Most MaCa Mysteries games should have three primary rounds unless this version intentionally uses a shorter format."
    );
  }

  const seenRoundSortOrders = new Set<number>();
  for (const round of version.rounds) {
    if (seenRoundSortOrders.has(round.sortOrder)) {
      addIssue(
        issues,
        "WARNING",
        "DUPLICATE_ROUND_SORT_ORDER",
        `Round "${round.title}" shares a sort order with another round.`,
        { type: "GameRound", id: round.id, label: round.title }
      );
    }
    seenRoundSortOrders.add(round.sortOrder);
  }

  if (!version.finalReveal) {
    addIssue(issues, "ERROR", "MISSING_FINAL_REVEAL", "Add final reveal content before publishing.");
  } else {
    if (version.finalReveal.victimCharacterId && !characterIds.has(version.finalReveal.victimCharacterId)) {
      addIssue(
        issues,
        "ERROR",
        "FINAL_REVEAL_VICTIM_OUTSIDE_VERSION",
        "The victim reveal points to a character outside this game version.",
        { type: "GameFinalReveal", id: version.finalReveal.id, label: version.finalReveal.title }
      );
    }
    if (version.finalReveal.killerCharacterId && !characterIds.has(version.finalReveal.killerCharacterId)) {
      addIssue(
        issues,
        "ERROR",
        "FINAL_REVEAL_KILLER_OUTSIDE_VERSION",
        "The killer reveal points to a character outside this game version.",
        { type: "GameFinalReveal", id: version.finalReveal.id, label: version.finalReveal.title }
      );
    }
    if (!isFilled(version.finalReveal.victimCharacterId)) {
      addIssue(issues, "WARNING", "MISSING_VICTIM_CHARACTER", "Final reveal has no victim character selected.");
    }
    if (!isFilled(version.finalReveal.killerCharacterId)) {
      addIssue(issues, "WARNING", "MISSING_KILLER_CHARACTER", "Final reveal has no killer character selected.");
    }
    if (!isFilled(version.finalReveal.solutionText)) {
      addIssue(issues, "WARNING", "MISSING_SOLUTION_TEXT", "Final reveal has no solution text.");
    }
  }

  if (contentTargets.length === 0) {
    addIssue(issues, "ERROR", "MISSING_PLAYER_CONTENT", "Add cards, evidence, media, or digital artifacts before publishing.");
  }

  const contentByRoundId = new Map<string, number>();
  for (const target of contentTargets) {
    if (target.gameRoundId) {
      contentByRoundId.set(target.gameRoundId, (contentByRoundId.get(target.gameRoundId) ?? 0) + 1);
    }
  }
  for (const round of version.rounds) {
    if (!contentByRoundId.get(round.id)) {
      addIssue(issues, "WARNING", "ROUND_HAS_NO_CONTENT", `Round "${round.title}" has no cards, evidence, media, or artifacts.`, {
        type: "GameRound",
        id: round.id,
        label: round.title
      });
    }
  }

  for (const target of contentTargets) {
    const label = contentLabel(target);
    if (target.visibility === "PLAYER_PRIVATE" && !target.characterId) {
      addIssue(issues, "ERROR", "PRIVATE_CONTENT_WITHOUT_CHARACTER", `"${label}" is player-private but has no character.`, {
        type: target.type,
        id: target.id,
        label
      });
    }
    if (target.characterId && !characterIds.has(target.characterId)) {
      addIssue(issues, "ERROR", "CONTENT_CHARACTER_OUTSIDE_VERSION", `"${label}" points to a character outside this version.`, {
        type: target.type,
        id: target.id,
        label
      });
    }
    if (target.gameRoundId && !roundIds.has(target.gameRoundId)) {
      addIssue(issues, "ERROR", "CONTENT_ROUND_OUTSIDE_VERSION", `"${label}" points to a round outside this version.`, {
        type: target.type,
        id: target.id,
        label
      });
    }
    if (target.evidenceId && !evidenceIds.has(target.evidenceId)) {
      addIssue(issues, "ERROR", "CONTENT_EVIDENCE_OUTSIDE_VERSION", `"${label}" points to evidence outside this version.`, {
        type: target.type,
        id: target.id,
        label
      });
    }
    if (target.mediaAssetId && !mediaIds.has(target.mediaAssetId)) {
      addIssue(issues, "ERROR", "ARTIFACT_MEDIA_OUTSIDE_VERSION", `"${label}" points to media outside this version.`, {
        type: target.type,
        id: target.id,
        label
      });
    }

    const requiredUnlockRuleId = target.requiredUnlockRuleId?.trim();
    if (requiredUnlockRuleId) {
      const rule = unlockRulesById.get(requiredUnlockRuleId);
      if (!rule) {
        addIssue(issues, "ERROR", "ORPHAN_REQUIRED_UNLOCK_RULE", `"${label}" requires a missing unlock rule.`, {
          type: target.type,
          id: target.id,
          label
        });
      } else {
        if (rule.status !== "PUBLISHED") {
          addIssue(
            issues,
            "ERROR",
            "CONTENT_REQUIRES_UNPUBLISHED_RULE",
            `"${label}" requires unlock rule "${rule.title}", but that rule is not published.`,
            { type: target.type, id: target.id, label }
          );
        }
        if (rule.targetType !== target.type || rule.targetId !== target.id) {
          addIssue(
            issues,
            "ERROR",
            "MISMATCHED_REQUIRED_UNLOCK_RULE",
            `"${label}" requires unlock rule "${rule.title}", but the rule targets different content.`,
            { type: target.type, id: target.id, label }
          );
        }
      }
    }
  }

  for (const rule of version.unlockRules) {
    const label = rule.title || rule.key;
    const target = contentTargetsByKey.get(targetMapKey(rule.targetType, rule.targetId));

    if (rule.status !== "PUBLISHED") {
      addIssue(issues, "WARNING", "UNPUBLISHED_UNLOCK_RULE", `Unlock rule "${label}" is not published.`, {
        type: "GameUnlockRule",
        id: rule.id,
        label
      });
    }
    if (!target) {
      addIssue(issues, "ERROR", "UNLOCK_RULE_TARGET_MISSING", `Unlock rule "${label}" targets missing content.`, {
        type: "GameUnlockRule",
        id: rule.id,
        label
      });
    } else if (rule.status === "PUBLISHED" && target.requiredUnlockRuleId !== rule.id) {
      addIssue(
        issues,
        "ERROR",
        "UNLOCK_RULE_NOT_ATTACHED_TO_TARGET",
        `Published unlock rule "${label}" targets "${contentLabel(target)}", but that content does not require the rule.`,
        { type: "GameUnlockRule", id: rule.id, label }
      );
    }

    if (rule.requiredRoundId && !roundIds.has(rule.requiredRoundId)) {
      addIssue(issues, "ERROR", "UNLOCK_RULE_ROUND_OUTSIDE_VERSION", `Unlock rule "${label}" requires a round outside this version.`, {
        type: "GameUnlockRule",
        id: rule.id,
        label
      });
    }
    if (rule.requiredCharacterId && !characterIds.has(rule.requiredCharacterId)) {
      addIssue(
        issues,
        "ERROR",
        "UNLOCK_RULE_CHARACTER_OUTSIDE_VERSION",
        `Unlock rule "${label}" requires a character outside this version.`,
        { type: "GameUnlockRule", id: rule.id, label }
      );
    }
    if (rule.sourceToolId && !toolIds.has(rule.sourceToolId)) {
      addIssue(issues, "ERROR", "UNLOCK_RULE_TOOL_OUTSIDE_VERSION", `Unlock rule "${label}" uses a tool outside this version.`, {
        type: "GameUnlockRule",
        id: rule.id,
        label
      });
    }

    const isCodeRule = rule.ruleType === "ACCESS_CODE" || rule.triggerType === "CODE_ENTRY";
    if (isCodeRule) {
      if (rule.ruleType !== "ACCESS_CODE" || rule.triggerType !== "CODE_ENTRY") {
        addIssue(
          issues,
          "ERROR",
          "INCONSISTENT_CODE_UNLOCK_RULE",
          `Unlock rule "${label}" mixes code-entry behavior with a non-code rule type.`,
          { type: "GameUnlockRule", id: rule.id, label }
        );
      }
      if (rule.codeMode !== "PARTY_TOOL_CODE") {
        addIssue(
          issues,
          "ERROR",
          "UNSUPPORTED_CODE_MODE",
          `Unlock rule "${label}" must use PARTY_TOOL_CODE until static-code publishing is implemented.`,
          { type: "GameUnlockRule", id: rule.id, label }
        );
      }
      if (!rule.sourceTool || rule.sourceTool.toolType !== "ACCESS_CODE_GENERATOR") {
        addIssue(
          issues,
          "ERROR",
          "MISSING_ACCESS_CODE_GENERATOR",
          `Access-code rule "${label}" needs an access-code generator tool.`,
          { type: "GameUnlockRule", id: rule.id, label }
        );
      }
    } else if (rule.codeMode || rule.sourceToolId) {
      addIssue(issues, "WARNING", "NON_CODE_RULE_HAS_CODE_SETTINGS", `Unlock rule "${label}" has code settings but is not a code rule.`, {
        type: "GameUnlockRule",
        id: rule.id,
        label
      });
    }

    if (target?.gameRoundId && rule.requiredRoundId) {
      const targetRoundSort = roundSortById.get(target.gameRoundId);
      const requiredRoundSort = roundSortById.get(rule.requiredRoundId);
      if (targetRoundSort !== undefined && requiredRoundSort !== undefined && requiredRoundSort > targetRoundSort) {
        addIssue(
          issues,
          "WARNING",
          "UNLOCK_AFTER_TARGET_ROUND",
          `Unlock rule "${label}" cannot fire until after its target content's round.`,
          { type: "GameUnlockRule", id: rule.id, label }
        );
      }
    }
  }

  for (const character of requiredCharacters) {
    const hasPrivateContent = contentTargets.some(
      (target) => target.visibility === "PLAYER_PRIVATE" && target.characterId === character.id
    );
    if (!hasPrivateContent) {
      addIssue(
        issues,
        "WARNING",
        "REQUIRED_CHARACTER_HAS_NO_PRIVATE_CONTENT",
        `Required character "${character.name}" has no player-private cards, evidence, media, or artifacts.`,
        { type: "GameCharacter", id: character.id, label: character.name }
      );
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === "ERROR").length;
  const warningCount = issues.filter((issue) => issue.severity === "WARNING").length;

  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    issues
  };
}
