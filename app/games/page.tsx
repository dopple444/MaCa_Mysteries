import Link from "next/link";

import { getPublishedGames } from "../lib/games";

export default async function GamesPage() {
  const games = await getPublishedGames();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-slate-100">
      <div className="mb-10">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Game catalog</p>
        <h1 className="mt-4 text-4xl font-semibold">Original murder mystery stories</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Browse our first-party mystery experiences built for hosts and party guests.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {games.map((game) => (
          <article key={game.slug} className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl shadow-indigo-500/5">
            <h2 className="text-2xl font-semibold text-white">{game.title}</h2>
            <p className="mt-3 text-sm uppercase tracking-[0.2em] text-indigo-300">{game.players}</p>
            <p className="mt-4 text-slate-300">{game.tagline}</p>
            <Link href={`/games/${game.slug}`} className="mt-6 inline-flex rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
              View details
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
