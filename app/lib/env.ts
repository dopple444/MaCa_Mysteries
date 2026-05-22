const REQUIRED_SERVER_ENV = ["DATABASE_URL"] as const;
const REQUIRED_PRODUCTION_ENV = ["APP_URL", "CSRF_SECRET", "ACCOUNT_TOKEN_SECRET"] as const;

function isUnsafeProductionSecret(value: string) {
  return value.trim().length < 32 || /change[_-]?me|replace|development/i.test(value);
}

function isBuildPhase(env: NodeJS.ProcessEnv) {
  return env.NEXT_PHASE === "phase-production-build" || env.npm_lifecycle_event === "build";
}

export function validateServerEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const shouldValidateProductionRuntime = env.NODE_ENV === "production" && !isBuildPhase(env);
  const productionRequired = shouldValidateProductionRuntime ? REQUIRED_PRODUCTION_ENV : [];
  const missing = [...REQUIRED_SERVER_ENV, ...productionRequired].filter((key) => !env[key]?.trim());

  if (missing.length) {
    throw new Error(`Missing required server environment variable(s): ${missing.join(", ")}`);
  }

  if (shouldValidateProductionRuntime) {
    const unsafe = ["CSRF_SECRET", "ACCOUNT_TOKEN_SECRET"].filter((key) =>
      isUnsafeProductionSecret(env[key] ?? "")
    );

    if (unsafe.length) {
      throw new Error(`Unsafe production environment variable(s): ${unsafe.join(", ")}`);
    }
  }

  return {
    databaseUrl: env.DATABASE_URL as string,
    nodeEnv: env.NODE_ENV ?? "development"
  };
}
