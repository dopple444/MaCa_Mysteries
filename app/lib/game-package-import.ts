import type { Prisma } from "@prisma/client";

import {
  type GamePackageContent,
  type GamePackageSummary,
  type GamePackageValidationIssue,
  validateGamePackage
} from "./game-package";
import { prisma } from "./prisma";

export type ImportGamePackageResult =
  | {
      ok: true;
      gameId: string;
      versionId: string;
      slug: string;
      summary: GamePackageSummary;
    }
  | {
      ok: false;
      reason: "invalid-package" | "slug-exists";
      summary?: GamePackageSummary;
      warnings: GamePackageValidationIssue[];
      errors: GamePackageValidationIssue[];
    };

type RequiredUnlockBackfill = {
  targetType: "GameCard" | "GameEvidence" | "GameMediaAsset" | "GameDigitalArtifact";
  targetId: string;
  requiredUnlockRuleKey: string;
};

function sortOrder(value: number | undefined, fallback: number) {
  return Number.isInteger(value) ? value : fallback;
}

function optionalText(value: string | undefined) {
  return value?.trim() ?? "";
}

function optionalUpper(value: string | undefined) {
  return optionalText(value).toUpperCase();
}

function jsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject {
  return (value ?? {}) as Prisma.InputJsonObject;
}

function jsonStringArray(value: string[] | undefined): Prisma.InputJsonArray {
  return (value ?? []).map((item) => item.trim()).filter(Boolean) as Prisma.InputJsonArray;
}

function requiredId(map: Map<string, string>, key: string, label: string) {
  const id = map.get(key);
  if (!id) {
    throw new Error(`Validated Game Package referenced missing ${label}: ${key}`);
  }
  return id;
}

function getTargetId({
  gamePackage,
  targetType,
  targetKey,
  targetRoundKey,
  cardIdsByCompositeKey,
  evidenceIdsByKey,
  mediaIdsByKey,
  artifactIdsByKey
}: {
  gamePackage: GamePackageContent;
  targetType: string;
  targetKey: string;
  targetRoundKey?: string;
  cardIdsByCompositeKey: Map<string, string>;
  evidenceIdsByKey: Map<string, string>;
  mediaIdsByKey: Map<string, string>;
  artifactIdsByKey: Map<string, string>;
}) {
  switch (targetType) {
    case "GameCard":
      return requiredId(cardIdsByCompositeKey, `${targetRoundKey}/${targetKey}`, "card");
    case "GameEvidence":
      return requiredId(evidenceIdsByKey, targetKey, "evidence");
    case "GameMediaAsset":
      return requiredId(mediaIdsByKey, targetKey, "media asset");
    case "GameDigitalArtifact":
      return requiredId(artifactIdsByKey, targetKey, "digital artifact");
    default:
      throw new Error(`Validated Game Package used unsupported target type: ${gamePackage.game.slug}:${targetType}`);
  }
}

async function backfillRequiredUnlocks(
  tx: Prisma.TransactionClient,
  backfills: RequiredUnlockBackfill[],
  unlockRuleIdsByKey: Map<string, string>
) {
  for (const backfill of backfills) {
    const requiredUnlockRuleId = requiredId(unlockRuleIdsByKey, backfill.requiredUnlockRuleKey, "unlock rule");
    if (backfill.targetType === "GameCard") {
      await tx.gameCard.update({ where: { id: backfill.targetId }, data: { requiredUnlockRuleId } });
    } else if (backfill.targetType === "GameEvidence") {
      await tx.gameEvidence.update({ where: { id: backfill.targetId }, data: { requiredUnlockRuleId } });
    } else if (backfill.targetType === "GameMediaAsset") {
      await tx.gameMediaAsset.update({ where: { id: backfill.targetId }, data: { requiredUnlockRuleId } });
    } else {
      await tx.gameDigitalArtifact.update({ where: { id: backfill.targetId }, data: { requiredUnlockRuleId } });
    }
  }
}

