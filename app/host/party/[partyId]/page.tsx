import Link from "next/link";
import { notFound } from "next/navigation";

import { addGuest } from "../../../lib/party-actions";
import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function PartyPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const user = await requireUser();
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      game: true,
      gameVersion: true,
      guests: true
    }
  });

  if (!party || party.hostId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Party control</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">{party.title}</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Invite code</p>
            <p className="mt-2 font-semibold text-white">{party.inviteCode}</p>
          </div>
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Game</p>
            <p className="mt-2 font-semibold text-white">{party.game?.title ?? party.gameSlug}</p>
            <p className="mt-1 text-sm text-slate-400">
              {party.gameVersion ? `Version ${party.gameVersion.versionNumber}` : party.gameSlug}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <h2 className="text-xl font-semibold text-white">Guests</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {party.guests.length ? (
                  party.guests.map((guest) => (
                    <div key={guest.id} className="rounded-2xl bg-slate-900/80 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white">{guest.name || "Unnamed guest"}</p>
                          <p className="mt-1 text-slate-400">{guest.email}</p>
                        </div>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                          {guest.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No guests invited yet.</p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="text-xl font-semibold text-white">Invite more guests</h2>
            <form action={addGuest} className="mt-6 space-y-4">
              <input type="hidden" name="partyId" value={party.id} />
              <label className="block text-sm font-medium text-slate-200">Guest name</label>
              <input
                name="name"
                type="text"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              />
              <label className="block text-sm font-medium text-slate-200">Guest email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              />
              <button className="inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
                Add guest
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 text-sm text-slate-400">
          Share this party link with guests: <Link href={`/join?code=${party.inviteCode}`} className="text-indigo-300 hover:text-white">{`/join?code=${party.inviteCode}`}</Link>
        </div>
      </div>
    </div>
  );
}
