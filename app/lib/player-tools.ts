import crypto from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  attemptCodeUnlock,
  canActorSeeConditionalContent,
  createPartyToolInstanceWithCode,
  getUnlockedRuleIdsForGuest
} from "./conditional-unlocks";
import { prisma } from "./prisma";

type CodeRule = {
  id: string;
  key: string;
  title: string;
  sourceToolId: string | null;
  targetType: string;
  targetId: string;
  unlockScope: string;
  config: Prisma.JsonValue;
};

type ToolInstance = {
  id: string;
  unlockRuleId: string | null;
  characterToolId: string;
  status: string;
  usesRemaining: number;
  expiresAt: Date | null;
};

export type PlayerToolDisplay = {
  id: string;
  title: string;
  description: string;
  toolType: string;
  codes: {
    unlockRuleId: string;
    unlockRuleTitle: string;
    targetType: string;
    targetId: string;
    code: string | null;
    status: string;
    usesRemaining: number;
  }[];
};

export type PlayerLockedEvidencePrompt = {
  evidenceId: string;
  title: string;
  evidenceType: string;
  roundTitle: string | null;
  unlockRuleId: string;
  unlockRuleTitle: string;
  sourceToolTitle: string | null;
};

export type PlayerLockedContentPrompt = {
  targetType: "GameCard" | "GameEvidence" | "GameMediaAsset" | "GameDigitalArtifact";
  targetId: string;
  title: string;
  contentTypeLabel: string;
  detailLabel: string | null;
  unlockRuleId: string;
  unlockRuleTitle: string;
  sourceToolTitle: string | null;
};

export type PlayerToolPanel = {
  tools: PlayerToolDisplay[];
  lockedEvidence: PlayerLockedEvidencePrompt[];
  lockedContent: PlayerLockedContentPrompt[];
};

export type PlayerCodeUnlockResult =
  | { status: "UNLOCKED"; unlockRuleId: string }
  | {
      status: "FAILED";
      reason:
        | "invalid-guest"
        | "not-joined"
        | "missing-assignment"
        | "invalid-rule"
        | "target-not-available"
        | "already-unlocked"
        | "no-active-code"
        | "invalid-code";
    };

function getAccessCodeSecret() {
  return process.env.ACCOUNT_TOKEN_SECRET || process.env.CSRF_SECRET || process.env.DATABASE_URL || "development-access-code-secret";
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generatePartyAccessCode(input: {
  partyId: string;
  characterToolId: string;
  unlockRuleId: string;
  guestId: string;
}) {
  const digest = crypto
    .createHmac("sha256", getAccessCodeSecret())
    .update(`${input.partyId}:${input.characterToolId}:${input.unlockRuleId}:${input.guestId}`)
    .digest("hex")
    .toUpperCase();
  return `${digest.slice(0, 3)}-${digest.slice(3, 6)}`;
}

function getConfiguredUses(config: Prisma.JsonValue) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return 1;
  const uses = (config as Record<string, unknown>).uses;
  return typeof uses === "number" && Number.isFinite(uses) ? Math.max(1, Math.floor(uses)) : 1;
}

function isActiveInstance(instance: ToolInstance) {
  return instance.status === "ACTIVE" && instance.usesRemaining > 0 && (!instance.expiresAt || instance.expiresAt > new Date());
}

async function getGuestContext(guestId: string) {
  return prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      assignments: true,
      party: {
        include: {
          roundStates: {
            include: {
              gameRound: {
                include: {
                  cards: true
                }
              }
            }
          },
          evidenceReveals: {
            include: {
              evidence: {
                include: {
                  gameRound: true
                }
              }
            },
            orderBy: { revealedAt: "asc" }
          },
          unlockEvents: true
        }
      }
    }
  });
}

async function getCodeRulesForToolIds(toolIds: string[]) {
  if (!toolIds.length) return [];
  return prisma.gameUnlockRule.findMany({
    where: {
      sourceToolId: { in: toolIds },
      status: "PUBLISHED",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      codeMode: "PARTY_TOOL_CODE"
    },
    orderBy: [
      { sortOrder: "asc" },
      { title: "asc" }
    ]
  });
}

