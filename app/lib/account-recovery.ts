import type { AccountRecoveryCase, Prisma } from "@prisma/client";

import { hasAdminPermission } from "./admin-permissions";
import { getAdminAlertRecipients, getAdminAlertUrl, getAlertDedupeCutoff } from "./admin-alerts";
import { queueEmailVerificationMessage, queuePasswordResetMessage } from "./account-security";
import { logAuditEvent } from "./audit-log";
import { queueEmailMessage } from "./outbound-delivery";
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
  riskWindowDays?: number;
  repeatedEmailThreshold?: number;
  failedVerificationThreshold?: number;
  emailDomain?: string;
};

type AccountRecoveryRiskSummaryInput = {
  now?: Date;
  windowDays?: number;
  repeatedEmailThreshold?: number;
  failedVerificationThreshold?: number;
  emailDomain?: string;
};

type AccountRecoveryRiskAlertInput = AccountRecoveryRiskSummaryInput & {
  env?: Partial<Record<string, string | undefined>>;
  dedupeMinutes?: number;
};

const ACCOUNT_RECOVERY_REQUEST_TYPES = [
  "ACCOUNT_ACCESS",
  "PASSWORD_RESET",
  "EMAIL_VERIFICATION",
  "PURCHASE_ACCESS"
] as const;

const ACCOUNT_RECOVERY_STATUSES = ["OPEN", "ACTIONED", "CLOSED", "DENIED"] as const;
const ACCOUNT_RECOVERY_VERIFICATION_STATUSES = ["PENDING", "VERIFIED", "FAILED"] as const;
const DEFAULT_ACCOUNT_RECOVERY_RISK_WINDOW_DAYS = 30;
const DEFAULT_ACCOUNT_RECOVERY_REPEATED_EMAIL_THRESHOLD = 3;
const DEFAULT_ACCOUNT_RECOVERY_FAILED_VERIFICATION_THRESHOLD = 3;
const DEFAULT_ACCOUNT_RECOVERY_RISK_ALERT_DEDUPE_MINUTES = 360;

export const ACCOUNT_RECOVERY_AUDIT_ACTIONS = [
  "accountRecovery.case.created",
  "accountRecovery.case.reviewed",
  "accountRecovery.passwordResetQueued",
  "accountRecovery.emailVerificationQueued",
  "accountRecovery.case.closed",
  "accountRecovery.riskAlertQueued"
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

function normalizePositiveNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value && value > 0 ? value : fallback;
}

