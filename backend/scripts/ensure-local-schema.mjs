/**
 * Local dev schema setup:
 * 1. migrate deploy
 * 2. on P3005 (non-empty DB, no migration history) — baseline + db push for drift
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "./loadEnv.mjs";
import { BASELINE_MIGRATION, BASELINE_DRIFT_REPAIR_SQL, isP3005Error, runPrisma, runPrismaGenerateIfNeeded } from "./prismaMigrate.mjs";

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backendEnvPath = resolve(backendDir, ".env");

loadEnv();

if (existsSync(backendEnvPath)) {
  config({ path: backendEnvPath });
}

const explicit = process.env.DATABASE_URL?.trim();
if (!explicit) {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = process.env;
  if (DB_USER && DB_HOST && DB_PORT && DB_DATABASE) {
    process.env.DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
  }
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "[ensure-local-schema] Missing DATABASE_URL. Set env/.env.local or backend/.env.",
  );
  process.exit(1);
}

function migrateDeploy(capture) {
  console.log("[ensure-local-schema] Running prisma migrate deploy…");
  return runPrisma(["migrate", "deploy"], { capture });
}

async function repairBaselineDrift() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    for (const sql of BASELINE_DRIFT_REPAIR_SQL) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log("[ensure-local-schema] Repaired baseline schema drift.");
  } finally {
    await prisma.$disconnect();
  }
}

function baselineExistingDatabase() {
  console.warn(
    `[ensure-local-schema] Database already has tables but no Prisma migration history (P3005). ` +
      `Marking ${BASELINE_MIGRATION} as applied…`,
  );
  const resolveResult = runPrisma(["migrate", "resolve", "--applied", BASELINE_MIGRATION]);
  if (resolveResult.status !== 0) {
    process.exit(resolveResult.status);
  }
}

function syncSchemaDrift() {
  console.log("[ensure-local-schema] Syncing schema with prisma db push…");
  const pushResult = runPrisma(["db", "push", "--skip-generate"]);
  if (pushResult.status !== 0) {
    console.error(
      "[ensure-local-schema] db push failed. Reset local DB if needed:\n" +
        "  DROP SCHEMA public CASCADE;\n" +
        "  CREATE SCHEMA public;\n" +
        "  GRANT ALL ON SCHEMA public TO public;",
    );
    process.exit(pushResult.status);
  }
}

function generateClientIfNeeded() {
  return runPrismaGenerateIfNeeded();
}

let result = migrateDeploy(true);
if (result.status === 0) {
  const genResult = generateClientIfNeeded();
  if (genResult.status !== 0) {
    console.error(
      "[ensure-local-schema] prisma generate failed. Stop the backend and run: npm run db:generate",
    );
    process.exit(genResult.status);
  }
  console.log("[ensure-local-schema] Done.");
  process.exit(0);
}

if (isP3005Error(result.output)) {
  baselineExistingDatabase();
  await repairBaselineDrift();
  result = migrateDeploy(false);
  if (result.status !== 0) {
    process.exit(result.status);
  }
  syncSchemaDrift();
  const genResult = generateClientIfNeeded();
  if (genResult.status !== 0) {
    console.error(
      "[ensure-local-schema] prisma generate failed. Stop the backend and run: npm run db:generate",
    );
    process.exit(genResult.status);
  }
  console.log("[ensure-local-schema] Done (baselined existing database).");
  process.exit(0);
}

if (result.output.trim()) {
  process.stderr.write(result.output);
}
process.exit(result.status);
