import { getAdminAlertRecipients, getAdminAlertUrl, getAlertDedupeCutoff } from "./admin-alerts";
import { queueEmailMessage } from "./outbound-delivery";
import { prisma } from "./prisma";

const DEFAULT_FAILED_CODE_ATTEMPT_WINDOW_MINUTES = 15;
const DEFAULT_FAILED_CODE_ATTEMPT_THRESHOLD = 5;
const DEFAULT_CONDITIONAL_ALERT_DEDUPE_MINUTES = 60;

type EnvMap = Partial<Record<string, string | undefined>>;

type ConditionalUnlockAlertInput = {
  now?: Date;
  windowMinutes?: number;
  threshold?: number;
  dedupeMinutes?: number;
  env?: EnvMap;
};

type GuestLabelInput = {
  name: string | null;
  email: string;
} | null;

function getGuestLabel(guest: GuestLabelInput) {
  if (!guest) return "Unknown player";
  return guest.name || guest.email;
}

function getRuleLabel(rule: { title: string; key: string } | null, includeSpoilers: boolean) {
  if (!rule) return "Conditional unlock";
  return includeSpoilers ? rule.title : "Conditional unlock";
}

function getToolLabel(tool: { title: string; key: string } | null | undefined, includeSpoilers: boolean) {
  if (!tool) return "Character tool";
  return includeSpoilers ? tool.title : "Character tool";
}

function getTargetTypeLabel(targetType: string | null | undefined) {
  switch (targetType) {
    case "GameCard":
      return "Card";
    case "GameEvidence":
      return "Evidence";
    case "GameMediaAsset":
      return "Media";
    case "GameDigitalArtifact":
      return "Digital artifact";
    default:
      return targetType ?? "Content";
  }
}

function normalizePositiveInteger(value: number | undefined, fallback: number, max: number) {
  if (!value || !Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

function getFailedCodeAttemptCutoff(input: ConditionalUnlockAlertInput = {}) {
  const now = input.now ?? new Date();
  const windowMinutes = normalizePositiveInteger(
    input.windowMinutes,
    DEFAULT_FAILED_CODE_ATTEMPT_WINDOW_MINUTES,
    24 * 60
  );
  return {
    now,
    windowMinutes,
    cutoff: new Date(now.getTime() - windowMinutes * 60 * 1000)
  };
}

export async function getPartyConditionalActivity(input: {
  partyId: string;
  hostId: string;
  includeSpoilers?: boolean;
  take?: number;
}) {
  const take = Math.min(Math.max(input.take ?? 8, 1), 25);
  const includeSpoilers = Boolean(input.includeSpoilers);
  const party = await prisma.party.findFirst({
    where: {
      id: input.partyId,
      hostId: input.hostId
    },
    select: {
      id: true,
      _count: {
        select: {
          codeAttempts: true,
          unlockEvents: true
        }
      },
      codeAttempts: {
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          status: true,
          createdAt: true,
          actorGuest: {
            select: {
              name: true,
              email: true
            }
          },
          unlockRule: {
            select: {
              title: true,
              key: true,
              targetType: true,
              unlockScope: true
            }
          },
          toolInstance: {
            select: {
              characterTool: {
                select: {
                  title: true,
                  key: true
                }
              }
            }
          }
        }
      },
      unlockEvents: {
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          status: true,
          targetType: true,
          unlockScope: true,
          createdAt: true,
          actorGuest: {
            select: {
              name: true,
              email: true
            }
          },
          targetGuest: {
            select: {
              name: true,
              email: true
            }
          },
          unlockRule: {
            select: {
              title: true,
              key: true,
              targetType: true,
              unlockScope: true
            }
          }
        }
      }
    }
  });

  if (!party) return null;

  return {
    counts: {
      codeAttempts: party._count.codeAttempts,
      unlockEvents: party._count.unlockEvents
    },
    codeAttempts: party.codeAttempts.map((attempt) => ({
      id: attempt.id,
      status: attempt.status,
      createdAt: attempt.createdAt,
      actorLabel: getGuestLabel(attempt.actorGuest),
      ruleLabel: getRuleLabel(attempt.unlockRule, includeSpoilers),
      targetTypeLabel: getTargetTypeLabel(attempt.unlockRule?.targetType),
      unlockScope: attempt.unlockRule?.unlockScope ?? "PLAYER",
      toolLabel: getToolLabel(attempt.toolInstance?.characterTool, includeSpoilers)
    })),
    unlockEvents: party.unlockEvents.map((event) => ({
      id: event.id,
      status: event.status,
      createdAt: event.createdAt,
      actorLabel: getGuestLabel(event.actorGuest),
      targetGuestLabel: getGuestLabel(event.targetGuest),
      ruleLabel: getRuleLabel(event.unlockRule, includeSpoilers),
      targetTypeLabel: getTargetTypeLabel(event.unlockRule?.targetType ?? event.targetType),
      unlockScope: event.unlockRule?.unlockScope ?? event.unlockScope
    }))
  };
}

