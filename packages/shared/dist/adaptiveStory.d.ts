/**
 * Adaptive stories MVP: token display / unlock helpers (framework-agnostic).
 * Enum values match Prisma StoryTokenKind / StoryStatus.
 */
export declare const STORY_TOKEN_KINDS: readonly ["word", "punct"];
export type StoryTokenKind = (typeof STORY_TOKEN_KINDS)[number];
export declare const STORY_STATUSES: readonly ["draft", "published"];
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
/** Union of wordIds from levels with level <= unlockedLevel (deduped). */
export declare function resolveUnlockedWordIds(unlockedLevel: number, levels: readonly AdaptiveStoryUnlockLevelInput[]): number[];
/** Punct is always "unlocked" for display; words unlock when vocabWordId is in the set. */
export declare function isTokenUnlocked(token: AdaptiveStoryTokenInput, unlockedWordIds: ReadonlySet<number> | readonly number[]): boolean;
/**
 * Render sentence tokens with L1 placeholders for locked words.
 * Glue (no space) only when glueToPrevious and both adjacent sides display as L2
 * (unlocked word or punct) — never glue L2 to a still-locked L1 stem.
 */
export declare function renderSentenceTokens(tokens: readonly AdaptiveStoryTokenInput[], unlockedWordIds: ReadonlySet<number> | readonly number[]): AdaptiveStoryRenderResult;
/** Progress 0..100; 0 when total is 0. */
export declare function progressPercent(unlockedUniqueWordCount: number, totalUniqueWordCount: number): number;
//# sourceMappingURL=adaptiveStory.d.ts.map