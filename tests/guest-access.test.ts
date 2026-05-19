import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.TEST_BASE_URL;
const prisma = new PrismaClient();

function guestCookie(token: string) {
  return `maca_guest=${token}`;
}

function locationPath(location: string | null) {
  if (!location) return null;
  return location.startsWith("http") ? new URL(location).pathname : location;
}

async function deleteGuestAccessData(slug: string, emailDomain: string) {
  const game = await prisma.game.findUnique({
    where: { slug },
    select: { id: true }
  });
  const gameIds = game ? [game.id] : [];

  const userIds = (
    await prisma.user.findMany({
      where: { email: { endsWith: emailDomain } },
      select: { id: true }
    })
  ).map((user) => user.id);

  const partyIds = (
    await prisma.party.findMany({
      where: {
        OR: [
          { gameId: { in: gameIds.length ? gameIds : ["__none__"] } },
          { hostId: { in: userIds.length ? userIds : ["__none__"] } }
        ]
      },
      select: { id: true }
    })
  ).map((party) => party.id);

  const versionIds = gameIds.length
    ? (
        await prisma.gameVersion.findMany({
          where: { gameId: { in: gameIds } },
          select: { id: true }
        })
      ).map((version) => version.id)
    : [];

  const roundIds = versionIds.length
    ? (
        await prisma.gameRound.findMany({
          where: { gameVersionId: { in: versionIds } },
          select: { id: true }
        })
      ).map((round) => round.id)
    : [];

  await prisma.partyCharacterAssignment.deleteMany({ where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { partyId: { in: partyIds.length ? partyIds : ["__none__"] } },
        { userId: { in: userIds.length ? userIds : ["__none__"] } }
      ]
    }
  });
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

