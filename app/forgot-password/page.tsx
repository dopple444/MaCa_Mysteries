import Link from "next/link";

import { requestPasswordReset } from "../lib/account-security-actions";
import { getCsrfToken } from "../lib/csrf";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ sent?: string; reset?: string }>;
}) {
  const csrfToken = await getCsrfToken();
  const params = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20 text-white">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold">Reset password</h1>
        <p className="mt-2 text-slate-400">
          Enter your account email and we will queue a reset link if an account exists.
        </p>

        {params?.sent && (
          <p className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            If that email is registered, a reset email has been queued.
          </p>
        )}
        {params?.reset === "invalid" && (
          <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-100">
            That reset link is invalid or expired. Request a new one.
          </p>
        )}

        <form action={requestPasswordReset} className="mt-8 grid gap-4">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <label className="block text-sm font-medium text-slate-200">Email</label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
          <button className="mt-4 inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
            Send reset link
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          Remembered it?{" "}
          <Link href="/login" className="text-indigo-300 hover:text-white">
            Sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
