import posthog from "posthog-js";

const analyticsEnv = import.meta.env.MODE;
const analyticsAppVersion = import.meta.env.VITE_APP_VERSION ?? "unknown";
const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY?.trim();
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
const metaPixelId = import.meta.env.VITE_META_PIXEL_ID?.trim();
const googleAdsId = import.meta.env.VITE_GOOGLE_ADS_ID?.trim();
const googleAdsSignupSendTo = import.meta.env.VITE_GOOGLE_ADS_SIGNUP_SEND_TO?.trim();

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function baseProps() {
  return { env: analyticsEnv, app_version: analyticsAppVersion };
}

let initialized = false;

export function initializeAnalytics(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: false,
      autocapture: true,
    });
  }
  if (metaPixelId && typeof document !== "undefined") {
    if (!window.fbq) {
      const fbq = (...args: unknown[]) => {
        (fbq as { queue?: unknown[] }).queue = (fbq as { queue?: unknown[] }).queue || [];
        (fbq as { queue?: unknown[] }).queue?.push(args);
      };
      window.fbq = fbq;
    }
    if (!document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]')) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    window.fbq("init", metaPixelId);
  }
  if (googleAdsId && typeof window !== "undefined" && window.gtag) {
    window.gtag("config", googleAdsId);
  }
}

const META_EVENTS: Record<string, string> = {
  auth_signup_succeeded: "CompleteRegistration",
  auth_login_succeeded: "Login",
  account_delete_succeeded: "DeleteAccount",
  checkout_completed: "Purchase",
};

export function trackAnalyticsEvent(event: string, props: Record<string, unknown> = {}): void {
  const payload = { ...baseProps(), ...props };
  if (posthogKey) {
    posthog.capture(event, payload);
  }
  if (metaPixelId && window.fbq) {
    const metaEvent = META_EVENTS[event];
    if (metaEvent) {
      window.fbq("track", metaEvent, payload);
    } else {
      window.fbq("trackCustom", event, payload);
    }
  }
  if (event === "auth_signup_succeeded" && googleAdsSignupSendTo && window.gtag) {
    window.gtag("event", "conversion", { send_to: googleAdsSignupSendTo, ...payload });
  }
}

export function trackUiCtaClick(ctaId: string, ctaLabel?: string): void {
  if (!metaPixelId || !window.fbq) {
    return;
  }
  window.fbq("trackCustom", "ui_cta_clicked", {
    ...baseProps(),
    cta_id: ctaId,
    ...(ctaLabel ? { cta_label: ctaLabel } : {}),
    page_path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  });
}

export function identifyAnalyticsUser(userId: string): void {
  if (posthogKey) {
    posthog.identify(userId);
  }
}

export function resetAnalyticsUser(): void {
  if (posthogKey) {
    posthog.reset();
  }
}

export function createRequestId(): string {
  return crypto.randomUUID();
}
