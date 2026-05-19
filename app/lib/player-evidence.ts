export type PlayerEvidence = {
  id: string;
  title: string;
  body: string;
  evidenceType: string;
  visibility: string;
  sortOrder: number;
  characterId: string | null;
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

function canPlayerSeeEvidence(evidence: PlayerEvidence, assignment: PlayerEvidenceAssignment) {
  if (evidence.visibility === "PUBLIC") return true;
  if (evidence.visibility !== "PLAYER_PRIVATE") return false;
  return Boolean(assignment?.characterId && evidence.characterId === assignment.characterId);
}

export function getVisiblePlayerEvidence(
  evidenceReveals: PlayerEvidenceReveal[],
  assignment: PlayerEvidenceAssignment
): VisiblePlayerEvidence[] {
  return evidenceReveals
    .filter((reveal) => canPlayerSeeEvidence(reveal.evidence, assignment))
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
