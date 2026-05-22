import { canActorSeeConditionalContent } from "./conditional-unlocks";

export type PlayerMediaAsset = {
  id: string;
  title: string;
  description: string;
  assetType: string;
  url: string;
  mimeType: string;
  visibility: string;
  sortOrder: number;
  characterId: string | null;
  gameRoundId: string | null;
  evidenceId: string | null;
  requiredUnlockRuleId?: string | null;
};

export type PlayerMediaAssignment = {
  characterId: string;
} | null | undefined;

export type PlayerMediaRoundState = {
  status: string;
  gameRoundId: string;
};

type PlayerUnlockContext = {
  unlockedRuleIds?: Set<string> | string[];
};

export function getVisiblePlayerMedia(
  mediaAssets: PlayerMediaAsset[],
  assignment: PlayerMediaAssignment,
  roundStates: PlayerMediaRoundState[],
  visibleEvidenceIds: Set<string>,
  unlockContext: PlayerUnlockContext = {}
) {
  const availableRoundIds = new Set(
    roundStates
      .filter((roundState) => ["ACTIVE", "COMPLETED"].includes(roundState.status))
      .map((roundState) => roundState.gameRoundId)
  );

  return mediaAssets
    .filter((media) =>
      canActorSeeConditionalContent(media, {
        actorType: "PLAYER",
        characterId: assignment?.characterId,
        activeRoundIds: availableRoundIds,
        completedRoundIds: availableRoundIds,
        unlockedRuleIds: unlockContext.unlockedRuleIds
      })
    )
    .filter((media) => !media.evidenceId || visibleEvidenceIds.has(media.evidenceId))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}
