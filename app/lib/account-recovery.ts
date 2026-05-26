import type { AccountRecoveryCase, Prisma } from "@prisma/client";

import { hasAdminPermission } from "./admin-permissions";
import { queueEmailVerificationMessage, queuePasswordResetMessage } from "./account-security";
import { logAuditEvent } from "./audit-log";
import { prisma } from "./prisma";

type UserLike = {
  id: string;
  role: string;
};

type CreateAccountRecoveryCaseInput = {
  actor: UserLike;
  email?: string | null;
  supportTicketId?: string | null;
  requestType?: string | null;
  notes?: string | null;
};

type AccountRecoveryCaseInput = {
  actor: UserLike;
  caseId: string;
};

type ReviewAccountRecoveryCaseInput = AccountRecoveryCaseInput & {
  verificationStatus?: string | null;
  resolutionStatus?: string | null;
  note?: string | null;
};

type AccountRecoveryReportInput = {
  now?: Date;
  staleAfterHours?: number;
  recentDays?: number;
};

const ACCOUNT_RECOVERY_REQUEST_TYPES = [
  "ACCOUNT_ACCESS",
  "PASSWORD_RESET",
  "EMAIL_VERIFICATION",
  "PURCHASE_ACCESS"
] as const;

const ACCOUNT_RECOVERY_STATUSES = ["OPEN", "ACTIONED", "CLOSED", "DENIED"] as const;
const ACCOUNT_RECOVERY_VERIFICATION_STATUSES = ["PENDING", "VERIFIED", "FAILED"] as const;

export const ACCOUNT_RECOVERY_AUDIT_ACTIONS = [
  "accountRecovery.case.created",
  "accountRecovery.case.reviewed",
  "accountRecovery.passwordResetQueued",
  "accountRecovery.emailVerificationQueued",
  "accountRecovery.case.closed"
] as const;

export function normalizeRecoveryEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase().slice(0, 254);
}

function normalizeRecoveryNote(note: string | null | undefined) {
  return (note ?? "").trim().slice(0, 2000);
}

function normalizeRequestType(requestType: string | null | undefined) {
  const normalized = (requestType ?? "").trim().toUpperCase();
  return (ACCOUNT_RECOVERY_REQUEST_TYPES as readonly string[]).includes(normalized)
    ? normalized
    : "ACCOUNT_ACCESS";
}

function normalizeVerificationStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toUpperCase();
  return (ACCOUNT_RECOVERY_VERIFICATION_STATUSES as readonly string[]).includes(normalized)
    ? normalized
    : "";
}

function normalizeResolutionStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toUpperCase();
  return (ACCOUNT_RECOVERY_STATUSES as readonly string[]).includes(normalized) ? normalized : "";
}

function canManageAccountRecovery(user: UserLike | null | undefined) {
  return hasAdminPermission(user, "support");
}

function isRecoverableCase(recoveryCase: Pick<AccountRecoveryCase, "status">) {
  return recoveryCase.status !== "CLOSED" && recoveryCase.status !== "DENIED";
}

async function logAccountRecoveryEvent({
  actor,
  recoveryCase,
  action,
  metadata = {}
}: {
  actor: UserLike;
  recoveryCase: Pick<AccountRecoveryCase, "id" | "email" | "targetUserId" | "supportTicketId">;
  action: (typeof ACCOUNT_RECOVERY_AUDIT_ACTIONS)[number];
  metadata?: Prisma.InputJsonObject;
}) {
  await logAuditEvent({
    userId: actor.id,
    action,
    entityType: "AccountRecoveryCase",
    entityId: recoveryCase.id,
    metadata: {
      email: recoveryCase.email,
      targetUserId: recoveryCase.targetUserId ?? "",
      supportTicketId: recoveryCase.supportTicketId ?? "",
      ...metadata
    }
  });
}

export async function getRecentAccountRecoveryCases(take = 20) {
  return prisma.accountRecoveryCase.findMany({
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
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          role: true,
          _count: {
            select: {
              sessions: true,
              orders: true,
              parties: true,
              supportTickets: true
            }
          }
        }
      },
      reviewedByUser: {
        select: {
          name: true,
          email: true
        }
      },
      supportTicket: {
        select: {
          id: true,
          subject: true,
          status: true,
          email: true
        }
      }
    }
  });
}

