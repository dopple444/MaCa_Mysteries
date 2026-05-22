import assert from "node:assert/strict";
import test from "node:test";

import { updateGameVersionStatus } from "../app/lib/admin-version-status";
import { getGameVersionPublishReadiness } from "../app/lib/publish-readiness";
import { prisma, uniqueTestLabel } from "./helpers/test-data";

async function deletePublishReadinessFixture(slug: string) {
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
  await prisma.gameFinalReveal.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameRound.deleteMany({ where: { id: { in: roundIds.length ? roundIds : ["__none__"] } } });
  await prisma.gameCharacter.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameVersion.deleteMany({ where: { id: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds.length ? gameIds : ["__none__"] } } });
}

async function createBaseGame(prefix: string) {
  const slug = uniqueTestLabel(prefix);
  await deletePublishReadinessFixture(slug);

  const game = await prisma.game.create({
    data: {
      slug,
      title: "Publish Readiness Test Game",
      tagline: "Disposable publish readiness fixture",
      description: "Used only by publish readiness tests.",
      minPlayers: 3,
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

  return {
    slug,
    gameId: game.id,
    versionId: game.versions[0].id
  };
}

async function addCompleteVersionContent(versionId: string) {
  const [firstCharacter, secondCharacter] = await Promise.all([
    prisma.gameCharacter.create({
      data: {
        gameVersionId: versionId,
        key: "detective",
        name: "Detective",
        publicBio: "A required detective.",
        isRequired: true,
        sortOrder: 1
      }
    }),
    prisma.gameCharacter.create({
      data: {
        gameVersionId: versionId,
        key: "archivist",
        name: "Archivist",
        publicBio: "Another required player.",
        isRequired: true,
        sortOrder: 2
      }
    })
  ]);
  const rounds = await Promise.all(
    [1, 2, 3].map((sortOrder) =>
      prisma.gameRound.create({
        data: {
          gameVersionId: versionId,
          key: `round-${sortOrder}`,
          title: `Round ${sortOrder}`,
          summary: `Round ${sortOrder} summary.`,
          sortOrder
        }
      })
    )
  );

  const card = await prisma.gameCard.create({
    data: {
      gameRoundId: rounds[0].id,
      characterId: firstCharacter.id,
      key: "detective-card",
      title: "Detective Card",
      body: "Private detective instruction.",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    }
  });
  await prisma.gameFinalReveal.create({
    data: {
      gameVersionId: versionId,
      victimCharacterId: firstCharacter.id,
      killerCharacterId: secondCharacter.id,
      title: "Solution",
      victimRevealText: "The detective was attacked.",
      killerRevealText: "The archivist did it.",
      solutionText: "The solution is complete.",
      epilogueText: "The end."
    }
  });

  return {
    firstCharacter,
    secondCharacter,
    rounds,
    card
  };
}

test("publish readiness reports missing essential game-version content", async () => {
  const fixture = await createBaseGame("publish-readiness-missing");

  try {
    const readiness = await getGameVersionPublishReadiness({
      gameId: fixture.gameId,
      versionId: fixture.versionId
    });

    assert.equal(readiness.ok, false);
    assert.ok(readiness.errorCount >= 5);
    assert.ok(readiness.issues.some((issue) => issue.code === "MISSING_CHARACTERS"));
    assert.ok(readiness.issues.some((issue) => issue.code === "MISSING_REQUIRED_CHARACTERS"));
    assert.ok(readiness.issues.some((issue) => issue.code === "MISSING_ROUNDS"));
    assert.ok(readiness.issues.some((issue) => issue.code === "MISSING_FINAL_REVEAL"));
    assert.ok(readiness.issues.some((issue) => issue.code === "MISSING_PLAYER_CONTENT"));
  } finally {
    await deletePublishReadinessFixture(fixture.slug);
  }
});

test("publish readiness allows complete versions while preserving warnings", async () => {
  const fixture = await createBaseGame("publish-readiness-complete");

  try {
    await addCompleteVersionContent(fixture.versionId);

    const readiness = await getGameVersionPublishReadiness({
      gameId: fixture.gameId,
      versionId: fixture.versionId
    });

    assert.equal(readiness.ok, true);
    assert.equal(readiness.errorCount, 0);
    assert.ok(readiness.warningCount >= 0);
  } finally {
    await deletePublishReadinessFixture(fixture.slug);
  }
});

test("publish readiness catches unsafe conditional unlock references", async () => {
  const fixture = await createBaseGame("publish-readiness-unlocks");

  try {
    const content = await addCompleteVersionContent(fixture.versionId);
    const evidence = await prisma.gameEvidence.create({
      data: {
        gameVersionId: fixture.versionId,
        gameRoundId: content.rounds[1].id,
        characterId: content.firstCharacter.id,
        key: "locked-evidence",
        title: "Locked Evidence",
        body: "This evidence points at a draft rule.",
        evidenceType: "DOCUMENT",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 1
      }
    });
    const media = await prisma.gameMediaAsset.create({
      data: {
        gameVersionId: fixture.versionId,
        gameRoundId: content.rounds[1].id,
        characterId: content.firstCharacter.id,
        key: "loose-media",
        title: "Loose Media",
        assetType: "IMAGE",
        url: "/media/loose.png",
        mimeType: "image/png",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 1
      }
    });
    const artifact = await prisma.gameDigitalArtifact.create({
      data: {
        gameVersionId: fixture.versionId,
        gameRoundId: content.rounds[1].id,
        characterId: content.firstCharacter.id,
        key: "code-artifact",
        title: "Code Artifact",
        artifactType: "DOCUMENT",
        visibility: "PLAYER_PRIVATE",
        content: {},
        sortOrder: 1
      }
    });
    const draftRule = await prisma.gameUnlockRule.create({
      data: {
        gameVersionId: fixture.versionId,
        key: "draft-evidence-rule",
        title: "Draft Evidence Rule",
        ruleType: "HOST_APPROVAL",
        triggerType: "HOST_APPROVAL",
        targetType: "GameEvidence",
        targetId: evidence.id,
        unlockScope: "PLAYER",
        status: "DRAFT"
      }
    });
    await prisma.gameEvidence.update({
      where: { id: evidence.id },
      data: { requiredUnlockRuleId: draftRule.id }
    });
    await prisma.gameCard.update({
      where: { id: content.card.id },
      data: { requiredUnlockRuleId: "missing-rule" }
    });
    await prisma.gameUnlockRule.create({
      data: {
        gameVersionId: fixture.versionId,
        key: "unattached-media-rule",
        title: "Unattached Media Rule",
        ruleType: "HOST_APPROVAL",
        triggerType: "HOST_APPROVAL",
        targetType: "GameMediaAsset",
        targetId: media.id,
        unlockScope: "PLAYER",
        status: "PUBLISHED"
      }
    });
    const codeRule = await prisma.gameUnlockRule.create({
      data: {
        gameVersionId: fixture.versionId,
        key: "missing-generator-rule",
        title: "Missing Generator Rule",
        ruleType: "ACCESS_CODE",
        triggerType: "CODE_ENTRY",
        targetType: "GameDigitalArtifact",
        targetId: artifact.id,
        unlockScope: "PLAYER",
        codeMode: "PARTY_TOOL_CODE",
        status: "PUBLISHED"
      }
    });
    await prisma.gameDigitalArtifact.update({
      where: { id: artifact.id },
      data: { requiredUnlockRuleId: codeRule.id }
    });

    const readiness = await getGameVersionPublishReadiness({
      gameId: fixture.gameId,
      versionId: fixture.versionId
    });

    assert.equal(readiness.ok, false);
    assert.ok(readiness.issues.some((issue) => issue.code === "CONTENT_REQUIRES_UNPUBLISHED_RULE"));
    assert.ok(readiness.issues.some((issue) => issue.code === "ORPHAN_REQUIRED_UNLOCK_RULE"));
    assert.ok(readiness.issues.some((issue) => issue.code === "UNLOCK_RULE_NOT_ATTACHED_TO_TARGET"));
    assert.ok(readiness.issues.some((issue) => issue.code === "MISSING_ACCESS_CODE_GENERATOR"));
  } finally {
    await deletePublishReadinessFixture(fixture.slug);
  }
});

test("updateGameVersionStatus blocks publishing versions with readiness errors", async () => {
  const fixture = await createBaseGame("publish-readiness-block");

  try {
    const result = await updateGameVersionStatus({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      userId: "publish-readiness-test",
      status: "PUBLISHED"
    });

    assert.equal(result.ok, false);
    if (result.ok) assert.fail("Expected publishing to be blocked.");
    assert.equal(result.reason, "publish-readiness");
    assert.ok(result.readiness?.issues.some((issue) => issue.code === "MISSING_FINAL_REVEAL"));

    const version = await prisma.gameVersion.findUniqueOrThrow({
      where: { id: fixture.versionId },
      select: { status: true, publishedAt: true }
    });
    assert.equal(version.status, "DRAFT");
    assert.equal(version.publishedAt, null);
  } finally {
    await deletePublishReadinessFixture(fixture.slug);
  }
});
