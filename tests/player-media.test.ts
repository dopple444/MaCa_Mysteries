import assert from "node:assert/strict";
import test from "node:test";

import { getVisiblePlayerMedia, type PlayerMediaAsset } from "../app/lib/player-media";

const mediaAssets: PlayerMediaAsset[] = [
  {
    id: "public-revealed",
    title: "Public Revealed",
    description: "",
    assetType: "IMAGE",
    url: "/media/public.svg",
    mimeType: "image/svg+xml",
    visibility: "PUBLIC",
    sortOrder: 2,
    characterId: null,
    gameRoundId: "round-active",
    evidenceId: "evidence-public"
  },
  {
    id: "private-matching",
    title: "Private Matching",
    description: "",
    assetType: "DOCUMENT",
    url: "/media/private.txt",
    mimeType: "text/plain",
    visibility: "PLAYER_PRIVATE",
    sortOrder: 1,
    characterId: "character-a",
    gameRoundId: "round-active",
    evidenceId: "evidence-private"
  },
  {
    id: "private-other",
    title: "Private Other",
    description: "",
    assetType: "DOCUMENT",
    url: "/media/other.txt",
    mimeType: "text/plain",
    visibility: "PLAYER_PRIVATE",
    sortOrder: 3,
    characterId: "character-b",
    gameRoundId: "round-active",
    evidenceId: "evidence-private"
  },
  {
    id: "unrevealed",
    title: "Unrevealed",
    description: "",
    assetType: "IMAGE",
    url: "/media/unrevealed.svg",
    mimeType: "image/svg+xml",
    visibility: "PUBLIC",
    sortOrder: 4,
    characterId: null,
    gameRoundId: "round-active",
    evidenceId: "evidence-hidden"
  },
  {
    id: "locked-round",
    title: "Locked Round",
    description: "",
    assetType: "IMAGE",
    url: "/media/locked.svg",
    mimeType: "image/svg+xml",
    visibility: "PUBLIC",
    sortOrder: 5,
    characterId: null,
    gameRoundId: "round-locked",
    evidenceId: null
  },
  {
    id: "spoiler",
    title: "Spoiler",
    description: "",
    assetType: "DOCUMENT",
    url: "/media/spoiler.txt",
    mimeType: "text/plain",
    visibility: "SPOILER_PROTECTED",
    sortOrder: 6,
    characterId: null,
    gameRoundId: "round-active",
    evidenceId: null
  }
];

test("getVisiblePlayerMedia returns active, revealed, player-safe media", () => {
  const visible = getVisiblePlayerMedia(
    mediaAssets,
    { characterId: "character-a" },
    [
      { gameRoundId: "round-active", status: "ACTIVE" },
      { gameRoundId: "round-locked", status: "LOCKED" }
    ],
    new Set(["evidence-public", "evidence-private"])
  );

  assert.deepEqual(
    visible.map((media) => media.id),
    ["private-matching", "public-revealed"]
  );
});

test("getVisiblePlayerMedia hides private media without assignment", () => {
  const visible = getVisiblePlayerMedia(
    mediaAssets,
    null,
    [{ gameRoundId: "round-active", status: "ACTIVE" }],
    new Set(["evidence-public", "evidence-private"])
  );

  assert.deepEqual(
    visible.map((media) => media.id),
    ["public-revealed"]
  );
});
