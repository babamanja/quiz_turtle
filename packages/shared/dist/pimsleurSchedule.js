/**
 * Pimsleur-style ladder: delay until the next review after landing at this level.
 */
export const PIMSLEUR_LEVEL_MAX = 10;
export const PIMSLEUR_DELAYS_MS = [
    5 * 1000,
    25 * 1000,
    2 * 60 * 1000,
    10 * 60 * 1000,
    60 * 60 * 1000,
    5 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
    5 * 24 * 60 * 60 * 1000,
    25 * 24 * 60 * 60 * 1000,
    Math.round(4 * 30.4375 * 24 * 60 * 60 * 1000),
    2 * 365.25 * 24 * 60 * 60 * 1000,
];
if (PIMSLEUR_DELAYS_MS.length !== PIMSLEUR_LEVEL_MAX + 1) {
    throw new Error("PIMSLEUR_DELAYS_MS must have length PIMSLEUR_LEVEL_MAX + 1");
}
export function intervalMsForLevel(level) {
    const clamped = Math.max(0, Math.min(level, PIMSLEUR_LEVEL_MAX));
    return PIMSLEUR_DELAYS_MS[clamped] ?? PIMSLEUR_DELAYS_MS[0];
}
/** New / failed card: level 0, first review after the shortest delay. */
export function initialSchedule(nowMs = Date.now()) {
    return {
        pimsleurLevel: 0,
        nextReviewMs: nowMs + intervalMsForLevel(0),
    };
}
export function scheduleAfterCorrect(currentLevel, nowMs = Date.now()) {
    const nextLevel = Math.min(currentLevel + 1, PIMSLEUR_LEVEL_MAX);
    return {
        pimsleurLevel: nextLevel,
        nextReviewMs: nowMs + intervalMsForLevel(nextLevel),
    };
}
export function scheduleAfterWrong(nowMs = Date.now()) {
    return initialSchedule(nowMs);
}
