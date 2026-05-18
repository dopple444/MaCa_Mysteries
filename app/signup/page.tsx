import Link from "next/link";
import { signup } from "../lib/auth-actions";

export default async function SignupPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20 text-white">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold">Create host account</h1>
        <p className="mt-2 text-slate-400">Register as a host to build parties, invite guests, and run games.</p>

        {params?.error === "invalid" && (
          <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">Please complete all fields.</p>
        )}
        {params?.error === "exists" && (
          <p className="mt-4 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">That email is already registered.</p>
        )}

        <form action={signup} className="mt-8 grid gap-4">
          <label className="block text-sm font-medium text-slate-200">Full name</label>
          <input
            name="name"
            type="text"
            autoComplete="name"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
          <label className="block text-sm font-medium text-slate-200">Email</label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
          <label className="block text-sm font-medium text-slate-200">Password</label>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
          <button className="mt-4 inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
            Create account
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          Already have an account? <Link href="/login" className="text-indigo-300 hover:text-white">Sign in</Link>.
        </p>
      </div>
    </div>
  );
}
