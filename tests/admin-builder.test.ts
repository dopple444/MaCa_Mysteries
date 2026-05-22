import assert from "node:assert/strict";
import test from "node:test";

import {
  upsertGameCharacterTool,
  upsertGameDigitalArtifact,
  upsertGameUnlockRule
} from "../app/lib/admin-builder";
import { prisma, uniqueTestLabel } from "./helpers/test-data";

async function deleteAdminBuilderFixture(slug: string) {
  const games = await prisma.game.findMany({
    where: { slug },
    select: { id: true }
  });
  const gameIds = games.map((game) => game.id);
  const versions = await prisma.gameVersion.findMany({
    where: { gameId: { in: gameIds.length ? gameIds : ["__none__"] } },
    select: { id: true }
  });
  const versionIds = versions.map((version) => version.id);
  const rounds = await prisma.gameRound.findMany({
    where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } },
    select: { id: true }
  });
  const roundIds = rounds.map((round) => round.id);

  await prisma.gameDigitalArtifact.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameUnlockRule.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameCharacterTool.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameMediaAsset.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameEvidence.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameCard.deleteMany({ where: { gameRoundId: { in: roundIds.length ? roundIds : ["__none__"] } } });
  await prisma.gameRound.deleteMany({ where: { id: { in: roundIds.length ? roundIds : ["__none__"] } } });
  await prisma.gameCharacter.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameVersion.deleteMany({ where: { id: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds.length ? gameIds : ["__none__"] } } });
}

async function createAdminBuilderFixture(prefix: string) {
  const slug = uniqueTestLabel(prefix);
  await deleteAdminBuilderFixture(slug);

  const game = await prisma.game.create({
    data: {
      slug,
      title: "Admin Builder Test Game",
      tagline: "Disposable builder editor fixture",
      description: "Used only by admin builder tests.",
      minPlayers: 4,
      maxPlayers: 8,
      durationMin: 120,
      durationMax: 180,
      versions: {
        create: {
          versionNumber: 1,
          status: "DRAFT",
          themes: ["test"]
        }
      }
    },
    include: { versions: true }
  });
  const version = game.versions[0];
  const [character, round] = await Promise.all([
    prisma.gameCharacter.create({
      data: {
        gameVersionId: version.id,
        key: "decoder-holder",
        name: "Decoder Holder",
        publicBio: "A character for builder tests.",
        isRequired: true,
        sortOrder: 1
      }
    }),
    prisma.gameRound.create({
      data: {
        gameVersionId: version.id,
        key: "round-2",
        title: "Round 2",
        summary: "Investigation round.",
        sortOrder: 2
      }
    })
  ]);
  const evidence = await prisma.gameEvidence.create({
    data: {
      gameVersionId: version.id,
      gameRoundId: round.id,
      characterId: character.id,
      key: "locked-folder",
      title: "Locked Folder",
      body: "A folder that needs a code.",
      evidenceType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    }
  });
  const card = await prisma.gameCard.create({
    data: {
      gameRoundId: round.id,
      characterId: character.id,
      key: "locked-card",
      title: "Locked Card",
      body: "A private card target.",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    }
  });
  const media = await prisma.gameMediaAsset.create({
    data: {
      gameVersionId: version.id,
      gameRoundId: round.id,
      characterId: character.id,
      evidenceId: evidence.id,
      key: "locked-media",
      title: "Locked Media",
      assetType: "IMAGE",
      url: "/media/locked.png",
      mimeType: "image/png",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    }
  });

  return {
    slug,
    gameId: game.id,
    versionId: version.id,
    characterId: character.id,
    roundId: round.id,
    evidenceId: evidence.id,
    cardId: card.id,
    mediaId: media.id
  };
}

