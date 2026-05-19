import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "../../../lib/auth";
import { getCsrfToken } from "../../../lib/csrf";

export default async function NewAdminGamePage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  const csrfToken = await getCsrfToken();
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <Link href="/admin" className="text-sm font-semibold text-indigo-300 hover:text-white">
          Back to admin
        </Link>
        <p className="mt-6 text-sm uppercase tracking-[0.3em] text-indigo-300">Admin content</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Create first-party game</h1>
        <p className="mt-3 text-slate-300">
          New games start as draft content with an initial draft version.
        </p>

        {params?.error && (
          <p className="mt-6 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            Please provide valid, unique game metadata.
          </p>
        )}

        <form action="/admin/games/create" method="post" className="mt-8 grid gap-4">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <label className="block text-sm font-medium text-slate-200">Title</label>
          <input
            name="title"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
          <label className="block text-sm font-medium text-slate-200">Slug</label>
          <input
            name="slug"
            required
            placeholder="new-game-slug"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
          <label className="block text-sm font-medium text-slate-200">Tagline</label>
          <input
            name="tagline"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
          <label className="block text-sm font-medium text-slate-200">Description</label>
          <textarea
            name="description"
            required
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-medium text-slate-200">
              Min players
              <input
                name="minPlayers"
                type="number"
                min={1}
                required
                defaultValue={4}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Max players
              <input
                name="maxPlayers"
                type="number"
                min={1}
                required
                defaultValue={8}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Min minutes
              <input
                name="durationMin"
                type="number"
                min={1}
                required
                defaultValue={120}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Max minutes
              <input
                name="durationMax"
                type="number"
                min={1}
                required
                defaultValue={180}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              />
            </label>
          </div>
          <button className="inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
            Create draft game
          </button>
        </form>
      </div>
    </div>
  );
}
