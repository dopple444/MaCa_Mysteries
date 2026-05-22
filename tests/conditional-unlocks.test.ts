import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  attemptCodeUnlock,
  canActorSeeConditionalContent,
  createPartyToolInstanceWithCode,
  getUnlockedRuleIdsForGuest
} from "../app/lib/conditional-unlocks";
import { getVisiblePlayerEvidence } from "../app/lib/player-evidence";
import { deleteCommerceFixture, prisma } from "./helpers/test-data";

test("canActorSeeConditionalContent keeps player, host, and admin visibility separate", () => {
  const lockedPrivate = {
    visibility: "PLAYER_PRIVATE",
    characterId: "character-b",
    requiredUnlockRuleId: "rule-1"
  };

  assert.equal(
    canActorSeeConditionalContent(lockedPrivate, {
      actorType: "PLAYER",
      characterId: "character-b",
      unlockedRuleIds: []
    }),
    false
  );
  assert.equal(
    canActorSeeConditionalContent(lockedPrivate, {
      actorType: "PLAYER",
      characterId: "character-b",
      unlockedRuleIds: ["rule-1"]
    }),
    true
  );
  assert.equal(
    canActorSeeConditionalContent(lockedPrivate, {
      actorType: "PLAYER",
      characterId: "character-a",
      unlockedRuleIds: ["rule-1"]
    }),
    false
  );
  assert.equal(
    canActorSeeConditionalContent(
      { visibility: "SPOILER_PROTECTED" },
      { actorType: "HOST", hostSpoilerModeUnlocked: false }
    ),
    false
  );
  assert.equal(
    canActorSeeConditionalContent(
      { visibility: "SPOILER_PROTECTED" },
      { actorType: "HOST", hostSpoilerModeUnlocked: true }
    ),
    true
  );
  assert.equal(
    canActorSeeConditionalContent(
      { visibility: "SPOILER_PROTECTED", requiredUnlockRuleId: "rule-1" },
      { actorType: "ADMIN" }
    ),
    true
  );
});

