import { Prisma } from "@prisma/client";

import { canActorSeeConditionalContent } from "./conditional-unlocks";

export type PlayerDigitalArtifact = {
  id: string;
  title: string;
  description: string;
  artifactType: string;
  visibility: string;
  sortOrder: number;
  characterId: string | null;
  gameRoundId: string | null;
  evidenceId: string | null;
  mediaAssetId: string | null;
  requiredUnlockRuleId?: string | null;
  content: Prisma.JsonValue;
  gameRound?: {
    title: string;
    sortOrder: number;
  } | null;
};

export type PlayerArtifactAssignment = {
  characterId: string;
} | null | undefined;

export type PlayerArtifactRoundState = {
  status: string;
  gameRoundId: string;
};

type PlayerUnlockContext = {
  unlockedRuleIds?: Set<string> | string[];
};

export function getVisiblePlayerArtifacts(
  artifacts: PlayerDigitalArtifact[],
  assignment: PlayerArtifactAssignment,
  roundStates: PlayerArtifactRoundState[],
  visibleEvidenceIds: Set<string>,
  visibleMediaIds: Set<string>,
  unlockContext: PlayerUnlockContext = {}
) {
  const availableRoundIds = new Set(
    roundStates
      .filter((roundState) => ["ACTIVE", "COMPLETED"].includes(roundState.status))
      .map((roundState) => roundState.gameRoundId)
  );

  return artifacts
    .filter((artifact) =>
      canActorSeeConditionalContent(artifact, {
        actorType: "PLAYER",
        characterId: assignment?.characterId,
        activeRoundIds: availableRoundIds,
        completedRoundIds: availableRoundIds,
        unlockedRuleIds: unlockContext.unlockedRuleIds
      })
    )
    .filter((artifact) => !artifact.evidenceId || visibleEvidenceIds.has(artifact.evidenceId))
    .filter((artifact) => !artifact.mediaAssetId || visibleMediaIds.has(artifact.mediaAssetId))
    .sort((a, b) => {
      const roundOrderA = a.gameRound?.sortOrder ?? 999;
      const roundOrderB = b.gameRound?.sortOrder ?? 999;
      return roundOrderA - roundOrderB || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
    });
}
