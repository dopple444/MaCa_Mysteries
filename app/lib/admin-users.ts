import type { Prisma, UserRole } from "@prisma/client";

import { isKnownUserRole, isOperationalAdminRole } from "./admin-permissions";
import { ACCOUNT_RECOVERY_AUDIT_ACTIONS } from "./account-recovery";
import { logAuditEvent } from "./audit-log";
import { prisma } from "./prisma";

type UserLike = {
  id: string;
  role: string;
};

type UpdateUserRoleInput = {
  actor: UserLike;
  targetUserId: string;
  role: string;
};

type RevokeUserSessionsInput = {
  actor: UserLike;
  targetUserId: string;
};

type ReviewAdminActionRequestInput = {
  actor: UserLike;
  requestId: string;
  reviewNote?: string;
};

type ManagedUserListInput = {
  query?: string;
  role?: string;
  take?: number;
};

export const ADMIN_USER_AUDIT_ACTIONS = [
  "admin.user.roleChanged",
  "admin.user.sessionsRevoked",
  "account.created",
  "account.email.verified",
  "account.password.reset",
  "auth.login.success",
  "auth.login.failed",
  "auth.login.rateLimited",
  "auth.login.locked",
  "auth.logout",
  "admin.actionRequest.created",
  "admin.actionRequest.approved",
  "admin.actionRequest.denied",
  ...ACCOUNT_RECOVERY_AUDIT_ACTIONS
] as const;

export function normalizeManagedUserSearch(query: string | null | undefined) {
  return (query ?? "").trim().slice(0, 100);
}

export function normalizeManagedUserRoleFilter(role: string | null | undefined) {
  const normalized = (role ?? "").trim().toUpperCase();
  return isKnownUserRole(normalized) ? normalized : "";
}

function normalizeReviewNote(reviewNote: string | null | undefined) {
  return (reviewNote ?? "").trim().slice(0, 500);
}

function isSensitiveRoleChange(previousRole: string, nextRole: string) {
  return isOperationalAdminRole(previousRole) || isOperationalAdminRole(nextRole);
}

export async function getSuperAdminCount() {
  return prisma.user.count({ where: { role: "SUPER_ADMIN" } });
}

export async function canManageAdminUsers(user: UserLike | null | undefined) {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role !== "ADMIN") return false;

  return (await getSuperAdminCount()) === 0;
}

export async function getAdminUserManagementContext(user: UserLike | null | undefined) {
  const superAdminCount = await getSuperAdminCount();
  const canManage = Boolean(
    user && (user.role === "SUPER_ADMIN" || (user.role === "ADMIN" && superAdminCount === 0))
  );

  return {
    canManage,
    bootstrapMode: Boolean(user && user.role === "ADMIN" && superAdminCount === 0),
    superAdminCount
  };
}

export async function getManagedUsers({ query, role, take = 200 }: ManagedUserListInput = {}) {
  const search = normalizeManagedUserSearch(query);
  const roleFilter = normalizeManagedUserRoleFilter(role);
  const where: Prisma.UserWhereInput = {
    ...(roleFilter ? { role: roleFilter as UserRole } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  };

  return prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { email: "asc" }],
    take,
    include: {
      sessions: {
        where: {
          revokedAt: null,
          expiresAt: { gt: new Date() }
        },
        orderBy: { lastSeenAt: "desc" },
        take: 3
      },
      _count: {
        select: {
          sessions: true,
          parties: true,
          orders: true,
          supportTickets: true
        }
      }
    }
  });
}

export async function getRecentAdminUserEvents(take = 12) {
  return prisma.auditLog.findMany({
    where: {
      action: { in: [...ADMIN_USER_AUDIT_ACTIONS] }
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });
}

export async function getAdminActionRequests(take = 12) {
  return prisma.adminActionRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take,
    include: {
      requestedByUser: {
        select: {
          name: true,
          email: true
        }
      },
      targetUser: {
        select: {
          name: true,
          email: true,
          role: true
        }
      },
      reviewedByUser: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });
}

