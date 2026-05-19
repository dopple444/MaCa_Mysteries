const REQUIRED_SERVER_ENV = ["DATABASE_URL"] as const;

export function validateServerEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const missing = REQUIRED_SERVER_ENV.filter((key) => !env[key]?.trim());

  if (missing.length) {
    throw new Error(`Missing required server environment variable(s): ${missing.join(", ")}`);
  }

  return {
    databaseUrl: env.DATABASE_URL as string,
    nodeEnv: env.NODE_ENV ?? "development"
  };
}
