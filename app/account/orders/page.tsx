import Link from "next/link";

import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

function formatMoney(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function formatActivityTime(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AccountOrdersPage() {
  const user = await requireUser();

  const [orders, accessGrants] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: {
              include: {
                game: {
                  select: {
                    title: true,
                    slug: true
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.userGameAccess.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE"
      },
      orderBy: { createdAt: "desc" },
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
      }
    })
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Account</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Orders and access</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Review purchases and the games currently available for hosting.
        </p>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold text-white">Available games</h2>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
              {accessGrants.length} active
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {accessGrants.length ? (
              accessGrants.map((grant) => (
                <article key={grant.id} className="rounded-2xl bg-slate-900/80 p-4">
                  <p className="font-semibold text-white">{grant.game.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{grant.product?.name ?? grant.source}</p>
                  <Link
                    href={`/host/create?game=${grant.game.slug}`}
                    className="mt-4 inline-flex rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400"
                  >
                    Start party
                  </Link>
                </article>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-900/80 p-4 text-slate-300">
                No active game access is linked to this account yet.
              </p>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold text-white">Order history</h2>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
              {orders.length} orders
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {orders.length ? (
              orders.map((order) => (
                <article key={order.id} className="rounded-2xl bg-slate-900/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-white">{formatMoney(order.totalCents, order.currency)}</p>
                      <p className="mt-1 text-sm text-slate-400">{formatActivityTime(order.createdAt)}</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    {order.items.map((item) => (
                      <p key={item.id}>
                        {item.product.name} · {item.product.game.title}
                      </p>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-900/80 p-4 text-slate-300">
                No orders are linked to this account yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
