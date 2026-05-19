import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

function formatActivityTime(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();

  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      items: {
        include: {
          product: {
            include: {
              game: {
                select: {
                  id: true,
                  title: true,
                  slug: true
                }
              }
            }
          }
        }
      },
      webhookEvents: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!order) notFound();

  const gameIds = order.items.map((item) => item.product.gameId);
  const accessGrants = order.userId
    ? await prisma.userGameAccess.findMany({
        where: {
          userId: order.userId,
          gameId: { in: gameIds.length ? gameIds : ["__none__"] }
        },
        include: {
          game: {
            select: {
              title: true,
              slug: true
            }
          },
          product: {
            select: {
              name: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      })
    : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <Link href="/admin" className="text-sm font-semibold text-indigo-300 hover:text-white">
          Back to admin
        </Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Admin order detail</p>
            <h1 className="mt-4 text-4xl font-semibold text-white">{order.email}</h1>
            <p className="mt-2 text-slate-400">{order.user?.name ?? "Guest checkout"}</p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
            {order.status}
          </span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total</p>
            <p className="mt-2 font-semibold text-white">
              {order.currency} {(order.totalCents / 100).toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Subtotal</p>
            <p className="mt-2 font-semibold text-white">
              {order.currency} {(order.subtotalCents / 100).toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Provider</p>
            <p className="mt-2 font-semibold text-white">{order.paymentProvider || "Not configured"}</p>
          </div>
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Created</p>
            <p className="mt-2 font-semibold text-white">{formatActivityTime(order.createdAt)}</p>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <h2 className="text-2xl font-semibold text-white">Items</h2>
          <div className="mt-4 space-y-3">
            {order.items.map((item) => (
              <article key={item.id} className="rounded-2xl bg-slate-900/80 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{item.product.name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.product.game.title} · {item.product.game.slug}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                    Qty {item.quantity}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {order.currency} {(item.totalPriceCents / 100).toFixed(2)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <h2 className="text-2xl font-semibold text-white">Access grants</h2>
          <div className="mt-4 space-y-3">
            {accessGrants.length ? (
              accessGrants.map((grant) => (
                <article key={grant.id} className="rounded-2xl bg-slate-900/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-white">{grant.game.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{grant.product?.name ?? grant.source}</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      {grant.status}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-900/80 p-4 text-slate-300">
                No access grants are linked to this order yet.
              </p>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <h2 className="text-2xl font-semibold text-white">Webhook events</h2>
          <div className="mt-4 space-y-3">
            {order.webhookEvents.length ? (
              order.webhookEvents.map((event) => (
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
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {formatActivityTime(event.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-900/80 p-4 text-slate-300">
                No provider webhook events are linked to this order yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