function getAccountRecoveryEmailWhere(emailDomain: string | undefined) {
  const normalized = emailDomain?.trim().toLowerCase();
  return normalized ? { email: { endsWith: normalized } } : {};
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

export async function getAccountRecoveryRiskSummary(input: AccountRecoveryRiskSummaryInput = {}) {
  const now = input.now ?? new Date();
  const windowDays = normalizePositiveNumber(input.windowDays, DEFAULT_ACCOUNT_RECOVERY_RISK_WINDOW_DAYS);
  const repeatedEmailThreshold = normalizePositiveNumber(
    input.repeatedEmailThreshold,
    DEFAULT_ACCOUNT_RECOVERY_REPEATED_EMAIL_THRESHOLD
  );
  const failedVerificationThreshold = normalizePositiveNumber(
    input.failedVerificationThreshold,
    DEFAULT_ACCOUNT_RECOVERY_FAILED_VERIFICATION_THRESHOLD
  );
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const emailWhere = getAccountRecoveryEmailWhere(input.emailDomain);
  const recentCases = await prisma.accountRecoveryCase.findMany({
    where: {
      ...emailWhere,
      createdAt: { gte: cutoff }
    },
    select: {
      email: true,
      verificationStatus: true,
      status: true
    }
  });
  const countsByEmail = new Map<string, number>();

  for (const recoveryCase of recentCases) {
    const email = normalizeRecoveryEmail(recoveryCase.email);
    if (!email) continue;
    countsByEmail.set(email, (countsByEmail.get(email) ?? 0) + 1);
  }

  const repeatedEmailCount = [...countsByEmail.values()].filter((count) => count >= repeatedEmailThreshold).length;
  const failedVerificationCount = recentCases.filter((recoveryCase) => recoveryCase.verificationStatus === "FAILED").length;
  const activeCaseCount = recentCases.filter(
    (recoveryCase) => recoveryCase.status === "OPEN" || recoveryCase.status === "ACTIONED"
  ).length;

  return {
    caseCount: recentCases.length,
    activeCaseCount,
    repeatedEmailCount,
    failedVerificationCount,
    windowDays,
    repeatedEmailThreshold,
    failedVerificationThreshold,
    cutoff,
    shouldAlert: repeatedEmailCount > 0 || failedVerificationCount >= failedVerificationThreshold
  };
}

export async function queueAccountRecoveryRiskAlert(input: AccountRecoveryRiskAlertInput = {}) {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const recipients = getAdminAlertRecipients(env);
  const summary = await getAccountRecoveryRiskSummary({ ...input, now });

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

  const adminUrl = getAdminAlertUrl(env, "/admin/account-recovery");
  const bodyPreview = [
    "Account recovery attention needed.",
    `${summary.caseCount} recovery cases in ${summary.windowDays} days.`,
    `Repeated account emails: ${summary.repeatedEmailCount}.`,
    `Failed identity checks: ${summary.failedVerificationCount}.`,
    `Active cases: ${summary.activeCaseCount}.`,
    `Review: ${adminUrl}`
  ].join(" ");
  const dedupeCutoff = getAlertDedupeCutoff(
    now,
    input.dedupeMinutes,
    DEFAULT_ACCOUNT_RECOVERY_RISK_ALERT_DEDUPE_MINUTES
  );
  let queuedCount = 0;
  let skippedDuplicateCount = 0;

  for (const recipient of recipients) {
    const existing = await prisma.outboundMessage.findFirst({
      where: {
        channel: "EMAIL",
        recipient,
        templateKey: "account_recovery_risk_alert",
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
      templateKey: "account_recovery_risk_alert",
      subject: "MaCa Mysteries account recovery alert",
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

export async function getAccountRecoveryReport(input: AccountRecoveryReportInput = {}) {
  const now = input.now ?? new Date();
  const staleAfterHours = normalizePositiveNumber(input.staleAfterHours, 48);
  const recentDays = normalizePositiveNumber(input.recentDays, 7);
  const staleCutoff = new Date(now.getTime() - staleAfterHours * 60 * 60 * 1000);
  const recentCutoff = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);
  const emailWhere = getAccountRecoveryEmailWhere(input.emailDomain);

  const [
    [
      openCaseCount,
      actionedCaseCount,
      pendingVerificationCount,
      verifiedOpenCaseCount,
      staleOpenCaseCount,
      passwordResetQueuedRecentCount,
      emailVerificationQueuedRecentCount,
      closedRecentCount,
      deniedRecentCount
    ],
    riskSummary
  ] = await Promise.all([
    prisma.$transaction([
      prisma.accountRecoveryCase.count({ where: { ...emailWhere, status: "OPEN" } }),
      prisma.accountRecoveryCase.count({ where: { ...emailWhere, status: "ACTIONED" } }),
      prisma.accountRecoveryCase.count({
        where: {
          ...emailWhere,
          status: { in: ["OPEN", "ACTIONED"] },
          verificationStatus: "PENDING"
        }
      }),
      prisma.accountRecoveryCase.count({
        where: {
          ...emailWhere,
          status: "OPEN",
          verificationStatus: "VERIFIED"
        }
      }),
      prisma.accountRecoveryCase.count({
        where: {
          ...emailWhere,
          status: { in: ["OPEN", "ACTIONED"] },
          createdAt: { lt: staleCutoff }
        }
      }),
      prisma.accountRecoveryCase.count({
        where: {
          ...emailWhere,
          passwordResetQueuedAt: { gte: recentCutoff }
        }
      }),
      prisma.accountRecoveryCase.count({
        where: {
          ...emailWhere,
          emailVerificationQueuedAt: { gte: recentCutoff }
        }
      }),
      prisma.accountRecoveryCase.count({
        where: {
          ...emailWhere,
          status: "CLOSED",
          reviewedAt: { gte: recentCutoff }
        }
      }),
      prisma.accountRecoveryCase.count({
        where: {
          ...emailWhere,
          status: "DENIED",
          reviewedAt: { gte: recentCutoff }
        }
      })
    ]),
    getAccountRecoveryRiskSummary({
      now,
      windowDays: input.riskWindowDays,
      repeatedEmailThreshold: input.repeatedEmailThreshold,
      failedVerificationThreshold: input.failedVerificationThreshold,
      emailDomain: input.emailDomain
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
    repeatedEmailRiskCount: riskSummary.repeatedEmailCount,
    failedVerificationRiskCount: riskSummary.failedVerificationCount,
    shouldQueueRiskAlert: riskSummary.shouldAlert,
    riskWindowDays: riskSummary.windowDays,
    repeatedEmailThreshold: riskSummary.repeatedEmailThreshold,
    failedVerificationThreshold: riskSummary.failedVerificationThreshold,
    riskCutoff: riskSummary.cutoff,
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
