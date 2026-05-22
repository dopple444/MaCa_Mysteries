import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { describeDatabaseUrl, getConfiguredTestDatabaseUrl, loadDotEnv } from "./test-env";

loadDotEnv();

const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" };
const liveBaseUrl = env.TEST_BASE_URL?.trim();

if (liveBaseUrl) {
  console.log(`Running tests against live app ${liveBaseUrl}; using DATABASE_URL so fixtures match the running server.`);
} else {
  const testDatabaseUrl = getConfiguredTestDatabaseUrl();
  if (testDatabaseUrl) {
    env.DATABASE_URL = testDatabaseUrl;
    console.log(`Running tests with test database ${describeDatabaseUrl(testDatabaseUrl)}.`);
  } else {
    console.warn("DATABASE_URL_TEST is not set and DATABASE_URL could not be loaded; tests may fail.");
  }
}

const testFiles = readdirSync(path.join(process.cwd(), "tests"))
  .filter((file) => file.endsWith(".test.ts"))
  .sort()
  .map((file) => path.join("tests", file));

const result = spawnSync("node", ["--import", "tsx", "--test", ...testFiles], {
  env,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
