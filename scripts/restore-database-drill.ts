import { closeSync, existsSync, openSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { loadDotEnv } from "./test-env";

loadDotEnv();

function printHelp() {
  console.log(`Usage: npm run backup:restore-drill -- [backup-file]

Restores a custom-format pg_dump into a separate drill database.

Environment:
  DATABASE_URL                     Source database URL used for connection settings.
  DATABASE_BACKUP_DIR              Backup directory. Defaults to /home/dopple444/backups/maca_mysteries.
  DATABASE_BACKUP_PREFIX           Backup filename prefix. Defaults to maca_mysteries.
  DATABASE_RESTORE_SOURCE          Optional explicit backup file path.
  DATABASE_RESTORE_DRILL_DATABASE  Optional drill database name. Defaults to <source>_restore_drill.
`);
}

function getCliBackupPath() {
  for (const arg of process.argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (!arg.startsWith("-")) return arg;
  }
  return "";
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is required to run a restore drill.");
    process.exit(1);
  }
  return databaseUrl;
}

function getConnectionUrl(value: string) {
  const url = new URL(value);
  url.searchParams.delete("schema");
  return url;
}

function getDatabaseName(url: URL) {
  return url.pathname.replace(/^\//, "");
}

function getBackupPath() {
  const explicit = getCliBackupPath() || process.env.DATABASE_RESTORE_SOURCE?.trim();
  if (explicit) return path.resolve(explicit);

  const backupDir = process.env.DATABASE_BACKUP_DIR?.trim() || "/home/dopple444/backups/maca_mysteries";
  const backupPrefix = process.env.DATABASE_BACKUP_PREFIX?.trim() || "maca_mysteries";
  const entries = existsSync(backupDir)
    ? readdirSync(backupDir)
        .filter((entry) => entry.startsWith(`${backupPrefix}_`) && entry.endsWith(".dump"))
        .sort()
    : [];
  const latest = entries.at(-1);

  if (!latest) {
    console.error(`No ${backupPrefix}_*.dump backups found in ${backupDir}.`);
    console.error("Run npm run backup:db first, or pass a backup file path.");
    process.exit(1);
  }

  return path.join(backupDir, latest);
}

function findPostgresContainer() {
  const configured = process.env.DATABASE_BACKUP_DOCKER_CONTAINER?.trim();
  if (configured) return configured;

  const result = spawnSync("docker", ["ps", "--format", "{{.Image}} {{.Names}}"], {
    encoding: "utf8"
  });

  if (result.status !== 0) return "";

  const line = result.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("postgres:") || entry.startsWith("postgres "));

  return line?.split(/\s+/).at(1) ?? "";
}

function assertSafeDatabaseName(name: string, sourceName: string) {
  if (!name || !/^[A-Za-z0-9_]+$/.test(name)) {
    console.error("DATABASE_RESTORE_DRILL_DATABASE must contain only letters, numbers, and underscores.");
    process.exit(1);
  }
  if (name === sourceName) {
    console.error("Refusing to restore over the source database.");
    process.exit(1);
  }
  if (!name.includes("restore") && !name.includes("drill")) {
    console.error("Refusing to use a drill database name that does not include restore or drill.");
    process.exit(1);
  }
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function commandExists(command: string) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore"
  });
  return !result.error && result.status === 0;
}

function runChecked(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; stdinFile?: string } = {}) {
  const stdin = options.stdinFile ? openSync(options.stdinFile, "r") : "inherit";
  const result = spawnSync(command, args, {
    env: options.env ?? process.env,
    stdio: [stdin, "inherit", "inherit"]
  });

  if (typeof stdin === "number") closeSync(stdin);

  if (result.error) {
    if ("code" in result.error && result.error.code === "ENOENT") {
      console.error(`${command} is not installed. Install PostgreSQL client tools first.`);
      console.error("Ubuntu: sudo apt install postgresql-client");
    } else {
      console.error(result.error.message);
    }
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runPostgresTool(command: "psql" | "pg_restore", args: string[], stdinFile?: string) {
  if (commandExists(command)) {
    runChecked(command, args, { stdinFile });
    return;
  }

  const postgresContainer = findPostgresContainer();
  if (!postgresContainer) {
    console.error(`${command} is not installed and no running Postgres Docker container was found.`);
    console.error("Install PostgreSQL client tools first, for example: sudo apt install postgresql-client");
    process.exit(1);
  }

  console.warn(`${command} is not installed on the host. Falling back to Docker container ${postgresContainer}.`);
  runChecked("docker", ["exec", ...(stdinFile ? ["-i"] : []), postgresContainer, command, ...args], { stdinFile });
}

const sourceUrl = getConnectionUrl(getDatabaseUrl());
const sourceDatabaseName = getDatabaseName(sourceUrl);
const targetDatabaseName =
  process.env.DATABASE_RESTORE_DRILL_DATABASE?.trim() || `${sourceDatabaseName}_restore_drill`;
assertSafeDatabaseName(targetDatabaseName, sourceDatabaseName);

const backupPath = getBackupPath();
if (!existsSync(backupPath)) {
  console.error(`Backup file does not exist: ${backupPath}`);
  process.exit(1);
}

const maintenanceUrl = new URL(sourceUrl.toString());
maintenanceUrl.pathname = "/postgres";
const targetUrl = new URL(sourceUrl.toString());
targetUrl.pathname = `/${targetDatabaseName}`;

console.log(`Restore drill source: ${backupPath}`);
console.log(`Restore drill target database: ${targetDatabaseName}`);

runPostgresTool("psql", [
  maintenanceUrl.toString(),
  "--set",
  "ON_ERROR_STOP=1",
  "--command",
  `DROP DATABASE IF EXISTS ${quoteIdentifier(targetDatabaseName)};`
]);
runPostgresTool("psql", [
  maintenanceUrl.toString(),
  "--set",
  "ON_ERROR_STOP=1",
  "--command",
  `CREATE DATABASE ${quoteIdentifier(targetDatabaseName)};`
]);
runPostgresTool("psql", [
  targetUrl.toString(),
  "--set",
  "ON_ERROR_STOP=1",
  "--command",
  "DROP SCHEMA IF EXISTS public CASCADE;"
]);
runPostgresTool("pg_restore", [
  "--dbname",
  targetUrl.toString(),
  "--no-owner",
  "--no-privileges",
  "--exit-on-error"
], backupPath);
runChecked("npx", ["prisma", "migrate", "status"], {
  env: {
    ...process.env,
    DATABASE_URL: targetUrl.toString()
  }
});

console.log(`Restore drill completed successfully against ${targetDatabaseName}.`);
