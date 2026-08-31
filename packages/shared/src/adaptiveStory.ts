/**
 * Adaptive stories MVP: token display / unlock helpers (framework-agnostic).
 * Enum values match Prisma StoryTokenKind / StoryStatus.
 */

export const STORY_TOKEN_KINDS = ["word", "punct"] as const;
export type StoryTokenKind = (typeof STORY_TOKEN_KINDS)[number];

export const STORY_STATUSES = ["draft", "published"] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

/** Token shape used for L1/L2 render (matches StoryToken fields needed client-side). */
export type AdaptiveStoryTokenInput = {
  kind: StoryTokenKind;
  vocabWordId: number | null;
  baseForm: string;
  l1Text: string;
  glueToPrevious: boolean;
};

/** Unlock ladder entry: vocab words revealed when the learner reaches this level. */
export type AdaptiveStoryUnlockLevelInput = {
  level: number;
  wordIds: number[];
};

export type AdaptiveStoryRenderedPart = {
  text: string;
  unlocked: boolean;
  kind: StoryTokenKind;
  glueToPrevious: boolean;
};

export type AdaptiveStoryRenderResult = {
  text: string;
  parts: AdaptiveStoryRenderedPart[];
};

function toWordIdSet(
  unlockedWordIds: ReadonlySet<number> | readonly number[],
): ReadonlySet<number> {
  return unlockedWordIds instanceof Set
    ? unlockedWordIds
    : new Set(unlockedWordIds);
}

/** Union of wordIds from levels with level <= unlockedLevel (deduped). */
export function resolveUnlockedWordIds(
  unlockedLevel: number,
  levels: readonly AdaptiveStoryUnlockLevelInput[],
): number[] {
  const ids = new Set<number>();
  for (const entry of levels) {
    if (entry.level <= unlockedLevel) {
      for (const wordId of entry.wordIds) {
        ids.add(wordId);
      }
    }
  }
  return [...ids];
}

/** Punct is always "unlocked" for display; words unlock when vocabWordId is in the set. */
export function isTokenUnlocked(
  token: AdaptiveStoryTokenInput,
  unlockedWordIds: ReadonlySet<number> | readonly number[],
): boolean {
  if (token.kind === "punct") {
    return true;
  }
  if (token.vocabWordId == null) {
    return false;
  }
  return toWordIdSet(unlockedWordIds).has(token.vocabWordId);
}

/** True when the token displays as L2 (unlocked word or punct). */
function displaysAsL2(
  token: AdaptiveStoryTokenInput,
  unlockedWordIds: ReadonlySet<number>,
): boolean {
  return token.kind === "punct" || isTokenUnlocked(token, unlockedWordIds);
}

function displayTextForToken(
  token: AdaptiveStoryTokenInput,
  unlocked: boolean,
): string {
  if (token.kind === "punct") {
    return token.baseForm;
  }
  return unlocked ? token.baseForm : token.l1Text;
}

/**
 * Render sentence tokens with L1 placeholders for locked words.
 * Glue (no space) only when glueToPrevious and both adjacent sides display as L2
 * (unlocked word or punct) — never glue L2 to a still-locked L1 stem.
 */
export function renderSentenceTokens(
  tokens: readonly AdaptiveStoryTokenInput[],
  unlockedWordIds: ReadonlySet<number> | readonly number[],
): AdaptiveStoryRenderResult {
  const idSet = toWordIdSet(unlockedWordIds);
  const parts: AdaptiveStoryRenderedPart[] = [];
  let text = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const unlocked = isTokenUnlocked(token, idSet);
    const piece = displayTextForToken(token, unlocked);

    if (i > 0) {
      const prev = tokens[i - 1]!;
      const glue =
        token.glueToPrevious &&
        displaysAsL2(token, idSet) &&
        displaysAsL2(prev, idSet);
      if (!glue) {
        text += " ";
      }
    }

    text += piece;
    parts.push({
      text: piece,
      unlocked,
      kind: token.kind,
      glueToPrevious: token.glueToPrevious,
    });
  }

  return { text, parts };
}

/** Progress 0..100; 0 when total is 0. */
export function progressPercent(
  unlockedUniqueWordCount: number,
  totalUniqueWordCount: number,
): number {
  if (totalUniqueWordCount <= 0) {
    return 0;
  }
  const raw = (unlockedUniqueWordCount / totalUniqueWordCount) * 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
}
