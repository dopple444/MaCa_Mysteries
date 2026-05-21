import fs from "node:fs";

function loadDotEnv() {
  if (!fs.existsSync(".env")) return;
  const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const rawValue = rest.join("=").trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadDotEnv();

const required = ["APP_URL", "PAYMENT_PROVIDER", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;

function getEnv(key: string) {
  return process.env[key]?.trim() ?? "";
}

const missing = required.filter((key) => !getEnv(key));
const provider = getEnv("PAYMENT_PROVIDER").toLowerCase();
const secretKey = getEnv("STRIPE_SECRET_KEY");
const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
const warnings: string[] = [];

if (provider && provider !== "stripe") {
  warnings.push(`PAYMENT_PROVIDER is "${provider}", but the app currently supports "stripe".`);
}

if (secretKey && !secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
  warnings.push("STRIPE_SECRET_KEY should start with sk_test_ for test mode or sk_live_ for live mode.");
}

if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
  warnings.push("STRIPE_WEBHOOK_SECRET should start with whsec_.");
}

console.log("Payment provider configuration check");
console.log(`APP_URL: ${getEnv("APP_URL") || "missing"}`);
console.log(`PAYMENT_PROVIDER: ${provider || "missing"}`);
console.log(`STRIPE_SECRET_KEY: ${secretKey ? "set" : "missing"}`);
console.log(`STRIPE_WEBHOOK_SECRET: ${webhookSecret ? "set" : "missing"}`);

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

if (missing.length) {
  console.error(`Missing required payment setting(s): ${missing.join(", ")}`);
  process.exit(1);
}

if (warnings.length) {
  process.exit(1);
}

console.log("Stripe payment provider settings look ready.");
