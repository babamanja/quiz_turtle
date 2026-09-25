import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

import { buildSpaContentSecurityPolicy } from "@language-turtle/shared";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readVercelSpaCsp(): string {
  const vercel = JSON.parse(readFileSync(resolve(repoRoot, "frontend/vercel.json"), "utf8")) as {
    headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }>;
  };
  const spaHeaders = vercel.headers?.find((entry) => entry.source?.includes("api"));
  const csp = spaHeaders?.headers?.find((header) => header.key === "Content-Security-Policy");
  assert.ok(csp?.value, "frontend/vercel.json must define Content-Security-Policy for SPA routes");
  return csp.value;
}

test("frontend/vercel.json SPA CSP matches shared policy builder", () => {
  assert.equal(readVercelSpaCsp(), buildSpaContentSecurityPolicy());
});
