import Link from "next/link";
import { notFound } from "next/navigation";

import { USER_ROLE_OPTIONS } from "../../lib/admin-permissions";
import {
  getAdminUserManagementContext,
  getManagedUsers,
  getRecentAdminUserEvents,
  normalizeManagedUserRoleFilter,
  normalizeManagedUserSearch
} from "../../lib/admin-users";
import { getUserRoleLabel, requireUser } from "../../lib/auth";
import { getCsrfToken } from "../../lib/csrf";

export const dynamic = "force-dynamic";

function formatActivityTime(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function getStatusMessage(error?: string, updated?: string) {
  if (error === "last-super-admin") return "At least one super administrator must remain active.";
  if (error === "invalid-role") return "Choose a valid role.";
  if (error === "missing-user") return "That user could not be found.";
  if (error === "csrf") return "The request expired. Try again.";
  if (updated === "role") return "Role updated.";
  if (updated === "sessions") return "Sessions revoked.";
  if (updated === "unchanged") return "No role change was needed.";
  return "";
}

function getMetadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function getAdminUserEventTitle(action: string) {
  switch (action) {
    case "admin.user.roleChanged":
      return "Role changed";
    case "admin.user.sessionsRevoked":
      return "Sessions revoked";
    case "account.created":
      return "Account created";
    case "account.email.verified":
      return "Email verified";
    case "account.password.reset":
      return "Password reset";
    case "auth.login.success":
      return "Sign-in succeeded";
    case "auth.login.failed":
      return "Sign-in failed";
    case "auth.login.rateLimited":
      return "Sign-in rate limited";
    case "auth.logout":
      return "Signed out";
    default:
      return action.replaceAll(".", " ");
  }
}

function getAdminUserEventDetail(log: Awaited<ReturnType<typeof getRecentAdminUserEvents>>[number]) {
  const targetEmail =
    getMetadataValue(log.metadata, "targetEmail") ||
    getMetadataValue(log.metadata, "email") ||
    log.user?.email ||
    "Unknown account";
  if (log.action === "admin.user.roleChanged") {
    const previousRole = getMetadataValue(log.metadata, "previousRole");
    const nextRole = getMetadataValue(log.metadata, "nextRole");
    return `${targetEmail}: ${previousRole || "unknown"} to ${nextRole || "unknown"}`;
  }
  if (log.action === "admin.user.sessionsRevoked") {
    const revokedSessionCount = getMetadataValue(log.metadata, "revokedSessionCount") || "0";
    return `${targetEmail}: ${revokedSessionCount} sessions revoked`;
  }
  if (log.action.startsWith("auth.login.")) {
    const reason = getMetadataValue(log.metadata, "reason");
    return reason ? `${targetEmail}: ${reason.replaceAll("_", " ")}` : targetEmail;
  }
  return targetEmail;
}

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; updated?: string; q?: string; role?: string }>;
}) {
  const user = await requireUser();
  const context = await getAdminUserManagementContext(user);
  if (!context.canManage) notFound();

  const csrfToken = await getCsrfToken();
  const params = await searchParams;
  const statusMessage = getStatusMessage(params?.error, params?.updated);
  const statusClass = params?.error ? "bg-yellow-500/10 text-yellow-100" : "bg-emerald-500/10 text-emerald-100";
  const search = normalizeManagedUserSearch(params?.q);
  const roleFilter = normalizeManagedUserRoleFilter(params?.role);
  const filterQuery = new URLSearchParams();
  if (search) filterQuery.set("q", search);
  if (roleFilter) filterQuery.set("role", roleFilter);
  const filterQueryString = filterQuery.toString();
  const actionQueryString = filterQueryString ? `?${filterQueryString}` : "";

  const [users, recentEvents] = await Promise.all([
    getManagedUsers({ query: search, role: roleFilter }),
    getRecentAdminUserEvents()
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <Link href="/admin" className="text-sm font-semibold text-indigo-300 hover:text-white">
          Back to admin
        </Link>
        <p className="mt-6 text-sm uppercase tracking-[0.3em] text-indigo-300">Super admin</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">User access</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Assign operational roles and revoke sessions for account recovery, support, finance, and content staff.
        </p>

        {context.bootstrapMode && (
          <p className="mt-6 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-3 text-sm leading-6 text-yellow-100">
            Bootstrap mode is active because no super administrator exists yet. Promote one trusted account to super
            administrator before public operations expand.
          </p>
        )}

        {statusMessage && (
          <p className={`mt-6 rounded-2xl px-4 py-3 text-sm ${statusClass}`}>{statusMessage}</p>
        )}

        <form method="get" className="mt-8 grid gap-4 rounded-2xl bg-slate-950/70 p-5 md:grid-cols-[1fr_14rem_auto] md:items-end">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Search
            <input
              name="q"
              defaultValue={search}
              placeholder="Name or email"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Role
            <select
              name="role"
              defaultValue={roleFilter}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400"
            >
              <option value="">All roles</option>
              {USER_ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {getUserRoleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:border-white">
              Filter
            </button>
            {(search || roleFilter) && (
              <Link
                href="/admin/users"
                className="rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:border-white/30 hover:text-white"
              >
                Clear
              </Link>
            )}
          </div>
        </form>

        <section className="mt-8 rounded-2xl bg-slate-950/70 p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Recent account security</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{recentEvents.length} events</p>
          </div>
          {recentEvents.length ? (
            <div className="mt-4 grid gap-3">
              {recentEvents.map((event) => (
                <article key={event.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{getAdminUserEventTitle(event.action)}</p>
                      <p className="mt-1 text-sm text-slate-300">{getAdminUserEventDetail(event)}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        By {event.user?.name || event.user?.email || "System"}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {formatActivityTime(event.createdAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No role or session changes have been logged yet.</p>
          )}
        </section>

        <div className="mt-8 grid gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Accounts</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{users.length} shown</p>
          </div>
          {users.map((account) => (
            <article key={account.id} className="rounded-2xl bg-slate-950/80 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-semibold text-white">{account.name || account.email}</p>
                  <p className="mt-1 text-sm text-slate-400">{account.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-slate-300">
                    <span className="rounded-full bg-slate-800 px-3 py-1">{getUserRoleLabel(account.role)}</span>
                    <span className="rounded-full bg-slate-800 px-3 py-1">{account._count.sessions} sessions</span>
                    <span className="rounded-full bg-slate-800 px-3 py-1">{account._count.parties} parties</span>
                    <span className="rounded-full bg-slate-800 px-3 py-1">{account._count.orders} orders</span>
                    <span className="rounded-full bg-slate-800 px-3 py-1">
                      {account.emailVerifiedAt ? "Verified" : "Unverified"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                    Updated {formatActivityTime(account.updatedAt)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
                  <form action={`/admin/users/${account.id}/role${actionQueryString}`} method="post" className="grid gap-3">
                    <input type="hidden" name="csrfToken" value={csrfToken} />
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Role
                      <select
                        name="role"
                        defaultValue={account.role}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400"
                      >
                        {USER_ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {getUserRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white">
                      Save role
                    </button>
                  </form>

                  <form
                    action={`/admin/users/${account.id}/sessions/revoke${actionQueryString}`}
                    method="post"
                    className="flex items-end"
                  >
                    <input type="hidden" name="csrfToken" value={csrfToken} />
                    <button className="w-full rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-100 hover:border-red-200">
                      Revoke sessions
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
          {!users.length && (
            <p className="rounded-2xl bg-slate-950/80 p-5 text-sm text-slate-400">
              No accounts match the current filters.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
