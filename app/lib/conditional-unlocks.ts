import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

type ActorType = "ADMIN" | "HOST" | "PLAYER";

type IdSetInput = Set<string> | string[] | undefined;

export type ConditionalContentTarget = {
  visibility: string;
  characterId?: string | null;
  gameRoundId?: string | null;
  requiredUnlockRuleId?: string | null;
};

export type ConditionalActorContext = {
  actorType: ActorType;
  characterId?: string | null;
  guestId?: string | null;
  activeRoundIds?: IdSetInput;
  completedRoundIds?: IdSetInput;
  unlockedRuleIds?: IdSetInput;
  hostSpoilerModeUnlocked?: boolean;
};

type UnlockEventForGuest = {
  unlockRuleId: string | null;
  targetGuestId?: string | null;
  actorGuestId?: string | null;
  unlockScope: string;
  status: string;
};

type CreatePartyToolInstanceWithCodeInput = {
  partyId: string;
  characterToolId: string;
  unlockRuleId?: string | null;
  guestId?: string | null;
  code: string;
  usesRemaining?: number;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
};

type AttemptCodeUnlockInput = {
  partyId: string;
  actorGuestId: string;
  toolInstanceId: string;
  unlockRuleId: string;
  code: string;
  targetGuestId?: string | null;
};

function toSet(value: IdSetInput) {
  return value instanceof Set ? value : new Set(value ?? []);
}

function normalizeVisibility(value: string) {
  return value.trim().toUpperCase();
}

