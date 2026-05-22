import { canActorSeeConditionalContent } from "./conditional-unlocks";
import { prisma } from "./prisma";

export const BUILDER_PREVIEW_MODES = ["HOST_SAFE", "HOST_SPOILER", "PLAYER"] as const;

export type BuilderPreviewMode = (typeof BUILDER_PREVIEW_MODES)[number];

type PreviewInput = {
  gameId: string;
  versionId: string;
  mode: BuilderPreviewMode;
  characterId?: string | null;
  roundId?: string | null;
  unlockedRuleIds?: Set<string> | string[];
};

type PreviewContent = {
  visibility: string;
  characterId?: string | null;
  gameRoundId?: string | null;
  requiredUnlockRuleId?: string | null;
};

function toSet(value?: Set<string> | string[]) {
  return value instanceof Set ? value : new Set(value ?? []);
}

function normalizePreviewMode(mode: string): BuilderPreviewMode {
  const normalizedMode = mode.trim().toUpperCase();
  return BUILDER_PREVIEW_MODES.includes(normalizedMode as BuilderPreviewMode)
    ? (normalizedMode as BuilderPreviewMode)
    : "HOST_SAFE";
}

function getAvailableRoundIds(
  rounds: { id: string; sortOrder: number }[],
  selectedRoundId?: string | null
) {
  if (!selectedRoundId) return new Set(rounds.map((round) => round.id));

  const selectedRound = rounds.find((round) => round.id === selectedRoundId);
  if (!selectedRound) return new Set<string>();

  return new Set(
    rounds
      .filter((round) => round.sortOrder <= selectedRound.sortOrder)
      .map((round) => round.id)
  );
}

function getPreviewActorContext(input: {
  mode: BuilderPreviewMode;
  characterId?: string | null;
  availableRoundIds: Set<string>;
  unlockedRuleIds?: Set<string> | string[];
}) {
  if (input.mode === "PLAYER") {
    return {
      actorType: "PLAYER" as const,
      characterId: input.characterId,
      activeRoundIds: input.availableRoundIds,
      completedRoundIds: input.availableRoundIds,
      unlockedRuleIds: input.unlockedRuleIds
    };
  }

  return {
    actorType: "HOST" as const,
    hostSpoilerModeUnlocked: input.mode === "HOST_SPOILER",
    activeRoundIds: input.availableRoundIds,
    completedRoundIds: input.availableRoundIds,
    unlockedRuleIds: input.unlockedRuleIds
  };
}

function canPreviewContent(content: PreviewContent, context: ReturnType<typeof getPreviewActorContext>) {
  return canActorSeeConditionalContent(content, context);
}

export async function getBuilderPreview(input: PreviewInput) {
  const mode = normalizePreviewMode(input.mode);
  const unlockedRuleIds = toSet(input.unlockedRuleIds);
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
            ],
            include: {
              character: true
            }
          }
        }
      },
      evidence: {
        orderBy: [
          { sortOrder: "asc" },
          { title: "asc" }
        ],
        include: {
          gameRound: true,
          character: true
        }
      },
      mediaAssets: {
        orderBy: [
          { sortOrder: "asc" },
          { title: "asc" }
        ],
        include: {
          gameRound: true,
          character: true,
          evidence: true
        }
      },
      digitalArtifacts: {
        orderBy: [
          { sortOrder: "asc" },
          { title: "asc" }
        ],
        include: {
          gameRound: true,
          character: true,
          evidence: true,
          mediaAsset: true
        }
      },
      characterTools: {
        orderBy: [
          { sortOrder: "asc" },
          { title: "asc" }
        ],
        include: {
          character: true
        }
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
      }
    }
  });

  if (!version) return null;

  const characterId =
    mode === "PLAYER"
      ? input.characterId && version.characters.some((character) => character.id === input.characterId)
        ? input.characterId
        : version.characters[0]?.id ?? null
      : null;
  const availableRoundIds = getAvailableRoundIds(version.rounds, input.roundId);
  const actorContext = getPreviewActorContext({
    mode,
    characterId,
    availableRoundIds,
    unlockedRuleIds
  });

  const cards = version.rounds.flatMap((round) =>
    round.cards
      .filter((card) => canPreviewContent(card, actorContext))
      .map((card) => ({
        ...card,
        roundTitle: round.title
      }))
  );

  const evidence = version.evidence.filter((evidenceItem) => canPreviewContent(evidenceItem, actorContext));
  const visibleEvidenceIds = new Set(evidence.map((evidenceItem) => evidenceItem.id));

  const mediaAssets = version.mediaAssets
    .filter((media) => canPreviewContent(media, actorContext))
    .filter((media) => !media.evidenceId || visibleEvidenceIds.has(media.evidenceId));
  const visibleMediaIds = new Set(mediaAssets.map((media) => media.id));

  const digitalArtifacts = version.digitalArtifacts
    .filter((artifact) => canPreviewContent(artifact, actorContext))
    .filter((artifact) => !artifact.evidenceId || visibleEvidenceIds.has(artifact.evidenceId))
    .filter((artifact) => !artifact.mediaAssetId || visibleMediaIds.has(artifact.mediaAssetId));

  const characterTools = version.characterTools.filter((tool) =>
    canPreviewContent(
      {
        visibility: tool.visibility,
        characterId: tool.characterId
      },
      actorContext
    )
  );

  return {
    mode,
    characterId,
    selectedRoundId: input.roundId ?? null,
    availableRoundIds,
    unlockedRuleIds,
    version,
    cards,
    evidence,
    mediaAssets,
    digitalArtifacts,
    characterTools,
    unlockRules: version.unlockRules
  };
}
