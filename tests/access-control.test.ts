import assert from "node:assert/strict";
import crypto from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.TEST_BASE_URL;
const prisma = new PrismaClient();

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sessionCookie(token: string) {
  return `maca_session=${token}`;
}

function locationPath(location: string | null) {
  if (!location) return null;
  return location.startsWith("http") ? new URL(location).pathname : location;
}

async function createSession(userId: string, label: string) {
  const token = `test-token-${label}-${crypto.randomBytes(8).toString("hex")}`;
  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  return token;
}

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
  const supportTickets = await prisma.supportTicket.findMany({
    where: {
      OR: [
        { email: { endsWith: emailDomain } },
        { userId: { in: userIds.length ? userIds : ["__none__"] } }
      ]
    },
    select: { id: true }
  });
  const supportTicketIds = supportTickets.map((ticket) => ticket.id);

  await prisma.supportTicketMessage.deleteMany({
    where: { ticketId: { in: supportTicketIds.length ? supportTicketIds : ["__none__"] } }
  });
  await prisma.supportTicket.deleteMany({
    where: { id: { in: supportTicketIds.length ? supportTicketIds : ["__none__"] } }
  });
  await prisma.outboundMessage.deleteMany({
    where: {
      OR: [
        { partyId: { in: partyIds.length ? partyIds : ["__none__"] } },
        { userId: { in: userIds.length ? userIds : ["__none__"] } }
      ]
    }
  });
  await prisma.orderItem.deleteMany({
    where: {
      order: {
        userId: { in: userIds.length ? userIds : ["__none__"] }
      }
    }
  });
  await prisma.order.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : ["__none__"] } },
        { email: { endsWith: emailDomain } }
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
  await prisma.partyCodeAttempt.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyUnlockEvent.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyAssetView.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyPlayerInteraction.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyPlayerInventory.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyToolInstance.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyCharacterAssignment.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyAccusation.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyFinalRevealState.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyResult.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyEvidenceReveal.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.partyRoundState.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.guest.deleteMany({
    where: { partyId: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.party.deleteMany({
    where: { id: { in: partyIds.length ? partyIds : ["__none__"] } }
  });
  await prisma.gameCard.deleteMany({
    where: { gameRoundId: { in: roundIds.length ? roundIds : ["__none__"] } }
  });
  await prisma.gameDigitalArtifact.deleteMany({
    where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } }
  });
  await prisma.gameUnlockRule.deleteMany({
    where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } }
  });
  await prisma.gameCharacterTool.deleteMany({
    where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } }
  });
  await prisma.gameMediaAsset.deleteMany({
    where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } }
  });
  await prisma.gameEvidence.deleteMany({
    where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } }
  });
  await prisma.gameFinalReveal.deleteMany({
    where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } }
  });
  await prisma.gameRound.deleteMany({
    where: { id: { in: roundIds.length ? roundIds : ["__none__"] } }
  });
  await prisma.gameCharacter.deleteMany({
    where: { gameVersionId: { in: versionIds.length ? versionIds : ["__none__"] } }
  });
  await prisma.gameVersion.deleteMany({
    where: { id: { in: versionIds.length ? versionIds : ["__none__"] } }
  });
  await prisma.product.deleteMany({
    where: { gameId: { in: gameIds.length ? gameIds : ["__none__"] } }
  });
  await prisma.game.deleteMany({
    where: { id: { in: gameIds.length ? gameIds : ["__none__"] } }
  });
  await prisma.userSession.deleteMany({
    where: { userId: { in: userIds.length ? userIds : ["__none__"] } }
  });
  await prisma.user.deleteMany({
    where: { id: { in: userIds.length ? userIds : ["__none__"] } }
  });
}

