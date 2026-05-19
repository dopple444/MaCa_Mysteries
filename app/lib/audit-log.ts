import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

type AuditLogInput = {
  action: string;
  userId?: string | null;
  partyId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function logAuditEvent({
  action,
  userId,
  partyId,
  entityType = "",
  entityId = "",
  metadata = {}
}: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      action,
      userId: userId || null,
      partyId: partyId || null,
      entityType,
      entityId,
      metadata
    }
  });
}