test("access-code unlocks reveal locked evidence only for the intended player", async () => {
  const label = crypto.randomBytes(6).toString("hex");
  const slugPrefix = "test-conditional-";
  const slug = `${slugPrefix}${label}`;
  const emailDomain = `@${slug}.example`;

  await deleteCommerceFixture(slugPrefix, emailDomain);

  const host = await prisma.user.create({
    data: {
      name: "Conditional Host",
      email: `host${emailDomain}`,
      role: "HOST",
      passwordHash: "test"
    }
  });

  try {
    const game = await prisma.game.create({
      data: {
        slug,
        title: "Conditional Test Game",
        tagline: "Disposable conditional game",
        description: "Used only by conditional unlock tests.",
        minPlayers: 2,
        maxPlayers: 4,
        durationMin: 60,
        durationMax: 90,
        status: "PUBLISHED",
        versions: {
          create: {
            versionNumber: 1,
            status: "PUBLISHED"
          }
        }
      },
      include: { versions: true }
    });
    const version = game.versions[0];
    assert.ok(version);

    const [toolCharacter, lockedCharacter] = await Promise.all([
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
          key: "locked-evidence-holder",
          name: "Locked Evidence Holder",
          publicBio: "Has the locked evidence.",
          isRequired: true,
          sortOrder: 2
        }
      })
    ]);
    const round = await prisma.gameRound.create({
      data: {
        gameVersionId: version.id,
        key: "round-2",
        title: "Round 2",
        sortOrder: 2
      }
    });
    const evidence = await prisma.gameEvidence.create({
      data: {
        gameVersionId: version.id,
        gameRoundId: round.id,
        characterId: lockedCharacter.id,
        key: "locked-folder",
        title: "Locked Folder",
        body: "The folder opens after a valid decoder code.",
        evidenceType: "DOCUMENT",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 1
      }
    });
    const tool = await prisma.gameCharacterTool.create({
      data: {
        gameVersionId: version.id,
        characterId: toolCharacter.id,
        key: "decoder",
        title: "Digital Decoder",
        description: "Generates the code another player needs.",
        toolType: "ACCESS_CODE_GENERATOR"
      }
    });
    const unlockRule = await prisma.gameUnlockRule.create({
      data: {
        gameVersionId: version.id,
        sourceToolId: tool.id,
        requiredRoundId: round.id,
        key: "unlock-locked-folder",
        title: "Unlock Locked Folder",
        ruleType: "ACCESS_CODE",
        triggerType: "CODE_ENTRY",
        targetType: "GameEvidence",
        targetId: evidence.id,
        unlockScope: "PLAYER",
        codeMode: "PARTY_TOOL_CODE",
        status: "PUBLISHED"
      }
    });
    await prisma.gameEvidence.update({
      where: { id: evidence.id },
      data: { requiredUnlockRuleId: unlockRule.id }
    });

    const party = await prisma.party.create({
      data: {
        title: "Conditional Party",
        gameSlug: game.slug,
        gameId: game.id,
        gameVersionId: version.id,
        hostId: host.id,
        inviteCode: label.slice(0, 8).toUpperCase(),
        guests: {
          create: [
            {
              name: "Tool Player",
              email: `tool${emailDomain}`,
              status: "JOINED",
              guestToken: `tool-${label}`
            },
            {
              name: "Locked Player",
              email: `locked${emailDomain}`,
              status: "JOINED",
              guestToken: `locked-${label}`
            }
          ]
        }
      },
      include: { guests: true }
    });
    const toolGuest = party.guests.find((guest) => guest.email === `tool${emailDomain}`);
    const lockedGuest = party.guests.find((guest) => guest.email === `locked${emailDomain}`);
    assert.ok(toolGuest);
    assert.ok(lockedGuest);

    await prisma.partyCharacterAssignment.createMany({
      data: [
        { partyId: party.id, guestId: toolGuest.id, characterId: toolCharacter.id },
        { partyId: party.id, guestId: lockedGuest.id, characterId: lockedCharacter.id }
      ]
    });
    await prisma.partyEvidenceReveal.create({
      data: {
        partyId: party.id,
        evidenceId: evidence.id,
        revealedByUserId: host.id
      }
    });

    const toolInstance = await createPartyToolInstanceWithCode({
      partyId: party.id,
      characterToolId: tool.id,
      unlockRuleId: unlockRule.id,
      guestId: toolGuest.id,
      code: "LAKE-417"
    });

    const evidenceReveals = await prisma.partyEvidenceReveal.findMany({
      where: { partyId: party.id },
      include: {
        evidence: {
          include: { gameRound: true }
        }
      }
    });
    assert.deepEqual(
      getVisiblePlayerEvidence(evidenceReveals, { characterId: lockedCharacter.id }).map((item) => item.id),
      []
    );

    const failedUnlock = await attemptCodeUnlock({
      partyId: party.id,
      actorGuestId: lockedGuest.id,
      targetGuestId: lockedGuest.id,
      toolInstanceId: toolInstance.id,
      unlockRuleId: unlockRule.id,
      code: "WRONG"
    });
    assert.equal(failedUnlock.status, "FAILED");
    assert.equal(failedUnlock.unlockEvent, null);

    const successfulUnlock = await attemptCodeUnlock({
      partyId: party.id,
      actorGuestId: lockedGuest.id,
      targetGuestId: lockedGuest.id,
      toolInstanceId: toolInstance.id,
      unlockRuleId: unlockRule.id,
      code: "lake 417"
    });
    assert.equal(successfulUnlock.status, "UNLOCKED");
    assert.ok(successfulUnlock.unlockEvent);

    const unlockEvents = await prisma.partyUnlockEvent.findMany({
      where: { partyId: party.id }
    });
    const lockedGuestUnlocks = getUnlockedRuleIdsForGuest(unlockEvents, lockedGuest.id);
    assert.deepEqual(
      getVisiblePlayerEvidence(evidenceReveals, { characterId: lockedCharacter.id }, { unlockedRuleIds: lockedGuestUnlocks }).map(
        (item) => item.id
      ),
      [evidence.id]
    );
    const toolGuestUnlocks = getUnlockedRuleIdsForGuest(unlockEvents, toolGuest.id);
    assert.deepEqual(
      getVisiblePlayerEvidence(evidenceReveals, { characterId: toolCharacter.id }, { unlockedRuleIds: toolGuestUnlocks }).map(
        (item) => item.id
      ),
      []
    );

    const attempts = await prisma.partyCodeAttempt.findMany({
      where: { partyId: party.id },
      orderBy: { createdAt: "asc" }
    });
    assert.deepEqual(
      attempts.map((attempt) => attempt.status),
      ["FAILED", "SUCCESS"]
    );
    assert.ok(attempts.every((attempt) => /^[a-f0-9]{64}$/.test(attempt.codeHash)));
    assert.ok(attempts.every((attempt) => !["WRONG", "LAKE417"].includes(attempt.codeHash)));

    const usedToolInstance = await prisma.partyToolInstance.findUniqueOrThrow({
      where: { id: toolInstance.id },
      select: { status: true, usesRemaining: true, codeHash: true }
    });
    assert.equal(usedToolInstance.status, "USED");
    assert.equal(usedToolInstance.usesRemaining, 0);
    assert.match(usedToolInstance.codeHash, /^[a-f0-9]{64}$/);
    assert.notEqual(usedToolInstance.codeHash, "LAKE417");
  } finally {
    await deleteCommerceFixture(slugPrefix, emailDomain);
  }
});
