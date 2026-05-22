import assert from "node:assert/strict";
import test from "node:test";

import { upsertGameCharacter } from "../app/lib/admin-characters";
import { prisma, uniqueTestLabel } from "./helpers/test-data";

async function deleteAdminCharacterFixture(slug: string) {
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

  await prisma.gameCharacter.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameVersion.deleteMany({ where: { id: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds.length ? gameIds : ["__none__"] } } });
}

async function createAdminCharacterFixture(prefix: string) {
  const slug = uniqueTestLabel(prefix);
  await deleteAdminCharacterFixture(slug);

  const game = await prisma.game.create({
    data: {
      slug,
      title: "Admin Character Test Game",
      tagline: "Disposable character editor fixture",
      description: "Used only by admin character tests.",
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

  return {
    slug,
    gameId: game.id,
    versionId: game.versions[0].id
  };
}

test("upsertGameCharacter creates characters and normalizes keys", async () => {
  const fixture = await createAdminCharacterFixture("admin-character-create");

  try {
    const result = await upsertGameCharacter({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "Lead-Suspect",
      name: "Lead Suspect",
      publicBio: "A public character description.",
      privateBio: "A private character secret.",
      isRequired: true,
      sortOrder: 3
    });

    assert.equal(result.ok, true);
    if (!result.ok) assert.fail("Expected character creation to succeed.");
    assert.equal(result.action, "created");
    assert.equal(result.key, "lead-suspect");

    const savedCharacter = await prisma.gameCharacter.findUniqueOrThrow({
      where: {
        gameVersionId_key: {
          gameVersionId: fixture.versionId,
          key: "lead-suspect"
        }
      }
    });
    assert.equal(savedCharacter.name, "Lead Suspect");
    assert.equal(savedCharacter.publicBio, "A public character description.");
    assert.equal(savedCharacter.privateBio, "A private character secret.");
    assert.equal(savedCharacter.isRequired, true);
    assert.equal(savedCharacter.sortOrder, 3);
  } finally {
    await deleteAdminCharacterFixture(fixture.slug);
  }
});

test("upsertGameCharacter updates existing characters and rejects duplicate keys", async () => {
  const fixture = await createAdminCharacterFixture("admin-character-update");

  try {
    const created = await upsertGameCharacter({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "lead-suspect",
      name: "Lead Suspect",
      publicBio: "A public character description.",
      privateBio: "",
      isRequired: true,
      sortOrder: 1
    });
    assert.equal(created.ok, true);
    if (!created.ok) assert.fail("Expected initial character creation to succeed.");

    const duplicate = await upsertGameCharacter({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "LEAD-SUSPECT",
      name: "Duplicate Suspect",
      publicBio: "Another public character description.",
      privateBio: "",
      isRequired: true,
      sortOrder: 2
    });
    assert.deepEqual(duplicate, { ok: false, reason: "duplicate-key" });

    const updated = await upsertGameCharacter({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      characterId: created.characterId,
      key: "chief-suspect",
      name: "Chief Suspect",
      publicBio: "Updated public character description.",
      privateBio: "Updated private note.",
      isRequired: true,
      sortOrder: 5
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) assert.fail("Expected character update to succeed.");
    assert.equal(updated.action, "updated");
    assert.equal(updated.previousKey, "lead-suspect");

    const characters = await prisma.gameCharacter.findMany({
      where: { gameVersionId: fixture.versionId },
      orderBy: { key: "asc" }
    });
    assert.equal(characters.length, 1);
    assert.equal(characters[0].key, "chief-suspect");
    assert.equal(characters[0].sortOrder, 5);
  } finally {
    await deleteAdminCharacterFixture(fixture.slug);
  }
});

test("upsertGameCharacter preserves required coverage and published version locks", async () => {
  const fixture = await createAdminCharacterFixture("admin-character-rules");

  try {
    const optionalFirst = await upsertGameCharacter({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "optional-first",
      name: "Optional First",
      publicBio: "An optional character cannot be the only character.",
      privateBio: "",
      isRequired: false,
      sortOrder: 1
    });
    assert.deepEqual(optionalFirst, { ok: false, reason: "required-character" });

    const created = await upsertGameCharacter({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      key: "required-lead",
      name: "Required Lead",
      publicBio: "A required character description.",
      privateBio: "",
      isRequired: true,
      sortOrder: 1
    });
    assert.equal(created.ok, true);
    if (!created.ok) assert.fail("Expected required character creation to succeed.");

    const removeOnlyRequired = await upsertGameCharacter({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      characterId: created.characterId,
      key: "required-lead",
      name: "Required Lead",
      publicBio: "A required character description.",
      privateBio: "",
      isRequired: false,
      sortOrder: 1
    });
    assert.deepEqual(removeOnlyRequired, { ok: false, reason: "required-character" });

    await prisma.gameVersion.update({
      where: { id: fixture.versionId },
      data: { status: "PUBLISHED", publishedAt: new Date() }
    });

    const publishedEdit = await upsertGameCharacter({
      gameId: fixture.gameId,
      versionId: fixture.versionId,
      characterId: created.characterId,
      key: "required-lead",
      name: "Published Edit",
      publicBio: "Published versions are locked.",
      privateBio: "",
      isRequired: true,
      sortOrder: 1
    });
    assert.deepEqual(publishedEdit, { ok: false, reason: "published-version" });
  } finally {
    await deleteAdminCharacterFixture(fixture.slug);
  }
});