async function createAccessFixture() {
  const label = crypto.randomBytes(6).toString("hex");
  const slug = `test-access-${label}`;
  const emailDomain = `@${slug}.example`;

  await deleteTestData("test-access-", emailDomain);

  const [owner, otherHost, admin] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Access Owner",
        email: `owner${emailDomain}`,
        role: "HOST",
        passwordHash: "test"
      }
    }),
    prisma.user.create({
      data: {
        name: "Other Host",
        email: `other${emailDomain}`,
        role: "HOST",
        passwordHash: "test"
      }
    }),
    prisma.user.create({
      data: {
        name: "Access Admin",
        email: `admin${emailDomain}`,
        role: "ADMIN",
        passwordHash: "test"
      }
    })
  ]);

  const game = await prisma.game.create({
    data: {
      slug,
      title: "Access Control Test Game",
      tagline: "Disposable test game",
      description: "Used only by access-control tests.",
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
  const product = await prisma.product.create({
    data: {
      gameId: game.id,
      slug: `${slug}-product`,
      name: "Access Control Product",
      priceCents: 2999,
      currency: "USD",
      status: "ACTIVE"
    }
  });
  const [character, previousRound, round] = await Promise.all([
    prisma.gameCharacter.create({
      data: {
        gameVersionId: version.id,
        key: "test-character",
        name: "Test Character",
        publicBio: "Visible test character.",
        isRequired: true,
        sortOrder: 1
      }
    }),
    prisma.gameRound.create({
      data: {
        gameVersionId: version.id,
        key: "round-two",
        title: "Round Two",
        summary: "Previously active test round.",
        sortOrder: 2
      }
    }),
    prisma.gameRound.create({
      data: {
        gameVersionId: version.id,
        key: "round-three",
        title: "Round Three",
        summary: "Test reveal round.",
        sortOrder: 3
      }
    })
  ]);

  const evidence = await prisma.gameEvidence.create({
    data: {
      gameVersionId: version.id,
      gameRoundId: round.id,
      key: "test-evidence",
      title: "Test Evidence",
      body: "Evidence used by access-control tests.",
      evidenceType: "TEXT",
      visibility: "PUBLIC",
      sortOrder: 1
    }
  });
  const finalReveal = await prisma.gameFinalReveal.create({
    data: {
      gameVersionId: version.id,
      victimCharacterId: character.id,
      killerCharacterId: character.id,
      title: "Access Control Final Reveal",
      victimRevealText: "Access victim reveal.",
      killerRevealText: "Access killer reveal.",
      solutionText: "Access solution.",
      epilogueText: "Access epilogue."
    }
  });

  const party = await prisma.party.create({
    data: {
      title: "Access Control Party",
      gameSlug: game.slug,
      gameId: game.id,
      gameVersionId: version.id,
      hostId: owner.id,
      inviteCode: `T${label}`.slice(0, 8).toUpperCase(),
      guests: {
        create: [
          {
            name: "Joined Guest",
            email: `guest${emailDomain}`,
            status: "JOINED",
            guestToken: `guest-token-${label}`
          },
          {
            name: "Backup Guest",
            email: `backup${emailDomain}`,
            status: "JOINED",
            guestToken: `backup-guest-token-${label}`
          },
          {
            name: "Invited Guest",
            email: `invited${emailDomain}`,
            status: "INVITED",
            guestToken: `invited-guest-token-${label}`
          },
          {
            name: "Pending Guest",
            email: `pending${emailDomain}`,
            status: "PENDING_APPROVAL",
            guestToken: `pending-guest-token-${label}`
          }
        ]
      },
      roundStates: {
        create: [
          {
            gameRoundId: previousRound.id,
            status: "ACTIVE",
            unlockedAt: new Date()
          },
          {
            gameRoundId: round.id
          }
        ]
      },
      finalRevealState: {
        create: {
          finalRevealId: finalReveal.id
        }
      }
    },
    include: {
      guests: true,
      roundStates: true
    }
  });
  const primaryGuest = party.guests.find((guest) => guest.guestToken === `guest-token-${label}`);
  const replacementGuest = party.guests.find((guest) => guest.guestToken === `backup-guest-token-${label}`);
  const invitedGuest = party.guests.find((guest) => guest.guestToken === `invited-guest-token-${label}`);
  const pendingGuest = party.guests.find((guest) => guest.guestToken === `pending-guest-token-${label}`);
  const previousRoundState = party.roundStates.find((roundState) => roundState.gameRoundId === previousRound.id);
  const revealRoundState = party.roundStates.find((roundState) => roundState.gameRoundId === round.id);
  assert.ok(primaryGuest);
  assert.ok(replacementGuest);
  assert.ok(invitedGuest);
  assert.ok(pendingGuest);
  assert.ok(previousRoundState);
  assert.ok(revealRoundState);

  return {
    emailDomain,
    slugPrefix: "test-access-",
    gameId: game.id,
    gameSlug: game.slug,
    productId: product.id,
    ownerId: owner.id,
    otherHostId: otherHost.id,
    adminId: admin.id,
    ownerToken: await createSession(owner.id, `owner-${label}`),
    otherHostToken: await createSession(otherHost.id, `other-${label}`),
    adminToken: await createSession(admin.id, `admin-${label}`),
    versionId: version.id,
    partyId: party.id,
    guestId: primaryGuest.id,
    replacementGuestId: replacementGuest.id,
    invitedGuestId: invitedGuest.id,
    pendingGuestId: pendingGuest.id,
    characterId: character.id,
    roundId: round.id,
    previousRoundStateId: previousRoundState.id,
    roundStateId: revealRoundState.id,
    evidenceId: evidence.id
  };
}

test(
  "protected host and player pages redirect unauthenticated users",
  { skip: baseUrl ? false : "Set TEST_BASE_URL to check the running app." },
  async () => {
    assert.ok(baseUrl);
    const appUrl = baseUrl;

    const protectedRoutes: Array<{ route: string; redirectLocation: string }> = [
      { route: "/dashboard", redirectLocation: "/login" },
      { route: "/host/create", redirectLocation: "/login" },
      { route: "/play", redirectLocation: "/join" }
    ];

    for (const protectedRoute of protectedRoutes) {
      const response: Response = await fetch(`${appUrl}${protectedRoute.route}`, { redirect: "manual" });
      assert.ok([307, 308].includes(response.status), `${protectedRoute.route} should redirect`);
      assert.equal(locationPath(response.headers.get("location")), protectedRoute.redirectLocation);
    }
  }
);

test(
  "admin page redirects unauthenticated users, hides from non-admins, and opens for admins",
  { skip: baseUrl ? false : "Set TEST_BASE_URL to check the running app." },
  async () => {
    assert.ok(baseUrl);
    const appUrl = baseUrl;
    const label = crypto.randomBytes(6).toString("hex");
    const emailDomain = `@test-admin-access-${label}.example`;
    const slugPrefix = "test-admin-access-";

    await deleteTestData(slugPrefix, emailDomain);

    const [admin, host] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Admin Access Test Admin",
          email: `admin${emailDomain}`,
          role: "ADMIN",
          passwordHash: "test"
        }
      }),
      prisma.user.create({
        data: {
          name: "Admin Access Test Host",
          email: `host${emailDomain}`,
          role: "HOST",
          passwordHash: "test"
        }
      })
    ]);
    const [adminToken, hostToken] = await Promise.all([
      createSession(admin.id, `admin-${label}`),
      createSession(host.id, `host-${label}`)
    ]);

    try {
      const unauthenticatedResponse = await fetch(`${appUrl}/admin`, { redirect: "manual" });
      assert.ok([307, 308].includes(unauthenticatedResponse.status));
      assert.equal(locationPath(unauthenticatedResponse.headers.get("location")), "/login");

      const hostResponse = await fetch(`${appUrl}/admin`, {
        headers: { cookie: sessionCookie(hostToken) },
        redirect: "manual"
      });
      assert.equal(hostResponse.status, 404);

      const adminResponse = await fetch(`${appUrl}/admin`, {
        headers: { cookie: sessionCookie(adminToken) },
        redirect: "manual"
      });
      assert.equal(adminResponse.status, 200);
      const adminHtml = await adminResponse.text();
      assert.match(adminHtml, /Admin inventory/);
      assert.match(adminHtml, /Content overview/);
    } finally {
      await deleteTestData(slugPrefix, emailDomain);
    }
  }
);