export async function getRecentAccountRecoveryAuditEvents(take = 12) {
  return prisma.auditLog.findMany({
    where: {
      action: { in: [...ACCOUNT_RECOVERY_AUDIT_ACTIONS] }
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

export async function getAccountRecoveryReport(input: AccountRecoveryReportInput = {}) {
  const now = input.now ?? new Date();
  const staleAfterHours =
    Number.isFinite(input.staleAfterHours) && input.staleAfterHours && input.staleAfterHours > 0
      ? input.staleAfterHours
      : 48;
  const recentDays =
    Number.isFinite(input.recentDays) && input.recentDays && input.recentDays > 0 ? input.recentDays : 7;
  const staleCutoff = new Date(now.getTime() - staleAfterHours * 60 * 60 * 1000);
  const recentCutoff = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);

  const [
    openCaseCount,
    actionedCaseCount,
    pendingVerificationCount,
    verifiedOpenCaseCount,
    staleOpenCaseCount,
    passwordResetQueuedRecentCount,
    emailVerificationQueuedRecentCount,
    closedRecentCount,
    deniedRecentCount
  ] = await prisma.$transaction([
    prisma.accountRecoveryCase.count({ where: { status: "OPEN" } }),
    prisma.accountRecoveryCase.count({ where: { status: "ACTIONED" } }),
    prisma.accountRecoveryCase.count({
      where: {
        status: { in: ["OPEN", "ACTIONED"] },
        verificationStatus: "PENDING"
      }
    }),
    prisma.accountRecoveryCase.count({
      where: {
        status: "OPEN",
        verificationStatus: "VERIFIED"
      }
    }),
    prisma.accountRecoveryCase.count({
      where: {
        status: { in: ["OPEN", "ACTIONED"] },
        createdAt: { lt: staleCutoff }
      }
    }),
    prisma.accountRecoveryCase.count({
      where: {
        passwordResetQueuedAt: { gte: recentCutoff }
      }
    }),
    prisma.accountRecoveryCase.count({
      where: {
        emailVerificationQueuedAt: { gte: recentCutoff }
      }
    }),
    prisma.accountRecoveryCase.count({
      where: {
        status: "CLOSED",
        reviewedAt: { gte: recentCutoff }
      }
    }),
    prisma.accountRecoveryCase.count({
      where: {
        status: "DENIED",
        reviewedAt: { gte: recentCutoff }
      }
    })
  ]);

  return {
    openCaseCount,
    actionedCaseCount,
    pendingVerificationCount,
    verifiedOpenCaseCount,
    staleOpenCaseCount,
    passwordResetQueuedRecentCount,
    emailVerificationQueuedRecentCount,
    closedRecentCount,
    deniedRecentCount,
    staleCutoff,
    recentCutoff
  };
}

export async function createAccountRecoveryCase(input: CreateAccountRecoveryCaseInput) {
  if (!canManageAccountRecovery(input.actor)) return { status: "FORBIDDEN" as const };

  const supportTicketId = (input.supportTicketId ?? "").trim();
  const supportTicket = supportTicketId
    ? await prisma.supportTicket.findUnique({
        where: { id: supportTicketId },
        select: { id: true, email: true, userId: true }
      })
    : null;
  if (supportTicketId && !supportTicket) return { status: "MISSING_TICKET" as const };

  const inputEmail = normalizeRecoveryEmail(input.email);
  const ticketEmail = normalizeRecoveryEmail(supportTicket?.email);
  if (supportTicket && inputEmail && ticketEmail && inputEmail !== ticketEmail) {
    return { status: "EMAIL_TICKET_MISMATCH" as const };
  }

  const email = inputEmail || ticketEmail;
  if (!email || !email.includes("@")) return { status: "INVALID_EMAIL" as const };

  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true }
  });

  const existingCase = await prisma.accountRecoveryCase.findFirst({
    where: {
      email,
      status: { in: ["OPEN", "ACTIONED"] }
    },
    select: { id: true }
  });
  if (existingCase) return { status: "EXISTS" as const, caseId: existingCase.id };

  const recoveryCase = await prisma.accountRecoveryCase.create({
    data: {
      requestedByUserId: input.actor.id,
      targetUserId: targetUser?.id ?? supportTicket?.userId ?? null,
      supportTicketId: supportTicket?.id ?? null,
      email,
      requestType: normalizeRequestType(input.requestType),
      notes: normalizeRecoveryNote(input.notes)
    }
  });

  await logAccountRecoveryEvent({
    actor: input.actor,
    recoveryCase,
    action: "accountRecovery.case.created",
    metadata: {
      requestType: recoveryCase.requestType
    }
  });

  return { status: "CREATED" as const, caseId: recoveryCase.id, recoveryCase };
}