export async function getConditionalUnlockAlertSummary(input: ConditionalUnlockAlertInput = {}) {
  const { cutoff, windowMinutes } = getFailedCodeAttemptCutoff(input);
  const threshold = normalizePositiveInteger(input.threshold, DEFAULT_FAILED_CODE_ATTEMPT_THRESHOLD, 1000);

  const [failedCodeAttemptCount, failedAttemptsForScope, recentFailedAttempts] = await Promise.all([
    prisma.partyCodeAttempt.count({
      where: {
        status: "FAILED",
        createdAt: { gte: cutoff }
      }
    }),
    prisma.partyCodeAttempt.findMany({
      where: {
        status: "FAILED",
        createdAt: { gte: cutoff }
      },
      select: {
        partyId: true,
        actorGuestId: true
      },
      take: 1000
    }),
    prisma.partyCodeAttempt.findMany({
      where: {
        status: "FAILED",
        createdAt: { gte: cutoff }
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        partyId: true,
        createdAt: true,
        party: {
          select: {
            title: true
          }
        },
        actorGuest: {
          select: {
            name: true,
            email: true
          }
        },
        unlockRule: {
          select: {
            title: true,
            key: true,
            targetType: true
          }
        }
      }
    })
  ]);

  return {
    failedCodeAttemptCount,
    affectedPartyCount: new Set(failedAttemptsForScope.map((attempt) => attempt.partyId)).size,
    affectedPlayerCount: new Set(failedAttemptsForScope.map((attempt) => attempt.actorGuestId).filter(Boolean)).size,
    windowMinutes,
    threshold,
    cutoff,
    shouldAlert: failedCodeAttemptCount >= threshold,
    recentFailedAttempts: recentFailedAttempts.map((attempt) => ({
      id: attempt.id,
      partyId: attempt.partyId,
      partyTitle: attempt.party.title,
      actorLabel: getGuestLabel(attempt.actorGuest),
      ruleLabel: getRuleLabel(attempt.unlockRule, true),
      targetTypeLabel: getTargetTypeLabel(attempt.unlockRule?.targetType),
      createdAt: attempt.createdAt
    }))
  };
}

