import { PostHog } from "posthog-node";

type AuthAnalyticsEvent = {
  event: string;
  authMethod: "password" | "google" | "account" | "guest";
  flow: "signup" | "login" | "refresh" | "delete" | "restore" | "guest";
  result: "started" | "success" | "failed";
  reason?: string;
  requestId?: string;
  userId?: number;
};

const posthogApiKey = process.env.POSTHOG_API_KEY?.trim();
const posthogHost = process.env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
const runtimeEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "local";
const appVersion = process.env.APP_VERSION?.trim() || "unknown";

const client = posthogApiKey
  ? new PostHog(posthogApiKey, { host: posthogHost, flushAt: 1, flushInterval: 0 })
  : null;

export function trackAuthEvent(event: AuthAnalyticsEvent): void {
  if (!client) {
    return;
  }
  client.capture({
    distinctId: event.userId ? `user:${event.userId}` : event.requestId || "backend-anon",
    event: event.event,
    properties: {
      auth_method: event.authMethod,
      flow: event.flow,
      result: event.result,
      reason: event.reason,
      request_id: event.requestId,
      env: runtimeEnv,
      app_version: appVersion,
      source: "backend",
      user_id: event.userId,
    },
  });
}

export async function shutdownAnalytics(): Promise<void> {
  await client?.shutdown();
}
