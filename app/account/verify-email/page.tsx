import { requireUser } from "../../lib/auth";
import { requestCurrentUserEmailVerification } from "../../lib/account-security-actions";
import { getCsrfToken } from "../../lib/csrf";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams?: Promise<{ sent?: string; verified?: string; error?: string }>;
}) {
  const user = await requireUser();
  const csrfToken = await getCsrfToken();
  const params = await searchParams;
  const isVerified = Boolean(user.emailVerifiedAt) || params?.verified === "1";

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Account security</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Email verification</h1>
        <p className="mt-3 text-slate-300">
          Verified email keeps password recovery and future purchase/support notices tied to the right account.
        </p>

        {isVerified ? (
          <p className="mt-6 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Your email address is verified.
          </p>
        ) : (
          <>
            {params?.sent && (
              <p className="mt-6 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Verification email queued. Use Admin email delivery if messages are not being sent automatically yet.
              </p>
            )}
            {params?.error === "rate-limited" && (
              <p className="mt-6 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                Too many verification emails requested. Please wait and try again.
              </p>
            )}
            {params?.error === "invalid" && (
              <p className="mt-6 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-100">
                Your request could not be verified. Please try again.
              </p>
            )}
            <div className="mt-8 rounded-2xl bg-slate-950/80 p-5">
              <p className="text-sm text-slate-400">Current email</p>
              <p className="mt-2 font-semibold text-white">{user.email}</p>
            </div>
            <form action={requestCurrentUserEmailVerification} className="mt-6">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <button className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
                Send verification email
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
