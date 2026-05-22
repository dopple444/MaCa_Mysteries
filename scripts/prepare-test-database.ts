import { spawnSync } from "node:child_process";

import { describeDatabaseUrl, getConfiguredTestDatabaseUrl } from "./test-env";

function run(command: string, args: string[], env = process.env) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function createDatabaseIfMissing(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, "");
  if (!/^[A-Za-z0-9_-]+$/.test(databaseName)) {
    throw new Error("Test database name contains unsupported characters.");
  }

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = "/postgres";

  const result = spawnSync("npx", ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
    env: {
      ...process.env,
      DATABASE_URL: maintenanceUrl.toString()
    },
    input: `CREATE DATABASE "${databaseName}";\n`,
    encoding: "utf8"
  });

  if (result.status === 0) {
    console.log(`Created test database ${databaseName}.`);
    return;
  }

  const stderr = result.stderr ?? "";
  const stdout = result.stdout ?? "";
  if (`${stderr}\n${stdout}`.includes("already exists")) {
    console.log(`Test database ${databaseName} already exists.`);
    return;
  }

  if (result.error) {
    console.error(result.error.message);
  }
  process.stderr.write(stderr);
  process.exit(result.status ?? 1);
}

const testDatabaseUrl = getConfiguredTestDatabaseUrl();
if (!testDatabaseUrl) {
  console.error("DATABASE_URL or DATABASE_URL_TEST is required to prepare the test database.");
  process.exit(1);
}

console.log(`Preparing test database: ${describeDatabaseUrl(testDatabaseUrl)}`);
createDatabaseIfMissing(testDatabaseUrl);

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  NODE_ENV: "test" as const
};

run("npx", ["prisma", "migrate", "deploy"], env);
run("npx", ["prisma", "generate"], env);