test(
  "party pages and mutation routes enforce host ownership",
  { skip: baseUrl ? false : "Set TEST_BASE_URL to check the running app." },
  async () => {
    assert.ok(baseUrl);
    const appUrl = baseUrl;

    const fixture = await createAccessFixture();

    try {
      const ownerPartyResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}`, {
        headers: { cookie: sessionCookie(fixture.ownerToken) },
        redirect: "manual"
      });
      assert.equal(ownerPartyResponse.status, 200);
      const ownerPartyHtml = await ownerPartyResponse.text();
      assert.match(ownerPartyHtml, /Host spoiler mode/);
      assert.doesNotMatch(ownerPartyHtml, /Access solution/);

      const otherHostPartyResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}`, {
        headers: { cookie: sessionCookie(fixture.otherHostToken) },
        redirect: "manual"
      });
      assert.equal(otherHostPartyResponse.status, 404);

      const deniedSpoilerModeResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/spoiler-mode`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: new URLSearchParams({
          confirmSpoilerMode: "on"
        }),
        redirect: "manual"
      });
      assert.equal(deniedSpoilerModeResponse.status, 303);
      assert.equal(locationPath(deniedSpoilerModeResponse.headers.get("location")), "/dashboard");

      const unconfirmedSpoilerModeResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/spoiler-mode`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({}),
        redirect: "manual"
      });
      assert.equal(unconfirmedSpoilerModeResponse.status, 303);
      assert.equal(
        locationPath(unconfirmedSpoilerModeResponse.headers.get("location")),
        `/host/party/${fixture.partyId}`
      );
      const partyAfterUnconfirmedSpoilerPost = await prisma.party.findUniqueOrThrow({
        where: { id: fixture.partyId },
        select: { hostSpoilerUnlockedAt: true }
      });
      assert.equal(partyAfterUnconfirmedSpoilerPost.hostSpoilerUnlockedAt, null);

      const ownerSpoilerModeResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/spoiler-mode`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          confirmSpoilerMode: "on"
        }),
        redirect: "manual"
      });
      assert.equal(ownerSpoilerModeResponse.status, 303);
      assert.equal(locationPath(ownerSpoilerModeResponse.headers.get("location")), `/host/party/${fixture.partyId}`);

      const partyAfterSpoilerPost = await prisma.party.findUniqueOrThrow({
        where: { id: fixture.partyId },
        select: { hostSpoilerUnlockedAt: true, hostSpoilerUnlockedByUserId: true }
      });
      assert.ok(partyAfterSpoilerPost.hostSpoilerUnlockedAt);
      assert.equal(partyAfterSpoilerPost.hostSpoilerUnlockedByUserId, fixture.ownerId);

      const spoilerUnlockedPartyResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}`, {
        headers: { cookie: sessionCookie(fixture.ownerToken) }
      });
      assert.equal(spoilerUnlockedPartyResponse.status, 200);
      const spoilerUnlockedPartyHtml = await spoilerUnlockedPartyResponse.text();
      assert.match(spoilerUnlockedPartyHtml, /Spoilers unlocked/);
      assert.match(spoilerUnlockedPartyHtml, /Access solution/);

      const deniedAssignmentResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/assign`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: new URLSearchParams({
          characterId: fixture.characterId,
          guestId: fixture.guestId
        }),
        redirect: "manual"
      });
      assert.equal(deniedAssignmentResponse.status, 303);
      assert.equal(locationPath(deniedAssignmentResponse.headers.get("location")), "/dashboard");

      const assignmentsAfterDeniedPost = await prisma.partyCharacterAssignment.count({
        where: { partyId: fixture.partyId }
      });
      assert.equal(assignmentsAfterDeniedPost, 0);

      const ownerAssignmentResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/assign`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          characterId: fixture.characterId,
          guestId: fixture.guestId
        }),
        redirect: "manual"
      });
      assert.equal(ownerAssignmentResponse.status, 303);
      assert.equal(locationPath(ownerAssignmentResponse.headers.get("location")), `/host/party/${fixture.partyId}`);

      const assignmentsAfterOwnerPost = await prisma.partyCharacterAssignment.findMany({
        where: { partyId: fixture.partyId },
        select: {
          characterId: true,
          guestId: true
        }
      });
      assert.deepEqual(assignmentsAfterOwnerPost, [
        {
          characterId: fixture.characterId,
          guestId: fixture.guestId
        }
      ]);

      const replacementAssignmentResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/assign`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          characterId: fixture.characterId,
          guestId: fixture.replacementGuestId
        }),
        redirect: "manual"
      });
      assert.equal(replacementAssignmentResponse.status, 303);

      const assignmentsAfterReplacement = await prisma.partyCharacterAssignment.findMany({
        where: { partyId: fixture.partyId },
        select: {
          characterId: true,
          guestId: true
        }
      });
      assert.deepEqual(assignmentsAfterReplacement, [
        {
          characterId: fixture.characterId,
          guestId: fixture.replacementGuestId
        }
      ]);

      const clearAssignmentResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/assign`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          characterId: fixture.characterId,
          guestId: ""
        }),
        redirect: "manual"
      });
      assert.equal(clearAssignmentResponse.status, 303);

      const assignmentsAfterClear = await prisma.partyCharacterAssignment.count({
        where: { partyId: fixture.partyId }
      });
      assert.equal(assignmentsAfterClear, 0);

      const invitedAssignmentResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/assign`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          characterId: fixture.characterId,
          guestId: fixture.invitedGuestId
        }),
        redirect: "manual"
      });
      assert.equal(invitedAssignmentResponse.status, 303);

      const assignmentsAfterInvitedPost = await prisma.partyCharacterAssignment.findMany({
        where: { partyId: fixture.partyId },
        select: {
          characterId: true,
          guestId: true
        }
      });
      assert.deepEqual(assignmentsAfterInvitedPost, [
        {
          characterId: fixture.characterId,
          guestId: fixture.invitedGuestId
        }
      ]);

      const pendingAssignmentResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/assign`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          characterId: fixture.characterId,
          guestId: fixture.pendingGuestId
        }),
        redirect: "manual"
      });
      assert.equal(pendingAssignmentResponse.status, 303);

      const assignmentsAfterPendingPost = await prisma.partyCharacterAssignment.findMany({
        where: { partyId: fixture.partyId },
        select: {
          characterId: true,
          guestId: true
        }
      });
      assert.deepEqual(assignmentsAfterPendingPost, [
        {
          characterId: fixture.characterId,
          guestId: fixture.invitedGuestId
        }
      ]);

      const deniedInviteResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/invite`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: new URLSearchParams({
          guestId: fixture.invitedGuestId
        }),
        redirect: "manual"
      });
      assert.equal(deniedInviteResponse.status, 303);
      assert.equal(locationPath(deniedInviteResponse.headers.get("location")), "/dashboard");

      const inviteMessagesBeforeResend = await prisma.outboundMessage.count({
        where: {
          partyId: fixture.partyId,
          recipient: `invited${fixture.emailDomain}`
        }
      });

      const ownerInviteResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/invite`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          guestId: fixture.invitedGuestId
        }),
        redirect: "manual"
      });
      assert.equal(ownerInviteResponse.status, 303);
      assert.equal(locationPath(ownerInviteResponse.headers.get("location")), `/host/party/${fixture.partyId}`);

      const inviteMessagesAfterResend = await prisma.outboundMessage.count({
        where: {
          partyId: fixture.partyId,
          recipient: `invited${fixture.emailDomain}`
        }
      });
      assert.equal(inviteMessagesAfterResend, inviteMessagesBeforeResend + 1);
      const invitedGuestAfterResend = await prisma.guest.findUniqueOrThrow({
        where: { id: fixture.invitedGuestId },
        select: {
          invitationStatus: true,
          invitationLastQueuedAt: true,
          invitationResendCount: true,
          invitationFailureDetail: true
        }
      });
      assert.equal(invitedGuestAfterResend.invitationStatus, "QUEUED");
      assert.ok(invitedGuestAfterResend.invitationLastQueuedAt);
      assert.equal(invitedGuestAfterResend.invitationResendCount, 1);
      assert.equal(invitedGuestAfterResend.invitationFailureDetail, "");

      const deniedRoundResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/round`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: new URLSearchParams({
          roundStateId: fixture.roundStateId,
          action: "start"
        }),
        redirect: "manual"
      });
      assert.equal(deniedRoundResponse.status, 303);
      assert.equal(locationPath(deniedRoundResponse.headers.get("location")), "/dashboard");

      const roundStateAfterDeniedPost = await prisma.partyRoundState.findUniqueOrThrow({
        where: { id: fixture.roundStateId },
        select: { status: true }
      });
      assert.equal(roundStateAfterDeniedPost.status, "LOCKED");

      const ownerUnlockResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/round`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          roundStateId: fixture.roundStateId,
          action: "unlock"
        }),
        redirect: "manual"
      });
      assert.equal(ownerUnlockResponse.status, 303);
      assert.equal(locationPath(ownerUnlockResponse.headers.get("location")), `/host/party/${fixture.partyId}`);

      const roundStateAfterUnlock = await prisma.partyRoundState.findUniqueOrThrow({
        where: { id: fixture.roundStateId },
        select: { status: true, unlockedAt: true }
      });
      assert.equal(roundStateAfterUnlock.status, "UNLOCKED");
      assert.ok(roundStateAfterUnlock.unlockedAt);

      const ownerStartResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/round`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          roundStateId: fixture.roundStateId,
          action: "start"
        }),
        redirect: "manual"
      });
      assert.equal(ownerStartResponse.status, 303);

      const roundStateAfterStart = await prisma.partyRoundState.findUniqueOrThrow({
        where: { id: fixture.roundStateId },
        select: { status: true, completedAt: true }
      });
      assert.equal(roundStateAfterStart.status, "ACTIVE");
      assert.equal(roundStateAfterStart.completedAt, null);

      const previousRoundStateAfterStart = await prisma.partyRoundState.findUniqueOrThrow({
        where: { id: fixture.previousRoundStateId },
        select: { status: true, completedAt: true }
      });
      assert.equal(previousRoundStateAfterStart.status, "COMPLETED");
      assert.ok(previousRoundStateAfterStart.completedAt);

      const activeRoundCountAfterStart = await prisma.partyRoundState.count({
        where: {
          partyId: fixture.partyId,
          status: "ACTIVE"
        }
      });
      assert.equal(activeRoundCountAfterStart, 1);

      const ownerCompleteResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/round`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          roundStateId: fixture.roundStateId,
          action: "complete"
        }),
        redirect: "manual"
      });
      assert.equal(ownerCompleteResponse.status, 303);

      const roundStateAfterComplete = await prisma.partyRoundState.findUniqueOrThrow({
        where: { id: fixture.roundStateId },
        select: { status: true, completedAt: true }
      });
      assert.equal(roundStateAfterComplete.status, "COMPLETED");
      assert.ok(roundStateAfterComplete.completedAt);

      const ownerRestartResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/round`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          roundStateId: fixture.roundStateId,
          action: "start"
        }),
        redirect: "manual"
      });
      assert.equal(ownerRestartResponse.status, 303);

      const roundStateAfterRestart = await prisma.partyRoundState.findUniqueOrThrow({
        where: { id: fixture.roundStateId },
        select: { status: true, completedAt: true }
      });
      assert.equal(roundStateAfterRestart.status, "ACTIVE");
      assert.equal(roundStateAfterRestart.completedAt, null);

      const deniedEvidenceResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/evidence`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: new URLSearchParams({
          evidenceId: fixture.evidenceId,
          action: "reveal"
        }),
        redirect: "manual"
      });
      assert.equal(deniedEvidenceResponse.status, 303);
      assert.equal(locationPath(deniedEvidenceResponse.headers.get("location")), "/dashboard");

      const evidenceRevealsAfterDeniedPost = await prisma.partyEvidenceReveal.count({
        where: { partyId: fixture.partyId }
      });
      assert.equal(evidenceRevealsAfterDeniedPost, 0);

      const ownerRevealResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/evidence`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          evidenceId: fixture.evidenceId,
          action: "reveal"
        }),
        redirect: "manual"
      });
      assert.equal(ownerRevealResponse.status, 303);
      assert.equal(locationPath(ownerRevealResponse.headers.get("location")), `/host/party/${fixture.partyId}`);

      const evidenceRevealsAfterOwnerPost = await prisma.partyEvidenceReveal.count({
        where: { partyId: fixture.partyId }
      });
      assert.equal(evidenceRevealsAfterOwnerPost, 1);

      const ownerHideResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/evidence`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          evidenceId: fixture.evidenceId,
          action: "hide"
        }),
        redirect: "manual"
      });
      assert.equal(ownerHideResponse.status, 303);
      assert.equal(locationPath(ownerHideResponse.headers.get("location")), `/host/party/${fixture.partyId}`);

      const evidenceRevealsAfterHide = await prisma.partyEvidenceReveal.count({
        where: { partyId: fixture.partyId }
      });
      assert.equal(evidenceRevealsAfterHide, 0);

      const deniedFinalRevealResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/final-reveal`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: new URLSearchParams({
          action: "reveal-final"
        }),
        redirect: "manual"
      });
      assert.equal(deniedFinalRevealResponse.status, 303);
      assert.equal(locationPath(deniedFinalRevealResponse.headers.get("location")), "/dashboard");

      const finalRevealAfterDeniedPost = await prisma.partyFinalRevealState.findUniqueOrThrow({
        where: { partyId: fixture.partyId },
        select: {
          victimRevealedAt: true,
          finalRevealedAt: true
        }
      });
      assert.equal(finalRevealAfterDeniedPost.victimRevealedAt, null);
      assert.equal(finalRevealAfterDeniedPost.finalRevealedAt, null);

      const ownerVictimRevealResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/final-reveal`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          action: "reveal-victim"
        }),
        redirect: "manual"
      });
      assert.equal(ownerVictimRevealResponse.status, 303);

      const finalRevealAfterVictimPost = await prisma.partyFinalRevealState.findUniqueOrThrow({
        where: { partyId: fixture.partyId },
        select: {
          victimRevealedAt: true,
          finalRevealedAt: true
        }
      });
      assert.ok(finalRevealAfterVictimPost.victimRevealedAt);
      assert.equal(finalRevealAfterVictimPost.finalRevealedAt, null);

      const ownerFinalRevealResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/final-reveal`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          action: "reveal-final"
        }),
        redirect: "manual"
      });
      assert.equal(ownerFinalRevealResponse.status, 303);

      const finalRevealAfterFinalPost = await prisma.partyFinalRevealState.findUniqueOrThrow({
        where: { partyId: fixture.partyId },
        select: {
          victimRevealedAt: true,
          finalRevealedAt: true
        }
      });
      assert.ok(finalRevealAfterFinalPost.victimRevealedAt);
      assert.ok(finalRevealAfterFinalPost.finalRevealedAt);

      const ownerCompletePartyResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/status`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          action: "complete"
        }),
        redirect: "manual"
      });
      assert.equal(ownerCompletePartyResponse.status, 303);
      assert.equal(locationPath(ownerCompletePartyResponse.headers.get("location")), `/host/party/${fixture.partyId}`);

      const completedParty = await prisma.party.findUniqueOrThrow({
        where: { id: fixture.partyId },
        select: {
          status: true,
          result: {
            select: {
              completedByUserId: true,
              summary: true
            }
          }
        }
      });
      assert.equal(completedParty.status, "COMPLETED");
      assert.equal(completedParty.result?.completedByUserId, fixture.ownerId);
      assert.equal((completedParty.result?.summary as { guests?: number } | null)?.guests, 4);

      const blockedCompletedAssignmentResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/assign`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          characterId: fixture.characterId,
          guestId: fixture.guestId
        }),
        redirect: "manual"
      });
      assert.equal(blockedCompletedAssignmentResponse.status, 303);

      const assignmentsAfterCompletedPost = await prisma.partyCharacterAssignment.findMany({
        where: { partyId: fixture.partyId },
        select: {
          characterId: true,
          guestId: true
        }
      });
      assert.deepEqual(assignmentsAfterCompletedPost, [
        {
          characterId: fixture.characterId,
          guestId: fixture.invitedGuestId
        }
      ]);

      const ownerReopenPartyResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/status`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          action: "reopen"
        }),
        redirect: "manual"
      });
      assert.equal(ownerReopenPartyResponse.status, 303);

      const reopenedParty = await prisma.party.findUniqueOrThrow({
        where: { id: fixture.partyId },
        select: { status: true }
      });
      assert.equal(reopenedParty.status, "ACTIVE");

      const ownerHideFinalResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}/final-reveal`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          action: "hide-final"
        }),
        redirect: "manual"
      });
      assert.equal(ownerHideFinalResponse.status, 303);

      const finalRevealAfterHideFinalPost = await prisma.partyFinalRevealState.findUniqueOrThrow({
        where: { partyId: fixture.partyId },
        select: {
          victimRevealedAt: true,
          finalRevealedAt: true
        }
      });
      assert.ok(finalRevealAfterHideFinalPost.victimRevealedAt);
      assert.equal(finalRevealAfterHideFinalPost.finalRevealedAt, null);

      const unauthenticatedCheckoutResponse = await fetch(`${appUrl}/checkout/start`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          productId: fixture.productId
        }),
        redirect: "manual"
      });
      assert.equal(unauthenticatedCheckoutResponse.status, 303);
      assert.equal(locationPath(unauthenticatedCheckoutResponse.headers.get("location")), "/login");

      const checkoutPlaceholderResponse = await fetch(`${appUrl}/checkout/start`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          productId: fixture.productId
        }),
        redirect: "manual"
      });
      assert.ok([303, 501, 502].includes(checkoutPlaceholderResponse.status));
      if (checkoutPlaceholderResponse.status === 303) {
        const checkoutLocation = checkoutPlaceholderResponse.headers.get("location") ?? "";
        assert.match(checkoutLocation, /^https:\/\/checkout\.stripe\.com\//);
      } else {
        const checkoutPlaceholderBody = await checkoutPlaceholderResponse.json();
        assert.match(checkoutPlaceholderBody.error, /Payment provider is not configured yet|STRIPE_SECRET_KEY is not configured|Stripe/);
      }

      await prisma.userGameAccess.create({
        data: {
          userId: fixture.ownerId,
          gameId: fixture.gameId,
          productId: fixture.productId,
          source: "ORDER",
          status: "ACTIVE"
        }
      });

      const checkoutWithAccessResponse = await fetch(`${appUrl}/checkout/start`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.ownerToken)
        },
        body: new URLSearchParams({
          productId: fixture.productId
        }),
        redirect: "manual"
      });
      assert.equal(checkoutWithAccessResponse.status, 303);
      assert.equal(
        locationPath(checkoutWithAccessResponse.headers.get("location")),
        `/host/create`
      );
      assert.equal(new URL(checkoutWithAccessResponse.headers.get("location") ?? "", appUrl).searchParams.get("game"), fixture.gameSlug);

      const supportTicket = await prisma.supportTicket.create({
        data: {
          userId: fixture.otherHostId,
          email: `support${fixture.emailDomain}`,
          subject: "Access support test",
          message: "Support ticket for admin status route tests."
        }
      });

      const deniedSupportStatusResponse = await fetch(`${appUrl}/admin/support/${supportTicket.id}/status`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: new URLSearchParams({
          status: "PENDING"
        }),
        redirect: "manual"
      });
      assert.equal(deniedSupportStatusResponse.status, 303);
      assert.equal(locationPath(deniedSupportStatusResponse.headers.get("location")), "/dashboard");

      const adminSupportStatusResponse = await fetch(`${appUrl}/admin/support/${supportTicket.id}/status`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.adminToken)
        },
        body: new URLSearchParams({
          status: "PENDING"
        }),
        redirect: "manual"
      });
      assert.equal(adminSupportStatusResponse.status, 303);
      assert.equal(
        locationPath(adminSupportStatusResponse.headers.get("location")),
        `/admin/support/${supportTicket.id}`
      );

      const supportTicketAfterAdminPost = await prisma.supportTicket.findUniqueOrThrow({
        where: { id: supportTicket.id },
        select: { status: true }
      });
      assert.equal(supportTicketAfterAdminPost.status, "PENDING");

      const deniedSupportMessageResponse = await fetch(`${appUrl}/admin/support/${supportTicket.id}/message`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: new URLSearchParams({
          messageType: "INTERNAL_NOTE",
          body: "Denied note."
        }),
        redirect: "manual"
      });
      assert.equal(deniedSupportMessageResponse.status, 303);
      assert.equal(locationPath(deniedSupportMessageResponse.headers.get("location")), "/dashboard");

      const adminSupportNoteResponse = await fetch(`${appUrl}/admin/support/${supportTicket.id}/message`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.adminToken)
        },
        body: new URLSearchParams({
          messageType: "INTERNAL_NOTE",
          body: "Internal access-control note."
        }),
        redirect: "manual"
      });
      assert.equal(adminSupportNoteResponse.status, 303);
      assert.equal(
        locationPath(adminSupportNoteResponse.headers.get("location")),
        `/admin/support/${supportTicket.id}`
      );

      const adminSupportReplyResponse = await fetch(`${appUrl}/admin/support/${supportTicket.id}/message`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.adminToken)
        },
        body: new URLSearchParams({
          messageType: "CUSTOMER_REPLY",
          body: "Customer-facing access-control reply."
        }),
        redirect: "manual"
      });
      assert.equal(adminSupportReplyResponse.status, 303);
      assert.equal(
        locationPath(adminSupportReplyResponse.headers.get("location")),
        `/admin/support/${supportTicket.id}`
      );

      const supportMessages = await prisma.supportTicketMessage.findMany({
        where: { ticketId: supportTicket.id },
        orderBy: { createdAt: "asc" },
        select: {
          messageType: true,
          body: true,
          outboundMessageId: true
        }
      });
      assert.deepEqual(
        supportMessages.map((message) => ({ messageType: message.messageType, body: message.body })),
        [
          { messageType: "INTERNAL_NOTE", body: "Internal access-control note." },
          { messageType: "CUSTOMER_REPLY", body: "Customer-facing access-control reply." }
        ]
      );
      assert.ok(supportMessages[1]?.outboundMessageId);
      const supportReplyOutboundCount = await prisma.outboundMessage.count({
        where: {
          recipient: `support${fixture.emailDomain}`,
          templateKey: "support_reply"
        }
      });
      assert.equal(supportReplyOutboundCount, 1);

      const deniedVersionStatusResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.otherHostToken)
          },
          body: new URLSearchParams({
            status: "DRAFT"
          }),
          redirect: "manual"
        }
      );
      assert.equal(deniedVersionStatusResponse.status, 303);
      assert.equal(locationPath(deniedVersionStatusResponse.headers.get("location")), "/dashboard");

      const adminDraftVersionResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            status: "DRAFT"
          }),
          redirect: "manual"
        }
      );
      assert.equal(adminDraftVersionResponse.status, 303);
      assert.equal(locationPath(adminDraftVersionResponse.headers.get("location")), `/admin/games/${fixture.gameId}`);

      const draftVersion = await prisma.gameVersion.findUniqueOrThrow({
        where: { id: fixture.versionId },
        select: { status: true, publishedAt: true }
      });
      assert.equal(draftVersion.status, "DRAFT");
      assert.equal(draftVersion.publishedAt, null);

      const deniedCharacterResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/characters`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.otherHostToken)
          },
          body: new URLSearchParams({
            key: "denied-character",
            name: "Denied Character",
            publicBio: "Denied character edit.",
            privateBio: "",
            sortOrder: "2",
            isRequired: "on"
          }),
          redirect: "manual"
        }
      );
      assert.equal(deniedCharacterResponse.status, 303);
      assert.equal(locationPath(deniedCharacterResponse.headers.get("location")), "/dashboard");

      const adminCharacterCreateResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/characters`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            key: "additional-suspect",
            name: "Additional Suspect",
            publicBio: "Added by access-control tests.",
            privateBio: "Private addition from access-control tests.",
            sortOrder: "2",
            isRequired: "on"
          }),
          redirect: "manual"
        }
      );
      assert.equal(adminCharacterCreateResponse.status, 303);
      assert.equal(
        locationPath(adminCharacterCreateResponse.headers.get("location")),
        `/admin/games/${fixture.gameId}`
      );

      const additionalCharacter = await prisma.gameCharacter.findUniqueOrThrow({
        where: {
          gameVersionId_key: {
            gameVersionId: fixture.versionId,
            key: "additional-suspect"
          }
        },
        select: { name: true, privateBio: true, isRequired: true }
      });
      assert.deepEqual(additionalCharacter, {
        name: "Additional Suspect",
        privateBio: "Private addition from access-control tests.",
        isRequired: true
      });

      const duplicateCharacterResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/characters`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            key: "additional-suspect",
            name: "Duplicate Suspect",
            publicBio: "Duplicate character edit.",
            privateBio: "",
            sortOrder: "3",
            isRequired: "on"
          }),
          redirect: "manual"
        }
      );
      assert.equal(duplicateCharacterResponse.status, 303);
      assert.match(duplicateCharacterResponse.headers.get("location") ?? "", /error=duplicate-character/);

      const adminCharacterUpdateResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/characters`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            characterId: fixture.characterId,
            key: "test-character-edited",
            name: "Edited Test Character",
            publicBio: "Edited character public bio.",
            privateBio: "Edited character private bio.",
            sortOrder: "10"
          }),
          redirect: "manual"
        }
      );
      assert.equal(adminCharacterUpdateResponse.status, 303);
      assert.equal(
        locationPath(adminCharacterUpdateResponse.headers.get("location")),
        `/admin/games/${fixture.gameId}`
      );

      const editedCharacter = await prisma.gameCharacter.findUniqueOrThrow({
        where: { id: fixture.characterId },
        select: {
          key: true,
          name: true,
          publicBio: true,
          privateBio: true,
          isRequired: true,
          sortOrder: true
        }
      });
      assert.deepEqual(editedCharacter, {
        key: "test-character-edited",
        name: "Edited Test Character",
        publicBio: "Edited character public bio.",
        privateBio: "Edited character private bio.",
        isRequired: false,
        sortOrder: 10
      });

      const characterAuditActions = await prisma.auditLog.findMany({
        where: {
          userId: fixture.adminId,
          action: { in: ["admin.gameCharacter.created", "admin.gameCharacter.updated"] }
        },
        select: { action: true }
      });
      assert.equal(
        characterAuditActions.filter((auditAction) => auditAction.action === "admin.gameCharacter.created").length,
        1
      );
      assert.equal(
        characterAuditActions.filter((auditAction) => auditAction.action === "admin.gameCharacter.updated").length,
        1
      );

      const deniedAdminRoundResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/rounds`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.otherHostToken)
          },
          body: new URLSearchParams({
            key: "denied-round",
            title: "Denied Round",
            summary: "Denied round edit.",
            sortOrder: "4"
          }),
          redirect: "manual"
        }
      );
      assert.equal(deniedAdminRoundResponse.status, 303);
      assert.equal(locationPath(deniedAdminRoundResponse.headers.get("location")), "/dashboard");

      const adminRoundCreateResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/rounds`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            key: "bonus-round",
            title: "Bonus Round",
            summary: "Added by access-control tests.",
            sortOrder: "4"
          }),
          redirect: "manual"
        }
      );
      assert.equal(adminRoundCreateResponse.status, 303);
      assert.equal(locationPath(adminRoundCreateResponse.headers.get("location")), `/admin/games/${fixture.gameId}`);

      const bonusRound = await prisma.gameRound.findUniqueOrThrow({
        where: {
          gameVersionId_key: {
            gameVersionId: fixture.versionId,
            key: "bonus-round"
          }
        },
        select: { id: true, title: true, sortOrder: true }
      });
      assert.deepEqual(
        { title: bonusRound.title, sortOrder: bonusRound.sortOrder },
        { title: "Bonus Round", sortOrder: 4 }
      );

      const deniedCardResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/cards`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.otherHostToken)
          },
          body: new URLSearchParams({
            roundId: fixture.roundId,
            key: "denied-card",
            title: "Denied Card",
            body: "Denied card edit.",
            visibility: "PUBLIC",
            sortOrder: "1"
          }),
          redirect: "manual"
        }
      );
      assert.equal(deniedCardResponse.status, 303);
      assert.equal(locationPath(deniedCardResponse.headers.get("location")), "/dashboard");

      const adminCardCreateResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/cards`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            roundId: bonusRound.id,
            key: "bonus-public-card",
            title: "Bonus Public Card",
            body: "Added by access-control tests.",
            visibility: "PUBLIC",
            sortOrder: "1"
          }),
          redirect: "manual"
        }
      );
      assert.equal(adminCardCreateResponse.status, 303);
      assert.equal(locationPath(adminCardCreateResponse.headers.get("location")), `/admin/games/${fixture.gameId}`);

      const bonusCard = await prisma.gameCard.findUniqueOrThrow({
        where: {
          gameRoundId_key: {
            gameRoundId: bonusRound.id,
            key: "bonus-public-card"
          }
        },
        select: { title: true, visibility: true, characterId: true }
      });
      assert.deepEqual(bonusCard, {
        title: "Bonus Public Card",
        visibility: "PUBLIC",
        characterId: null
      });

      const duplicateCardResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/cards`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            roundId: bonusRound.id,
            key: "bonus-public-card",
            title: "Duplicate Bonus Card",
            body: "Duplicate card key in the same round.",
            visibility: "PUBLIC",
            sortOrder: "2"
          }),
          redirect: "manual"
        }
      );
      assert.equal(duplicateCardResponse.status, 303);
      assert.match(duplicateCardResponse.headers.get("location") ?? "", /error=duplicate-card/);

      const roundCardAuditActions = await prisma.auditLog.findMany({
        where: {
          userId: fixture.adminId,
          action: { in: ["admin.gameRound.created", "admin.gameCard.created"] }
        },
        select: { action: true }
      });
      assert.equal(
        roundCardAuditActions.filter((auditAction) => auditAction.action === "admin.gameRound.created").length,
        1
      );
      assert.equal(
        roundCardAuditActions.filter((auditAction) => auditAction.action === "admin.gameCard.created").length,
        1
      );

      const deniedAdminEvidenceResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/evidence`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.otherHostToken)
          },
          body: new URLSearchParams({
            gameRoundId: fixture.roundId,
            key: "denied-admin-evidence",
            title: "Denied Admin Evidence",
            body: "Denied evidence edit.",
            evidenceType: "DOCUMENT",
            visibility: "PUBLIC",
            sortOrder: "1"
          }),
          redirect: "manual"
        }
      );
      assert.equal(deniedAdminEvidenceResponse.status, 303);
      assert.equal(locationPath(deniedAdminEvidenceResponse.headers.get("location")), "/dashboard");

      const adminEvidenceCreateResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/evidence`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            gameRoundId: fixture.roundId,
            key: "admin-evidence",
            title: "Admin Evidence",
            body: "Added by access-control tests.",
            evidenceType: "DOCUMENT",
            visibility: "PUBLIC",
            sortOrder: "5"
          }),
          redirect: "manual"
        }
      );
      assert.equal(adminEvidenceCreateResponse.status, 303);
      assert.equal(locationPath(adminEvidenceCreateResponse.headers.get("location")), `/admin/games/${fixture.gameId}`);

      const adminEvidence = await prisma.gameEvidence.findUniqueOrThrow({
        where: {
          gameVersionId_key: {
            gameVersionId: fixture.versionId,
            key: "admin-evidence"
          }
        },
        select: { id: true, title: true, gameRoundId: true, visibility: true }
      });
      assert.deepEqual(
        { title: adminEvidence.title, gameRoundId: adminEvidence.gameRoundId, visibility: adminEvidence.visibility },
        { title: "Admin Evidence", gameRoundId: fixture.roundId, visibility: "PUBLIC" }
      );

      const duplicateEvidenceResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/evidence`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            key: "admin-evidence",
            title: "Duplicate Admin Evidence",
            body: "Duplicate evidence key.",
            evidenceType: "DOCUMENT",
            visibility: "PUBLIC",
            sortOrder: "6"
          }),
          redirect: "manual"
        }
      );
      assert.equal(duplicateEvidenceResponse.status, 303);
      assert.match(duplicateEvidenceResponse.headers.get("location") ?? "", /error=duplicate-evidence/);

      const deniedAdminMediaResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/media`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.otherHostToken)
          },
          body: new URLSearchParams({
            gameRoundId: fixture.roundId,
            evidenceId: adminEvidence.id,
            key: "denied-admin-media",
            title: "Denied Admin Media",
            description: "Denied media edit.",
            assetType: "IMAGE",
            url: "/media/denied-admin-media.png",
            mimeType: "image/png",
            visibility: "PUBLIC",
            sortOrder: "1"
          }),
          redirect: "manual"
        }
      );
      assert.equal(deniedAdminMediaResponse.status, 303);
      assert.equal(locationPath(deniedAdminMediaResponse.headers.get("location")), "/dashboard");

      const adminMediaCreateResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/media`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            gameRoundId: fixture.roundId,
            evidenceId: adminEvidence.id,
            key: "admin-media",
            title: "Admin Media",
            description: "Added by access-control tests.",
            assetType: "IMAGE",
            url: "/media/admin-media.png",
            mimeType: "image/png",
            visibility: "PUBLIC",
            sortOrder: "5"
          }),
          redirect: "manual"
        }
      );
      assert.equal(adminMediaCreateResponse.status, 303);
      assert.equal(locationPath(adminMediaCreateResponse.headers.get("location")), `/admin/games/${fixture.gameId}`);

      const adminMedia = await prisma.gameMediaAsset.findUniqueOrThrow({
        where: {
          gameVersionId_key: {
            gameVersionId: fixture.versionId,
            key: "admin-media"
          }
        },
        select: { title: true, evidenceId: true, assetType: true, url: true }
      });
      assert.deepEqual(adminMedia, {
        title: "Admin Media",
        evidenceId: adminEvidence.id,
        assetType: "IMAGE",
        url: "/media/admin-media.png"
      });

      const duplicateMediaResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/media`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            key: "admin-media",
            title: "Duplicate Admin Media",
            description: "Duplicate media key.",
            assetType: "IMAGE",
            url: "/media/duplicate-admin-media.png",
            mimeType: "image/png",
            visibility: "PUBLIC",
            sortOrder: "6"
          }),
          redirect: "manual"
        }
      );
      assert.equal(duplicateMediaResponse.status, 303);
      assert.match(duplicateMediaResponse.headers.get("location") ?? "", /error=duplicate-media/);

      const evidenceMediaAuditActions = await prisma.auditLog.findMany({
        where: {
          userId: fixture.adminId,
          action: { in: ["admin.gameEvidence.created", "admin.gameMedia.created"] }
        },
        select: { action: true }
      });
      assert.equal(
        evidenceMediaAuditActions.filter((auditAction) => auditAction.action === "admin.gameEvidence.created").length,
        1
      );
      assert.equal(
        evidenceMediaAuditActions.filter((auditAction) => auditAction.action === "admin.gameMedia.created").length,
        1
      );

      const deniedUploadForm = new FormData();
      deniedUploadForm.append("file", new Blob(["denied upload"], { type: "text/plain" }), "denied-upload.txt");
      deniedUploadForm.append("access", "public");
      const deniedMediaUploadResponse = await fetch(`${appUrl}/admin/media/uploads/create`, {
        method: "POST",
        headers: {
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: deniedUploadForm,
        redirect: "manual"
      });
      assert.equal(deniedMediaUploadResponse.status, 303);
      assert.equal(locationPath(deniedMediaUploadResponse.headers.get("location")), "/dashboard");

      const adminUploadForm = new FormData();
      adminUploadForm.append("file", new Blob(["admin upload"], { type: "text/plain" }), "admin-upload.txt");
      adminUploadForm.append("access", "public");
      const adminMediaUploadResponse = await fetch(`${appUrl}/admin/media/uploads/create`, {
        method: "POST",
        headers: {
          cookie: sessionCookie(fixture.adminToken)
        },
        body: adminUploadForm,
        redirect: "manual"
      });
      assert.equal(adminMediaUploadResponse.status, 303);
      assert.equal(locationPath(adminMediaUploadResponse.headers.get("location")), "/admin/media/uploads");
      const uploadLocation = new URL(adminMediaUploadResponse.headers.get("location") ?? "", appUrl);
      assert.equal(uploadLocation.searchParams.get("uploaded"), "1");
      const uploadedUrl = uploadLocation.searchParams.get("url") ?? "";
      assert.match(uploadedUrl, /^\/uploads\/media\/\d{4}\/\d{2}\//);
      await unlink(path.join(process.cwd(), "public", uploadedUrl.replace(/^\//, ""))).catch(() => undefined);

      const mediaUploadAuditCount = await prisma.auditLog.count({
        where: {
          userId: fixture.adminId,
          action: "admin.mediaUpload.created"
        }
      });
      assert.equal(mediaUploadAuditCount, 1);

      const adminPublishVersionResponse = await fetch(
        `${appUrl}/admin/games/${fixture.gameId}/versions/${fixture.versionId}/status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: sessionCookie(fixture.adminToken)
          },
          body: new URLSearchParams({
            status: "PUBLISHED"
          }),
          redirect: "manual"
        }
      );
      assert.equal(adminPublishVersionResponse.status, 303);

      const publishedVersion = await prisma.gameVersion.findUniqueOrThrow({
        where: { id: fixture.versionId },
        select: { status: true, publishedAt: true }
      });
      assert.equal(publishedVersion.status, "PUBLISHED");
      assert.ok(publishedVersion.publishedAt);

      const adminAuditActions = await prisma.auditLog.findMany({
        where: {
          userId: fixture.adminId,
          action: {
            in: [
              "support.ticket.statusChanged",
              "support.ticket.internalNoteAdded",
              "support.ticket.replied",
              "admin.gameVersion.statusChanged"
            ]
          }
        },
        select: { action: true }
      });
      assert.equal(
        adminAuditActions.filter((auditAction) => auditAction.action === "support.ticket.statusChanged").length,
        1
      );
      assert.equal(
        adminAuditActions.filter((auditAction) => auditAction.action === "support.ticket.internalNoteAdded").length,
        1
      );
      assert.equal(
        adminAuditActions.filter((auditAction) => auditAction.action === "support.ticket.replied").length,
        1
      );
      assert.equal(
        adminAuditActions.filter((auditAction) => auditAction.action === "admin.gameVersion.statusChanged").length,
        2
      );

      const deniedGameEditResponse = await fetch(`${appUrl}/admin/games/${fixture.gameId}/edit`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.otherHostToken)
        },
        body: new URLSearchParams({
          title: "Denied Edit",
          tagline: "Denied tagline",
          description: "Denied description",
          minPlayers: "4",
          maxPlayers: "8",
          durationMin: "120",
          durationMax: "180"
        }),
        redirect: "manual"
      });
      assert.equal(deniedGameEditResponse.status, 303);
      assert.equal(locationPath(deniedGameEditResponse.headers.get("location")), "/dashboard");

      const adminGameEditResponse = await fetch(`${appUrl}/admin/games/${fixture.gameId}/edit`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: sessionCookie(fixture.adminToken)
        },
        body: new URLSearchParams({
          title: "Edited Access Control Test Game",
          tagline: "Edited disposable test game",
          description: "Edited by access-control tests.",
          minPlayers: "5",
          maxPlayers: "9",
          durationMin: "90",
          durationMax: "150"
        }),
        redirect: "manual"
      });
      assert.equal(adminGameEditResponse.status, 303);
      assert.equal(locationPath(adminGameEditResponse.headers.get("location")), `/admin/games/${fixture.gameId}`);

      const editedGame = await prisma.game.findUniqueOrThrow({
        where: { id: fixture.gameId },
        select: {
          title: true,
          minPlayers: true,
          maxPlayers: true,
          durationMin: true,
          durationMax: true
        }
      });
      assert.deepEqual(editedGame, {
        title: "Edited Access Control Test Game",
        minPlayers: 5,
        maxPlayers: 9,
        durationMin: 90,
        durationMax: 150
      });

      const gameEditAuditCount = await prisma.auditLog.count({
        where: {
          userId: fixture.adminId,
          action: "admin.game.updated",
          entityId: fixture.gameId
        }
      });
      assert.equal(gameEditAuditCount, 1);

      const auditActions = (
        await prisma.auditLog.findMany({
          where: { partyId: fixture.partyId },
          select: { action: true }
        })
      ).map((log) => log.action);
      const expectedAuditActionCounts = new Map([
        ["party.spoilerMode.unlocked", 1],
        ["party.assignment.saved", 3],
        ["party.assignment.cleared", 1],
        ["party.invitation.resent", 1],
        ["party.round.unlocked", 1],
        ["party.round.started", 2],
        ["party.round.completed", 1],
        ["party.evidence.revealed", 1],
        ["party.evidence.hidden", 1],
        ["party.finalReveal.victimRevealed", 1],
        ["party.finalReveal.solutionRevealed", 1],
        ["party.finalReveal.solutionHidden", 1],
        ["party.completed", 1],
        ["party.reopened", 1]
      ]);

      for (const [action, expectedCount] of expectedAuditActionCounts) {
        assert.equal(
          auditActions.filter((auditAction) => auditAction === action).length,
          expectedCount,
          `${action} audit count`
        );
      }
      assert.equal(
        auditActions.length,
        Array.from(expectedAuditActionCounts.values()).reduce((total, count) => total + count, 0)
      );
    } finally {
      await deleteTestData(fixture.slugPrefix, fixture.emailDomain);
    }
  }
);