export async function importGamePackageAsDraft(value: unknown): Promise<ImportGamePackageResult> {
  const validation = validateGamePackage(value);
  if (!validation.ok) {
    return {
      ok: false,
      reason: "invalid-package",
      summary: validation.summary,
      warnings: validation.warnings,
      errors: validation.errors
    };
  }

  const gamePackage = validation.package;
  const gameSlug = gamePackage.game.slug.trim();
  const existingGame = await prisma.game.findUnique({ where: { slug: gameSlug }, select: { id: true } });
  if (existingGame) {
    return {
      ok: false,
      reason: "slug-exists",
      summary: validation.summary,
      warnings: validation.warnings,
      errors: [
        {
          code: "DUPLICATE_GAME_SLUG",
          path: "game.slug",
          message: `A game with slug "${gameSlug}" already exists.`
        }
      ]
    };
  }

  return prisma.$transaction(async (tx) => {
    const game = await tx.game.create({
      data: {
        slug: gameSlug,
        title: gamePackage.game.title.trim(),
        tagline: gamePackage.game.tagline.trim(),
        description: gamePackage.game.description.trim(),
        minPlayers: gamePackage.game.minPlayers,
        maxPlayers: gamePackage.game.maxPlayers,
        durationMin: gamePackage.game.durationMin,
        durationMax: gamePackage.game.durationMax,
        status: "DRAFT"
      },
      select: { id: true, slug: true }
    });

    const version = await tx.gameVersion.create({
      data: {
        gameId: game.id,
        versionNumber: 1,
        status: "DRAFT",
        themes: jsonStringArray(gamePackage.game.themes),
        contentWarnings: jsonStringArray(gamePackage.game.contentWarnings),
        sourceKind: gamePackage.source?.kind ?? "IMPORT",
        sourceToolName: optionalText(gamePackage.source?.toolName),
        sourceToolVersion: optionalText(gamePackage.source?.toolVersion),
        sourceNotes: optionalText(gamePackage.source?.notes)
      },
      select: { id: true }
    });

    const characterIdsByKey = new Map<string, string>();
    const roundIdsByKey = new Map<string, string>();
    const cardIdsByCompositeKey = new Map<string, string>();
    const evidenceIdsByKey = new Map<string, string>();
    const mediaIdsByKey = new Map<string, string>();
    const artifactIdsByKey = new Map<string, string>();
    const toolIdsByKey = new Map<string, string>();
    const unlockRuleIdsByKey = new Map<string, string>();
    const requiredUnlockBackfills: RequiredUnlockBackfill[] = [];

    for (const [index, character] of gamePackage.characters.entries()) {
      const createdCharacter = await tx.gameCharacter.create({
        data: {
          gameVersionId: version.id,
          key: character.key.trim(),
          name: character.name.trim(),
          publicBio: character.publicBio.trim(),
          privateBio: optionalText(character.privateBio),
          isRequired: character.isRequired ?? true,
          sortOrder: sortOrder(character.sortOrder, index + 1)
        },
        select: { id: true }
      });
      characterIdsByKey.set(character.key, createdCharacter.id);
    }

    for (const [index, round] of gamePackage.rounds.entries()) {
      const createdRound = await tx.gameRound.create({
        data: {
          gameVersionId: version.id,
          key: round.key.trim(),
          title: round.title.trim(),
          summary: optionalText(round.summary),
          sortOrder: sortOrder(round.sortOrder, index + 1)
        },
        select: { id: true }
      });
      roundIdsByKey.set(round.key, createdRound.id);
    }

    for (const round of gamePackage.rounds) {
      const roundId = requiredId(roundIdsByKey, round.key, "round");
      for (const [index, card] of (round.cards ?? []).entries()) {
        const createdCard = await tx.gameCard.create({
          data: {
            gameRoundId: roundId,
            characterId: card.characterKey ? requiredId(characterIdsByKey, card.characterKey, "character") : null,
            key: card.key.trim(),
            title: card.title.trim(),
            body: card.body.trim(),
            visibility: optionalUpper(card.visibility),
            sortOrder: sortOrder(card.sortOrder, index + 1)
          },
          select: { id: true }
        });
        cardIdsByCompositeKey.set(`${round.key}/${card.key}`, createdCard.id);
        if (card.requiredUnlockRuleKey) {
          requiredUnlockBackfills.push({
            targetType: "GameCard",
            targetId: createdCard.id,
            requiredUnlockRuleKey: card.requiredUnlockRuleKey
          });
        }
      }
    }

    for (const [index, evidence] of (gamePackage.evidence ?? []).entries()) {
      const createdEvidence = await tx.gameEvidence.create({
        data: {
          gameVersionId: version.id,
          gameRoundId: evidence.roundKey ? requiredId(roundIdsByKey, evidence.roundKey, "round") : null,
          characterId: evidence.characterKey ? requiredId(characterIdsByKey, evidence.characterKey, "character") : null,
          key: evidence.key.trim(),
          title: evidence.title.trim(),
          body: evidence.body.trim(),
          evidenceType: optionalUpper(evidence.evidenceType),
          visibility: optionalUpper(evidence.visibility),
          sortOrder: sortOrder(evidence.sortOrder, index + 1)
        },
        select: { id: true }
      });
      evidenceIdsByKey.set(evidence.key, createdEvidence.id);
      if (evidence.requiredUnlockRuleKey) {
        requiredUnlockBackfills.push({
          targetType: "GameEvidence",
          targetId: createdEvidence.id,
          requiredUnlockRuleKey: evidence.requiredUnlockRuleKey
        });
      }
    }

    for (const [index, media] of (gamePackage.mediaAssets ?? []).entries()) {
      const createdMedia = await tx.gameMediaAsset.create({
        data: {
          gameVersionId: version.id,
          gameRoundId: media.roundKey ? requiredId(roundIdsByKey, media.roundKey, "round") : null,
          characterId: media.characterKey ? requiredId(characterIdsByKey, media.characterKey, "character") : null,
          evidenceId: media.evidenceKey ? requiredId(evidenceIdsByKey, media.evidenceKey, "evidence") : null,
          key: media.key.trim(),
          title: media.title.trim(),
          description: optionalText(media.description),
          assetType: optionalUpper(media.assetType),
          url: media.url.trim(),
          mimeType: optionalText(media.mimeType),
          visibility: optionalUpper(media.visibility),
          sortOrder: sortOrder(media.sortOrder, index + 1)
        },
        select: { id: true }
      });
      mediaIdsByKey.set(media.key, createdMedia.id);
      if (media.requiredUnlockRuleKey) {
        requiredUnlockBackfills.push({
          targetType: "GameMediaAsset",
          targetId: createdMedia.id,
          requiredUnlockRuleKey: media.requiredUnlockRuleKey
        });
      }
    }

    for (const [index, artifact] of (gamePackage.digitalArtifacts ?? []).entries()) {
      const createdArtifact = await tx.gameDigitalArtifact.create({
        data: {
          gameVersionId: version.id,
          gameRoundId: artifact.roundKey ? requiredId(roundIdsByKey, artifact.roundKey, "round") : null,
          characterId: artifact.characterKey ? requiredId(characterIdsByKey, artifact.characterKey, "character") : null,
          evidenceId: artifact.evidenceKey ? requiredId(evidenceIdsByKey, artifact.evidenceKey, "evidence") : null,
          mediaAssetId: artifact.mediaAssetKey ? requiredId(mediaIdsByKey, artifact.mediaAssetKey, "media asset") : null,
          key: artifact.key.trim(),
          title: artifact.title.trim(),
          description: optionalText(artifact.description),
          artifactType: optionalUpper(artifact.artifactType),
          visibility: optionalUpper(artifact.visibility),
          content: jsonObject(artifact.content),
          sortOrder: sortOrder(artifact.sortOrder, index + 1)
        },
        select: { id: true }
      });
      artifactIdsByKey.set(artifact.key, createdArtifact.id);
      if (artifact.requiredUnlockRuleKey) {
        requiredUnlockBackfills.push({
          targetType: "GameDigitalArtifact",
          targetId: createdArtifact.id,
          requiredUnlockRuleKey: artifact.requiredUnlockRuleKey
        });
      }
    }

    for (const [index, tool] of (gamePackage.characterTools ?? []).entries()) {
      const createdTool = await tx.gameCharacterTool.create({
        data: {
          gameVersionId: version.id,
          characterId: requiredId(characterIdsByKey, tool.characterKey, "character"),
          key: tool.key.trim(),
          title: tool.title.trim(),
          description: optionalText(tool.description),
          toolType: optionalUpper(tool.toolType),
          visibility: optionalUpper(tool.visibility),
          config: jsonObject(tool.config),
          sortOrder: sortOrder(tool.sortOrder, index + 1)
        },
        select: { id: true }
      });
      toolIdsByKey.set(tool.key, createdTool.id);
    }

    for (const [index, unlockRule] of (gamePackage.unlockRules ?? []).entries()) {
      const targetId = getTargetId({
        gamePackage,
        targetType: unlockRule.targetType,
        targetKey: unlockRule.targetKey,
        targetRoundKey: unlockRule.targetRoundKey,
        cardIdsByCompositeKey,
        evidenceIdsByKey,
        mediaIdsByKey,
        artifactIdsByKey
      });
      const createdRule = await tx.gameUnlockRule.create({
        data: {
          gameVersionId: version.id,
          requiredRoundId: unlockRule.requiredRoundKey
            ? requiredId(roundIdsByKey, unlockRule.requiredRoundKey, "round")
            : null,
          requiredCharacterId: unlockRule.requiredCharacterKey
            ? requiredId(characterIdsByKey, unlockRule.requiredCharacterKey, "character")
            : null,
          sourceToolId: unlockRule.sourceToolKey ? requiredId(toolIdsByKey, unlockRule.sourceToolKey, "tool") : null,
          key: unlockRule.key.trim(),
          title: unlockRule.title.trim(),
          description: optionalText(unlockRule.description),
          ruleType: optionalUpper(unlockRule.ruleType),
          triggerType: optionalUpper(unlockRule.triggerType),
          targetType: unlockRule.targetType.trim(),
          targetId,
          unlockScope: optionalUpper(unlockRule.unlockScope),
          codeMode: optionalUpper(unlockRule.codeMode),
          config: jsonObject(unlockRule.config),
          effect: jsonObject(unlockRule.effect),
          status: optionalUpper(unlockRule.status) || "DRAFT",
          sortOrder: sortOrder(unlockRule.sortOrder, index + 1)
        },
        select: { id: true }
      });
      unlockRuleIdsByKey.set(unlockRule.key, createdRule.id);
    }

    await backfillRequiredUnlocks(tx, requiredUnlockBackfills, unlockRuleIdsByKey);

    if (gamePackage.finalReveal) {
      await tx.gameFinalReveal.create({
        data: {
          gameVersionId: version.id,
          victimCharacterId: gamePackage.finalReveal.victimCharacterKey
            ? requiredId(characterIdsByKey, gamePackage.finalReveal.victimCharacterKey, "character")
            : null,
          killerCharacterId: gamePackage.finalReveal.killerCharacterKey
            ? requiredId(characterIdsByKey, gamePackage.finalReveal.killerCharacterKey, "character")
            : null,
          title: gamePackage.finalReveal.title.trim(),
          victimRevealText: optionalText(gamePackage.finalReveal.victimRevealText),
          killerRevealText: optionalText(gamePackage.finalReveal.killerRevealText),
          solutionText: gamePackage.finalReveal.solutionText.trim(),
          epilogueText: optionalText(gamePackage.finalReveal.epilogueText)
        }
      });
    }

    return {
      ok: true,
      gameId: game.id,
      versionId: version.id,
      slug: game.slug,
      summary: validation.summary
    };
  });
}
