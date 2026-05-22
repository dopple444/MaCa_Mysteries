import assert from "node:assert/strict";
import test from "node:test";

import { upsertGameEvidence, upsertGameMedia } from "../app/lib/admin-evidence";
import { prisma, uniqueTestLabel } from "./helpers/test-data";

async function deleteAdminEvidenceFixture(slug: string) {
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

  await prisma.gameMediaAsset.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameEvidence.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameRound.deleteMany({ where: { id: { in: roundIds.length ? roundIds : ["__none__"] } } });
  await prisma.gameCharacter.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameVersion.deleteMany({ where: { id: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds.length ? gameIds : ["__none__"] } } });
}

async function createAdminEvidenceFixture(prefix: string) {
  const slug = uniqueTestLabel(prefix);
  await deleteAdminEvidenceFixture(slug);

  const game = await prisma.game.create({
    data: {
      slug,
      title: "Admin Evidence Test Game",
      tagline: "Disposable evidence editor fixture",
      description: "Used only by admin evidence tests.",
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
        key: "test-character",
        name: "Test Character",
        publicBio: "A character for evidence assignment tests.",
        isRequired: true,
        sortOrder: 1
      }
    }),
    prisma.gameRound.create({
      data: {
        gameVersionId: version.id,
        key: "round-1",
        title: "Round 1",
        summary: "Opening round.",
        sortOrder: 1
      }
    })
  ]);

  return {
    slug,
    gameId: game.id,
    versionId: version.id,
    characterId: character.id,
    roundId: round.id
  };
}

test("upsertGameEvidence creates, updates, and validates evidence linkages", async () => {
  const fixture = await createAdminEvidenceFixture("admin-evidence-create");

  try {
    const invalidPrivate = await upsertGameEvidence({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      gameRoundId: fixture.roundId,
      key: "private-evidence",
      title: "Private Evidence",
      body: "Private evidence requires a character.",
      evidenceType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    });
    assert.deepEqual(invalidPrivate, { ok: false, reason: "invalid-linkage" });

    const created = await upsertGameEvidence({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      gameRoundId: fixture.roundId,
      characterId: fixture.characterId,
      key: "Private-Evidence",
      title: "Private Evidence",
      body: "Only the assigned character should see this after reveal.",
      evidenceType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 2
    });
    assert.equal(created.ok, true);
    if (!created.ok) assert.fail("Expected evidence creation to succeed.");
    assert.equal(created.key, "private-evidence");

    const duplicate = await upsertGameEvidence({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "PRIVATE-EVIDENCE",
      title: "Duplicate Evidence",
      body: "Duplicate evidence key.",
      evidenceType: "TEXT",
      visibility: "PUBLIC",
      sortOrder: 3
    });
    assert.deepEqual(duplicate, { ok: false, reason: "duplicate-key" });

    const updated = await upsertGameEvidence({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      evidenceId: created.evidenceId,
      key: "public-evidence",
      title: "Public Evidence",
      body: "Everyone can see this once revealed.",
      evidenceType: "NOTE",
      visibility: "PUBLIC",
      sortOrder: 4
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) assert.fail("Expected evidence update to succeed.");
    assert.equal(updated.previousKey, "private-evidence");

    const savedEvidence = await prisma.gameEvidence.findUniqueOrThrow({ where: { id: created.evidenceId } });
    assert.equal(savedEvidence.key, "public-evidence");
    assert.equal(savedEvidence.gameRoundId, null);
    assert.equal(savedEvidence.characterId, null);
    assert.equal(savedEvidence.evidenceType, "NOTE");
    assert.equal(savedEvidence.visibility, "PUBLIC");
  } finally {
    await deleteAdminEvidenceFixture(fixture.slug);
  }
});

test("upsertGameMedia creates, updates, and validates media metadata linkages", async () => {
  const fixture = await createAdminEvidenceFixture("admin-media-create");

  try {
    const evidence = await prisma.gameEvidence.create({
      data: {
        gameVersionId: fixture.versionId,
        gameRoundId: fixture.roundId,
        key: "test-evidence",
        title: "Test Evidence",
        body: "Evidence for linked media.",
        evidenceType: "DOCUMENT",
        visibility: "PUBLIC",
        sortOrder: 1
      }
    });

    const invalidPrivate = await upsertGameMedia({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      gameRoundId: fixture.roundId,
      evidenceId: evidence.id,
      key: "private-media",
      title: "Private Media",
      description: "",
      assetType: "IMAGE",
      url: "/media/private.png",
      mimeType: "image/png",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    });
    assert.deepEqual(invalidPrivate, { ok: false, reason: "invalid-linkage" });

    const created = await upsertGameMedia({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      gameRoundId: fixture.roundId,
      characterId: fixture.characterId,
      evidenceId: evidence.id,
      key: "Private-Media",
      title: "Private Media",
      description: "A private image clue.",
      assetType: "IMAGE",
      url: "/media/private.png",
      mimeType: "IMAGE/PNG",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 2
    });
    assert.equal(created.ok, true);
    if (!created.ok) assert.fail("Expected media creation to succeed.");
    assert.equal(created.key, "private-media");

    const duplicate = await upsertGameMedia({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "PRIVATE-MEDIA",
      title: "Duplicate Media",
      description: "",
      assetType: "IMAGE",
      url: "/media/duplicate.png",
      mimeType: "image/png",
      visibility: "PUBLIC",
      sortOrder: 3
    });
    assert.deepEqual(duplicate, { ok: false, reason: "duplicate-key" });

    const updated = await upsertGameMedia({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      mediaId: created.mediaId,
      key: "public-media",
      title: "Public Media",
      description: "A public image clue.",
      assetType: "IMAGE",
      url: "https://example.com/public.png",
      mimeType: "image/png",
      visibility: "PUBLIC",
      sortOrder: 4
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) assert.fail("Expected media update to succeed.");
    assert.equal(updated.previousKey, "private-media");

    const savedMedia = await prisma.gameMediaAsset.findUniqueOrThrow({ where: { id: created.mediaId } });
    assert.equal(savedMedia.key, "public-media");
    assert.equal(savedMedia.gameRoundId, null);
    assert.equal(savedMedia.characterId, null);
    assert.equal(savedMedia.evidenceId, null);
    assert.equal(savedMedia.url, "https://example.com/public.png");
    assert.equal(savedMedia.mimeType, "image/png");
  } finally {
    await deleteAdminEvidenceFixture(fixture.slug);
  }
});

test("upsertGameEvidence and upsertGameMedia lock published versions", async () => {
  const fixture = await createAdminEvidenceFixture("admin-evidence-lock");

  try {
    await prisma.gameVersion.update({
      where: { id: fixture.versionId },
      data: { status: "PUBLISHED", publishedAt: new Date() }
    });

    const evidenceResult = await upsertGameEvidence({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "locked-evidence",
      title: "Locked Evidence",
      body: "Published versions are locked.",
      evidenceType: "TEXT",
      visibility: "PUBLIC",
      sortOrder: 1
    });
    assert.deepEqual(evidenceResult, { ok: false, reason: "published-version" });

    const mediaResult = await upsertGameMedia({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "locked-media",
      title: "Locked Media",
      description: "",
      assetType: "IMAGE",
      url: "/media/locked.png",
      mimeType: "image/png",
      visibility: "PUBLIC",
      sortOrder: 1
    });
    assert.deepEqual(mediaResult, { ok: false, reason: "published-version" });
  } finally {
    await deleteAdminEvidenceFixture(fixture.slug);
  }
});
