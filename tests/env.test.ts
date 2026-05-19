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
