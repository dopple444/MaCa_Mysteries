import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  getAdminConditionalActivity,
  getPartyConditionalActivity,
  queueConditionalUnlockAlert
} from "../app/lib/conditional-activity";
import { getUnlockedRuleIdsForGuest } from "../app/lib/conditional-unlocks";
import { getVisiblePlayerArtifacts } from "../app/lib/player-artifacts";
import { getVisiblePlayerEvidence } from "../app/lib/player-evidence";
import { attemptPlayerCodeUnlock, getPlayerToolPanel } from "../app/lib/player-tools";
import { deleteCommerceFixture, prisma } from "./helpers/test-data";

async function createPlayerToolsFixture() {
  const label = crypto.randomBytes(6).toString("hex");
  const slugPrefix = "test-player-tools-";
  const slug = `${slugPrefix}${label}`;
  const emailDomain = `@${slug}.example`;

  await deleteCommerceFixture(slugPrefix, emailDomain);

  const host = await prisma.user.create({
    data: {
      name: "Player Tools Host",
      email: `host${emailDomain}`,
      role: "HOST",
      passwordHash: "test"
    }
  });
  const game = await prisma.game.create({
    data: {
      slug,
      title: "Player Tools Test Game",
      tagline: "Disposable player tools fixture",
      description: "Used only by player tool tests.",
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
        key: "locked-holder",
        name: "Locked Holder",
        publicBio: "Has the locked evidence.",
        isRequired: true,
        sortOrder: 2
      }
    })
  ]);
  const round = await prisma.gameRound.create({
    data: {
      gameVersionId: version.id,
      key: "round-two",
      title: "Round Two",
      summary: "Investigation round.",
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
      body: "The folder opens after a valid code.",
      evidenceType: "DOCUMENT",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    }
  });
  const card = await prisma.gameCard.create({
    data: {
      gameRoundId: round.id,
      characterId: lockedCharacter.id,
      key: "locked-card",
      title: "Locked Card",
      body: "This card opens after a valid code.",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 1
    }
  });
  const media = await prisma.gameMediaAsset.create({
    data: {
      gameVersionId: version.id,
      gameRoundId: round.id,
      characterId: lockedCharacter.id,
      evidenceId: evidence.id,
      key: "locked-audio",
      title: "Locked Audio",
      description: "This recording opens after a valid code.",
      assetType: "AUDIO",
      url: "/uploads/media/test-audio.mp3",
      mimeType: "audio/mpeg",
      visibility: "PLAYER_PRIVATE",
      sortOrder: 2
    }
  });
  const artifact = await prisma.gameDigitalArtifact.create({
    data: {
      gameVersionId: version.id,
      gameRoundId: round.id,
      characterId: lockedCharacter.id,
      mediaAssetId: media.id,
      key: "locked-email",
      title: "Locked Email",
      description: "This email opens after a valid code.",
      artifactType: "EMAIL",
      visibility: "PLAYER_PRIVATE",
      content: { body: "The email confirms the hidden timeline." },
      sortOrder: 3
    }
  });
  const tool = await prisma.gameCharacterTool.create({
    data: {
      gameVersionId: version.id,
      characterId: toolCharacter.id,
      key: "decoder",
      title: "Digital Decoder",
      description: "Creates a code for another player.",
      toolType: "ACCESS_CODE_GENERATOR",
      visibility: "PLAYER_PRIVATE"
    }
  });
  const unlockRule = await prisma.gameUnlockRule.create({
    data: {
      gameVersionId: version.id,
      sourceToolId: tool.id,
      requiredRoundId: round.id,
      key: "unlock-folder",
      title: "Unlock Folder",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      targetType: "GameEvidence",
      targetId: evidence.id,
      unlockScope: "PLAYER",
      codeMode: "PARTY_TOOL_CODE",
      config: { uses: 1 },
      status: "PUBLISHED"
    }
  });
  const cardUnlockRule = await prisma.gameUnlockRule.create({
    data: {
      gameVersionId: version.id,
      sourceToolId: tool.id,
      requiredRoundId: round.id,
      key: "unlock-card",
      title: "Unlock Card",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      targetType: "GameCard",
      targetId: card.id,
      unlockScope: "PLAYER",
      codeMode: "PARTY_TOOL_CODE",
      config: { uses: 1 },
      status: "PUBLISHED",
      sortOrder: 2
    }
  });
  const mediaUnlockRule = await prisma.gameUnlockRule.create({
    data: {
      gameVersionId: version.id,
      sourceToolId: tool.id,
      requiredRoundId: round.id,
      key: "unlock-audio",
      title: "Unlock Audio",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      targetType: "GameMediaAsset",
      targetId: media.id,
      unlockScope: "PLAYER",
      codeMode: "PARTY_TOOL_CODE",
      config: { uses: 1 },
      status: "PUBLISHED",
      sortOrder: 3
    }
  });
  const artifactUnlockRule = await prisma.gameUnlockRule.create({
    data: {
      gameVersionId: version.id,
      sourceToolId: tool.id,
      requiredRoundId: round.id,
      key: "unlock-email",
      title: "Unlock Email",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      targetType: "GameDigitalArtifact",
      targetId: artifact.id,
      unlockScope: "PLAYER",
      codeMode: "PARTY_TOOL_CODE",
      config: { uses: 1 },
      status: "PUBLISHED",
      sortOrder: 4
    }
  });
  await prisma.gameEvidence.update({
    where: { id: evidence.id },
    data: { requiredUnlockRuleId: unlockRule.id }
  });
  await prisma.gameCard.update({
    where: { id: card.id },
    data: { requiredUnlockRuleId: cardUnlockRule.id }
  });
  await prisma.gameMediaAsset.update({
    where: { id: media.id },
    data: { requiredUnlockRuleId: mediaUnlockRule.id }
  });
  await prisma.gameDigitalArtifact.update({
    where: { id: artifact.id },
    data: { requiredUnlockRuleId: artifactUnlockRule.id }
  });

  const party = await prisma.party.create({
    data: {
      title: "Player Tools Party",
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
      },
      roundStates: {
        create: {
          gameRoundId: round.id,
          status: "ACTIVE",
          unlockedAt: new Date()
        }
      },
      evidenceReveals: {
        create: {
          evidenceId: evidence.id,
          revealedByUserId: host.id
        }
      }
    },
    include: {
      guests: true
    }
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

  return {
    slugPrefix,
    emailDomain,
    hostId: host.id,
    partyId: party.id,
    toolGuestId: toolGuest.id,
    lockedGuestId: lockedGuest.id,
    lockedCharacterId: lockedCharacter.id,
    evidenceId: evidence.id,
    mediaId: media.id,
    artifactId: artifact.id,
    unlockRuleId: unlockRule.id,
    cardUnlockRuleId: cardUnlockRule.id,
    mediaUnlockRuleId: mediaUnlockRule.id,
    artifactUnlockRuleId: artifactUnlockRule.id
  };
}

