/**
 * Shared Prisma CLI helpers for local migrate / baseline flows.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";
const USE_SHELL = process.platform === "win32";

export const BASELINE_MIGRATION = "20260621120000_init_language_turtle";

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(backendDir, "..");

function resolvePrismaCli() {
  const candidates = [
    resolve(backendDir, "node_modules/prisma/build/index.js"),
    resolve(backendDir, "..", "node_modules", "prisma", "build", "index.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function prismaInvocation(args) {
  const prismaCli = resolvePrismaCli();
  if (prismaCli) {
    return { command: process.execPath, args: [prismaCli, ...args], shell: false };
  }
  return { command: NPX_BIN, args: ["prisma", ...args], shell: USE_SHELL };
}

export function isP3005Error(output) {
  const text = output ?? "";
  return text.includes("P3005") || text.includes("database schema is not empty");
}

export function isP3018Error(output) {
  const text = output ?? "";
  return text.includes("P3018") || text.includes("migration failed to apply");
}

export function isP3009Error(output) {
  const text = output ?? "";
  return text.includes("P3009") || text.includes("found failed migrations in the target database");
}

export function hasFailedMigrationError(output) {
  return isP3009Error(output) || isP3018Error(output);
}

export function extractFailedMigrationName(output) {
  const text = output ?? "";
  const explicit = text.match(/Migration name: ([^\s]+)/);
  if (explicit?.[1]) {
    return explicit[1];
  }
  const blocked = text.match(/The `([^`]+)` migration (?:started|failed)/);
  return blocked?.[1] ?? null;
}

/** Idempotent repairs skipped when init migration is baselined without running SQL. */
export const BASELINE_DRIFT_REPAIR_SQL = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
];

export function prismaClientEntryPath() {
  return resolve(repoRoot, "node_modules/@prisma/client/index.js");
}

export function isPrismaClientGenerated() {
  const entry = prismaClientEntryPath();
  const engine = resolve(repoRoot, "node_modules/.prisma/client/index.js");
  return existsSync(entry) && existsSync(engine);
}

export function isPrismaEngineLockedError(output) {
  const text = output ?? "";
  return text.includes("EPERM") && text.includes("query_engine");
}

export function runPrismaGenerateIfNeeded({ force = false } = {}) {
  if (!force && isPrismaClientGenerated()) {
    console.log("[prisma] Client already generated; skipping prisma generate.");
    return { status: 0, output: "", skipped: true };
  }

  const result = runPrisma(["generate"]);
  if (result.status !== 0 && isPrismaEngineLockedError(result.output)) {
    console.error(
      "[prisma] Query engine DLL is locked. Stop backend/bot dev servers, then run npm run db:generate again.",
    );
  }
  return result;
}

function linkHoistedPrismaClientToBackend() {
  const links = [
    ["@prisma/client", resolve(repoRoot, "node_modules/@prisma/client")],
    [".prisma", resolve(repoRoot, "node_modules/.prisma")],
  ];
  for (const [name, source] of links) {
    if (!existsSync(source)) {
      continue;
    }
    const target = resolve(backendDir, "node_modules", name);
    if (existsSync(target)) {
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(source, target, "junction");
  }
}

/**
 * @param {string[]} args Prisma CLI args after `prisma`
 * @param {{ capture?: boolean }} [options]
 */
export function runPrisma(args, options = {}) {
  const capture = options.capture === true;
  const isGenerate = args[0] === "generate" && args.length === 1;
  if (isGenerate) {
    linkHoistedPrismaClientToBackend();
  }
  const { command, args: commandArgs, shell } = prismaInvocation(args);
  const result = spawnSync(command, commandArgs, {
    cwd: backendDir,
    env: process.env,
    shell,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    throw new Error(`Failed to run ${command}: ${result.error.message}`);
  }

  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";

  return {
    status: result.status ?? 1,
    output: `${stdout}\n${stderr}`.trim(),
  };
}
