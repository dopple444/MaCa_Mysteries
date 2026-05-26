import Link from "next/link";
import { notFound } from "next/navigation";

import { hasAdminPermission, isOperationalAdminRole } from "../lib/admin-permissions";
import { canManageAdminUsers } from "../lib/admin-users";
import { requireUser } from "../lib/auth";
import { getAdminConditionalActivity } from "../lib/conditional-activity";
import { getCsrfToken } from "../lib/csrf";
import {
  getPaymentOperationsAlertRecipients,
  getRecoverableStripeCheckoutCutoff,
  getStalePendingOrderCutoff
} from "../lib/order-maintenance";
import { prisma } from "../lib/prisma";

export const dynamic = "force-dynamic";

function getAuditLabel(action: string) {
  switch (action) {
    case "party.assignment.saved":
      return "Character assignment saved";
    case "party.assignment.cleared":
      return "Character assignment cleared";
    case "party.round.unlocked":
      return "Round unlocked";
    case "party.round.started":
      return "Round started";
    case "party.round.completed":
      return "Round completed";
    case "party.evidence.revealed":
      return "Evidence revealed";
    case "party.evidence.hidden":
      return "Evidence hidden";
    case "party.finalReveal.victimRevealed":
      return "Victim reveal shown";
    case "party.finalReveal.victimHidden":
      return "Victim reveal hidden";
    case "party.finalReveal.solutionRevealed":
      return "Final solution shown";
    case "party.finalReveal.solutionHidden":
      return "Final solution hidden";
    case "party.accusation.submitted":
      return "Accusation submitted";
    case "payment.orders.stalePendingCancelled":
      return "Stale pending orders cancelled";
    case "payment.orders.paidAccessReconciled":
      return "Paid order access reconciled";
    case "payment.orders.stripeCheckoutsReconciled":
      return "Stripe checkout recovery run";
    case "payment.operations.alertQueued":
      return "Payment operations alert queued";
    case "payment.order.accessReconciled":
      return "Order access reconciled";
    case "outbound.email.deliveryRun":
      return "Email delivery run";
    case "admin.user.roleChanged":
      return "User role changed";
    case "admin.user.sessionsRevoked":
      return "User sessions revoked";
    case "admin.actionRequest.created":
      return "Admin approval requested";
    case "admin.actionRequest.approved":
      return "Admin approval accepted";
    case "admin.actionRequest.denied":
      return "Admin approval denied";
    case "account.created":
      return "Account created";
    case "account.email.verified":
      return "Email verified";
    case "account.password.reset":
      return "Password reset";
    case "accountRecovery.case.created":
      return "Account recovery case created";
    case "accountRecovery.case.reviewed":
      return "Account recovery case reviewed";
    case "accountRecovery.passwordResetQueued":
      return "Account recovery reset queued";
    case "accountRecovery.emailVerificationQueued":
      return "Account recovery verification queued";
    case "accountRecovery.case.closed":
      return "Account recovery case closed";
    case "auth.login.success":
      return "Sign-in succeeded";
    case "auth.login.failed":
      return "Sign-in failed";
    case "auth.login.rateLimited":
      return "Sign-in rate limited";
    case "auth.login.locked":
      return "Account locked";
    case "auth.logout":
      return "Signed out";
    case "conditional.unlocks.alertQueued":
      return "Conditional unlock alert queued";
    case "admin.gamePackage.validated":
      return "Game Package validated";
    default:
      return action.replaceAll(".", " ");
  }
}

