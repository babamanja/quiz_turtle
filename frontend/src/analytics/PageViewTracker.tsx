import posthog from "posthog-js";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [location.pathname, location.search, location.hash]);

  return null;
}
