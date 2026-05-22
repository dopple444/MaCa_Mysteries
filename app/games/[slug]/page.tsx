import { notFound } from "next/navigation";

import { getCurrentUser } from "../../lib/auth";
import { getCsrfToken } from "../../lib/csrf";
import { getHostGameAccess } from "../../lib/game-access";
import { getGameBySlug } from "../../lib/games";

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();
  const [csrfToken, user] = await Promise.all([getCsrfToken(), getCurrentUser()]);
  const access = user
    ? await getHostGameAccess({
        userId: user.id,
        gameId: game.id,
        allowDevelopmentBypass: false
      })
    : null;
  const hasActiveAccess = Boolean(access?.canHost && !access.requiresPurchase);
  const accessLabel = game.product ? "Already purchased" : "Ready to host";
  const accessDetail = game.product
    ? "This game is ready to host from your account."
    : "This game does not require a purchase before hosting.";
  const canPurchase = Boolean(game.product && !hasActiveAccess);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Game details</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">{game.title}</h1>
        <p className="mt-6 max-w-3xl leading-8 text-slate-300">{game.description}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Players</p>
            <p className="mt-2 font-semibold text-white">{game.players}</p>
          </div>
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Duration</p>
            <p className="mt-2 font-semibold text-white">{game.duration}</p>
          </div>
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Themes</p>
            <p className="mt-2 font-semibold text-white">{game.themes.join(", ")}</p>
          </div>
        </div>
        {hasActiveAccess && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Account access</p>
            <p className="mt-2 text-xl font-semibold text-white">{accessLabel}</p>
            <p className="mt-2 text-slate-300">{accessDetail}</p>
          </div>
        )}
        {canPurchase && game.product && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Purchase option</p>
            <p className="mt-2 text-xl font-semibold text-white">{game.product.name}</p>
            <p className="mt-2 text-slate-300">
              {game.product.currency} {(game.product.priceCents / 100).toFixed(2)}
            </p>
            <form action="/checkout/start" method="post" className="mt-4">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="productId" value={game.product.id} />
              <button className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
                Purchase access
              </button>
            </form>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {hasActiveAccess ? (
            <a
              href={`/host/create?game=${game.slug}`}
              className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Start party
            </a>
          ) : (
            <a
              href={user ? "/account/orders" : "/login"}
              className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white hover:border-white"
            >
              {user ? "View purchases" : "Sign in"}
            </a>
          )}
          <a
            href="/host"
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white hover:border-white"
          >
            Invite guests
          </a>
        </div>
      </div>
    </div>
  );
}
