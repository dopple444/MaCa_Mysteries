import { closeSync, mkdirSync, openSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { loadDotEnv } from "./test-env";

loadDotEnv();

function getTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required to create a database backup.");
  process.exit(1);
}

const backupDir = process.env.DATABASE_BACKUP_DIR?.trim() || "/home/dopple444/backups/maca_mysteries";
const backupPrefix = process.env.DATABASE_BACKUP_PREFIX?.trim() || "maca_mysteries";
const backupPath = path.join(backupDir, `${backupPrefix}_${getTimestamp()}.dump`);
const pgConnection = getPgDumpConnection(databaseUrl);

mkdirSync(backupDir, { recursive: true });

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

function removePartialBackup() {
  try {
    rmSync(backupPath, { force: true });
  } catch {
    // Best effort cleanup only.
  }
}

function getPgDumpConnection(value: string) {
  try {
    const url = new URL(value);
    const schema = url.searchParams.get("schema")?.trim() || "";
    url.searchParams.delete("schema");
    return {
      url: url.toString(),
      schema
    };
  } catch {
    return {
      url: value,
      schema: ""
    };
  }
}

function getPgDumpArgs() {
  return [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    ...(pgConnection.schema ? [`--schema=${pgConnection.schema}`] : []),
    pgConnection.url
  ];
}

function runPgDump() {
  return spawnSync("pg_dump", [...getPgDumpArgs(), "--file", backupPath], {
    stdio: "inherit"
  });
}

function runDockerPgDump(containerName: string) {
  const backupFile = openSync(backupPath, "w");
  try {
    return spawnSync("docker", ["exec", containerName, "pg_dump", ...getPgDumpArgs()], {
      stdio: ["ignore", backupFile, "inherit"]
    });
  } finally {
    closeSync(backupFile);
  }
}

let result = runPgDump();

if (result.error) {
  if ("code" in result.error && result.error.code === "ENOENT") {
    const postgresContainer = findPostgresContainer();
    if (postgresContainer) {
      console.warn(`pg_dump is not installed on the host. Falling back to Docker container ${postgresContainer}.`);
      result = runDockerPgDump(postgresContainer);
    } else {
      console.error(result.error.message);
      console.error("Install the PostgreSQL client tools first, for example: sudo apt install postgresql-client");
    }
  } else {
    console.error(result.error.message);
  }
}

if (result.status !== 0) {
  removePartialBackup();
  process.exit(result.status ?? 1);
}

console.log(`Database backup created: ${backupPath}`);