export async function ensurePartyToolInstancesForGuest(guestId: string) {
  const guest = await getGuestContext(guestId);
  const assignment = guest?.assignments[0];
  if (!guest || guest.status !== "JOINED" || !assignment || !guest.party.gameVersionId) return { createdCount: 0 };

  const tools = await prisma.gameCharacterTool.findMany({
    where: {
      gameVersionId: guest.party.gameVersionId,
      characterId: assignment.characterId,
      toolType: "ACCESS_CODE_GENERATOR"
    },
    select: {
      id: true
    }
  });
  const toolIds = tools.map((tool) => tool.id);
  const rules = await getCodeRulesForToolIds(toolIds);
  let createdCount = 0;

  for (const rule of rules) {
    if (!rule.sourceToolId) continue;
    const existing = await prisma.partyToolInstance.findFirst({
      where: {
        partyId: guest.partyId,
        guestId: guest.id,
        characterToolId: rule.sourceToolId,
        unlockRuleId: rule.id
      },
      select: { id: true }
    });
    if (existing) continue;

    await createPartyToolInstanceWithCode({
      partyId: guest.partyId,
      guestId: guest.id,
      characterToolId: rule.sourceToolId,
      unlockRuleId: rule.id,
      code: generatePartyAccessCode({
        partyId: guest.partyId,
        guestId: guest.id,
        characterToolId: rule.sourceToolId,
        unlockRuleId: rule.id
      }),
      usesRemaining: getConfiguredUses(rule.config),
      metadata: {
        generatedBy: "player-tool-panel",
        ruleKey: rule.key
      }
    });
    createdCount += 1;
  }

  return { createdCount };
}