export async function queueConditionalUnlockAlert(input: ConditionalUnlockAlertInput = {}) {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const recipients = getAdminAlertRecipients(env);
  const summary = await getConditionalUnlockAlertSummary({ ...input, now });

  if (!recipients.length) {
    return {
      status: "NOT_CONFIGURED" as const,
      queuedCount: 0,
      skippedDuplicateCount: 0,
      recipients,
      summary
    };
  }

  if (!summary.shouldAlert) {
    return {
      status: "NO_ALERTS" as const,
      queuedCount: 0,
      skippedDuplicateCount: 0,
      recipients,
      summary
    };
  }

  const adminUrl = getAdminAlertUrl(env, "/admin");
  const bodyPreview = [
    "Conditional unlock attention needed.",
    `${summary.failedCodeAttemptCount} failed code attempts in ${summary.windowMinutes} minutes.`,
    `Affected parties: ${summary.affectedPartyCount}.`,
    `Affected players: ${summary.affectedPlayerCount}.`,
    `Review: ${adminUrl}`
  ].join(" ");
  const dedupeCutoff = getAlertDedupeCutoff(now, input.dedupeMinutes, DEFAULT_CONDITIONAL_ALERT_DEDUPE_MINUTES);
  let queuedCount = 0;
  let skippedDuplicateCount = 0;

  for (const recipient of recipients) {
    const existing = await prisma.outboundMessage.findFirst({
      where: {
        channel: "EMAIL",
        recipient,
        templateKey: "conditional_unlock_alert",
        createdAt: { gte: dedupeCutoff }
      },
      select: { id: true }
    });

    if (existing) {
      skippedDuplicateCount += 1;
      continue;
    }

    const message = await queueEmailMessage({
      recipient,
      templateKey: "conditional_unlock_alert",
      subject: "MaCa Mysteries conditional unlock alert",
      bodyPreview
    });

    if (message) queuedCount += 1;
  }

  return {
    status: queuedCount ? ("QUEUED" as const) : ("DUPLICATE" as const),
    queuedCount,
    skippedDuplicateCount,
    recipients,
    summary
  };
}

export async function getAdminConditionalActivity(input: { take?: number } = {}) {
  const take = Math.min(Math.max(input.take ?? 8, 1), 25);
  const [codeAttemptCount, failedCodeAttemptCount, unlockEventCount, codeAttempts, unlockEvents] = await Promise.all([
    prisma.partyCodeAttempt.count(),
    prisma.partyCodeAttempt.count({ where: { status: "FAILED" } }),
    prisma.partyUnlockEvent.count(),
    prisma.partyCodeAttempt.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        partyId: true,
        status: true,
        createdAt: true,
        party: {
          select: {
            title: true
          }
        },
        actorGuest: {
          select: {
            name: true,
            email: true
          }
        },
        unlockRule: {
          select: {
            title: true,
            key: true,
            targetType: true,
            unlockScope: true
          }
        },
        toolInstance: {
          select: {
            characterTool: {
              select: {
                title: true,
                key: true
              }
            }
          }
        }
      }
    }),
    prisma.partyUnlockEvent.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        partyId: true,
        status: true,
        targetType: true,
        unlockScope: true,
        createdAt: true,
        party: {
          select: {
            title: true
          }
        },
        actorGuest: {
          select: {
            name: true,
            email: true
          }
        },
        targetGuest: {
          select: {
            name: true,
            email: true
          }
        },
        unlockRule: {
          select: {
            title: true,
            key: true,
            targetType: true,
            unlockScope: true
          }
        }
      }
    })
  ]);

  return {
    counts: {
      codeAttempts: codeAttemptCount,
      failedCodeAttempts: failedCodeAttemptCount,
      unlockEvents: unlockEventCount
    },
    codeAttempts: codeAttempts.map((attempt) => ({
      id: attempt.id,
      partyId: attempt.partyId,
      partyTitle: attempt.party.title,
      status: attempt.status,
      createdAt: attempt.createdAt,
      actorLabel: getGuestLabel(attempt.actorGuest),
      ruleLabel: getRuleLabel(attempt.unlockRule, true),
      targetTypeLabel: getTargetTypeLabel(attempt.unlockRule?.targetType),
      unlockScope: attempt.unlockRule?.unlockScope ?? "PLAYER",
      toolLabel: getToolLabel(attempt.toolInstance?.characterTool, true)
    })),
    unlockEvents: unlockEvents.map((event) => ({
      id: event.id,
      partyId: event.partyId,
      partyTitle: event.party.title,
      status: event.status,
      createdAt: event.createdAt,
      actorLabel: getGuestLabel(event.actorGuest),
      targetGuestLabel: getGuestLabel(event.targetGuest),
      ruleLabel: getRuleLabel(event.unlockRule, true),
      targetTypeLabel: getTargetTypeLabel(event.unlockRule?.targetType ?? event.targetType),
      unlockScope: event.unlockRule?.unlockScope ?? event.unlockScope
    }))
  };
}
