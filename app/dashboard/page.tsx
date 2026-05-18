import Link from "next/link";

import { requireUser } from "../lib/auth";
import { logout } from "../lib/auth-actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Host dashboard</p>
            <h1 className="mt-4 text-4xl font-semibold text-white">Welcome, {user.name.split(" ")[0]}</h1>
            <p className="mt-3 text-slate-300">Manage parties, assign guests, and run your game in spoiler-safe mode.</p>
          </div>
          <form action={logout}>
            <button className="rounded-full border border-white/10 bg-slate-950/90 px-5 py-3 text-sm font-semibold text-white hover:border-white">
              Sign out
            </button>
          </form>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Link href="/host" className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 hover:border-indigo-400">
            <h2 className="text-xl font-semibold text-white">Host experience</h2>
            <p className="mt-3 text-slate-300">Create and manage parties with your custom game selection.</p>
          </Link>
          <Link href="/games" className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 hover:border-indigo-400">
            <h2 className="text-xl font-semibold text-white">Game catalog</h2>
            <p className="mt-3 text-slate-300">Browse original mysteries and choose your next party story.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
