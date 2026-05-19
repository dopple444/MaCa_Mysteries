import { requireUser } from "../../lib/auth";
import { getCsrfToken } from "../../lib/csrf";
import { updateNotificationPreferences } from "../../lib/account-actions";

export const dynamic = "force-dynamic";

function getBooleanPreference(value: unknown, key: string, fallback: boolean) {
  if (!value || typeof value !== "object" || !(key in value)) return fallback;
  return Boolean((value as Record<string, unknown>)[key]);
}

export default async function NotificationSettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  const csrfToken = await getCsrfToken();
  const params = await searchParams;
  const emailOptIn = getBooleanPreference(user.notificationPrefs, "emailOptIn", true);
  const smsOptIn = getBooleanPreference(user.notificationPrefs, "smsOptIn", false);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Account</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Notification settings</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Choose how MaCa Mysteries can contact you for invitations, purchases, reminders, and party updates.
        </p>

        {params?.saved && (
          <p className="mt-6 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Notification settings saved.
          </p>
        )}
        {params?.error && (
          <p className="mt-6 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {params.error === "phone"
              ? "Enter a valid phone number before enabling SMS."
              : "Your request could not be verified. Please try again."}
          </p>
        )}

        <form action={updateNotificationPreferences} className="mt-8 grid gap-6">
          <input type="hidden" name="csrfToken" value={csrfToken} />

          <label className="flex items-start gap-3 rounded-2xl bg-slate-950/80 p-4">
            <input name="emailOptIn" type="checkbox" defaultChecked={emailOptIn} className="mt-1" />
            <span>
              <span className="block font-semibold text-white">Email notifications</span>
              <span className="mt-1 block text-sm leading-6 text-slate-300">
                Invitations, purchase confirmations, support replies, reminders, and host notices.
              </span>
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-200">Phone number</span>
            <input
              name="phoneNumber"
              type="tel"
              defaultValue={user.phoneNumber}
              placeholder="+15555550123"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl bg-slate-950/80 p-4">
            <input name="smsOptIn" type="checkbox" defaultChecked={smsOptIn} className="mt-1" />
            <span>
              <span className="block font-semibold text-white">SMS notifications</span>
              <span className="mt-1 block text-sm leading-6 text-slate-300">
                Short reminders and in-game cue messages. SMS delivery stays disabled until a provider is configured.
              </span>
            </span>
          </label>

          <button className="inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400">
            Save settings
          </button>
        </form>
      </div>
    </div>
  );
}
