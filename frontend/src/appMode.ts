import type { User } from "./types";

export type AppMode = "student" | "teacher" | "admin";

const STORAGE_KEY = "lt.appMode";

type ModeUser = Pick<User, "role" | "isGuest" | "taughtLanguageIds"> | null | undefined;

export function modesForUser(user: ModeUser): AppMode[] {
  if (!user || user.role === "guest") {
    return [];
  }
  const modes: AppMode[] = ["student"];
  if (!user.isGuest && (user.taughtLanguageIds?.length ?? 0) > 0) {
    modes.push("teacher");
  }
  if (!user.isGuest && user.role === "admin") {
    modes.push("admin");
  }
  return modes;
}

export function readStoredAppMode(): AppMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "student" || value === "teacher" || value === "admin") {
      return value;
    }
  } catch {
    // Storage can be blocked; fall back to the default mode.
  }
  return null;
}

const listeners = new Set<() => void>();

export function subscribeAppMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setAppMode(mode: AppMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
  for (const listener of listeners) {
    listener();
  }
}

export function activeAppMode(user: ModeUser): AppMode {
  const modes = modesForUser(user);
  const stored = readStoredAppMode();
  if (stored && modes.includes(stored)) {
    return stored;
  }
  if (modes.includes("admin")) {
    return "admin";
  }
  if (modes.includes("teacher")) {
    return "teacher";
  }
  return "student";
}

export function homePathForMode(mode: AppMode): string {
  if (mode === "admin") {
    return "/admin/dashboard";
  }
  if (mode === "teacher") {
    return "/admin/words";
  }
  return "/dashboard";
}

export function languagesTaughtByUser<T extends { id: number }>(
  languages: readonly T[],
  taughtLanguageIds: readonly number[] | undefined,
): T[] {
  const allowed = new Set(taughtLanguageIds ?? []);
  return languages.filter((language) => allowed.has(language.id));
}