export async function updateManagedUserRole(input: UpdateUserRoleInput) {
  if (!(await canManageAdminUsers(input.actor))) {
    return { status: "FORBIDDEN" as const };
  }

  if (!isKnownUserRole(input.role)) {
    return { status: "INVALID_ROLE" as const };
  }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, email: true, role: true }
  });

  if (!target) return { status: "NOT_FOUND" as const };

  const nextRole = input.role as UserRole;
  if (target.role === "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN") {
    const superAdminCount = await getSuperAdminCount();
    if (superAdminCount <= 1) {
      return { status: "LAST_SUPER_ADMIN" as const };
    }
  }

  if (target.role === nextRole) {
    return { status: "UNCHANGED" as const, user: target };
  }

  const superAdminCount = await getSuperAdminCount();
  if (superAdminCount > 0 && isSensitiveRoleChange(target.role, nextRole)) {
    const existingRequest = await prisma.adminActionRequest.findFirst({
      where: {
        actionType: "USER_ROLE_CHANGE",
        status: "PENDING",
        targetUserId: target.id,
        requestedRole: nextRole
      },
      select: { id: true }
    });

    if (existingRequest) {
      return { status: "REQUEST_EXISTS" as const, requestId: existingRequest.id, user: target };
    }

    const request = await prisma.adminActionRequest.create({
      data: {
        requestedByUserId: input.actor.id,
        targetUserId: target.id,
        actionType: "USER_ROLE_CHANGE",
        status: "PENDING",
        targetType: "User",
        targetId: target.id,
        previousRole: target.role,
        requestedRole: nextRole,
        metadata: {
          targetEmail: target.email,
          previousRole: target.role,
          requestedRole: nextRole
        }
      },
      select: { id: true }
    });

    await logAuditEvent({
      userId: input.actor.id,
      action: "admin.actionRequest.created",
      entityType: "AdminActionRequest",
      entityId: request.id,
      metadata: {
        actionType: "USER_ROLE_CHANGE",
        targetUserId: target.id,
        targetEmail: target.email,
        previousRole: target.role,
        requestedRole: nextRole
      }
    });

    return { status: "REQUESTED" as const, requestId: request.id, user: target };
  }

  const roleChangedAt = new Date();
  const [updated, revokedSessions] = await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { role: nextRole },
      select: { id: true, email: true, role: true }
    }),
    prisma.userSession.updateMany({
      where: {
        userId: target.id,
        revokedAt: null
      },
      data: {
        revokedAt: roleChangedAt,
        revokedByUserId: input.actor.id,
        revokeReason: "ROLE_CHANGED"
      }
    })
  ]);

  await logAuditEvent({
    userId: input.actor.id,
    action: "admin.user.roleChanged",
    entityType: "User",
    entityId: updated.id,
    metadata: {
      targetEmail: updated.email,
      previousRole: target.role,
      nextRole: updated.role,
      revokedSessionCount: revokedSessions.count
    }
  });

  return { status: "UPDATED" as const, user: updated, previousRole: target.role, revokedSessionCount: revokedSessions.count };
}

