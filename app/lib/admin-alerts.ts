type EnvMap = Partial<Record<string, string | undefined>>;

export function getAdminAlertRecipients(env: EnvMap = process.env) {
  const raw = env.ADMIN_ALERT_EMAILS?.trim() || env.ADMIN_ALERT_EMAIL?.trim() || "";
  if (!raw) return [];

  return [
    ...new Set(
      raw
        .split(/[,\n;]/)
        .map((recipient) => recipient.trim().toLowerCase())
        .filter((recipient) => recipient.includes("@"))
    )
  ];
}

export function getAdminAlertUrl(env: EnvMap = process.env, path = "/admin") {
  const baseUrl = env.APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getAlertDedupeCutoff(now: Date, dedupeMinutes: number | undefined, fallbackMinutes: number) {
  const minutes =
    Number.isFinite(dedupeMinutes) && dedupeMinutes && dedupeMinutes > 0 ? dedupeMinutes : fallbackMinutes;
  return new Date(now.getTime() - minutes * 60 * 1000);
}
