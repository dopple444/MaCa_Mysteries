import { canActorSeeConditionalContent } from "./conditional-unlocks";

export type PlayerCard = {
  id: string;
  gameRoundId?: string | null;
  title: string;
  body: string;
  visibility: string;
  sortOrder: number;
  characterId: string | null;
  requiredUnlockRuleId?: string | null;
};

export type PlayerRoundState = {
  status: string;
  gameRoundId?: string;
  gameRound: {
    id?: string;
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

type PlayerUnlockContext = {
  unlockedRuleIds?: Set<string> | string[];
};

export function getActiveRoundStates<T extends PlayerRoundState>(roundStates: T[]) {
  return roundStates
    .filter((roundState) => roundState.status === "ACTIVE")
    .sort((a, b) => a.gameRound.sortOrder - b.gameRound.sortOrder);
}

export function getVisiblePlayerCards(
  roundStates: PlayerRoundState[],
  assignment: PlayerAssignment,
  unlockContext: PlayerUnlockContext = {}
): VisiblePlayerCard[] {
  return getActiveRoundStates(roundStates).flatMap((roundState) => {
    const activeRoundId = roundState.gameRoundId ?? roundState.gameRound.id;

    return roundState.gameRound.cards
      .filter((card) =>
        canActorSeeConditionalContent(card, {
          actorType: "PLAYER",
          characterId: assignment?.characterId,
          activeRoundIds: activeRoundId ? [activeRoundId] : undefined,
          unlockedRuleIds: unlockContext.unlockedRuleIds
        })
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
      .map((card) => ({
        ...card,
        roundTitle: roundState.gameRound.title
      }))
  });
}
