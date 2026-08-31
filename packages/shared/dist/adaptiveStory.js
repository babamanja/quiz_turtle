/**
 * Adaptive stories MVP: token display / unlock helpers (framework-agnostic).
 * Enum values match Prisma StoryTokenKind / StoryStatus.
 */
export const STORY_TOKEN_KINDS = ["word", "punct"];
export const STORY_STATUSES = ["draft", "published"];
function toWordIdSet(unlockedWordIds) {
    return unlockedWordIds instanceof Set
        ? unlockedWordIds
        : new Set(unlockedWordIds);
}
/** Union of wordIds from levels with level <= unlockedLevel (deduped). */
export function resolveUnlockedWordIds(unlockedLevel, levels) {
    const ids = new Set();
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
export function isTokenUnlocked(token, unlockedWordIds) {
    if (token.kind === "punct") {
        return true;
    }
    if (token.vocabWordId == null) {
        return false;
    }
    return toWordIdSet(unlockedWordIds).has(token.vocabWordId);
}
/** True when the token displays as L2 (unlocked word or punct). */
function displaysAsL2(token, unlockedWordIds) {
    return token.kind === "punct" || isTokenUnlocked(token, unlockedWordIds);
}
function displayTextForToken(token, unlocked) {
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
export function renderSentenceTokens(tokens, unlockedWordIds) {
    const idSet = toWordIdSet(unlockedWordIds);
    const parts = [];
    let text = "";
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const unlocked = isTokenUnlocked(token, idSet);
        const piece = displayTextForToken(token, unlocked);
        if (i > 0) {
            const prev = tokens[i - 1];
            const glue = token.glueToPrevious &&
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
export function progressPercent(unlockedUniqueWordCount, totalUniqueWordCount) {
    if (totalUniqueWordCount <= 0) {
        return 0;
    }
    const raw = (unlockedUniqueWordCount / totalUniqueWordCount) * 100;
    return Math.min(100, Math.max(0, Math.round(raw)));
}
