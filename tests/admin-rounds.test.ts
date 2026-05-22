import assert from "node:assert/strict";
import test from "node:test";

import { upsertGameCard, upsertGameRound } from "../app/lib/admin-rounds";
import { prisma, uniqueTestLabel } from "./helpers/test-data";

async function deleteAdminRoundFixture(slug: string) {
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

  await prisma.gameCard.deleteMany({ where: { gameRoundId: { in: roundIds.length ? roundIds : ["__none__"] } } });
  await prisma.gameRound.deleteMany({ where: { id: { in: roundIds.length ? roundIds : ["__none__"] } } });
  await prisma.gameCharacter.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameVersion.deleteMany({ where: { id: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds.length ? gameIds : ["__none__"] } } });
}

async function createAdminRoundFixture(prefix: string) {
  const slug = uniqueTestLabel(prefix);
  await deleteAdminRoundFixture(slug);

  const game = await prisma.game.create({
    data: {
      slug,
      title: "Admin Round Test Game",
      tagline: "Disposable round editor fixture",
      description: "Used only by admin round tests.",
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
  const character = await prisma.gameCharacter.create({
    data: {
      gameVersionId: version.id,
      key: "test-character",
      name: "Test Character",
      publicBio: "A character for card assignment tests.",
      isRequired: true,
      sortOrder: 1
    }
  });

  return {
    slug,
    gameId: game.id,
    versionId: version.id,
    characterId: character.id
  };
}

test("upsertGameRound creates, updates, and rejects duplicate round keys", async () => {
  const fixture = await createAdminRoundFixture("admin-round-create");

  try {
    const created = await upsertGameRound({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "Round-1",
      title: "Round 1",
      summary: "Opening round summary.",
      sortOrder: 1
    });
    assert.equal(created.ok, true);
    if (!created.ok) assert.fail("Expected round creation to succeed.");
    assert.equal(created.key, "round-1");

    const duplicate = await upsertGameRound({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "ROUND-1",
      title: "Duplicate Round",
      summary: "",
      sortOrder: 2
    });
    assert.deepEqual(duplicate, { ok: false, reason: "duplicate-key" });

    const updated = await upsertGameRound({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      roundId: created.roundId,
      key: "round-one",
      title: "Round One",
      summary: "Updated opening round summary.",
      sortOrder: 5
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) assert.fail("Expected round update to succeed.");
    assert.equal(updated.previousKey, "round-1");

    const savedRound = await prisma.gameRound.findUniqueOrThrow({ where: { id: created.roundId } });
    assert.equal(savedRound.key, "round-one");
    assert.equal(savedRound.title, "Round One");
    assert.equal(savedRound.summary, "Updated opening round summary.");
    assert.equal(savedRound.sortOrder, 5);
  } finally {
    await deleteAdminRoundFixture(fixture.slug);
  }
});

test("upsertGameCard creates, updates, and validates card visibility rules", async () => {
  const fixture = await createAdminRoundFixture("admin-card-create");

  try {
    const roundOne = await prisma.gameRound.create({
      data: {
        gameVersionId: fixture.versionId,
        key: "round-1",
        title: "Round 1",
        summary: "Opening round.",
        sortOrder: 1
      }
    });
    const roundTwo = await prisma.gameRound.create({
      data: {
        gameVersionId: fixture.versionId,
        key: "round-2",
        title: "Round 2",
        summary: "Investigation round.",
        sortOrder: 2
      }
    });

    const invalidPrivate = await upsertGameCard({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      roundId: roundOne.id,
      key: "private-card",
      title: "Private Card",
      body: "Private cards need a character assignment.",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    });
    assert.deepEqual(invalidPrivate, { ok: false, reason: "invalid-character" });

    const created = await upsertGameCard({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      roundId: roundOne.id,
      key: "Public-Card",
      title: "Public Card",
      body: "Everyone can see this card once the round is active.",
      visibility: "PUBLIC",
      sortOrder: 1
    });
    assert.equal(created.ok, true);
    if (!created.ok) assert.fail("Expected card creation to succeed.");
    assert.equal(created.key, "public-card");

    const duplicate = await upsertGameCard({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      roundId: roundOne.id,
      key: "PUBLIC-CARD",
      title: "Duplicate Card",
      body: "Duplicate key in the same round.",
      visibility: "PUBLIC",
      sortOrder: 2
    });
    assert.deepEqual(duplicate, { ok: false, reason: "duplicate-key" });

    const updated = await upsertGameCard({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      cardId: created.cardId,
      roundId: roundTwo.id,
      characterId: fixture.characterId,
      key: "private-round-two",
      title: "Private Round Two",
      body: "Only the assigned character can see this card.",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 3
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) assert.fail("Expected card update to succeed.");
    assert.equal(updated.previousKey, "public-card");

    const savedCard = await prisma.gameCard.findUniqueOrThrow({ where: { id: created.cardId } });
    assert.equal(savedCard.gameRoundId, roundTwo.id);
    assert.equal(savedCard.characterId, fixture.characterId);
    assert.equal(savedCard.visibility, "PLAYER_PRIVATE");
    assert.equal(savedCard.sortOrder, 3);
  } finally {
    await deleteAdminRoundFixture(fixture.slug);
  }
});

test("upsertGameRound and upsertGameCard lock published versions", async () => {
  const fixture = await createAdminRoundFixture("admin-round-lock");

  try {
    await prisma.gameVersion.update({
      where: { id: fixture.versionId },
      data: { status: "PUBLISHED", publishedAt: new Date() }
    });

    const roundResult = await upsertGameRound({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "round-1",
      title: "Round 1",
      summary: "",
      sortOrder: 1
    });
    assert.deepEqual(roundResult, { ok: false, reason: "published-version" });

    const cardResult = await upsertGameCard({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      roundId: "missing-round",
      key: "card-1",
      title: "Card 1",
      body: "Published versions are locked.",
      visibility: "PUBLIC",
      sortOrder: 1
    });
    assert.deepEqual(cardResult, { ok: false, reason: "published-version" });
  } finally {
    await deleteAdminRoundFixture(fixture.slug);
  }
});
