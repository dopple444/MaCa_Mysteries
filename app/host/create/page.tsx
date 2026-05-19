import { getGameBySlug } from "../../lib/games";
import { getHostGameAccess } from "../../lib/game-access";
import { createParty } from "../../lib/party-actions";
import { requireUser } from "../../lib/auth";
import { getCsrfToken } from "../../lib/csrf";

export default async function CreatePartyPage({ searchParams }: { searchParams?: Promise<{ game?: string }> }) {
  const user = await requireUser();
  const csrfToken = await getCsrfToken();
  const params = await searchParams;
  const selectedGame = params?.game ? await getGameBySlug(params.game) : undefined;
  const gameAccess = selectedGame
    ? await getHostGameAccess({
        userId: user.id,
        gameId: selectedGame.id
      })
    : null;
  const canCreateParty = Boolean(selectedGame && gameAccess?.canHost);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Create party</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Start your party session</h1>

        {selectedGame ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Selected game</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{selectedGame.title}</h2>
            <p className="mt-2 text-slate-300">{selectedGame.tagline}</p>
            {gameAccess?.requiresPurchase && (
              <p className="mt-4 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                Purchase gating is configured for this game. Development hosting remains available until checkout is connected.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-6 text-slate-300">Please choose a game from the catalog first.</p>
        )}

        <form action={createParty} className="mt-8 grid gap-6">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="gameSlug" value={selectedGame?.slug ?? ""} />

          <label className="block text-sm font-medium text-slate-200">Party title</label>
          <input
            name="title"
            required
            defaultValue={selectedGame ? `${selectedGame.title} Party` : ""}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
            disabled={!canCreateParty}
          />

          <label className="block text-sm font-medium text-slate-200">Guest names and emails</label>
          <textarea
            name="guestInvites"
            placeholder={"Alex Reed, alex@example.com\nJordan Lee, jordan@example.com"}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
            disabled={!canCreateParty}
          />

          <button
            type="submit"
            disabled={!canCreateParty}
            className="inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            Create party
          </button>
          {!selectedGame && (
            <p className="text-sm text-yellow-300">Choose a game from the catalog first, then click Start party.</p>
          )}
        </form>
      </div>
    </div>
  );
}