function formatActivityTime(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: Promise<{
    messageStatus?: string;
    messageChannel?: string;
    orderStatus?: string;
    webhookStatus?: string;
  }>;
}) {
  const user = await requireUser();
  if (!isOperationalAdminRole(user.role)) notFound();
  const csrfToken = await getCsrfToken();
  const params = await searchParams;
  const canViewAudit = hasAdminPermission(user, "content") && hasAdminPermission(user, "payment");
  const canViewContent = hasAdminPermission(user, "content");
  const canViewPayments = hasAdminPermission(user, "payment");
  const canViewSupport = hasAdminPermission(user, "support");
  const canViewOutbound = hasAdminPermission(user, "outbound");
  const canManageUsers = await canManageAdminUsers(user);
  const messageStatus = params?.messageStatus?.trim().toUpperCase() ?? "";
  const messageChannel = params?.messageChannel?.trim().toUpperCase() ?? "";
  const orderStatus = params?.orderStatus?.trim().toUpperCase() ?? "";
  const webhookStatus = params?.webhookStatus?.trim().toUpperCase() ?? "";
  const outboundMessageWhere = {
    ...(messageStatus ? { status: messageStatus } : {}),
    ...(messageChannel ? { channel: messageChannel } : {})
  };
  const orderWhere = {
    ...(orderStatus ? { status: orderStatus } : {})
  };
  const webhookEventWhere = {
    ...(webhookStatus ? { status: webhookStatus } : {})
  };
  const stalePendingOrderCutoff = getStalePendingOrderCutoff();
  const adminAlertRecipientCount = getPaymentOperationsAlertRecipients().length;

  const [
    games,
    totals,
    auditLogs,
    conditionalActivity,
    recentOrders,
    outboundMessages,
    supportTickets,
    webhookEvents,
    stalePendingOrderCount,
    paidOrderCount,
    failedWebhookEventCount,
    recoverableStripeCheckoutCount
  ] = await Promise.all([
    canViewContent
      ? prisma.game.findMany({
          orderBy: { title: "asc" },
          include: {
            versions: {
              orderBy: { versionNumber: "asc" },
              include: {
                _count: {
                  select: {
                    characters: true,
                    rounds: true,
                    evidence: true,
                    mediaAssets: true
                  }
                },
                finalReveal: true
              }
            },
            products: {
              orderBy: { name: "asc" }
            }
          }
        })
      : Promise.resolve([]),
    prisma.$transaction([
      prisma.game.count(),
      prisma.gameVersion.count(),
      prisma.gameCharacter.count(),
      prisma.gameRound.count(),
      prisma.gameCard.count(),
      prisma.gameEvidence.count(),
      prisma.gameMediaAsset.count(),
      prisma.party.count(),
      prisma.guest.count(),
      prisma.partyAccusation.count(),
      prisma.auditLog.count(),
      prisma.order.count(),
      prisma.outboundMessage.count(),
      prisma.supportTicket.count(),
      prisma.accountRecoveryCase.count(),
      prisma.paymentWebhookEvent.count()
    ]),
    canViewAudit
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 12,
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            },
            party: {
              select: {
                title: true
              }
            }
          }
        })
      : Promise.resolve([]),
    canViewAudit ? getAdminConditionalActivity() : Promise.resolve(null),
    canViewPayments
      ? prisma.order.findMany({
          where: orderWhere,
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            },
            items: {
              include: {
                product: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        })
      : Promise.resolve([]),
    canViewOutbound
      ? prisma.outboundMessage.findMany({
          where: outboundMessageWhere,
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        })
      : Promise.resolve([]),
    canViewSupport
      ? prisma.supportTicket.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        })
      : Promise.resolve([]),
    canViewPayments
      ? prisma.paymentWebhookEvent.findMany({
          where: webhookEventWhere,
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            order: {
              select: {
                id: true,
                email: true,
                status: true,
                totalCents: true,
                currency: true
              }
            }
          }
        })
      : Promise.resolve([]),
    canViewPayments
      ? prisma.order.count({
          where: {
            status: "PENDING",
            createdAt: { lt: stalePendingOrderCutoff }
          }
        })
      : Promise.resolve(0),
    canViewPayments ? prisma.order.count({ where: { status: "PAID" } }) : Promise.resolve(0),
    canViewPayments ? prisma.paymentWebhookEvent.count({ where: { status: "FAILED" } }) : Promise.resolve(0),
    canViewPayments
      ? prisma.order.count({
          where: {
            status: "PENDING",
            paymentProvider: "stripe",
            paymentReference: { not: "" },
            createdAt: { lt: getRecoverableStripeCheckoutCutoff() }
          }
        })
      : Promise.resolve(0)
  ]);

  const [
    gameCount,
    versionCount,
    characterCount,
    roundCount,
    cardCount,
    evidenceCount,
    mediaCount,
    partyCount,
    guestCount,
    accusationCount,
    auditLogCount,
    orderCount,
    outboundMessageCount,
    supportTicketCount,
    accountRecoveryCaseCount,
    paymentWebhookEventCount
  ] = totals;

  const statCards: Array<[string, number]> = [];
  if (canViewContent) {
    statCards.push(
      ["Games", gameCount],
      ["Versions", versionCount],
      ["Characters", characterCount],
      ["Rounds", roundCount],
      ["Cards", cardCount],
      ["Evidence", evidenceCount],
      ["Media", mediaCount],
      ["Parties", partyCount],
      ["Guests", guestCount],
      ["Accusations", accusationCount]
    );
  }
  if (canViewAudit) statCards.push(["Audit Logs", auditLogCount]);
  if (canViewPayments) statCards.push(["Orders", orderCount], ["Webhooks", paymentWebhookEventCount]);
  if (canViewOutbound) statCards.push(["Messages", outboundMessageCount]);
  if (canViewSupport) statCards.push(["Support", supportTicketCount], ["Recovery", accountRecoveryCaseCount]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Admin inventory</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Content overview</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Read-only inventory for first-party game content and current play data.
        </p>
        {canViewContent && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/games/new"
              className="inline-flex rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Create game
            </Link>
            <Link
              href="/admin/games/package"
              className="inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:border-white"
            >
              Validate package
            </Link>
            <Link
              href="/admin/media/uploads"
              className="inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:border-white"
            >
              Upload media
            </Link>
          </div>
        )}
        {canManageUsers && (
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/admin/users"
              className="inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:border-white"
            >
              Manage users
            </Link>
          </div>
        )}
        {canViewSupport && (
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/admin/account-recovery"
              className="inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:border-white"
            >
              Account recovery
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {statCards.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        {canViewPayments && (
        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Payment operations</h2>
              <p className="mt-2 text-sm text-slate-400">
                Maintenance actions are idempotent and audit logged for Stripe test and production operations.
              </p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
              {failedWebhookEventCount} failed hooks
            </span>
          </div>
          {(failedWebhookEventCount > 0 || recoverableStripeCheckoutCount > 0) && (
            <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
              Payment attention needed: {failedWebhookEventCount} failed webhook
              {failedWebhookEventCount === 1 ? "" : "s"} and {recoverableStripeCheckoutCount} pending Stripe checkout
              {recoverableStripeCheckoutCount === 1 ? "" : "s"} ready for recovery review.
            </div>
          )}
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <form action="/admin/orders/maintenance" method="post" className="rounded-2xl bg-slate-900/80 p-4">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="operation" value="cancel-stale-pending" />
              <p className="text-sm font-semibold text-white">Stale pending checkouts</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {stalePendingOrderCount} pending order{stalePendingOrderCount === 1 ? "" : "s"} older than 24 hours.
              </p>
              <button className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white">
                Cancel stale pending
              </button>
            </form>
            <form action="/admin/orders/maintenance" method="post" className="rounded-2xl bg-slate-900/80 p-4">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="operation" value="reconcile-paid-access" />
              <p className="text-sm font-semibold text-white">Paid access reconciliation</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Recheck {paidOrderCount} paid order{paidOrderCount === 1 ? "" : "s"} and repair any missing game access.
              </p>
              <button className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white">
                Reconcile paid access
              </button>
            </form>
            <form action="/admin/orders/maintenance" method="post" className="rounded-2xl bg-slate-900/80 p-4">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="operation" value="reconcile-stripe-checkouts" />
              <p className="text-sm font-semibold text-white">Stripe checkout recovery</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Check {recoverableStripeCheckoutCount} pending Stripe checkout
                {recoverableStripeCheckoutCount === 1 ? "" : "s"} older than 10 minutes and fulfill completed payments.
              </p>
              <button className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white">
                Recover Stripe checkouts
              </button>
            </form>
            <form action="/admin/orders/maintenance" method="post" className="rounded-2xl bg-slate-900/80 p-4">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="operation" value="queue-payment-alert" />
              <p className="text-sm font-semibold text-white">Payment alert email</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Queue a deduped alert to {adminAlertRecipientCount} configured operations recipient
                {adminAlertRecipientCount === 1 ? "" : "s"}.
              </p>
              <button className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white">
                Queue alert
              </button>
            </form>
          </div>
        </section>
        )}

        <div className="mt-10 space-y-4">
          {canViewAudit && (
          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-semibold text-white">Recent activity</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {auditLogs.length} events
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {auditLogs.length ? (
                auditLogs.map((log) => (
                  <article key={log.id} className="rounded-2xl bg-slate-900/80 p-4">
                    <p className="font-semibold text-white">{getAuditLabel(log.action)}</p>
                    <p className="mt-1 text-sm text-slate-400">{log.party?.title ?? "Platform event"}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {formatActivityTime(log.createdAt)}
                    </p>
                    {log.user && (
                      <p className="mt-2 text-sm text-slate-400">
                        {log.user.name || log.user.email}
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-900/80 p-4 text-slate-300">No audit activity has been logged yet.</p>
              )}
            </div>
          </section>
          )}

          {canViewAudit && conditionalActivity && (
          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Conditional unlock monitoring</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Platform-wide code attempts and successful unlocks for spotting unusual gameplay activity.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {conditionalActivity.counts.failedCodeAttempts} failed
                </span>
                <form action="/admin/conditional-activity/alerts" method="post">
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  <button className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white hover:border-white">
                    Queue alert
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Code attempts</p>
                <p className="mt-2 text-2xl font-semibold text-white">{conditionalActivity.counts.codeAttempts}</p>
              </div>
              <div className="rounded-2xl bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Failed attempts</p>
                <p className="mt-2 text-2xl font-semibold text-white">{conditionalActivity.counts.failedCodeAttempts}</p>
              </div>
              <div className="rounded-2xl bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Unlock events</p>
                <p className="mt-2 text-2xl font-semibold text-white">{conditionalActivity.counts.unlockEvents}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Recent attempts</h3>
                <div className="mt-3 grid gap-3">
                  {conditionalActivity.codeAttempts.length ? (
                    conditionalActivity.codeAttempts.map((attempt) => (
                      <article key={attempt.id} className="rounded-2xl bg-slate-900/80 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold text-white">{attempt.ruleLabel}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {attempt.actorLabel} in{" "}
                              <Link href={`/host/party/${attempt.partyId}`} className="hover:text-indigo-200">
                                {attempt.partyTitle}
                              </Link>
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                            {attempt.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          {attempt.targetTypeLabel} · {attempt.toolLabel} · Scope {attempt.unlockScope}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {formatActivityTime(attempt.createdAt)}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-2xl bg-slate-900/80 p-4 text-sm text-slate-300">
                      No code attempts have been logged yet.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Recent unlocks</h3>
                <div className="mt-3 grid gap-3">
                  {conditionalActivity.unlockEvents.length ? (
                    conditionalActivity.unlockEvents.map((event) => (
                      <article key={event.id} className="rounded-2xl bg-slate-900/80 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold text-white">{event.ruleLabel}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {event.actorLabel} for {event.targetGuestLabel} in{" "}
                              <Link href={`/host/party/${event.partyId}`} className="hover:text-indigo-200">
                                {event.partyTitle}
                              </Link>
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                            {event.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          {event.targetTypeLabel} · Scope {event.unlockScope}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {formatActivityTime(event.createdAt)}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-2xl bg-slate-900/80 p-4 text-sm text-slate-300">
                      No conditional unlocks have been logged yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {canViewPayments && (
            <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold text-white">Recent orders</h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {recentOrders.length} shown
                </span>
              </div>
              <form className="mt-4 grid gap-3 sm:grid-cols-2">
                <select
                  name="orderStatus"
                  defaultValue={orderStatus}
                  className="rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400"
                >
                  <option value="">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <button className="rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:border-white">
                  Filter
                </button>
              </form>
              <div className="mt-4 space-y-3">
                {recentOrders.length ? (
                  recentOrders.map((order) => (
                    <article key={order.id} className="rounded-2xl bg-slate-900/80 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">{order.email}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            <Link href={`/admin/orders/${order.id}`} className="hover:text-indigo-200">
                              {order.user?.name ?? "Guest checkout"} · {order.items.length} item
                              {order.items.length === 1 ? "" : "s"}
                            </Link>
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                          {order.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">
                        {order.currency} {(order.totalCents / 100).toFixed(2)}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {formatActivityTime(order.createdAt)}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-900/80 p-4 text-slate-300">No orders have been created yet.</p>
                )}
              </div>
            </section>
            )}

            {canViewOutbound && (
            <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold text-white">Outbound messages</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <form action="/admin/outbound/deliver" method="post">
                    <input type="hidden" name="csrfToken" value={csrfToken} />
                    <button className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:border-white">
                      Send pending email
                    </button>
                  </form>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                    {outboundMessages.length} shown
                  </span>
                </div>
              </div>
              <form className="mt-4 grid gap-3 sm:grid-cols-3">
                <select
                  name="messageChannel"
                  defaultValue={messageChannel}
                  className="rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400"
                >
                  <option value="">All channels</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
                <select
                  name="messageStatus"
                  defaultValue={messageStatus}
                  className="rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400"
                >
                  <option value="">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="SENT">Sent</option>
                  <option value="FAILED">Failed</option>
                </select>
                <button className="rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:border-white">
                  Filter
                </button>
              </form>
              <div className="mt-4 space-y-3">
                {outboundMessages.length ? (
                  outboundMessages.map((message) => (
                    <article key={message.id} className="rounded-2xl bg-slate-900/80 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">{message.recipient}</p>
                          <p className="mt-1 text-sm text-slate-400">{message.subject || message.templateKey}</p>
                        </div>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                          {message.status}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{message.bodyPreview}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {message.channel} · {formatActivityTime(message.createdAt)}
                      </p>
                      {message.status === "FAILED" && (
                        <form action={`/admin/outbound/${message.id}/retry`} method="post" className="mt-4">
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <button className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:border-white">
                            Retry
                          </button>
                        </form>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-900/80 p-4 text-slate-300">No outbound messages have been queued yet.</p>
                )}
              </div>
            </section>
            )}
          </div>

          {canViewPayments && (
          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-semibold text-white">Payment webhooks</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {webhookEvents.length} shown
              </span>
            </div>
            <form className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                name="webhookStatus"
                defaultValue={webhookStatus}
                className="rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400"
              >
                <option value="">All statuses</option>
                <option value="RECEIVED">Received</option>
                <option value="PROCESSED">Processed</option>
                <option value="FAILED">Failed</option>
              </select>
              <button className="rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:border-white">
                Filter
              </button>
            </form>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {webhookEvents.length ? (
                webhookEvents.map((event) => (
                  <article key={event.id} className="rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">{event.eventType}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {event.provider} · {event.eventId}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                        {event.status}
                      </span>
                    </div>
                    {event.order && (
                      <p className="mt-3 text-sm text-slate-300">
                        <Link href={`/admin/orders/${event.order.id}`} className="hover:text-indigo-200">
                          {event.order.email} · {event.order.currency} {(event.order.totalCents / 100).toFixed(2)} ·{" "}
                          {event.order.status}
                        </Link>
                      </p>
                    )}
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {formatActivityTime(event.createdAt)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-900/80 p-4 text-slate-300">
                  No payment webhook events have been recorded yet.
                </p>
              )}
            </div>
          </section>
          )}

          {canViewSupport && (
          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-semibold text-white">Support queue</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {supportTickets.length} shown
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {supportTickets.length ? (
                supportTickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">
                          <Link href={`/admin/support/${ticket.id}`} className="hover:text-indigo-200">
                            {ticket.subject}
                          </Link>
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {ticket.user?.name ?? ticket.email}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                        {ticket.status}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{ticket.message}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {formatActivityTime(ticket.createdAt)}
                    </p>
                    <form action={`/admin/support/${ticket.id}/status`} method="post" className="mt-4 flex flex-wrap gap-2">
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      {["OPEN", "PENDING", "CLOSED"].map((status) => (
                        <button
                          key={status}
                          name="status"
                          value={status}
                          disabled={ticket.status === status}
                          className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:border-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                        >
                          {status}
                        </button>
                      ))}
                    </form>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-900/80 p-4 text-slate-300">No support tickets have been submitted yet.</p>
              )}
            </div>
          </section>
          )}

          {canViewContent && games.length ? (
            games.map((game) => (
              <section key={game.id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">
                      <Link href={`/admin/games/${game.id}`} className="hover:text-indigo-200">
                        {game.title}
                      </Link>
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">{game.slug}</p>
                    <p className="mt-3 max-w-3xl leading-7 text-slate-300">{game.tagline}</p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                    {game.status}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {game.versions.map((version) => (
                    <article key={version.id} className="rounded-2xl bg-slate-900/80 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">Version {version.versionNumber}</p>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                          {version.status}
                        </span>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                          {version.finalReveal ? "Reveal ready" : "No reveal"}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div>
                          <p className="text-slate-400">Characters</p>
                          <p className="font-semibold text-white">{version._count.characters}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Rounds</p>
                          <p className="font-semibold text-white">{version._count.rounds}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Evidence</p>
                          <p className="font-semibold text-white">{version._count.evidence}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Media</p>
                          <p className="font-semibold text-white">{version._count.mediaAssets}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                  {game.products.map((product) => (
                    <article key={product.id} className="rounded-2xl bg-slate-900/80 p-4">
                      <p className="font-semibold text-white">{product.name}</p>
                      <p className="mt-2 text-sm text-slate-400">{product.slug}</p>
                      <p className="mt-3 text-sm text-slate-300">
                        {product.currency} {(product.priceCents / 100).toFixed(2)} · {product.status}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))
          ) : canViewContent ? (
            <p className="rounded-2xl bg-slate-950/80 p-4 text-slate-300">No games have been added yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
