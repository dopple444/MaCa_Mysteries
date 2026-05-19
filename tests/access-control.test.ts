import assert from "node:assert/strict";
import crypto from "node:crypto";
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
  await prisma.supportTicket.deleteMany({
    where: {
      OR: [
        { email: { endsWith: emailDomain } },
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

      const otherHostPartyResponse = await fetch(`${appUrl}/host/party/${fixture.partyId}`, {
        headers: { cookie: sessionCookie(fixture.otherHostToken) },
        redirect: "manual"
      });
      assert.equal(otherHostPartyResponse.status, 404);

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
      assert.equal(checkoutPlaceholderResponse.status, 501);
      const checkoutPlaceholderBody = await checkoutPlaceholderResponse.json();
      assert.equal(checkoutPlaceholderBody.error, "Payment provider is not configured yet.");

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
      assert.equal(locationPath(adminSupportStatusResponse.headers.get("location")), "/admin");

      const supportTicketAfterAdminPost = await prisma.supportTicket.findUniqueOrThrow({
        where: { id: supportTicket.id },
        select: { status: true }
      });
      assert.equal(supportTicketAfterAdminPost.status, "PENDING");

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
          action: { in: ["support.ticket.statusChanged", "admin.gameVersion.statusChanged"] }
        },
        select: { action: true }
      });
      assert.equal(
        adminAuditActions.filter((auditAction) => auditAction.action === "support.ticket.statusChanged").length,
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
      assert.equal(auditActions.length, 16);
    } finally {
      await deleteTestData(fixture.slugPrefix, fixture.emailDomain);
    }
  }
);
