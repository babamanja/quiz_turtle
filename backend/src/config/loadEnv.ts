import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeAppEnv, type AppEnv } from "./appEnv.js";
import { hostToOrigin } from "./publicOrigins.js";

export type { AppEnv } from "./appEnv.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const envDir = resolve(moduleDir, "../../../env");
const backendEnvPath = resolve(moduleDir, "../../.env");

function syncViteGoogleClientId(): void {
  if (!process.env.VITE_GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_ID?.trim()) {
    process.env.VITE_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID.trim();
  }
}

/** Use Vercel deployment URL when AUTH_PUBLIC_APP_URL is not set (email links, etc.). */
function syncAuthPublicAppUrl(): void {
  if (process.env.AUTH_PUBLIC_APP_URL?.trim()) {
    return;
  }
  for (const key of [
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
  ] as const) {
    const origin = hostToOrigin(process.env[key]);
    if (origin) {
      process.env.AUTH_PUBLIC_APP_URL = origin;
      return;
    }
  }
}

/** Loads env files from repo `env/` (local dev). Host-provided vars are never overwritten. */
export function loadEnv(mode?: string): AppEnv {
  const appEnv = normalizeAppEnv(mode ?? process.env.APP_ENV);
  if (process.env.APP_ENV === undefined) {
    process.env.APP_ENV = appEnv;
  }

  const files = [".env", ".env.local", `.env.${appEnv}`, `.env.${appEnv}.local`];
  const merged: Record<string, string> = {};

  for (const name of files) {
    const path = resolve(envDir, name);
    if (!existsSync(path)) {
      continue;
    }
    const parsed = config({ path, processEnv: {} });
    if (parsed.parsed) {
      Object.assign(merged, parsed.parsed);
    }
  }

  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  if (existsSync(backendEnvPath)) {
    const parsed = config({ path: backendEnvPath, processEnv: {} });
    if (parsed.parsed) {
      for (const [key, value] of Object.entries(parsed.parsed)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }
  }

  syncViteGoogleClientId();
  syncAuthPublicAppUrl();

  return appEnv;
}