async function createGuestAccessFixture() {
  const label = crypto.randomBytes(6).toString("hex");
  const slug = `test-guest-access-${label}`;
  const emailDomain = `@${slug}.example`;

  await deleteGuestAccessData(slug, emailDomain);

  const host = await prisma.user.create({
    data: {
      name: "Guest Access Host",
      email: `host${emailDomain}`,
      role: "HOST",
      passwordHash: "test"
    }
  });

  const game = await prisma.game.create({
    data: {
      slug,
      title: "Guest Access Test Game",
      tagline: "Disposable guest access game",
      description: "Used only for guest access tests.",
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
  const character = await prisma.gameCharacter.create({
    data: {
      gameVersionId: version.id,
      key: "detective",
      name: "Detective Test",
      publicBio: "Assigned test character.",
      isRequired: true,
      sortOrder: 1
    }
  });
  const killerCharacter = await prisma.gameCharacter.create({
    data: {
      gameVersionId: version.id,
      key: "killer",
      name: "Killer Test",
      publicBio: "Second test character.",
      isRequired: true,
      sortOrder: 2
    }
  });
  const round = await prisma.gameRound.create({
    data: {
      gameVersionId: version.id,
      key: "round-one",
      title: "Round One",
      summary: "Active test round.",
      sortOrder: 1
    }
  });

  await prisma.gameCard.createMany({
    data: [
      {
        gameRoundId: round.id,
        key: "public-card",
        title: "Visible Public Card",
        body: "Public card body.",
        visibility: "PUBLIC",
        sortOrder: 1
      },
      {
        gameRoundId: round.id,
        characterId: character.id,
        key: "private-card",
        title: "Visible Private Card",
        body: "Private card body.",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 2
      },
      {
        gameRoundId: round.id,
        key: "host-safe-card",
        title: "Hidden Host Safe Card",
        body: "Host safe card body.",
        visibility: "HOST_SAFE",
        sortOrder: 3
      },
      {
        gameRoundId: round.id,
        key: "spoiler-card",
        title: "Hidden Spoiler Card",
        body: "Spoiler card body.",
        visibility: "SPOILER_PROTECTED",
        sortOrder: 4
      }
    ]
  });

  const [publicEvidence, privateEvidence, hostSafeEvidence, spoilerEvidence] = await Promise.all([
    prisma.gameEvidence.create({
      data: {
        gameVersionId: version.id,
        gameRoundId: round.id,
        key: "public-evidence",
        title: "Visible Public Evidence",
        body: "Public evidence body.",
        evidenceType: "DOCUMENT",
        visibility: "PUBLIC",
        sortOrder: 1
      }
    }),
    prisma.gameEvidence.create({
      data: {
        gameVersionId: version.id,
        gameRoundId: round.id,
        characterId: character.id,
        key: "private-evidence",
        title: "Visible Private Evidence",
        body: "Private evidence body.",
        evidenceType: "IMAGE",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 2
      }
    }),
    prisma.gameEvidence.create({
      data: {
        gameVersionId: version.id,
        gameRoundId: round.id,
        key: "host-safe-evidence",
        title: "Hidden Host Safe Evidence",
        body: "Host safe evidence body.",
        evidenceType: "NOTE",
        visibility: "HOST_SAFE",
        sortOrder: 3
      }
    }),
    prisma.gameEvidence.create({
      data: {
        gameVersionId: version.id,
        gameRoundId: round.id,
        key: "spoiler-evidence",
        title: "Hidden Spoiler Evidence",
        body: "Spoiler evidence body.",
        evidenceType: "DOCUMENT",
        visibility: "SPOILER_PROTECTED",
        sortOrder: 4
      }
    })
  ]);
  const finalReveal = await prisma.gameFinalReveal.create({
    data: {
      gameVersionId: version.id,
      victimCharacterId: character.id,
      killerCharacterId: killerCharacter.id,
      title: "Guest Access Final Reveal",
      victimRevealText: "Victim Test has been revealed.",
      killerRevealText: "Killer Test has been revealed.",
      solutionText: "The test solution is now visible.",
      epilogueText: "The test epilogue is now visible."
    }
  });

  const pendingToken = `pending-guest-${label}`;
  const joinedToken = `joined-guest-${label}`;
  const party = await prisma.party.create({
    data: {
      title: "Guest Access Party",
      gameSlug: game.slug,
      gameId: game.id,
      gameVersionId: version.id,
      hostId: host.id,
      inviteCode: `G${label}`.slice(0, 8).toUpperCase(),
      guests: {
        create: [
          {
            name: "Pending Guest",
            email: `pending${emailDomain}`,
            status: "PENDING_APPROVAL",
            guestToken: pendingToken
          },
          {
            name: "Joined Guest",
            email: `joined${emailDomain}`,
            status: "JOINED",
            guestToken: joinedToken
          }
        ]
      },
      roundStates: {
        create: {
          gameRoundId: round.id,
          status: "ACTIVE",
          unlockedAt: new Date()
        }
      }
    },
    include: { guests: true }
  });

  const joinedGuest = party.guests.find((guest) => guest.guestToken === joinedToken);
  assert.ok(joinedGuest);

  await prisma.partyCharacterAssignment.create({
    data: {
      partyId: party.id,
      guestId: joinedGuest.id,
      characterId: character.id
    }
  });

  await prisma.partyFinalRevealState.create({
    data: {
      partyId: party.id,
      finalRevealId: finalReveal.id
    }
  });

  await prisma.partyEvidenceReveal.createMany({
    data: [publicEvidence, privateEvidence, hostSafeEvidence, spoilerEvidence].map((evidence) => ({
      partyId: party.id,
      evidenceId: evidence.id,
      revealedByUserId: host.id
    }))
  });

  return {
    slug,
    emailDomain,
    pendingToken,
    joinedToken,
    partyId: party.id,
    characterId: character.id
  };
}

test(
  "guest play access handles invalid, pending, and joined guest cookies",
  { skip: baseUrl ? false : "Set TEST_BASE_URL to check the running app." },
  async () => {
    assert.ok(baseUrl);
    const appUrl = baseUrl;
    const fixture = await createGuestAccessFixture();

    try {
      const invalidGuestResponse = await fetch(`${appUrl}/play`, {
        headers: { cookie: guestCookie("not-a-real-guest") },
        redirect: "manual"
      });
      assert.ok([307, 308].includes(invalidGuestResponse.status));
      assert.equal(locationPath(invalidGuestResponse.headers.get("location")), "/join");

      const pendingGuestResponse = await fetch(`${appUrl}/play`, {
        headers: { cookie: guestCookie(fixture.pendingToken) }
      });
      assert.equal(pendingGuestResponse.status, 200);
      const pendingHtml = await pendingGuestResponse.text();
      assert.match(pendingHtml, /Awaiting host approval/);
      assert.doesNotMatch(pendingHtml, /Visible Public Card/);
      assert.doesNotMatch(pendingHtml, /Visible Public Evidence/);

      const joinedGuestResponse = await fetch(`${appUrl}/play`, {
        headers: { cookie: guestCookie(fixture.joinedToken) }
      });
      assert.equal(joinedGuestResponse.status, 200);
      const joinedHtml = await joinedGuestResponse.text();
      assert.match(joinedHtml, /Visible Public Card/);
      assert.match(joinedHtml, /Visible Private Card/);
      assert.match(joinedHtml, /Visible Public Evidence/);
      assert.match(joinedHtml, /Visible Private Evidence/);
      assert.doesNotMatch(joinedHtml, /Victim Test has been revealed/);
      assert.doesNotMatch(joinedHtml, /Killer Test has been revealed/);
      assert.doesNotMatch(joinedHtml, /The test solution is now visible/);
      assert.doesNotMatch(joinedHtml, /Hidden Host Safe Card/);
      assert.doesNotMatch(joinedHtml, /Hidden Spoiler Card/);
      assert.doesNotMatch(joinedHtml, /Hidden Host Safe Evidence/);
      assert.doesNotMatch(joinedHtml, /Hidden Spoiler Evidence/);

      await prisma.partyFinalRevealState.update({
        where: { partyId: fixture.partyId },
        data: { victimRevealedAt: new Date() }
      });

      const victimRevealResponse = await fetch(`${appUrl}/play`, {
        headers: { cookie: guestCookie(fixture.joinedToken) }
      });
      assert.equal(victimRevealResponse.status, 200);
      const victimRevealHtml = await victimRevealResponse.text();
      assert.match(victimRevealHtml, /Victim Test has been revealed/);
      assert.doesNotMatch(victimRevealHtml, /Killer Test has been revealed/);
      assert.doesNotMatch(victimRevealHtml, /The test solution is now visible/);

      await prisma.partyFinalRevealState.update({
        where: { partyId: fixture.partyId },
        data: { finalRevealedAt: new Date() }
      });

      const finalRevealResponse = await fetch(`${appUrl}/play`, {
        headers: { cookie: guestCookie(fixture.joinedToken) }
      });
      assert.equal(finalRevealResponse.status, 200);
      const finalRevealHtml = await finalRevealResponse.text();
      assert.match(finalRevealHtml, /Killer Test has been revealed/);
      assert.match(finalRevealHtml, /The test solution is now visible/);

      const pendingAccusationResponse = await fetch(`${appUrl}/play/accusation`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: guestCookie(fixture.pendingToken)
        },
        body: new URLSearchParams({
          suspectCharacterId: fixture.characterId,
          motiveNotes: "Pending motive",
          evidenceNotes: "Pending evidence",
          accusationText: "Pending accusation"
        }),
        redirect: "manual"
      });
      assert.equal(pendingAccusationResponse.status, 303);
      assert.equal(locationPath(pendingAccusationResponse.headers.get("location")), "/play");

      const accusationsAfterPendingPost = await prisma.partyAccusation.count({
        where: { partyId: fixture.partyId }
      });
      assert.equal(accusationsAfterPendingPost, 0);

      const joinedAccusationResponse = await fetch(`${appUrl}/play/accusation`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: guestCookie(fixture.joinedToken)
        },
        body: new URLSearchParams({
          suspectCharacterId: fixture.characterId,
          motiveNotes: "Joined motive",
          evidenceNotes: "Joined evidence",
          accusationText: "Joined accusation"
        }),
        redirect: "manual"
      });
      assert.equal(joinedAccusationResponse.status, 303);
      assert.equal(locationPath(joinedAccusationResponse.headers.get("location")), "/play");

      const accusationAfterJoinedPost = await prisma.partyAccusation.findFirstOrThrow({
        where: { partyId: fixture.partyId },
        select: {
          suspectCharacterId: true,
          motiveNotes: true,
          evidenceNotes: true,
          accusationText: true
        }
      });
      assert.deepEqual(accusationAfterJoinedPost, {
        suspectCharacterId: fixture.characterId,
        motiveNotes: "Joined motive",
        evidenceNotes: "Joined evidence",
        accusationText: "Joined accusation"
      });
    } finally {
      await deleteGuestAccessData(fixture.slug, fixture.emailDomain);
    }
  }
);
