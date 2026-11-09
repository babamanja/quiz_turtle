export function taughtLanguageDenied(
  taughtLanguageIds: readonly number[],
  languageId: number | null | undefined,
): { ok: false; status: 403; error: "forbidden" } | null {
  if (languageId != null && taughtLanguageIds.includes(languageId)) {
    return null;
  }
  return { ok: false, status: 403, error: "forbidden" };
}
