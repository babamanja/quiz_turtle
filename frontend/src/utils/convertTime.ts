type DateInput = string | Date | number | null | undefined;

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

function parseDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelativeTime(value: DateInput, locale?: string): string {
  const date = parseDate(value);
  if (!date) {
    return "—";
  }

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const absoluteDiff = Math.abs(diffSeconds);

  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (absoluteDiff >= secondsInUnit || unit === "second") {
      return formatter.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }

  return formatter.format(0, "second");
}

export function isReviewOverdue(nextReviewMs: number, nowMs: number = Date.now()): boolean {
  if (!Number.isFinite(nextReviewMs) || nextReviewMs <= 0) {
    return false;
  }
  return nextReviewMs <= nowMs;
}

const SHORT_DURATION_UNITS: ReadonlyArray<{ limitMs: number; divisorMs: number; suffix: string }> = [
  { limitMs: 60_000, divisorMs: 1_000, suffix: "s" },
  { limitMs: 3_600_000, divisorMs: 60_000, suffix: "m" },
  { limitMs: 86_400_000, divisorMs: 3_600_000, suffix: "h" },
  { limitMs: 86_400_000 * 45, divisorMs: 86_400_000, suffix: "d" },
  { limitMs: 86_400_000 * 365, divisorMs: 86_400_000 * 30.4375, suffix: "mo" },
];

export function formatShortDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }

  for (const unit of SHORT_DURATION_UNITS) {
    if (ms < unit.limitMs) {
      return `${Math.round(ms / unit.divisorMs)}${unit.suffix}`;
    }
  }

  const years = ms / (86_400_000 * 365.25);
  if (years >= 10) {
    return `${Math.round(years)}y`;
  }
  const roundedYears = Math.round(years * 10) / 10;
  return `${roundedYears}y`;
}
