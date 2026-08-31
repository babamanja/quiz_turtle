import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  BASELINE_MIGRATION,
  BASELINE_DRIFT_REPAIR_SQL,
  extractFailedMigrationName,
  hasFailedMigrationError,
  isP3005Error,
  isP3009Error,
  isP3018Error,
  isPrismaEngineLockedError,
  runPrisma,
} from "../scripts/prismaMigrate.mjs";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("isP3005Error detects non-empty database baseline error", () => {
  assert.equal(
    isP3005Error("Error: P3005\n\nThe database schema is not empty."),
    true,
  );
  assert.equal(isP3005Error("database schema is not empty"), true);
  assert.equal(isP3005Error("migration applied successfully"), false);
});

test("BASELINE_MIGRATION matches checked-in migration folder", () => {
  const migrationSql = resolve(
    backendRoot,
    "prisma/migrations",
    BASELINE_MIGRATION,
    "migration.sql",
  );
  assert.ok(existsSync(migrationSql), `expected ${migrationSql}`);
});

test("isP3018Error detects failed migration recovery error", () => {
  assert.equal(
    isP3018Error("Error: P3018\n\nA migration failed to apply."),
    true,
  );
  assert.equal(isP3018Error("migration failed to apply"), true);
  assert.equal(isP3018Error("migration applied successfully"), false);
});

test("isP3009Error detects blocked deploy with failed migration history", () => {
  assert.equal(
    isP3009Error("Error: P3009\n\nmigrate found failed migrations in the target database"),
    true,
  );
  assert.equal(isP3009Error("found failed migrations in the target database"), true);
  assert.equal(isP3009Error("migration applied successfully"), false);
});

test("hasFailedMigrationError covers P3009 and P3018", () => {
  assert.equal(hasFailedMigrationError("Error: P3009"), true);
  assert.equal(hasFailedMigrationError("Error: P3018"), true);
  assert.equal(hasFailedMigrationError("ok"), false);
});

test("extractFailedMigrationName parses Prisma migrate output", () => {
  const p3018 = "Migration name: 20260622170000_user_dictionaries\nDatabase error code: 42703";
  assert.equal(extractFailedMigrationName(p3018), "20260622170000_user_dictionaries");

  const p3009 =
    "Error: P3009\nThe `20260622170000_user_dictionaries` migration started at 2026-06-24 failed";
  assert.equal(extractFailedMigrationName(p3009), "20260622170000_user_dictionaries");
});

test("BASELINE_DRIFT_REPAIR_SQL adds users.created_at for legacy DBs", () => {
  assert.match(BASELINE_DRIFT_REPAIR_SQL.join("\n"), /users.*created_at/);
});

test("deploy-database.mjs baselines P3005 with migrate resolve --applied", () => {
  const source = readFileSync(
    resolve(backendRoot, "scripts/deploy-database.mjs"),
    "utf8",
  );
  assert.match(source, /isP3005Error/);
  assert.match(source, /migrate", "resolve", "--applied", BASELINE_MIGRATION/);
  assert.match(source, /clearFailedMigrationsFromDatabase/);
  assert.match(source, /recoverFailedMigration/);
  assert.match(source, /repairBaselineDrift/);
  assert.doesNotMatch(source, /--rolled-back.*BASELINE_MIGRATION/);
});

test("isPrismaEngineLockedError detects Windows EPERM on query engine", () => {
  assert.equal(
    isPrismaEngineLockedError(
      "EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp' -> '...query_engine-windows.dll.node'",
    ),
    true,
  );
  assert.equal(isPrismaEngineLockedError("migration applied successfully"), false);
});

test("ensure-local-schema skips prisma generate when client already exists", () => {
  const source = readFileSync(resolve(backendRoot, "scripts/ensure-local-schema.mjs"), "utf8");
  assert.match(source, /runPrismaGenerateIfNeeded/);
  assert.doesNotMatch(source, /runPrisma\(\["generate"\]\)/);
});

test("prisma generate links hoisted @prisma/client into backend workspace", () => {
  const source = readFileSync(resolve(backendRoot, "scripts/prismaMigrate.mjs"), "utf8");
  assert.match(source, /linkHoistedPrismaClientToBackend/);
  assert.match(source, /symlinkSync/);
});
test("runPrisma invokes Prisma CLI without Windows .cmd shims", () => {
  const source = readFileSync(resolve(backendRoot, "scripts/prismaMigrate.mjs"), "utf8");
  assert.match(source, /prisma\/build\/index\.js/);
  assert.doesNotMatch(source, /prisma\.cmd/);
});

test("runPrisma --version exits successfully", () => {
  const result = runPrisma(["--version"], { capture: true });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /prisma/i);
});

test("dev script starts tsx watch; schema prep is dev:prepare", () => {
  const pkg = JSON.parse(readFileSync(resolve(backendRoot, "package.json"), "utf8"));
  assert.match(pkg.scripts.dev, /tsx watch src\/index\.ts/);
  assert.match(pkg.scripts["dev:prepare"], /ensure-local-schema\.mjs/);
});
