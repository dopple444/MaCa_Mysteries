export type PlayerCard = {
  id: string;
  title: string;
  body: string;
  visibility: string;
  sortOrder: number;
  characterId: string | null;
};

export type PlayerRoundState = {
  status: string;
  gameRound: {
    title: string;
    sortOrder: number;
    cards: PlayerCard[];
  };
};

export type PlayerAssignment = {
  characterId: string;
} | null | undefined;

export type VisiblePlayerCard = PlayerCard & {
  roundTitle: string;
};

export function getActiveRoundStates<T extends PlayerRoundState>(roundStates: T[]) {
  return roundStates
    .filter((roundState) => roundState.status === "ACTIVE")
    .sort((a, b) => a.gameRound.sortOrder - b.gameRound.sortOrder);
}

export function getVisiblePlayerCards(
  roundStates: PlayerRoundState[],
  assignment: PlayerAssignment
): VisiblePlayerCard[] {
  return getActiveRoundStates(roundStates).flatMap((roundState) =>
    roundState.gameRound.cards
      .filter((card) => {
        if (card.visibility === "PUBLIC") return true;
        if (card.visibility !== "PLAYER_PRIVATE") return false;
        return Boolean(assignment?.characterId && card.characterId === assignment.characterId);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
      .map((card) => ({
        ...card,
        roundTitle: roundState.gameRound.title
      }))
  );
}
