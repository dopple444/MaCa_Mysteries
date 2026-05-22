import fs from "node:fs";
import path from "node:path";

export function loadDotEnv(filePath = path.join(process.cwd(), ".env")) {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

export function getDerivedTestDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, "");
  if (!databaseName) return "";
  url.pathname = databaseName.endsWith("_test") ? `/${databaseName}` : `/${databaseName}_test`;
  return url.toString();
}

export function getConfiguredTestDatabaseUrl() {
  loadDotEnv();
  const explicit = process.env.DATABASE_URL_TEST?.trim();
  if (explicit) return explicit;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  return databaseUrl ? getDerivedTestDatabaseUrl(databaseUrl) : "";
}

export function describeDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const username = url.username ? `${url.username}@` : "";
  const port = url.port ? `:${url.port}` : "";
  return `${url.protocol}//${username}${url.hostname}${port}${url.pathname}`;
}
