const STORAGE_KEY = "language_turtle_cookie_consent";
const ACKNOWLEDGED_VALUE = "accepted";

/** Whether the user has dismissed the cookie usage notice. */
export function hasCookieNoticeAcknowledged(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(STORAGE_KEY) === ACKNOWLEDGED_VALUE;
}

export function acknowledgeCookieNotice(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, ACKNOWLEDGED_VALUE);
}
