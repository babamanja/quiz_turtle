import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("bot dev generates Prisma client before tsx watch", () => {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "bot/package.json"), "utf8"));
  assert.match(pkg.scripts.dev, /ensure-prisma-client-ready\.mjs/);
  assert.match(pkg.scripts.dev, /tsx watch main\.ts/);
});

test("bot prisma client imports generated backend @prisma/client", () => {
  const source = readFileSync(resolve(repoRoot, "bot/domain/prisma-client.ts"), "utf8");
  assert.match(source, /node_modules\/@prisma\/client\/index\.js/);
  assert.doesNotMatch(source, /from ["']@prisma\/client["']/);
});

test("bot keeps @prisma/client only as a devDependency for types", () => {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "bot/package.json"), "utf8"));
  assert.equal(pkg.dependencies?.["@prisma/client"], undefined);
  assert.match(pkg.devDependencies?.["@prisma/client"], /^[\^~]?6\./);
});

test("dev:all prepares database and Prisma before starting services", () => {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  assert.match(pkg.scripts["dev:prepare"], /ensure-prisma-client-ready\.mjs/);
  assert.match(pkg.scripts["dev:prepare"], /dev:prepare --prefix backend/);
  assert.match(pkg.scripts["dev:all"], /npm run dev:prepare && concurrently/);
  assert.match(pkg.scripts["dev:all"], /wait-for-backend\.mjs/);
});

test("backend dev starts tsx immediately without blocking migrate deploy", () => {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "backend/package.json"), "utf8"));
  assert.match(pkg.scripts.dev, /tsx watch src\/index\.ts/);
  assert.doesNotMatch(pkg.scripts.dev, /ensure-local-schema/);
  assert.match(pkg.scripts["dev:prepare"], /ensure-local-schema\.mjs/);
});
