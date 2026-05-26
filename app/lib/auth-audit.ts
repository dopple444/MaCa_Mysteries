import { logAuditEvent } from "./audit-log";

type AuthAuditInput = {
  action: "auth.login.success" | "auth.login.failed" | "auth.login.rateLimited" | "auth.logout" | "account.created";
  userId?: string | null;
  email?: string;
  reason?: string;
};

export async function logAuthAuditEvent({ action, userId, email, reason }: AuthAuditInput) {
  const normalizedEmail = (email ?? "").trim().toLowerCase();

  await logAuditEvent({
    action,
    userId: userId || null,
    entityType: userId ? "User" : "",
    entityId: userId || "",
    metadata: {
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      ...(reason ? { reason } : {})
    }
  });
}
