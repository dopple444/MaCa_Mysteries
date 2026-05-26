import Link from "next/link";
import { notFound } from "next/navigation";

import { getRecentAccountRecoveryAuditEvents, getRecentAccountRecoveryCases } from "../../lib/account-recovery";
import { hasAdminPermission } from "../../lib/admin-permissions";
import { getUserRoleLabel, requireUser } from "../../lib/auth";
import { getCsrfToken } from "../../lib/csrf";

export const dynamic = "force-dynamic";

function formatActivityTime(date: Date | null) {
  if (!date) return "Not recorded";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function getStatusMessage(error?: string, updated?: string) {
  if (error === "csrf") return "The request expired. Try again.";
  if (error === "invalid-email") return "Enter a valid account email.";
  if (error === "missing-ticket") return "That support ticket could not be found.";
  if (error === "ticket-email-mismatch") return "The account email must match the linked support ticket email.";
  if (error === "missing-case") return "That recovery case could not be found.";
  if (error === "closed") return "That recovery case is already closed.";
  if (error === "no-target") return "No matching account exists for that recovery case.";
  if (error === "needs-verification") return "Mark identity verification as complete before queuing a password reset.";
  if (error === "not-queued") return "The recovery email could not be queued.";
  if (error === "invalid-status") return "Choose a valid review status.";
  if (updated === "created") return "Account recovery case created.";
  if (updated === "exists") return "An open recovery case already exists for that email.";
  if (updated === "reviewed") return "Recovery case reviewed.";
  if (updated === "closed") return "Recovery case closed.";
  if (updated === "reset") return "Password reset email queued.";
  if (updated === "verification") return "Email verification message queued.";
  if (updated === "already-verified") return "That account email is already verified.";
  return "";
}

function getActorName(user: { name: string; email: string } | null) {
  if (!user) return "System";
  return user.name || user.email;
}

function getAuditTitle(action: string) {
  switch (action) {
    case "accountRecovery.case.created":
      return "Case created";
    case "accountRecovery.case.reviewed":
      return "Case reviewed";
    case "accountRecovery.passwordResetQueued":
      return "Password reset queued";
    case "accountRecovery.emailVerificationQueued":
      return "Email verification queued";
    case "accountRecovery.case.closed":
      return "Case closed";
    default:
      return action.replaceAll(".", " ");
  }
}

function getMetadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export default async function AdminAccountRecoveryPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  if (!hasAdminPermission(user, "support")) notFound();

  const csrfToken = await getCsrfToken();
  const params = await searchParams;
  const statusMessage = getStatusMessage(params?.error, params?.updated);
  const statusClass = params?.error ? "bg-yellow-500/10 text-yellow-100" : "bg-emerald-500/10 text-emerald-100";

  const [recoveryCases, auditEvents] = await Promise.all([
    getRecentAccountRecoveryCases(),
    getRecentAccountRecoveryAuditEvents()
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <Link href="/admin" className="text-sm font-semibold text-indigo-300 hover:text-white">
          Back to admin
        </Link>
        <p className="mt-6 text-sm uppercase tracking-[0.3em] text-indigo-300">Support operations</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Account recovery</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Review account access cases, record identity checks, and queue recovery emails without exposing reset links.
        </p>

        {statusMessage && <p className={`mt-6 rounded-2xl px-4 py-3 text-sm ${statusClass}`}>{statusMessage}</p>}

        <section className="mt-8 rounded-2xl bg-slate-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Create case</h2>
          <form action="/admin/account-recovery/create" method="post" className="mt-4 grid gap-4 lg:grid-cols-2">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Account email
              <input
                name="email"
                type="email"
                placeholder="customer@example.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Request type
              <select
                name="requestType"
                defaultValue="ACCOUNT_ACCESS"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400"
              >
                <option value="ACCOUNT_ACCESS">Account access</option>
                <option value="PASSWORD_RESET">Password reset</option>
                <option value="EMAIL_VERIFICATION">Email verification</option>
                <option value="PURCHASE_ACCESS">Purchase access</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 lg:col-span-2">
              Support ticket ID
              <input
                name="supportTicketId"
                placeholder="Optional"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 lg:col-span-2">
              Internal notes
              <textarea
                name="notes"
                rows={3}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400"
              />
            </label>
            <button className="justify-self-start rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
              Create recovery case
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-2xl bg-slate-950/70 p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Recovery cases</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{recoveryCases.length} shown</p>
          </div>
          {recoveryCases.length ? (
            <div className="mt-4 grid gap-4">
              {recoveryCases.map((recoveryCase) => {
                const isClosed = recoveryCase.status === "CLOSED" || recoveryCase.status === "DENIED";
                const canQueueReset = recoveryCase.verificationStatus === "VERIFIED" && recoveryCase.targetUser && !isClosed;
                const canQueueVerification =
                  recoveryCase.targetUser && !recoveryCase.targetUser.emailVerifiedAt && !isClosed;

                return (
                  <article key={recoveryCase.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                            {recoveryCase.status}
                          </span>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                            {recoveryCase.verificationStatus}
                          </span>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                            {recoveryCase.requestType.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-3 break-words text-lg font-semibold text-white">{recoveryCase.email}</p>
                        <p className="mt-2 text-sm text-slate-300">
                          {recoveryCase.targetUser
                            ? `${recoveryCase.targetUser.name || recoveryCase.targetUser.email} (${getUserRoleLabel(
                                recoveryCase.targetUser.role
                              )})`
                            : "No matching user account"}
                        </p>
                        {recoveryCase.targetUser && (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-slate-300">
                            <span className="rounded-full bg-slate-950 px-3 py-1">
                              {recoveryCase.targetUser.emailVerifiedAt ? "Verified email" : "Unverified email"}
                            </span>
                            <span className="rounded-full bg-slate-950 px-3 py-1">
                              {recoveryCase.targetUser._count.sessions} sessions
                            </span>
                            <span className="rounded-full bg-slate-950 px-3 py-1">
                              {recoveryCase.targetUser._count.orders} orders
                            </span>
                            <span className="rounded-full bg-slate-950 px-3 py-1">
                              {recoveryCase.targetUser._count.parties} parties
                            </span>
                          </div>
                        )}
                        {recoveryCase.supportTicket && (
                          <Link
                            href={`/admin/support/${recoveryCase.supportTicket.id}`}
                            className="mt-3 inline-block text-sm font-semibold text-indigo-300 hover:text-white"
                          >
                            Support ticket: {recoveryCase.supportTicket.subject}
                          </Link>
                        )}
                        <p className="mt-3 text-xs text-slate-500">
                          Created by {getActorName(recoveryCase.requestedByUser)} at{" "}
                          {formatActivityTime(recoveryCase.createdAt)}
                        </p>
                        {recoveryCase.reviewedByUser && (
                          <p className="mt-1 text-xs text-slate-500">
                            Last reviewed by {getActorName(recoveryCase.reviewedByUser)} at{" "}
                            {formatActivityTime(recoveryCase.reviewedAt)}
                          </p>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[24rem]">
                        <form action={`/admin/account-recovery/${recoveryCase.id}/review`} method="post">
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="verificationStatus" value="VERIFIED" />
                          <button
                            disabled={isClosed || recoveryCase.verificationStatus === "VERIFIED"}
                            className="w-full rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-semibold text-emerald-100 hover:border-emerald-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                          >
                            Mark verified
                          </button>
                        </form>
                        <form action={`/admin/account-recovery/${recoveryCase.id}/review`} method="post">
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="verificationStatus" value="FAILED" />
                          <button
                            disabled={isClosed || recoveryCase.verificationStatus === "FAILED"}
                            className="w-full rounded-full border border-yellow-300/30 px-4 py-2 text-sm font-semibold text-yellow-100 hover:border-yellow-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                          >
                            Mark failed
                          </button>
                        </form>
                        <form action={`/admin/account-recovery/${recoveryCase.id}/queue-password-reset`} method="post">
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <button
                            disabled={!canQueueReset}
                            className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                          >
                            Queue reset
                          </button>
                        </form>
                        <form action={`/admin/account-recovery/${recoveryCase.id}/queue-email-verification`} method="post">
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <button
                            disabled={!canQueueVerification}
                            className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                          >
                            Queue verification
                          </button>
                        </form>
                        <form action={`/admin/account-recovery/${recoveryCase.id}/review`} method="post" className="sm:col-span-2">
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="resolutionStatus" value="CLOSED" />
                          <button
                            disabled={isClosed}
                            className="w-full rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-100 hover:border-red-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                          >
                            Close case
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-slate-900/80 p-4 text-slate-300">No account recovery cases yet.</p>
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-950/70 p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Recovery audit</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{auditEvents.length} events</p>
          </div>
          {auditEvents.length ? (
            <div className="mt-4 grid gap-3">
              {auditEvents.map((event) => (
                <article key={event.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{getAuditTitle(event.action)}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {getMetadataValue(event.metadata, "email") || "Unknown account"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">By {getActorName(event.user)}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {formatActivityTime(event.createdAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No account recovery audit events yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