export async function getPlayerToolPanel(guestId: string): Promise<PlayerToolPanel> {
  await ensurePartyToolInstancesForGuest(guestId);
  const guest = await getGuestContext(guestId);
  const assignment = guest?.assignments[0];
  if (!guest || guest.status !== "JOINED" || !assignment || !guest.party.gameVersionId) {
    return { tools: [], lockedEvidence: [], lockedContent: [] };
  }

  const activeRoundIds = new Set(
    guest.party.roundStates
      .filter((roundState) => ["ACTIVE", "COMPLETED"].includes(roundState.status))
      .map((roundState) => roundState.gameRoundId)
  );
  const unlockedRuleIds = getUnlockedRuleIdsForGuest(guest.party.unlockEvents, guest.id);

  const tools = await prisma.gameCharacterTool.findMany({
    where: {
      gameVersionId: guest.party.gameVersionId,
      characterId: assignment.characterId
    },
    orderBy: [
      { sortOrder: "asc" },
      { title: "asc" }
    ]
  });
  const visibleTools = tools.filter((tool) =>
    canActorSeeConditionalContent(
      {
        visibility: tool.visibility,
        characterId: tool.characterId
      },
      {
        actorType: "PLAYER",
        characterId: assignment.characterId
      }
    )
  );
  const toolIds = visibleTools.map((tool) => tool.id);
  const [rules, instances] = await Promise.all([
    getCodeRulesForToolIds(toolIds),
    prisma.partyToolInstance.findMany({
      where: {
        partyId: guest.partyId,
        guestId: guest.id,
        characterToolId: { in: toolIds.length ? toolIds : ["__none__"] }
      },
      orderBy: { createdAt: "asc" }
    })
  ]);
  const rulesByToolId = new Map<string, CodeRule[]>();
  for (const rule of rules) {
    if (!rule.sourceToolId) continue;
    rulesByToolId.set(rule.sourceToolId, [...(rulesByToolId.get(rule.sourceToolId) ?? []), rule]);
  }
  const instancesByRuleId = new Map(instances.map((instance) => [instance.unlockRuleId ?? "", instance]));

  const toolDisplays = visibleTools.map((tool) => ({
    id: tool.id,
    title: tool.title,
    description: tool.description,
    toolType: tool.toolType,
    codes: (rulesByToolId.get(tool.id) ?? []).map((rule) => {
      const instance = instancesByRuleId.get(rule.id);
      return {
        unlockRuleId: rule.id,
        unlockRuleTitle: rule.title,
        targetType: rule.targetType,
        targetId: rule.targetId,
        code: instance && isActiveInstance(instance)
          ? generatePartyAccessCode({
              partyId: guest.partyId,
              guestId: guest.id,
              characterToolId: tool.id,
              unlockRuleId: rule.id
            })
          : null,
        status: instance?.status ?? "MISSING",
        usesRemaining: instance?.usesRemaining ?? 0
      };
    })
  }));

  const activeCardShells = guest.party.roundStates
    .filter((roundState) => roundState.status === "ACTIVE")
    .flatMap((roundState) =>
      roundState.gameRound.cards.map((card) => ({
        card,
        roundId: roundState.gameRoundId,
        roundTitle: roundState.gameRound.title
      }))
    );
  const visibleEvidenceIds = new Set(
    guest.party.evidenceReveals
      .filter((reveal) =>
        canActorSeeConditionalContent(
          {
            visibility: reveal.evidence.visibility,
            characterId: reveal.evidence.characterId,
            requiredUnlockRuleId: reveal.evidence.requiredUnlockRuleId
          },
          {
            actorType: "PLAYER",
            characterId: assignment.characterId,
            unlockedRuleIds
          }
        )
      )
      .map((reveal) => reveal.evidenceId)
  );
  const mediaAssets = await prisma.gameMediaAsset.findMany({
    where: {
      gameVersionId: guest.party.gameVersionId
    },
    include: {
      gameRound: true,
      evidence: true
    },
    orderBy: [
      { sortOrder: "asc" },
      { title: "asc" }
    ]
  });
  const visibleMediaIds = new Set(
    mediaAssets
      .filter((media) =>
        canActorSeeConditionalContent(
          {
            visibility: media.visibility,
            characterId: media.characterId,
            gameRoundId: media.gameRoundId,
            requiredUnlockRuleId: media.requiredUnlockRuleId
          },
          {
            actorType: "PLAYER",
            characterId: assignment.characterId,
            activeRoundIds,
            completedRoundIds: activeRoundIds,
            unlockedRuleIds
          }
        )
      )
      .filter((media) => !media.evidenceId || visibleEvidenceIds.has(media.evidenceId))
      .map((media) => media.id)
  );
  const digitalArtifacts = await prisma.gameDigitalArtifact.findMany({
    where: {
      gameVersionId: guest.party.gameVersionId,
      requiredUnlockRuleId: {
        not: ""
      }
    },
    include: {
      gameRound: true,
      evidence: true,
      mediaAsset: true
    },
    orderBy: [
      { sortOrder: "asc" },
      { title: "asc" }
    ]
  });
  const requiredRuleIds = [
    ...guest.party.evidenceReveals.map((reveal) => reveal.evidence.requiredUnlockRuleId?.trim()),
    ...activeCardShells.map(({ card }) => card.requiredUnlockRuleId?.trim()),
    ...mediaAssets.map((media) => media.requiredUnlockRuleId?.trim()),
    ...digitalArtifacts.map((artifact) => artifact.requiredUnlockRuleId?.trim())
  ].filter((ruleId): ruleId is string => Boolean(ruleId));
  const requiredRules = requiredRuleIds.length
    ? await prisma.gameUnlockRule.findMany({
        where: {
          id: { in: requiredRuleIds },
          gameVersionId: guest.party.gameVersionId,
          status: "PUBLISHED",
          ruleType: "ACCESS_CODE",
          triggerType: "CODE_ENTRY",
          codeMode: "PARTY_TOOL_CODE"
        },
        include: {
          sourceTool: true
        }
      })
    : [];
  const rulesById = new Map(requiredRules.map((rule) => [rule.id, rule]));

  const lockedEvidence: PlayerLockedEvidencePrompt[] = guest.party.evidenceReveals.flatMap((reveal) => {
    const ruleId = reveal.evidence.requiredUnlockRuleId?.trim();
    if (!ruleId || unlockedRuleIds.has(ruleId)) return [];
    const rule = rulesById.get(ruleId);
    if (!rule || rule.targetType !== "GameEvidence" || rule.targetId !== reveal.evidence.id) return [];

    const canSeeLockedShell = canActorSeeConditionalContent(
      {
        visibility: reveal.evidence.visibility,
        characterId: reveal.evidence.characterId,
        gameRoundId: reveal.evidence.gameRoundId,
        requiredUnlockRuleId: null
      },
      {
        actorType: "PLAYER",
        characterId: assignment.characterId,
        activeRoundIds,
        completedRoundIds: activeRoundIds
      }
    );
    if (!canSeeLockedShell) return [];

    return [
      {
        evidenceId: reveal.evidence.id,
        title: reveal.evidence.title,
        evidenceType: reveal.evidence.evidenceType,
        roundTitle: reveal.evidence.gameRound?.title ?? null,
        unlockRuleId: rule.id,
        unlockRuleTitle: rule.title,
        sourceToolTitle: rule.sourceTool?.title ?? null
      }
    ];
  });
  const lockedCards: PlayerLockedContentPrompt[] = activeCardShells.flatMap(({ card, roundId, roundTitle }) => {
    const ruleId = card.requiredUnlockRuleId?.trim();
    if (!ruleId || unlockedRuleIds.has(ruleId)) return [];
    const rule = rulesById.get(ruleId);
    if (!rule || rule.targetType !== "GameCard" || rule.targetId !== card.id) return [];

    const canSeeLockedShell = canActorSeeConditionalContent(
      {
        visibility: card.visibility,
        characterId: card.characterId,
        gameRoundId: roundId,
        requiredUnlockRuleId: null
      },
      {
        actorType: "PLAYER",
        characterId: assignment.characterId,
        activeRoundIds: new Set([roundId]),
        completedRoundIds: new Set()
      }
    );
    if (!canSeeLockedShell) return [];

    return [
      {
        targetType: "GameCard" as const,
        targetId: card.id,
        title: card.title,
        contentTypeLabel: "Locked card",
        detailLabel: roundTitle,
        unlockRuleId: rule.id,
        unlockRuleTitle: rule.title,
        sourceToolTitle: rule.sourceTool?.title ?? null
      }
    ];
  });
  const lockedMedia: PlayerLockedContentPrompt[] = mediaAssets.flatMap((media) => {
    const ruleId = media.requiredUnlockRuleId?.trim();
    if (!ruleId || unlockedRuleIds.has(ruleId)) return [];
    const rule = rulesById.get(ruleId);
    if (!rule || rule.targetType !== "GameMediaAsset" || rule.targetId !== media.id) return [];
    if (media.evidenceId && !visibleEvidenceIds.has(media.evidenceId)) return [];

    const canSeeLockedShell = canActorSeeConditionalContent(
      {
        visibility: media.visibility,
        characterId: media.characterId,
        gameRoundId: media.gameRoundId,
        requiredUnlockRuleId: null
      },
      {
        actorType: "PLAYER",
        characterId: assignment.characterId,
        activeRoundIds,
        completedRoundIds: activeRoundIds
      }
    );
    if (!canSeeLockedShell) return [];

    return [
      {
        targetType: "GameMediaAsset" as const,
        targetId: media.id,
        title: media.title,
        contentTypeLabel: `Locked ${media.assetType.toLowerCase()}`,
        detailLabel: media.gameRound?.title ?? media.evidence?.title ?? null,
        unlockRuleId: rule.id,
        unlockRuleTitle: rule.title,
        sourceToolTitle: rule.sourceTool?.title ?? null
      }
    ];
  });
  const lockedArtifacts: PlayerLockedContentPrompt[] = digitalArtifacts.flatMap((artifact) => {
    const ruleId = artifact.requiredUnlockRuleId?.trim();
    if (!ruleId || unlockedRuleIds.has(ruleId)) return [];
    const rule = rulesById.get(ruleId);
    if (!rule || rule.targetType !== "GameDigitalArtifact" || rule.targetId !== artifact.id) return [];
    if (artifact.evidenceId && !visibleEvidenceIds.has(artifact.evidenceId)) return [];
    if (artifact.mediaAssetId && !visibleMediaIds.has(artifact.mediaAssetId)) return [];

    const canSeeLockedShell = canActorSeeConditionalContent(
      {
        visibility: artifact.visibility,
        characterId: artifact.characterId,
        gameRoundId: artifact.gameRoundId,
        requiredUnlockRuleId: null
      },
      {
        actorType: "PLAYER",
        characterId: assignment.characterId,
        activeRoundIds,
        completedRoundIds: activeRoundIds
      }
    );
    if (!canSeeLockedShell) return [];

    return [
      {
        targetType: "GameDigitalArtifact" as const,
        targetId: artifact.id,
        title: artifact.title,
        contentTypeLabel: `Locked ${artifact.artifactType.toLowerCase().replaceAll("_", " ")}`,
        detailLabel: artifact.gameRound?.title ?? artifact.evidence?.title ?? artifact.mediaAsset?.title ?? null,
        unlockRuleId: rule.id,
        unlockRuleTitle: rule.title,
        sourceToolTitle: rule.sourceTool?.title ?? null
      }
    ];
  });
  const lockedContent: PlayerLockedContentPrompt[] = [
    ...lockedEvidence.map((item) => ({
      targetType: "GameEvidence" as const,
      targetId: item.evidenceId,
      title: item.title,
      contentTypeLabel: `Locked ${item.evidenceType.toLowerCase()}`,
      detailLabel: item.roundTitle,
      unlockRuleId: item.unlockRuleId,
      unlockRuleTitle: item.unlockRuleTitle,
      sourceToolTitle: item.sourceToolTitle
    })),
    ...lockedCards,
    ...lockedMedia,
    ...lockedArtifacts
  ];

  return {
    tools: toolDisplays.filter((tool) => tool.codes.length || tool.toolType !== "ACCESS_CODE_GENERATOR"),
    lockedEvidence,
    lockedContent
  };
}

