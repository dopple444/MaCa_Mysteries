import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "../lib/auth";
import { getCsrfToken } from "../lib/csrf";
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
  if (user.role !== "ADMIN") notFound();
  const csrfToken = await getCsrfToken();
  const params = await searchParams;
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

  const [games, totals, auditLogs, recentOrders, outboundMessages, supportTickets, webhookEvents] = await Promise.all([
    prisma.game.findMany({
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
    }),
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
      prisma.paymentWebhookEvent.count()
    ]),
    prisma.auditLog.findMany({
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
    }),
    prisma.order.findMany({
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
    }),
    prisma.outboundMessage.findMany({
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
    }),
    prisma.supportTicket.findMany({
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
    }),
    prisma.paymentWebhookEvent.findMany({
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
    paymentWebhookEventCount
  ] = totals;

  const statCards = [
    ["Games", gameCount],
    ["Versions", versionCount],
    ["Characters", characterCount],
    ["Rounds", roundCount],
    ["Cards", cardCount],
    ["Evidence", evidenceCount],
    ["Media", mediaCount],
    ["Parties", partyCount],
    ["Guests", guestCount],
    ["Accusations", accusationCount],
    ["Audit Logs", auditLogCount],
    ["Orders", orderCount],
    ["Messages", outboundMessageCount],
    ["Support", supportTicketCount],
    ["Webhooks", paymentWebhookEventCount]
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Admin inventory</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Content overview</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Read-only inventory for first-party game content and current play data.
        </p>
        <div className="mt-6">
          <Link
            href="/admin/games/new"
            className="inline-flex rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Create game
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {statCards.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-4">
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

          <div className="grid gap-4 lg:grid-cols-2">
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

            <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold text-white">Outbound messages</h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {outboundMessages.length} shown
                </span>
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
          </div>

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

          {games.length ? (
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
          ) : (
            <p className="rounded-2xl bg-slate-950/80 p-4 text-slate-300">No games have been added yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
