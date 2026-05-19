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
};

export type PlayerMediaAssignment = {
  characterId: string;
} | null | undefined;

export type PlayerMediaRoundState = {
  status: string;
  gameRoundId: string;
};

function canPlayerSeeMedia(media: PlayerMediaAsset, assignment: PlayerMediaAssignment) {
  if (media.visibility === "PUBLIC") return true;
  if (media.visibility !== "PLAYER_PRIVATE") return false;
  return Boolean(assignment?.characterId && media.characterId === assignment.characterId);
}

export function getVisiblePlayerMedia(
  mediaAssets: PlayerMediaAsset[],
  assignment: PlayerMediaAssignment,
  roundStates: PlayerMediaRoundState[],
  visibleEvidenceIds: Set<string>
) {
  const availableRoundIds = new Set(
    roundStates
      .filter((roundState) => ["ACTIVE", "COMPLETED"].includes(roundState.status))
      .map((roundState) => roundState.gameRoundId)
  );

  return mediaAssets
    .filter((media) => canPlayerSeeMedia(media, assignment))
    .filter((media) => !media.gameRoundId || availableRoundIds.has(media.gameRoundId))
    .filter((media) => !media.evidenceId || visibleEvidenceIds.has(media.evidenceId))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}
