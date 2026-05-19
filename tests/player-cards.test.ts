import assert from "node:assert/strict";
import test from "node:test";

import { getActiveRoundStates, getVisiblePlayerCards, type PlayerRoundState } from "../app/lib/player-cards";

const roundStates: PlayerRoundState[] = [
  {
    status: "LOCKED",
    gameRound: {
      title: "Locked Round",
      sortOrder: 1,
      cards: [
        {
          id: "locked-public",
          title: "Locked Public",
          body: "This is not visible yet.",
          visibility: "PUBLIC",
          sortOrder: 1,
          characterId: null
        }
      ]
    }
  },
  {
    status: "ACTIVE",
    gameRound: {
      title: "Round Two",
      sortOrder: 3,
      cards: [
        {
          id: "host-safe",
          title: "Host Safe",
          body: "For host only.",
          visibility: "HOST_SAFE",
          sortOrder: 1,
          characterId: null
        },
        {
          id: "matching-private",
          title: "Matching Private",
          body: "Only this character should see it.",
          visibility: "PLAYER_PRIVATE",
          sortOrder: 3,
          characterId: "character-a"
        },
        {
          id: "spoiler",
          title: "Spoiler",
          body: "Do not show to player.",
          visibility: "SPOILER_PROTECTED",
          sortOrder: 4,
          characterId: null
        }
      ]
    }
  },
  {
    status: "ACTIVE",
    gameRound: {
      title: "Round One",
      sortOrder: 2,
      cards: [
        {
          id: "public",
          title: "Public",
          body: "Everyone sees this.",
          visibility: "PUBLIC",
          sortOrder: 2,
          characterId: null
        },
        {
          id: "other-private",
          title: "Other Private",
          body: "Another character sees it.",
          visibility: "PLAYER_PRIVATE",
          sortOrder: 1,
          characterId: "character-b"
        }
      ]
    }
  }
];

test("getActiveRoundStates returns active rounds sorted by game round order", () => {
  assert.deepEqual(
    getActiveRoundStates(roundStates).map((roundState) => roundState.gameRound.title),
    ["Round One", "Round Two"]
  );
});

test("getVisiblePlayerCards only returns active public and matching private cards", () => {
  assert.deepEqual(
    getVisiblePlayerCards(roundStates, { characterId: "character-a" }).map((card) => ({
      id: card.id,
      roundTitle: card.roundTitle
    })),
    [
      { id: "public", roundTitle: "Round One" },
      { id: "matching-private", roundTitle: "Round Two" }
    ]
  );
});

test("getVisiblePlayerCards hides private cards when no character is assigned", () => {
  assert.deepEqual(
    getVisiblePlayerCards(roundStates, null).map((card) => card.id),
    ["public"]
  );
});
