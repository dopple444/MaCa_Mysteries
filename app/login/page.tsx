import Link from "next/link";
import { login } from "../lib/auth-actions";
import { getCsrfToken } from "../lib/csrf";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const csrfToken = await getCsrfToken();
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20 text-white">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-slate-400">Access your host dashboard and manage your party experience.</p>

        {params?.error === "invalid" && (
          <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">Invalid email or password.</p>
        )}
        {params?.error === "rate-limited" && (
          <p className="mt-4 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">Too many sign-in attempts. Please wait and try again.</p>
        )}

        <form action={login} className="mt-8 grid gap-4">
          <input type="hidden" name="csrfToken" value={csrfToken} />
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
            autoComplete="current-password"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
          <button className="mt-4 inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
            Sign in
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          New host? <Link href="/signup" className="text-indigo-300 hover:text-white">Create an account</Link>.
        </p>
      </div>
    </div>
  );
}
