import assert from "node:assert/strict";
import test from "node:test";

import { validateServerEnvironment } from "../app/lib/env";

test("validateServerEnvironment returns normalized required settings", () => {
  const env = validateServerEnvironment({
    DATABASE_URL: "postgresql://example",
    NODE_ENV: "test"
  });

  assert.deepEqual(env, {
    databaseUrl: "postgresql://example",
    nodeEnv: "test"
  });
});

test("validateServerEnvironment throws when DATABASE_URL is missing", () => {
  assert.throws(
    () => validateServerEnvironment({ NODE_ENV: "test" }),
    /Missing required server environment variable\(s\): DATABASE_URL/
  );
});

test("validateServerEnvironment requires public URL and secrets in production", () => {
  assert.throws(
    () => validateServerEnvironment({ DATABASE_URL: "postgresql://example", NODE_ENV: "production" }),
    /Missing required server environment variable\(s\): APP_URL, CSRF_SECRET, ACCOUNT_TOKEN_SECRET/
  );
});

test("validateServerEnvironment allows production build phase without runtime secrets", () => {
  const env = validateServerEnvironment({
    DATABASE_URL: "postgresql://example",
    NODE_ENV: "production",
    NEXT_PHASE: "phase-production-build"
  });

  assert.deepEqual(env, {
    databaseUrl: "postgresql://example",
    nodeEnv: "production"
  });
});

test("validateServerEnvironment rejects placeholder-grade production secrets", () => {
  assert.throws(
    () =>
      validateServerEnvironment({
        DATABASE_URL: "postgresql://example",
        NODE_ENV: "production",
        APP_URL: "https://staging.example.com",
        CSRF_SECRET: "change_me_before_production",
        ACCOUNT_TOKEN_SECRET: "replace-with-a-real-secret"
      }),
    /Unsafe production environment variable\(s\): CSRF_SECRET, ACCOUNT_TOKEN_SECRET/
  );
});

test("validateServerEnvironment accepts production settings with strong secrets", () => {
  const env = validateServerEnvironment({
    DATABASE_URL: "postgresql://example",
    NODE_ENV: "production",
    APP_URL: "https://staging.example.com",
    CSRF_SECRET: "0123456789abcdef0123456789abcdef",
    ACCOUNT_TOKEN_SECRET: "abcdef0123456789abcdef0123456789"
  });

  assert.deepEqual(env, {
    databaseUrl: "postgresql://example",
    nodeEnv: "production"
  });
});
