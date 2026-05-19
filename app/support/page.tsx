import { getCurrentUser } from "../lib/auth";
import { getCsrfToken } from "../lib/csrf";
import { submitSupportTicket } from "../lib/support-actions";

export const dynamic = "force-dynamic";

export default async function SupportPage({ searchParams }: { searchParams?: Promise<{ submitted?: string; error?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const submitted = params?.submitted === "1";
  const hasError = Boolean(params?.error);
  const csrfToken = await getCsrfToken();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Support</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Contact support</h1>
        <p className="mt-4 leading-7 text-slate-300">
          Send a support request for account access, party setup, gameplay issues, or purchase questions.
        </p>

        {submitted && (
          <p className="mt-6 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Your support request was received.
          </p>
        )}
        {hasError && (
          <p className="mt-6 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            {params?.error === "rate-limited"
              ? "Too many support requests. Please wait and try again."
              : "Please include a valid email, subject, and message."}
          </p>
        )}

        <form action={submitSupportTicket} className="mt-8 grid gap-5">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <label className="block text-sm font-medium text-slate-200">Email</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={user?.email ?? ""}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />

          <label className="block text-sm font-medium text-slate-200">Subject</label>
          <input
            name="subject"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />

          <label className="block text-sm font-medium text-slate-200">Message</label>
          <textarea
            name="message"
            required
            rows={6}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
          />

          <button className="inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400">
            Submit request
          </button>
        </form>
      </div>
    </div>
  );
}