test("upsertGameCharacterTool creates, updates, and validates character linkage", async () => {
  const fixture = await createAdminBuilderFixture("admin-builder-tool");

  try {
    const invalidTool = await upsertGameCharacterTool({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "decoder",
      title: "Decoder",
      description: "Missing character.",
      toolType: "ACCESS_CODE_GENERATOR",
      visibility: "PLAYER_PRIVATE",
      config: {},
      sortOrder: 1
    });
    assert.deepEqual(invalidTool, { ok: false, reason: "invalid-tool" });

    const created = await upsertGameCharacterTool({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      characterId: fixture.characterId,
      key: "Decoder",
      title: "Digital Decoder",
      description: "Generates party-specific codes.",
      toolType: "ACCESS_CODE_GENERATOR",
      visibility: "PLAYER_PRIVATE",
      config: { mode: "party-code" },
      sortOrder: 1
    });
    assert.equal(created.ok, true);
    if (!created.ok) assert.fail("Expected tool creation to succeed.");
    assert.equal(created.key, "decoder");

    const duplicate = await upsertGameCharacterTool({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      characterId: fixture.characterId,
      key: "DECODER",
      title: "Duplicate Decoder",
      description: "",
      toolType: "GENERIC",
      visibility: "PLAYER_PRIVATE",
      config: {},
      sortOrder: 2
    });
    assert.deepEqual(duplicate, { ok: false, reason: "duplicate-key" });

    const updated = await upsertGameCharacterTool({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      toolId: created.toolId,
      characterId: fixture.characterId,
      key: "safe-key",
      title: "Safe Key",
      description: "Updated tool.",
      toolType: "KEY",
      visibility: "PLAYER_PRIVATE",
      config: { color: "brass" },
      sortOrder: 4
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) assert.fail("Expected tool update to succeed.");
    assert.equal(updated.previousKey, "decoder");

    const savedTool = await prisma.gameCharacterTool.findUniqueOrThrow({ where: { id: created.toolId } });
    assert.equal(savedTool.key, "safe-key");
    assert.equal(savedTool.toolType, "KEY");
    assert.deepEqual(savedTool.config, { color: "brass" });
  } finally {
    await deleteAdminBuilderFixture(fixture.slug);
  }
});

test("upsertGameDigitalArtifact creates, updates, and validates linkages", async () => {
  const fixture = await createAdminBuilderFixture("admin-builder-artifact");

  try {
    const invalidPrivate = await upsertGameDigitalArtifact({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      gameRoundId: fixture.roundId,
      key: "private-document",
      title: "Private Document",
      description: "Player-private artifacts require a character.",
      artifactType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      content: {},
      sortOrder: 1
    });
    assert.deepEqual(invalidPrivate, { ok: false, reason: "invalid-linkage" });

    const created = await upsertGameDigitalArtifact({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      gameRoundId: fixture.roundId,
      characterId: fixture.characterId,
      evidenceId: fixture.evidenceId,
      mediaAssetId: fixture.mediaId,
      key: "Restricted-Folder",
      title: "Restricted Folder",
      description: "A locked digital folder.",
      artifactType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      content: { body: "Locked content." },
      sortOrder: 1
    });
    assert.equal(created.ok, true);
    if (!created.ok) assert.fail("Expected artifact creation to succeed.");
    assert.equal(created.key, "restricted-folder");

    const duplicate = await upsertGameDigitalArtifact({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      characterId: fixture.characterId,
      key: "RESTRICTED-FOLDER",
      title: "Duplicate Folder",
      description: "",
      artifactType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      content: {},
      sortOrder: 2
    });
    assert.deepEqual(duplicate, { ok: false, reason: "duplicate-key" });

    const updated = await upsertGameDigitalArtifact({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      artifactId: created.artifactId,
      key: "public-file",
      title: "Public File",
      description: "A public digital file.",
      artifactType: "EMAIL",
      visibility: "PUBLIC",
      content: { subject: "Public file" },
      sortOrder: 3
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) assert.fail("Expected artifact update to succeed.");
    assert.equal(updated.previousKey, "restricted-folder");

    const savedArtifact = await prisma.gameDigitalArtifact.findUniqueOrThrow({ where: { id: created.artifactId } });
    assert.equal(savedArtifact.key, "public-file");
    assert.equal(savedArtifact.characterId, null);
    assert.equal(savedArtifact.evidenceId, null);
    assert.equal(savedArtifact.mediaAssetId, null);
    assert.equal(savedArtifact.artifactType, "EMAIL");
    assert.deepEqual(savedArtifact.content, { subject: "Public file" });
  } finally {
    await deleteAdminBuilderFixture(fixture.slug);
  }
});

test("upsertGameUnlockRule creates access-code rules and validates targets/source tools", async () => {
  const fixture = await createAdminBuilderFixture("admin-builder-rule");

  try {
    const genericTool = await prisma.gameCharacterTool.create({
      data: {
        gameVersionId: fixture.versionId,
        characterId: fixture.characterId,
        key: "generic-tool",
        title: "Generic Tool",
        toolType: "GENERIC",
        visibility: "PLAYER_PRIVATE"
      }
    });
    const codeTool = await prisma.gameCharacterTool.create({
      data: {
        gameVersionId: fixture.versionId,
        characterId: fixture.characterId,
        key: "decoder",
        title: "Digital Decoder",
        toolType: "ACCESS_CODE_GENERATOR",
        visibility: "PLAYER_PRIVATE"
      }
    });

    const invalidSource = await upsertGameUnlockRule({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      requiredRoundId: fixture.roundId,
      sourceToolId: genericTool.id,
      key: "unlock-folder",
      title: "Unlock Folder",
      description: "Generic tools cannot power access-code rules.",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      targetType: "GameEvidence",
      targetId: fixture.evidenceId,
      unlockScope: "PLAYER",
      codeMode: "PARTY_TOOL_CODE",
      config: {},
      effect: {},
      status: "DRAFT",
      sortOrder: 1
    });
    assert.deepEqual(invalidSource, { ok: false, reason: "invalid-linkage" });

    const created = await upsertGameUnlockRule({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      requiredRoundId: fixture.roundId,
      requiredCharacterId: fixture.characterId,
      sourceToolId: codeTool.id,
      key: "Unlock-Folder",
      title: "Unlock Folder",
      description: "Code entry unlocks evidence.",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      targetType: "GameEvidence",
      targetId: fixture.evidenceId,
      unlockScope: "PLAYER",
      codeMode: "PARTY_TOOL_CODE",
      config: { uses: 1 },
      effect: { reveal: "target" },
      status: "DRAFT",
      sortOrder: 1
    });
    assert.equal(created.ok, true);
    if (!created.ok) assert.fail("Expected unlock rule creation to succeed.");
    assert.equal(created.key, "unlock-folder");

    const duplicate = await upsertGameUnlockRule({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      sourceToolId: codeTool.id,
      key: "UNLOCK-FOLDER",
      title: "Duplicate Rule",
      description: "",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      targetType: "GameEvidence",
      targetId: fixture.evidenceId,
      unlockScope: "PLAYER",
      codeMode: "PARTY_TOOL_CODE",
      config: {},
      effect: {},
      status: "DRAFT",
      sortOrder: 2
    });
    assert.deepEqual(duplicate, { ok: false, reason: "duplicate-key" });

    const updated = await upsertGameUnlockRule({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      unlockRuleId: created.unlockRuleId,
      key: "unlock-card",
      title: "Unlock Card",
      description: "Host approval unlocks a card.",
      ruleType: "HOST_APPROVAL",
      triggerType: "HOST_APPROVAL",
      targetType: "GameCard",
      targetId: fixture.cardId,
      unlockScope: "ALL_PLAYERS",
      codeMode: "",
      config: {},
      effect: {},
      status: "PUBLISHED",
      sortOrder: 3
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) assert.fail("Expected unlock rule update to succeed.");
    assert.equal(updated.previousKey, "unlock-folder");

    const savedRule = await prisma.gameUnlockRule.findUniqueOrThrow({ where: { id: created.unlockRuleId } });
    assert.equal(savedRule.key, "unlock-card");
    assert.equal(savedRule.targetType, "GameCard");
    assert.equal(savedRule.targetId, fixture.cardId);
    assert.equal(savedRule.unlockScope, "ALL_PLAYERS");
    assert.equal(savedRule.status, "PUBLISHED");
  } finally {
    await deleteAdminBuilderFixture(fixture.slug);
  }
});

test("admin builder upserts lock published versions", async () => {
  const fixture = await createAdminBuilderFixture("admin-builder-lock");

  try {
    await prisma.gameVersion.update({
      where: { id: fixture.versionId },
      data: { status: "PUBLISHED", publishedAt: new Date() }
    });

    const artifactResult = await upsertGameDigitalArtifact({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      characterId: fixture.characterId,
      key: "published-artifact",
      title: "Published Artifact",
      description: "",
      artifactType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      content: {},
      sortOrder: 1
    });
    assert.deepEqual(artifactResult, { ok: false, reason: "published-version" });

    const toolResult = await upsertGameCharacterTool({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      characterId: fixture.characterId,
      key: "published-tool",
      title: "Published Tool",
      description: "",
      toolType: "GENERIC",
      visibility: "PLAYER_PRIVATE",
      config: {},
      sortOrder: 1
    });
    assert.deepEqual(toolResult, { ok: false, reason: "published-version" });

    const ruleResult = await upsertGameUnlockRule({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "published-rule",
      title: "Published Rule",
      description: "",
      ruleType: "HOST_APPROVAL",
      triggerType: "HOST_APPROVAL",
      targetType: "GameEvidence",
      targetId: fixture.evidenceId,
      unlockScope: "PLAYER",
      codeMode: "",
      config: {},
      effect: {},
      status: "DRAFT",
      sortOrder: 1
    });
    assert.deepEqual(ruleResult, { ok: false, reason: "published-version" });
  } finally {
    await deleteAdminBuilderFixture(fixture.slug);
  }
});
