import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { createPartyRecord } from "../app/lib/party-service";

const prisma = new PrismaClient();

async function deleteTestData(slugPrefix: string, emailDomain: string) {
  const games = await prisma.game.findMany({
    where: { slug: { startsWith: slugPrefix } },
    select: { id: true }
  });
  const gameIds = games.map((game) => game.id);

  const users = await prisma.user.findMany({
    where: { email: { endsWith: emailDomain } },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);

  const parties = await prisma.party.findMany({
    where: {
      OR: [
        { gameId: { in: gameIds.length ? gameIds : ["__none__"] } },
        { hostId: { in: userIds.length ? userIds : ["__none__"] } }
      ]
    },
    select: { id: true }
  });
  const partyIds = parties.map((party) => party.id);

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

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { partyId: { in: partyIds.length ? partyIds : ["__none__"] } },
        { userId: { in: userIds.length ? userIds : ["__none__"] } }
      ]
    }
  });
  await prisma.outboundMessage.deleteMany({
    where: {
      OR: [
        { partyId: { in: partyIds.length ? partyIds : ["__none__"] } },
        { userId: { in: userIds.length ? userIds : ["__none__"] } }
      ]
    }
  });
  await prisma.userGameAccess.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : ["__none__"] } },
        { gameId: { in: gameIds.length ? gameIds : ["__none__"] } }
      ]
    }
  });
  await prisma.partyCharacterAssignment.deleteMany({ where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } } });
  await prisma.partyAccusation.deleteMany({ where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } } });
  await prisma.partyFinalRevealState.deleteMany({ where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } } });
  await prisma.partyResult.deleteMany({ where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } } });
  await prisma.partyEvidenceReveal.deleteMany({ where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } } });
  await prisma.partyRoundState.deleteMany({ where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } } });
  await prisma.guest.deleteMany({ where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } } });
  await prisma.party.deleteMany({ where: { id: { in: partyIds.length ? partyIds : ["__none__"] } } });
  await prisma.gameCard.deleteMany({ where: { gameRoundId: { in: roundIds.length ? roundIds : ["__none__"] } } });
  await prisma.gameMediaAsset.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameEvidence.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameFinalReveal.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameRound.deleteMany({ where: { id: { in: roundIds.length ? roundIds : ["__none__"] } } });
  await prisma.gameCharacter.deleteMany({ where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.gameVersion.deleteMany({ where: { id: { in: versionIds.length ? versionIds : ["__none__"] } } });
  await prisma.product.deleteMany({ where: { gameId: { in: gameIds.length ? gameIds : ["__none__"] } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds.length ? gameIds : ["__none__"] } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds.length ? userIds : ["__none__"] } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds.length ? userIds : ["__none__"] } } });
}

test("createPartyRecord creates guests, round states, and final reveal state", async () => {
  const label = crypto.randomBytes(6).toString("hex");
  const slugPrefix = "test-party-create-";
  const slug = `${slugPrefix}${label}`;
  const emailDomain = `@${slug}.example`;

  await deleteTestData(slugPrefix, emailDomain);

  const host = await prisma.user.create({
    data: {
      name: "Party Creation Host",
      email: `host${emailDomain}`,
      role: "HOST",
      passwordHash: "test"
    }
  });
  const game = await prisma.game.create({
    data: {
      slug,
      title: "Party Creation Test Game",
      tagline: "Disposable party creation test",
      description: "Used only by party creation tests.",
      minPlayers: 4,
      maxPlayers: 8,
      durationMin: 120,
      durationMax: 180,
      status: "PUBLISHED",
      versions: {
        create: {
          versionNumber: 1,
          status: "PUBLISHED",
          themes: ["test"]
        }
      }
    },
    include: { versions: true }
  });
  const version = game.versions[0];

  try {
    const character = await prisma.gameCharacter.create({
      data: {
        gameVersionId: version.id,
        key: "test-character",
        name: "Test Character",
        publicBio: "Visible test character.",
        isRequired: true,
        sortOrder: 1
      }
    });
    const [roundOne, roundTwo] = await Promise.all([
      prisma.gameRound.create({
        data: {
          gameVersionId: version.id,
          key: "round-one",
          title: "Round One",
          summary: "Opening round.",
          sortOrder: 1
        }
      }),
      prisma.gameRound.create({
        data: {
          gameVersionId: version.id,
          key: "round-two",
          title: "Round Two",
          summary: "Investigation round.",
          sortOrder: 2
        }
      })
    ]);
    await prisma.gameFinalReveal.create({
      data: {
        gameVersionId: version.id,
        victimCharacterId: character.id,
        killerCharacterId: character.id,
        title: "Party Creation Final Reveal",
        victimRevealText: "Victim reveal.",
        killerRevealText: "Killer reveal.",
        solutionText: "Solution.",
        epilogueText: "Epilogue."
      }
    });

    const party = await createPartyRecord({
      hostId: host.id,
      title: "  Opening Night  ",
      gameSlug: slug,
      guestInvites: `Alex Reed, ALEX${emailDomain}\nbackup${emailDomain}`
    });

    assert.ok(party);
    const savedParty = await prisma.party.findUniqueOrThrow({
      where: { id: party.id },
      include: {
        guests: { orderBy: { email: "asc" } },
        roundStates: { orderBy: { gameRoundId: "asc" } },
        finalRevealState: true
      }
    });

    assert.equal(savedParty.title, "Opening Night");
    assert.equal(savedParty.hostId, host.id);
    assert.equal(savedParty.gameId, game.id);
    assert.equal(savedParty.gameVersionId, version.id);
    assert.match(savedParty.inviteCode, /^[0-9A-F]{8}$/);
    assert.deepEqual(
      savedParty.guests.map((guest) => ({ name: guest.name, email: guest.email, status: guest.status })),
      [
        { name: "Alex Reed", email: `alex${emailDomain}`, status: "INVITED" },
        { name: `backup${emailDomain}`, email: `backup${emailDomain}`, status: "INVITED" }
      ]
    );
    assert.deepEqual(
      savedParty.roundStates
        .map((roundState) => roundState.gameRoundId)
        .sort(),
      [roundOne.id, roundTwo.id].sort()
    );
    assert.ok(savedParty.roundStates.every((roundState) => roundState.status === "LOCKED"));
    assert.ok(savedParty.finalRevealState);

    const queuedInvitations = await prisma.outboundMessage.findMany({
      where: {
        partyId: savedParty.id,
        channel: "EMAIL",
        templateKey: "party_invitation"
      },
      orderBy: { recipient: "asc" },
      select: {
        recipient: true,
        subject: true,
        status: true
      }
    });
    assert.deepEqual(queuedInvitations, [
      {
        recipient: `alex${emailDomain}`,
        subject: "Invitation: Opening Night",
        status: "PENDING"
      },
      {
        recipient: `backup${emailDomain}`,
        subject: "Invitation: Opening Night",
        status: "PENDING"
      }
    ]);

    const missingParty = await createPartyRecord({
      hostId: host.id,
      title: "Missing Game",
      gameSlug: `${slug}-missing`
    });
    assert.equal(missingParty, null);
  } finally {
    await deleteTestData(slugPrefix, emailDomain);
  }
});
