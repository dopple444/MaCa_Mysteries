import { canActorSeeConditionalContent } from "./conditional-unlocks";

export type PlayerEvidence = {
  id: string;
  title: string;
  body: string;
  evidenceType: string;
  visibility: string;
  sortOrder: number;
  characterId: string | null;
  requiredUnlockRuleId?: string | null;
  gameRound?: {
    title: string;
    sortOrder: number;
  } | null;
};

export type PlayerEvidenceReveal = {
  revealedAt: Date | string;
  evidence: PlayerEvidence;
};

export type PlayerEvidenceAssignment = {
  characterId: string;
} | null | undefined;

export type VisiblePlayerEvidence = PlayerEvidence & {
  roundTitle: string | null;
  revealedAt: Date | string;
};

type PlayerUnlockContext = {
  unlockedRuleIds?: Set<string> | string[];
};

export function getVisiblePlayerEvidence(
  evidenceReveals: PlayerEvidenceReveal[],
  assignment: PlayerEvidenceAssignment,
  unlockContext: PlayerUnlockContext = {}
): VisiblePlayerEvidence[] {
  return evidenceReveals
    .filter((reveal) =>
      canActorSeeConditionalContent(
        {
          visibility: reveal.evidence.visibility,
          characterId: reveal.evidence.characterId,
          requiredUnlockRuleId: reveal.evidence.requiredUnlockRuleId
        },
        {
          actorType: "PLAYER",
          characterId: assignment?.characterId,
          unlockedRuleIds: unlockContext.unlockedRuleIds
        }
      )
    )
    .sort((a, b) => {
      const roundOrderA = a.evidence.gameRound?.sortOrder ?? 999;
      const roundOrderB = b.evidence.gameRound?.sortOrder ?? 999;
      return (
        roundOrderA - roundOrderB ||
        a.evidence.sortOrder - b.evidence.sortOrder ||
        a.evidence.title.localeCompare(b.evidence.title)
      );
    })
    .map((reveal) => ({
      ...reveal.evidence,
      roundTitle: reveal.evidence.gameRound?.title ?? null,
      revealedAt: reveal.revealedAt
    }));
}