export async function reviewAccountRecoveryCase(input: ReviewAccountRecoveryCaseInput) {
  if (!canManageAccountRecovery(input.actor)) return { status: "FORBIDDEN" as const };

  const recoveryCase = await prisma.accountRecoveryCase.findUnique({ where: { id: input.caseId } });
  if (!recoveryCase) return { status: "NOT_FOUND" as const };

  const verificationStatus = normalizeVerificationStatus(input.verificationStatus);
  const resolutionStatus = normalizeResolutionStatus(input.resolutionStatus);
  const note = normalizeRecoveryNote(input.note);
  if (!verificationStatus && !resolutionStatus) return { status: "INVALID_STATUS" as const };

  const data: Prisma.AccountRecoveryCaseUpdateInput = {
    reviewedByUser: { connect: { id: input.actor.id } },
    reviewedAt: new Date()
  };
  if (verificationStatus) data.verificationStatus = verificationStatus;
  if (resolutionStatus) data.status = resolutionStatus;
  if (note) data.resolutionNote = note;

  const updated = await prisma.accountRecoveryCase.update({
    where: { id: recoveryCase.id },
    data
  });

  await logAccountRecoveryEvent({
    actor: input.actor,
    recoveryCase: updated,
    action: resolutionStatus === "CLOSED" || resolutionStatus === "DENIED"
      ? "accountRecovery.case.closed"
      : "accountRecovery.case.reviewed",
    metadata: {
      verificationStatus: updated.verificationStatus,
      status: updated.status
    }
  });

  return { status: "UPDATED" as const, recoveryCase: updated };
}

export async function queueAccountRecoveryPasswordReset(input: AccountRecoveryCaseInput) {
  if (!canManageAccountRecovery(input.actor)) return { status: "FORBIDDEN" as const };

  const recoveryCase = await prisma.accountRecoveryCase.findUnique({
    where: { id: input.caseId },
    include: {
      targetUser: {
        select: {
          id: true,
          email: true,
          passwordHash: true
        }
      }
    }
  });
  if (!recoveryCase) return { status: "NOT_FOUND" as const };
  if (!isRecoverableCase(recoveryCase)) return { status: "CLOSED" as const };
  if (recoveryCase.verificationStatus !== "VERIFIED") return { status: "NEEDS_VERIFICATION" as const };
  if (!recoveryCase.targetUser || !recoveryCase.targetUser.passwordHash) return { status: "NO_TARGET" as const };

  const queued = await queuePasswordResetMessage(recoveryCase.targetUser.email);
  if (!queued.queued) return { status: "NOT_QUEUED" as const };

  const updated = await prisma.accountRecoveryCase.update({
    where: { id: recoveryCase.id },
    data: {
      status: "ACTIONED",
      passwordResetQueuedAt: new Date(),
      reviewedByUserId: input.actor.id,
      reviewedAt: new Date()
    }
  });

  await logAccountRecoveryEvent({
    actor: input.actor,
    recoveryCase: updated,
    action: "accountRecovery.passwordResetQueued"
  });

  return { status: "QUEUED" as const, recoveryCase: updated };
}

export async function queueAccountRecoveryEmailVerification(input: AccountRecoveryCaseInput) {
  if (!canManageAccountRecovery(input.actor)) return { status: "FORBIDDEN" as const };

  const recoveryCase = await prisma.accountRecoveryCase.findUnique({
    where: { id: input.caseId },
    include: {
      targetUser: {
        select: {
          id: true,
          emailVerifiedAt: true
        }
      }
    }
  });
  if (!recoveryCase) return { status: "NOT_FOUND" as const };
  if (!isRecoverableCase(recoveryCase)) return { status: "CLOSED" as const };
  if (!recoveryCase.targetUser) return { status: "NO_TARGET" as const };
  if (recoveryCase.targetUser.emailVerifiedAt) return { status: "ALREADY_VERIFIED" as const };

  const queued = await queueEmailVerificationMessage(recoveryCase.targetUser.id);
  if (!queued.queued) return { status: "NOT_QUEUED" as const };

  const updated = await prisma.accountRecoveryCase.update({
    where: { id: recoveryCase.id },
    data: {
      status: "ACTIONED",
      emailVerificationQueuedAt: new Date(),
      reviewedByUserId: input.actor.id,
      reviewedAt: new Date()
    }
  });

  await logAccountRecoveryEvent({
    actor: input.actor,
    recoveryCase: updated,
    action: "accountRecovery.emailVerificationQueued"
  });

  return { status: "QUEUED" as const, recoveryCase: updated };
}
