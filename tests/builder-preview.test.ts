import assert from "node:assert/strict";
import test from "node:test";

import { getBuilderPreview } from "../app/lib/builder-preview";
import { prisma, uniqueTestLabel } from "./helpers/test-data";

async function deleteBuilderPreviewFixture(slug: string) {
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

async function createBuilderPreviewFixture(prefix: string) {
  const slug = uniqueTestLabel(prefix);
  await deleteBuilderPreviewFixture(slug);

  const game = await prisma.game.create({
    data: {
      slug,
      title: "Builder Preview Test Game",
      tagline: "Disposable preview fixture",
      description: "Used only by builder preview tests.",
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
  const [characterA, characterB] = await Promise.all([
    prisma.gameCharacter.create({
      data: {
        gameVersionId: version.id,
        key: "decoder-holder",
        name: "Decoder Holder",
        publicBio: "Has the decoder.",
        isRequired: true,
        sortOrder: 1
      }
    }),
    prisma.gameCharacter.create({
      data: {
        gameVersionId: version.id,
        key: "observer",
        name: "Observer",
        publicBio: "Does not have the decoder.",
        isRequired: true,
        sortOrder: 2
      }
    })
  ]);
  const [roundOne, roundTwo] = await Promise.all([
    prisma.gameRound.create({
      data: {
        gameVersionId: version.id,
        key: "round-1",
        title: "Round 1",
        summary: "Opening round.",
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

  await prisma.gameCard.createMany({
    data: [
      {
        gameRoundId: roundOne.id,
        key: "public-card",
        title: "Public Card",
        body: "Visible to hosts and players.",
        visibility: "PUBLIC",
        sortOrder: 1
      },
      {
        gameRoundId: roundOne.id,
        key: "host-card",
        title: "Host Card",
        body: "Visible to host-safe preview.",
        visibility: "HOST_SAFE",
        sortOrder: 2
      },
      {
        gameRoundId: roundOne.id,
        key: "spoiler-card",
        title: "Spoiler Card",
        body: "Visible only to spoiler host.",
        visibility: "SPOILER_PROTECTED",
        sortOrder: 3
      },
      {
        gameRoundId: roundOne.id,
        characterId: characterA.id,
        key: "private-card-a",
        title: "Private Card A",
        body: "Visible to character A.",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 4
      },
      {
        gameRoundId: roundTwo.id,
        characterId: characterA.id,
        key: "round-two-card-a",
        title: "Round Two Card A",
        body: "Visible to character A after round two.",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 5
      }
    ]
  });
  const lockedCard = await prisma.gameCard.create({
    data: {
      gameRoundId: roundTwo.id,
      characterId: characterA.id,
      key: "locked-card-a",
      title: "Locked Card A",
      body: "Visible after unlock.",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 6
    }
  });

  const lockedEvidence = await prisma.gameEvidence.create({
    data: {
      gameVersionId: version.id,
      gameRoundId: roundTwo.id,
      characterId: characterA.id,
      key: "locked-evidence",
      title: "Locked Evidence",
      body: "Evidence unlocked by code.",
      evidenceType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    }
  });
  const lockedMedia = await prisma.gameMediaAsset.create({
    data: {
      gameVersionId: version.id,
      gameRoundId: roundTwo.id,
      characterId: characterA.id,
      evidenceId: lockedEvidence.id,
      key: "locked-media",
      title: "Locked Media",
      assetType: "IMAGE",
      url: "/media/locked.png",
      mimeType: "image/png",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    }
  });
  const tool = await prisma.gameCharacterTool.create({
    data: {
      gameVersionId: version.id,
      characterId: characterA.id,
      key: "decoder",
      title: "Digital Decoder",
      description: "A character-private decoder.",
      toolType: "ACCESS_CODE_GENERATOR",
      visibility: "PLAYER_PRIVATE",
      config: { mode: "party-code" },
      sortOrder: 1
    }
  });
  const unlockRule = await prisma.gameUnlockRule.create({
    data: {
      gameVersionId: version.id,
      requiredRoundId: roundTwo.id,
      sourceToolId: tool.id,
      key: "unlock-card-a",
      title: "Unlock Card A",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      targetType: "GameCard",
      targetId: lockedCard.id,
      unlockScope: "PLAYER",
      codeMode: "PARTY_TOOL_CODE",
      status: "DRAFT",
      sortOrder: 1
    }
  });
  await prisma.gameCard.update({
    where: { id: lockedCard.id },
    data: { requiredUnlockRuleId: unlockRule.id }
  });
  await prisma.gameEvidence.update({
    where: { id: lockedEvidence.id },
    data: { requiredUnlockRuleId: unlockRule.id }
  });
  await prisma.gameMediaAsset.update({
    where: { id: lockedMedia.id },
    data: { requiredUnlockRuleId: unlockRule.id }
  });
  const artifact = await prisma.gameDigitalArtifact.create({
    data: {
      gameVersionId: version.id,
      gameRoundId: roundTwo.id,
      characterId: characterA.id,
      evidenceId: lockedEvidence.id,
      mediaAssetId: lockedMedia.id,
      requiredUnlockRuleId: unlockRule.id,
      key: "locked-artifact",
      title: "Locked Artifact",
      artifactType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      content: { body: "Locked artifact body." },
      sortOrder: 1
    }
  });

  return {
    slug,
    gameId: game.id,
    versionId: version.id,
    characterAId: characterA.id,
    characterBId: characterB.id,
    roundOneId: roundOne.id,
    roundTwoId: roundTwo.id,
    lockedCardId: lockedCard.id,
    lockedEvidenceId: lockedEvidence.id,
    lockedMediaId: lockedMedia.id,
    artifactId: artifact.id,
    unlockRuleId: unlockRule.id
  };
}

test("builder preview separates host-safe and spoiler-host content", async () => {
  const fixture = await createBuilderPreviewFixture("builder-preview-host");

  try {
    const hostSafePreview = await getBuilderPreview({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      mode: "HOST_SAFE"
    });
    assert.ok(hostSafePreview);
    assert.deepEqual(
      hostSafePreview.cards.map((card) => card.title),
      ["Public Card", "Host Card"]
    );

    const spoilerPreview = await getBuilderPreview({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      mode: "HOST_SPOILER"
    });
    assert.ok(spoilerPreview);
    assert.deepEqual(
      spoilerPreview.cards.map((card) => card.title),
      ["Public Card", "Host Card", "Spoiler Card"]
    );
  } finally {
    await deleteBuilderPreviewFixture(fixture.slug);
  }
});

test("builder preview filters player content by character, round, and simulated unlocks", async () => {
  const fixture = await createBuilderPreviewFixture("builder-preview-player");

  try {
    const roundOnePreview = await getBuilderPreview({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      mode: "PLAYER",
      characterId: fixture.characterAId,
      roundId: fixture.roundOneId
    });
    assert.ok(roundOnePreview);
    assert.deepEqual(
      roundOnePreview.cards.map((card) => card.title),
      ["Public Card", "Private Card A"]
    );
    assert.deepEqual(roundOnePreview.evidence.map((evidence) => evidence.title), []);
    assert.deepEqual(roundOnePreview.characterTools.map((tool) => tool.title), ["Digital Decoder"]);

    const lockedPreview = await getBuilderPreview({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      mode: "PLAYER",
      characterId: fixture.characterAId,
      roundId: fixture.roundTwoId
    });
    assert.ok(lockedPreview);
    assert.deepEqual(
      lockedPreview.cards.map((card) => card.title),
      ["Public Card", "Private Card A", "Round Two Card A"]
    );
    assert.deepEqual(lockedPreview.evidence.map((evidence) => evidence.title), []);
    assert.deepEqual(lockedPreview.mediaAssets.map((media) => media.title), []);
    assert.deepEqual(lockedPreview.digitalArtifacts.map((artifact) => artifact.title), []);

    const unlockedPreview = await getBuilderPreview({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      mode: "PLAYER",
      characterId: fixture.characterAId,
      roundId: fixture.roundTwoId,
      unlockedRuleIds: [fixture.unlockRuleId]
    });
    assert.ok(unlockedPreview);
    assert.deepEqual(
      unlockedPreview.cards.map((card) => card.title),
      ["Public Card", "Private Card A", "Round Two Card A", "Locked Card A"]
    );
    assert.deepEqual(unlockedPreview.evidence.map((evidence) => evidence.title), ["Locked Evidence"]);
    assert.deepEqual(unlockedPreview.mediaAssets.map((media) => media.title), ["Locked Media"]);
    assert.deepEqual(unlockedPreview.digitalArtifacts.map((artifact) => artifact.title), ["Locked Artifact"]);

    const otherCharacterPreview = await getBuilderPreview({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      mode: "PLAYER",
      characterId: fixture.characterBId,
      roundId: fixture.roundTwoId,
      unlockedRuleIds: [fixture.unlockRuleId]
    });
    assert.ok(otherCharacterPreview);
    assert.deepEqual(otherCharacterPreview.cards.map((card) => card.title), ["Public Card"]);
    assert.deepEqual(otherCharacterPreview.characterTools.map((tool) => tool.title), []);
  } finally {
    await deleteBuilderPreviewFixture(fixture.slug);
  }
});
