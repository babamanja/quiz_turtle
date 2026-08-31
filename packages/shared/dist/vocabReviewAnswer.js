export const VOCAB_ANSWER_MAX_TYPOS = 3;
export function normalizeVocabAnswer(raw) {
    return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
function levenshteinDistance(a, b) {
    if (a === b) {
        return 0;
    }
    if (a.length === 0) {
        return b.length;
    }
    if (b.length === 0) {
        return a.length;
    }
    const prev = new Array(b.length + 1);
    const curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) {
        prev[j] = j;
    }
    for (let i = 1; i <= a.length; i += 1) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        for (let j = 0; j <= b.length; j += 1) {
            prev[j] = curr[j];
        }
    }
    return prev[b.length];
}
function collectNormalizedCandidates(expected, alternateAnswers) {
    const seen = new Set();
    const candidates = [];
    for (const raw of [expected, ...alternateAnswers]) {
        const normalized = normalizeVocabAnswer(raw);
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        candidates.push(normalized);
    }
    return candidates;
}
export function evaluateVocabAnswer(userAnswer, expected, alternateAnswers = [], maxTypos = VOCAB_ANSWER_MAX_TYPOS) {
    const normalizedUser = normalizeVocabAnswer(userAnswer);
    if (!normalizedUser) {
        return "wrong";
    }
    const candidates = collectNormalizedCandidates(expected, alternateAnswers);
    if (candidates.length === 0) {
        return "wrong";
    }
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        if (normalizedUser === candidate) {
            return "exact";
        }
        closestDistance = Math.min(closestDistance, levenshteinDistance(normalizedUser, candidate));
    }
    if (closestDistance <= maxTypos) {
        return "close";
    }
    return "wrong";
}
