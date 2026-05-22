import { logAuditEvent } from "./audit-log";
import { getGameVersionPublishReadiness, type PublishReadinessResult } from "./publish-readiness";
import { prisma } from "./prisma";

export const GAME_VERSION_STATUSES = ["DRAFT", "PUBLISHED"] as const;

type GameVersionStatus = (typeof GAME_VERSION_STATUSES)[number];

export type UpdateGameVersionStatusResult =
  | {
      ok: true;
      status: GameVersionStatus;
    }
  | {
      ok: false;
      reason: "invalid-status" | "not-found" | "publish-readiness";
      readiness?: PublishReadinessResult;
    };

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

export async function updateGameVersionStatus(input: {
  gameId: string;
  versionId: string;
  userId: string;
  status: string;
}): Promise<UpdateGameVersionStatusResult> {
  const status = normalizeStatus(input.status);
  if (!GAME_VERSION_STATUSES.includes(status as GameVersionStatus)) {
    return { ok: false, reason: "invalid-status" };
  }

  const version = await prisma.gameVersion.findFirst({
    where: {
      id: input.versionId,
      gameId: input.gameId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!version) {
    return { ok: false, reason: "not-found" };
  }

  let readiness: PublishReadinessResult | undefined;
  if (status === "PUBLISHED") {
    readiness = await getGameVersionPublishReadiness({
      gameId: input.gameId,
      versionId: input.versionId
    });
    if (!readiness.ok) {
      return { ok: false, reason: "publish-readiness", readiness };
    }
  }

  await prisma.gameVersion.update({
    where: { id: input.versionId },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null
    }
  });
  await logAuditEvent({
    action: "admin.gameVersion.statusChanged",
    userId: input.userId,
    entityType: "GameVersion",
    entityId: input.versionId,
    metadata: {
      previousStatus: version.status,
      status,
      readiness: readiness
        ? {
            errorCount: readiness.errorCount,
            warningCount: readiness.warningCount
          }
        : undefined
    }
  });

  return {
    ok: true,
    status: status as GameVersionStatus
  };
}