export async function attemptPlayerCodeUnlock(input: {
  guestId: string;
  unlockRuleId: string;
  code: string;
}): Promise<PlayerCodeUnlockResult> {
  const code = normalizeCode(input.code);
  if (!code) return { status: "FAILED", reason: "invalid-code" };

  const guest = await getGuestContext(input.guestId);
  const assignment = guest?.assignments[0];
  if (!guest) return { status: "FAILED", reason: "invalid-guest" };
  if (guest.status !== "JOINED" || guest.party.status === "COMPLETED") return { status: "FAILED", reason: "not-joined" };
  if (!assignment || !guest.party.gameVersionId) return { status: "FAILED", reason: "missing-assignment" };

  const unlockedRuleIds = getUnlockedRuleIdsForGuest(guest.party.unlockEvents, guest.id);
  if (unlockedRuleIds.has(input.unlockRuleId)) {
    return { status: "FAILED", reason: "already-unlocked" };
  }

  const rule = await prisma.gameUnlockRule.findFirst({
    where: {
      id: input.unlockRuleId,
      gameVersionId: guest.party.gameVersionId,
      status: "PUBLISHED",
      ruleType: "ACCESS_CODE",
      triggerType: "CODE_ENTRY",
      codeMode: "PARTY_TOOL_CODE"
    }
  });
  if (!rule) return { status: "FAILED", reason: "invalid-rule" };

  const panel = await getPlayerToolPanel(guest.id);
  const prompt = panel.lockedContent.find((item) => item.unlockRuleId === rule.id);
  if (!prompt) return { status: "FAILED", reason: "target-not-available" };

  const toolInstance = await prisma.partyToolInstance.findFirst({
    where: {
      partyId: guest.partyId,
      unlockRuleId: rule.id,
      characterToolId: rule.sourceToolId ?? undefined,
      status: "ACTIVE",
      usesRemaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    orderBy: { createdAt: "asc" }
  });

  if (!toolInstance) {
    await prisma.partyCodeAttempt.create({
      data: {
        partyId: guest.partyId,
        unlockRuleId: rule.id,
        actorGuestId: guest.id,
        codeHash: crypto.createHmac("sha256", getAccessCodeSecret()).update(code).digest("hex"),
        status: "FAILED",
        metadata: {
          reason: "no_active_code"
        }
      }
    });
    return { status: "FAILED", reason: "no-active-code" };
  }

  const result = await attemptCodeUnlock({
    partyId: guest.partyId,
    actorGuestId: guest.id,
    targetGuestId: guest.id,
    toolInstanceId: toolInstance.id,
    unlockRuleId: rule.id,
    code
  });

  if (result.status === "UNLOCKED") {
    return { status: "UNLOCKED", unlockRuleId: rule.id };
  }

  return { status: "FAILED", reason: "invalid-code" };
}