function normalizeScope(value: string) {
  return value.trim().toUpperCase();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function createSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashAccessCode(code: string, salt: string) {
  return crypto.createHash("sha256").update(`${salt}:${normalizeCode(code)}`).digest("hex");
}

function hasRequiredUnlock(content: ConditionalContentTarget, context: ConditionalActorContext) {
  const requiredUnlockRuleId = content.requiredUnlockRuleId?.trim();
  if (!requiredUnlockRuleId || context.actorType === "ADMIN") return true;
  return toSet(context.unlockedRuleIds).has(requiredUnlockRuleId);
}

function isRoundAvailable(content: ConditionalContentTarget, context: ConditionalActorContext) {
  if (!content.gameRoundId || context.actorType === "ADMIN" || context.actorType === "HOST") return true;
  return toSet(context.activeRoundIds).has(content.gameRoundId) || toSet(context.completedRoundIds).has(content.gameRoundId);
}

export function canActorSeeConditionalContent(
  content: ConditionalContentTarget,
  context: ConditionalActorContext
) {
  if (!hasRequiredUnlock(content, context) || !isRoundAvailable(content, context)) return false;
  if (context.actorType === "ADMIN") return true;

  const visibility = normalizeVisibility(content.visibility);

  if (context.actorType === "HOST") {
    if (visibility === "SPOILER_PROTECTED") return Boolean(context.hostSpoilerModeUnlocked);
    return visibility === "PUBLIC" || visibility === "HOST_SAFE";
  }

  if (visibility === "PUBLIC") return true;
  if (visibility !== "PLAYER_PRIVATE") return false;

  return Boolean(context.characterId && content.characterId === context.characterId);
}

export function getUnlockedRuleIdsForGuest(events: UnlockEventForGuest[], guestId: string) {
  return new Set(
    events
      .filter((event) => event.status === "UNLOCKED" && event.unlockRuleId)
      .filter((event) => {
        const scope = normalizeScope(event.unlockScope);
        if (["PARTY", "ALL_PLAYERS", "HOST_AND_PLAYERS"].includes(scope)) return true;
        if (scope === "PLAYER") return event.targetGuestId === guestId || (!event.targetGuestId && event.actorGuestId === guestId);
        return false;
      })
      .map((event) => event.unlockRuleId as string)
  );
}

export function getUnlockedRuleIdsForHost(events: UnlockEventForGuest[]) {
  return new Set(
    events
      .filter((event) => event.status === "UNLOCKED" && event.unlockRuleId)
      .filter((event) => ["PARTY", "HOST", "HOST_AND_PLAYERS"].includes(normalizeScope(event.unlockScope)))
      .map((event) => event.unlockRuleId as string)
  );
}

export async function createPartyToolInstanceWithCode(input: CreatePartyToolInstanceWithCodeInput) {
  const salt = createSalt();
  const codeHash = hashAccessCode(input.code, salt);

  return prisma.partyToolInstance.create({
    data: {
      partyId: input.partyId,
      characterToolId: input.characterToolId,
      unlockRuleId: input.unlockRuleId ?? null,
      guestId: input.guestId ?? null,
      codeHash,
      codeSalt: salt,
      usesRemaining: Math.max(1, input.usesRemaining ?? 1),
      expiresAt: input.expiresAt ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
    }
  });
}

export async function attemptCodeUnlock(input: AttemptCodeUnlockInput) {
  const toolInstance = await prisma.partyToolInstance.findUnique({
    where: { id: input.toolInstanceId },
    include: {
      unlockRule: true
    }
  });

  const attemptedHash = toolInstance?.codeSalt ? hashAccessCode(input.code, toolInstance.codeSalt) : "";
  const now = new Date();
  const rule = toolInstance?.unlockRuleId === input.unlockRuleId ? toolInstance.unlockRule : null;
  const isValid =
    Boolean(toolInstance && rule) &&
    toolInstance?.partyId === input.partyId &&
    toolInstance?.status === "ACTIVE" &&
    (!toolInstance.expiresAt || toolInstance.expiresAt > now) &&
    toolInstance.usesRemaining > 0 &&
    attemptedHash === toolInstance.codeHash;

  if (!isValid || !rule) {
    const attempt = await prisma.partyCodeAttempt.create({
      data: {
        partyId: input.partyId,
        unlockRuleId: input.unlockRuleId,
        toolInstanceId: input.toolInstanceId,
        actorGuestId: input.actorGuestId,
        codeHash: attemptedHash,
        status: "FAILED",
        metadata: {
          reason: "invalid_or_expired"
        }
      }
    });

    return {
      status: "FAILED" as const,
      attempt,
      unlockEvent: null
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.partyToolInstance.updateMany({
      where: {
        id: toolInstance.id,
        partyId: input.partyId,
        status: "ACTIVE",
        usesRemaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      data: {
        usesRemaining: { decrement: 1 }
      }
    });

    if (updateResult.count !== 1) {
      const attempt = await tx.partyCodeAttempt.create({
        data: {
          partyId: input.partyId,
          unlockRuleId: input.unlockRuleId,
          toolInstanceId: input.toolInstanceId,
          actorGuestId: input.actorGuestId,
          codeHash: attemptedHash,
          status: "FAILED",
          metadata: {
            reason: "already_used_or_expired"
          }
        }
      });

      return {
        status: "FAILED" as const,
        attempt,
        unlockEvent: null
      };
    }

    await tx.partyToolInstance.updateMany({
      where: {
        id: toolInstance.id,
        usesRemaining: { lte: 0 }
      },
      data: {
        status: "USED"
      }
    });

    const attempt = await tx.partyCodeAttempt.create({
      data: {
        partyId: input.partyId,
        unlockRuleId: input.unlockRuleId,
        toolInstanceId: input.toolInstanceId,
        actorGuestId: input.actorGuestId,
        codeHash: attemptedHash,
        status: "SUCCESS",
        metadata: {
          reason: "matched"
        }
      }
    });

    const unlockEvent = await tx.partyUnlockEvent.create({
      data: {
        partyId: input.partyId,
        unlockRuleId: rule.id,
        actorGuestId: input.actorGuestId,
        targetGuestId: input.targetGuestId ?? input.actorGuestId,
        targetType: rule.targetType,
        targetId: rule.targetId,
        unlockScope: rule.unlockScope,
        status: "UNLOCKED",
        metadata: {
          toolInstanceId: toolInstance.id,
          codeAttemptId: attempt.id
        }
      }
    });

    return {
      status: "UNLOCKED" as const,
      attempt,
      unlockEvent
    };
  });

  return result;
}
