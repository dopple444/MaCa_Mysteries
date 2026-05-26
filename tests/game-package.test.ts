import assert from "node:assert/strict";
import test from "node:test";

import { GAME_PACKAGE_SCHEMA_VERSION, validateGamePackage } from "../app/lib/game-package";

function createValidGamePackage(): any {
  return {
    schemaVersion: GAME_PACKAGE_SCHEMA_VERSION,
    source: {
      kind: "AI_ASSISTED",
      toolName: "Writer Room Prototype",
      toolVersion: "0.1"
    },
    game: {
      slug: "murder-at-test-manor",
      title: "Murder at Test Manor",
      tagline: "A tidy little validation mystery.",
      description: "A full enough package to validate future AI-assisted imports.",
      minPlayers: 4,
      maxPlayers: 8,
      durationMin: 90,
      durationMax: 150,
      themes: ["country house", "locked room"],
      contentWarnings: ["fictional murder"]
    },
    characters: [
      {
        key: "detective-vale",
        name: "Detective Vale",
        publicBio: "A visiting investigator with a sharp eye.",
        privateBio: "Vale knows the household staff from an older case.",
        isRequired: true,
        relationships: ["Former contact of the archivist"],
        objectives: ["Keep the investigation orderly"],
        secrets: ["Recognizes an old cipher"],
        sortOrder: 1
      },
      {
        key: "archivist",
        name: "The Archivist",
        publicBio: "Keeper of the manor records.",
        privateBio: "The archivist hid a restricted folder.",
        isRequired: false,
        sortOrder: 2
      }
    ],
    rounds: [
      {
        key: "round-1",
        title: "Arrivals",
        summary: "Players mingle before the murder.",
        sortOrder: 1,
        cards: [
          {
            key: "vale-arrival",
            title: "A Familiar Crest",
            body: "Mention that the manor crest appears on a sealed envelope.",
            visibility: "PLAYER_PRIVATE",
            characterKey: "detective-vale",
            sortOrder: 1
          }
        ]
      }
    ],
    evidence: [
      {
        key: "sealed-envelope",
        title: "Sealed Envelope",
        body: "An envelope marked with the manor crest.",
        evidenceType: "DOCUMENT",
        visibility: "PUBLIC",
        roundKey: "round-1",
        sortOrder: 1
      }
    ],
    mediaAssets: [
      {
        key: "crest-image",
        title: "Manor Crest",
        description: "Placeholder crest image.",
        assetType: "IMAGE",
        url: "/uploads/media/crest-placeholder.png",
        mimeType: "image/png",
        visibility: "PUBLIC",
        evidenceKey: "sealed-envelope",
        sortOrder: 1
      }
    ],
    digitalArtifacts: [
      {
        key: "restricted-folder",
        title: "Restricted Folder",
        description: "A folder that unlocks with a generated code.",
        artifactType: "DOCUMENT",
        visibility: "PLAYER_PRIVATE",
        characterKey: "archivist",
        evidenceKey: "sealed-envelope",
        mediaAssetKey: "crest-image",
        requiredUnlockRuleKey: "open-restricted-folder",
        content: {
          body: "Inside the folder is a cipher key."
        },
        sortOrder: 1
      }
    ],
    characterTools: [
      {
        key: "vale-code-generator",
        title: "Code Generator",
        description: "Generates a party-specific code for the restricted folder.",
        toolType: "ACCESS_CODE_GENERATOR",
        visibility: "PLAYER_PRIVATE",
        characterKey: "detective-vale",
        config: {
          codeLength: 6
        },
        sortOrder: 1
      }
    ],
    unlockRules: [
      {
        key: "open-restricted-folder",
        title: "Open the Restricted Folder",
        description: "The archivist needs Vale's generated code.",
        ruleType: "ACCESS_CODE",
        triggerType: "CODE_ENTRY",
        targetType: "GameDigitalArtifact",
        targetKey: "restricted-folder",
        unlockScope: "PLAYER",
        codeMode: "PARTY_TOOL_CODE",
        sourceToolKey: "vale-code-generator",
        status: "PUBLISHED",
        config: {},
        effect: {},
        sortOrder: 1
      }
    ],
    finalReveal: {
      title: "The Truth at Test Manor",
      victimCharacterKey: "archivist",
      killerCharacterKey: "detective-vale",
      victimRevealText: "The archivist is found in the records room.",
      killerRevealText: "Vale staged the clue trail.",
      solutionText: "The answer turns on the cipher in the restricted folder.",
      epilogueText: "The manor finally gives up its old secret."
    }
  };
}

test("validateGamePackage accepts a review-gated AI-assisted package", () => {
  const result = validateGamePackage(createValidGamePackage());

  assert.equal(result.ok, true);
  assert.equal(result.summary.sourceKind, "AI_ASSISTED");
  assert.equal(result.summary.characters, 2);
  assert.equal(result.summary.requiredCharacters, 1);
  assert.equal(result.summary.optionalCharacters, 1);
  assert.equal(result.summary.rounds, 1);
  assert.equal(result.summary.cards, 1);
  assert.equal(result.summary.evidence, 1);
  assert.equal(result.summary.mediaAssets, 1);
  assert.equal(result.summary.digitalArtifacts, 1);
  assert.equal(result.summary.characterTools, 1);
  assert.equal(result.summary.unlockRules, 1);
  assert.equal(result.summary.hasFinalReveal, true);
  assert.ok(result.warnings.some((warning) => warning.code === "AI_REVIEW_REQUIRED"));
});

test("validateGamePackage rejects duplicate keys and broken references", () => {
  const gamePackage = createValidGamePackage();
  gamePackage.characters.push({
    key: "detective-vale",
    name: "Duplicate Detective",
    publicBio: "Duplicate key.",
    isRequired: true
  });
  gamePackage.rounds[0]?.cards?.push({
    key: "private-without-character",
    title: "Private But Unassigned",
    body: "This card cannot be safely assigned.",
    visibility: "PLAYER_PRIVATE"
  });
  gamePackage.mediaAssets[0]!.evidenceKey = "missing-evidence";
  gamePackage.unlockRules[0]!.sourceToolKey = "missing-tool";

  const result = validateGamePackage(gamePackage);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "DUPLICATE_KEY" && error.path === "characters[2].key"));
  assert.ok(result.errors.some((error) => error.code === "MISSING_CHARACTER_REFERENCE"));
  assert.ok(result.errors.some((error) => error.path === "mediaAssets[0].evidenceKey"));
  assert.ok(result.errors.some((error) => error.path === "unlockRules[0].sourceToolKey"));
});

test("validateGamePackage rejects unsupported schema versions and unsafe game ranges", () => {
  const gamePackage = createValidGamePackage();
  gamePackage.schemaVersion = "maca-game-package/v0";
  gamePackage.game.minPlayers = 9;
  gamePackage.game.maxPlayers = 4;

  const result = validateGamePackage(gamePackage);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "UNSUPPORTED_SCHEMA_VERSION"));
  assert.ok(result.errors.some((error) => error.code === "INVALID_RANGE" && error.path === "game.maxPlayers"));
});