test("player tool panel creates display codes and unlocks locked content", async () => {
  const fixture = await createPlayerToolsFixture();

  try {
    const lockedPanelBeforeCode = await getPlayerToolPanel(fixture.lockedGuestId);
    assert.equal(lockedPanelBeforeCode.lockedEvidence.length, 1);
    assert.deepEqual(
      lockedPanelBeforeCode.lockedContent.map((item) => item.contentTypeLabel),
      ["Locked document", "Locked card"]
    );

    const missingCodeResult = await attemptPlayerCodeUnlock({
      guestId: fixture.lockedGuestId,
      unlockRuleId: fixture.unlockRuleId,
      code: "ABC123"
    });
    assert.deepEqual(missingCodeResult, { status: "FAILED", reason: "no-active-code" });

    const toolPanel = await getPlayerToolPanel(fixture.toolGuestId);
    assert.equal(toolPanel.tools.length, 1);
    assert.equal(toolPanel.tools[0].codes.length, 4);
    const evidenceCode = toolPanel.tools[0].codes.find((item) => item.unlockRuleId === fixture.unlockRuleId)?.code;
    const cardCode = toolPanel.tools[0].codes.find((item) => item.unlockRuleId === fixture.cardUnlockRuleId)?.code;
    const mediaCode = toolPanel.tools[0].codes.find((item) => item.unlockRuleId === fixture.mediaUnlockRuleId)?.code;
    const artifactCode = toolPanel.tools[0].codes.find((item) => item.unlockRuleId === fixture.artifactUnlockRuleId)?.code;
    const code = evidenceCode;
    assert.match(code ?? "", /^[A-F0-9]{3}-[A-F0-9]{3}$/);
    assert.match(cardCode ?? "", /^[A-F0-9]{3}-[A-F0-9]{3}$/);
    assert.match(mediaCode ?? "", /^[A-F0-9]{3}-[A-F0-9]{3}$/);
    assert.match(artifactCode ?? "", /^[A-F0-9]{3}-[A-F0-9]{3}$/);

    const instance = await prisma.partyToolInstance.findFirstOrThrow({
      where: {
        partyId: fixture.partyId,
        unlockRuleId: fixture.unlockRuleId
      }
    });
    assert.match(instance.codeHash, /^[a-f0-9]{64}$/);
    assert.notEqual(instance.codeHash, code?.replace("-", ""));

    const failedResult = await attemptPlayerCodeUnlock({
      guestId: fixture.lockedGuestId,
      unlockRuleId: fixture.unlockRuleId,
      code: "WRONG"
    });
    assert.deepEqual(failedResult, { status: "FAILED", reason: "invalid-code" });

    const successResult = await attemptPlayerCodeUnlock({
      guestId: fixture.lockedGuestId,
      unlockRuleId: fixture.unlockRuleId,
      code: code ?? ""
    });
    assert.equal(successResult.status, "UNLOCKED");

    const cardResult = await attemptPlayerCodeUnlock({
      guestId: fixture.lockedGuestId,
      unlockRuleId: fixture.cardUnlockRuleId,
      code: cardCode ?? ""
    });
    assert.equal(cardResult.status, "UNLOCKED");

    const mediaPanelBeforeUnlock = await getPlayerToolPanel(fixture.lockedGuestId);
    assert.equal(
      mediaPanelBeforeUnlock.lockedContent.some((item) => item.unlockRuleId === fixture.mediaUnlockRuleId),
      true
    );
    const mediaResult = await attemptPlayerCodeUnlock({
      guestId: fixture.lockedGuestId,
      unlockRuleId: fixture.mediaUnlockRuleId,
      code: mediaCode ?? ""
    });
    assert.equal(mediaResult.status, "UNLOCKED");

    const artifactPanelBeforeUnlock = await getPlayerToolPanel(fixture.lockedGuestId);
    assert.equal(
      artifactPanelBeforeUnlock.lockedContent.some((item) => item.unlockRuleId === fixture.artifactUnlockRuleId),
      true
    );
    const artifactResult = await attemptPlayerCodeUnlock({
      guestId: fixture.lockedGuestId,
      unlockRuleId: fixture.artifactUnlockRuleId,
      code: artifactCode ?? ""
    });
    assert.equal(artifactResult.status, "UNLOCKED");

    const lockedPanelAfterUnlock = await getPlayerToolPanel(fixture.lockedGuestId);
    assert.equal(lockedPanelAfterUnlock.lockedEvidence.length, 0);
    assert.equal(lockedPanelAfterUnlock.lockedContent.length, 0);

    const [unlockEvents, evidenceReveals, partyForArtifacts] = await Promise.all([
      prisma.partyUnlockEvent.findMany({ where: { partyId: fixture.partyId } }),
      prisma.partyEvidenceReveal.findMany({
        where: { partyId: fixture.partyId },
        include: {
          evidence: {
            include: { gameRound: true }
          }
        }
      }),
      prisma.party.findUniqueOrThrow({
        where: { id: fixture.partyId },
        include: {
          roundStates: true,
          gameVersion: {
            include: {
              digitalArtifacts: {
                include: { gameRound: true }
              }
            }
          }
        }
      })
    ]);
    const unlockedRuleIds = getUnlockedRuleIdsForGuest(unlockEvents, fixture.lockedGuestId);
    assert.deepEqual(
      [fixture.unlockRuleId, fixture.cardUnlockRuleId, fixture.mediaUnlockRuleId, fixture.artifactUnlockRuleId].map((ruleId) =>
        unlockedRuleIds.has(ruleId)
      ),
      [true, true, true, true]
    );
    assert.deepEqual(
      getVisiblePlayerEvidence(evidenceReveals, { characterId: fixture.lockedCharacterId }, { unlockedRuleIds }).map(
        (item) => item.id
      ),
      [fixture.evidenceId]
    );
    assert.deepEqual(
      getVisiblePlayerArtifacts(
        partyForArtifacts.gameVersion?.digitalArtifacts ?? [],
        { characterId: fixture.lockedCharacterId },
        partyForArtifacts.roundStates,
        new Set([fixture.evidenceId]),
        new Set([fixture.mediaId]),
        { unlockedRuleIds }
      ).map((item) => item.id),
      [fixture.artifactId]
    );

    const hostSafeActivity = await getPartyConditionalActivity({
      partyId: fixture.partyId,
      hostId: fixture.hostId,
      includeSpoilers: false
    });
    assert.ok(hostSafeActivity);
    assert.equal(hostSafeActivity.counts.codeAttempts, 6);
    assert.equal(hostSafeActivity.counts.unlockEvents, 4);
    assert.equal(hostSafeActivity.codeAttempts.some((attempt) => attempt.status === "SUCCESS"), true);
    assert.equal(hostSafeActivity.unlockEvents[0].ruleLabel, "Conditional unlock");
    assert.equal("codeHash" in (hostSafeActivity.codeAttempts[0] as Record<string, unknown>), false);

    const spoilerActivity = await getPartyConditionalActivity({
      partyId: fixture.partyId,
      hostId: fixture.hostId,
      includeSpoilers: true
    });
    assert.equal(
      spoilerActivity?.codeAttempts.some(
        (attempt) => attempt.status === "SUCCESS" && attempt.ruleLabel === "Unlock Folder"
      ),
      true
    );
    assert.equal(spoilerActivity?.codeAttempts.find((attempt) => attempt.status === "SUCCESS")?.toolLabel, "Digital Decoder");

    const adminActivity = await getAdminConditionalActivity({ take: 20 });
    assert.equal(adminActivity.counts.codeAttempts >= 6, true);
    assert.equal(adminActivity.counts.unlockEvents >= 4, true);
    assert.equal(adminActivity.counts.failedCodeAttempts >= 1, true);
    assert.equal(
      adminActivity.codeAttempts.some(
        (attempt) => attempt.partyId === fixture.partyId && attempt.status === "SUCCESS" && attempt.ruleLabel === "Unlock Folder"
      ),
      true
    );
    assert.equal(
      adminActivity.unlockEvents.some(
        (event) => event.partyId === fixture.partyId && event.ruleLabel === "Unlock Folder"
      ),
      true
    );
    assert.equal("codeHash" in (adminActivity.codeAttempts[0] as Record<string, unknown>), false);

    const alertRecipients = [`conditional-alert${fixture.emailDomain}`];
    const alertResult = await queueConditionalUnlockAlert({
      threshold: 1,
      windowMinutes: 60,
      dedupeMinutes: 120,
      env: {
        ADMIN_ALERT_EMAILS: alertRecipients.join(","),
        APP_URL: "https://staging.macamysteries.com"
      }
    });

    assert.equal(alertResult.status, "QUEUED");
    assert.equal(alertResult.queuedCount, 1);
    assert.equal(alertResult.summary.failedCodeAttemptCount >= 1, true);

    const alertMessage = await prisma.outboundMessage.findFirstOrThrow({
      where: {
        recipient: alertRecipients[0],
        templateKey: "conditional_unlock_alert"
      }
    });
    assert.equal(alertMessage.subject, "MaCa Mysteries conditional unlock alert");
    assert.match(alertMessage.bodyPreview, /failed code attempts/);
    assert.match(alertMessage.bodyPreview, /https:\/\/staging\.macamysteries\.com\/admin/);

    const duplicateAlertResult = await queueConditionalUnlockAlert({
      threshold: 1,
      windowMinutes: 60,
      dedupeMinutes: 120,
      env: {
        ADMIN_ALERT_EMAILS: alertRecipients.join(","),
        APP_URL: "https://staging.macamysteries.com"
      }
    });

    assert.equal(duplicateAlertResult.status, "DUPLICATE");
    assert.equal(duplicateAlertResult.queuedCount, 0);
    assert.equal(duplicateAlertResult.skippedDuplicateCount, 1);
  } finally {
    await prisma.outboundMessage.deleteMany({
      where: {
        recipient: { endsWith: fixture.emailDomain },
        templateKey: "conditional_unlock_alert"
      }
    });
    await deleteCommerceFixture(fixture.slugPrefix, fixture.emailDomain);
  }
});
