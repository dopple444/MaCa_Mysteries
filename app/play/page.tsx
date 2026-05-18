import Link from "next/link";

import { requireGuest } from "../lib/guest-auth";

export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const guest = await requireGuest();
  const gameTitle = guest.party.game?.title ?? guest.party.gameSlug;

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Player lobby</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">{guest.party.title}</h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          You are joined as {guest.name}. The host has not assigned characters yet.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Game</p>
            <p className="mt-2 font-semibold text-white">{gameTitle}</p>
          </div>
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Player email</p>
            <p className="mt-2 break-words font-semibold text-white">{guest.email}</p>
          </div>
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Status</p>
            <p className="mt-2 font-semibold text-white">{guest.status}</p>
          </div>
        </div>

        <div className="mt-8 text-sm text-slate-400">
          Waiting for the host? Keep this page open or return with your invite link.{" "}
          <Link href="/join" className="text-indigo-300 hover:text-white">
            Join another party
          </Link>
        </div>
      </div>
    </div>
  );
}
