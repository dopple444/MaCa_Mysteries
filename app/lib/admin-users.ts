import type { Prisma, UserRole } from "@prisma/client";

import { isKnownUserRole } from "./admin-permissions";
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
  "auth.logout"
] as const;

export function normalizeManagedUserSearch(query: string | null | undefined) {
  return (query ?? "").trim().slice(0, 100);
}

export function normalizeManagedUserRoleFilter(role: string | null | undefined) {
  const normalized = (role ?? "").trim().toUpperCase();
  return isKnownUserRole(normalized) ? normalized : "";
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

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: nextRole },
    select: { id: true, email: true, role: true }
  });

  await logAuditEvent({
    userId: input.actor.id,
    action: "admin.user.roleChanged",
    entityType: "User",
    entityId: updated.id,
    metadata: {
      targetEmail: updated.email,
      previousRole: target.role,
      nextRole: updated.role
    }
  });

  return { status: "UPDATED" as const, user: updated, previousRole: target.role };
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

  const result = await prisma.userSession.deleteMany({
    where: { userId: target.id }
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
