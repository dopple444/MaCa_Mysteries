import Link from "next/link";

import { resetPassword } from "../lib/account-security-actions";
import { getCsrfToken } from "../lib/csrf";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const csrfToken = await getCsrfToken();
  const params = await searchParams;
  const token = params?.token ?? "";

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20 text-white">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-slate-400">Reset links expire after one hour and stop working after the password changes.</p>

        {!token ? (
          <div className="mt-8 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Missing reset token.{" "}
            <Link href="/forgot-password" className="font-semibold text-white">
              Request a new link
            </Link>
            .
          </div>
        ) : (
          <form action={resetPassword} className="mt-8 grid gap-4">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="token" value={token} />
            <label className="block text-sm font-medium text-slate-200">New password</label>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
            <button className="mt-4 inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
              Reset password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
