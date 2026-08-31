import { trackAnalyticsEvent } from "../analytics";
import type { AuthSession } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function authMethodFromProviders(providers: AuthSession["providers"]): "password" | "google" {
  return providers.password ? "password" : "google";
}

let inFlightRefresh: Promise<AuthSession> | null = null;

/**
 * Exchanges httpOnly refresh cookie for a new access token + user (cookie rotated on server).
 * Concurrent callers share one in-flight request to avoid rate-limit storms.
 */
export async function refreshSession(): Promise<AuthSession> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("refresh_failed");
      }
      const data = (await response.json()) as AuthSession;
      trackAnalyticsEvent("auth_refresh_succeeded", {
        auth_method: authMethodFromProviders(data.providers),
        flow: "refresh",
        result: "success",
      });
      return data;
    })
    .finally(() => {
      inFlightRefresh = null;
    });

  return inFlightRefresh;
}
