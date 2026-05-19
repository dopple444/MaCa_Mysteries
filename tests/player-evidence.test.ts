import assert from "node:assert/strict";
import test from "node:test";

import { getVisiblePlayerEvidence, type PlayerEvidenceReveal } from "../app/lib/player-evidence";

const evidenceReveals: PlayerEvidenceReveal[] = [
  {
    revealedAt: new Date("2026-01-01T00:00:00Z"),
    evidence: {
      id: "host-safe",
      title: "Host Safe",
      body: "Players should not see this.",
      evidenceType: "NOTE",
      visibility: "HOST_SAFE",
      sortOrder: 1,
      characterId: null,
      gameRound: { title: "Round Two", sortOrder: 2 }
    }
  },
  {
    revealedAt: new Date("2026-01-01T00:01:00Z"),
    evidence: {
      id: "matching-private",
      title: "Matching Private",
      body: "Only one character sees this.",
      evidenceType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 2,
      characterId: "character-a",
      gameRound: { title: "Round Two", sortOrder: 2 }
    }
  },
  {
    revealedAt: new Date("2026-01-01T00:02:00Z"),
    evidence: {
      id: "other-private",
      title: "Other Private",
      body: "Another character sees this.",
      evidenceType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1,
      characterId: "character-b",
      gameRound: { title: "Round One", sortOrder: 1 }
    }
  },
  {
    revealedAt: new Date("2026-01-01T00:03:00Z"),
    evidence: {
      id: "public",
      title: "Public Evidence",
      body: "Everyone sees this.",
      evidenceType: "IMAGE",
      visibility: "PUBLIC",
      sortOrder: 2,
      characterId: null,
      gameRound: { title: "Round One", sortOrder: 1 }
    }
  },
  {
    revealedAt: new Date("2026-01-01T00:04:00Z"),
    evidence: {
      id: "spoiler",
      title: "Spoiler",
      body: "Players should not see this.",
      evidenceType: "DOCUMENT",
      visibility: "SPOILER_PROTECTED",
      sortOrder: 3,
      characterId: null,
      gameRound: { title: "Round Three", sortOrder: 3 }
    }
  }
];

test("getVisiblePlayerEvidence returns public and matching private evidence only", () => {
  assert.deepEqual(
    getVisiblePlayerEvidence(evidenceReveals, { characterId: "character-a" }).map((evidence) => ({
      id: evidence.id,
      roundTitle: evidence.roundTitle
    })),
    [
      { id: "public", roundTitle: "Round One" },
      { id: "matching-private", roundTitle: "Round Two" }
    ]
  );
});

test("getVisiblePlayerEvidence hides private evidence without an assignment", () => {
  assert.deepEqual(
    getVisiblePlayerEvidence(evidenceReveals, null).map((evidence) => evidence.id),
    ["public"]
  );
});

test("getVisiblePlayerEvidence never returns host-safe or spoiler-protected evidence", () => {
  const visibleIds = getVisiblePlayerEvidence(evidenceReveals, { characterId: "character-a" }).map(
    (evidence) => evidence.id
  );

  assert.equal(visibleIds.includes("host-safe"), false);
  assert.equal(visibleIds.includes("spoiler"), false);
});
