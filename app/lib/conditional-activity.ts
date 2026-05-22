import { prisma } from "./prisma";

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