export async function approveAdminActionRequest(input: ReviewAdminActionRequestInput) {
  if (!(await canManageAdminUsers(input.actor))) {
    return { status: "FORBIDDEN" as const };
  }

  const request = await prisma.adminActionRequest.findUnique({
    where: { id: input.requestId },
    include: {
      targetUser: {
        select: { id: true, email: true, role: true }
      }
    }
  });

  if (!request) return { status: "NOT_FOUND" as const };
  if (request.status !== "PENDING") return { status: "NOT_PENDING" as const };
  if (request.actionType !== "USER_ROLE_CHANGE" || !request.targetUserId || !request.targetUser) {
    return { status: "UNSUPPORTED" as const };
  }
  if (!isKnownUserRole(request.requestedRole)) {
    return { status: "INVALID_ROLE" as const };
  }

  const nextRole = request.requestedRole as UserRole;
  if (request.targetUser.role === "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN") {
    const superAdminCount = await getSuperAdminCount();
    if (superAdminCount <= 1) {
      return { status: "LAST_SUPER_ADMIN" as const };
    }
  }

  const reviewNote = normalizeReviewNote(input.reviewNote);
  const targetUser = request.targetUser;
  const previousRole = targetUser.role;

  const roleChangedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: targetUser.id },
      data: { role: nextRole },
      select: { id: true, email: true, role: true }
    });
    const revokedSessions = await tx.userSession.updateMany({
      where: {
        userId: targetUser.id,
        revokedAt: null
      },
      data: {
        revokedAt: roleChangedAt,
        revokedByUserId: input.actor.id,
        revokeReason: "ROLE_CHANGED"
      }
    });
    await tx.adminActionRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedByUserId: input.actor.id,
        reviewedAt: new Date(),
        reviewNote
      }
    });
    await tx.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "admin.actionRequest.approved",
        entityType: "AdminActionRequest",
        entityId: request.id,
        metadata: {
          actionType: request.actionType,
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          previousRole,
          nextRole,
          revokedSessionCount: revokedSessions.count
        }
      }
    });
    await tx.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "admin.user.roleChanged",
        entityType: "User",
        entityId: targetUser.id,
        metadata: {
          requestId: request.id,
          targetEmail: targetUser.email,
          previousRole,
          nextRole,
          revokedSessionCount: revokedSessions.count
        }
      }
    });

    return { updated, revokedSessionCount: revokedSessions.count };
  });

  return {
    status: "APPROVED" as const,
    user: result.updated,
    previousRole,
    requestId: request.id,
    revokedSessionCount: result.revokedSessionCount
  };
}

export async function denyAdminActionRequest(input: ReviewAdminActionRequestInput) {
  if (!(await canManageAdminUsers(input.actor))) {
    return { status: "FORBIDDEN" as const };
  }

  const request = await prisma.adminActionRequest.findUnique({
    where: { id: input.requestId },
    include: {
      targetUser: {
        select: { id: true, email: true, role: true }
      }
    }
  });

  if (!request) return { status: "NOT_FOUND" as const };
  if (request.status !== "PENDING") return { status: "NOT_PENDING" as const };

  const reviewNote = normalizeReviewNote(input.reviewNote);
  await prisma.$transaction([
    prisma.adminActionRequest.update({
      where: { id: request.id },
      data: {
        status: "DENIED",
        reviewedByUserId: input.actor.id,
        reviewedAt: new Date(),
        reviewNote
      }
    }),
    prisma.auditLog.create({
      data: {
        userId: input.actor.id,
        action: "admin.actionRequest.denied",
        entityType: "AdminActionRequest",
        entityId: request.id,
        metadata: {
          actionType: request.actionType,
          targetUserId: request.targetUserId,
          targetEmail: request.targetUser?.email ?? "",
          previousRole: request.previousRole,
          requestedRole: request.requestedRole
        }
      }
    })
  ]);

  return { status: "DENIED" as const, requestId: request.id };
}

export async function revokeManagedUserSessions(input: RevokeUserSessionsInput) {
  if (!(await canManageAdminUsers(input.actor))) {
    return { status: "FORBIDDEN" as const };
  }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, email: true, role: true }
  });

  if (!target) return { status: "NOT_FOUND" as const };

  const result = await prisma.userSession.updateMany({
    where: {
      userId: target.id,
      revokedAt: null
    },
    data: {
      revokedAt: new Date(),
      revokedByUserId: input.actor.id,
      revokeReason: "ADMIN_REVOKE"
    }
  });

  await logAuditEvent({
    userId: input.actor.id,
    action: "admin.user.sessionsRevoked",
    entityType: "User",
    entityId: target.id,
    metadata: {
      targetEmail: target.email,
      targetRole: target.role,
      revokedSessionCount: result.count
    }
  });

  return { status: "REVOKED" as const, user: target, revokedSessionCount: result.count };
}
