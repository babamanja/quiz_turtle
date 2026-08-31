import { intervalMsForLevel, PIMSLEUR_LEVEL_MAX } from "./pimsleurSchedule.js";
const REVIEW_RETENTION_THRESHOLD = 0.7;
const REVIEW_LOSS_FRACTION_BY_LEVEL = [
    1.0, 0.6, 0.4, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2,
];
if (REVIEW_LOSS_FRACTION_BY_LEVEL.length !== PIMSLEUR_LEVEL_MAX + 1) {
    throw new Error("REVIEW_LOSS_FRACTION_BY_LEVEL must have length PIMSLEUR_LEVEL_MAX + 1");
}
function reviewLossFractionForLevel(level) {
    const clamped = Math.max(0, Math.min(level, PIMSLEUR_LEVEL_MAX));
    return REVIEW_LOSS_FRACTION_BY_LEVEL[clamped] ?? 0.2;
}
export function reviewRetentionThresholdForLevel(level) {
    return 1 - reviewLossFractionForLevel(level);
}
const REVIEW_RETENTION_EPSILON = 1e-9;
function decayThresholdForTau(threshold) {
    if (threshold <= 0) {
        return REVIEW_RETENTION_EPSILON;
    }
    if (threshold >= 1) {
        return 1 - REVIEW_RETENTION_EPSILON;
    }
    return threshold;
}
export function retentionAtElapsed(elapsedMs, intervalMs, threshold = REVIEW_RETENTION_THRESHOLD) {
    if (intervalMs <= 0) {
        return 1;
    }
    if (threshold >= 1) {
        return 1;
    }
    const clampedElapsed = Math.max(0, Math.min(elapsedMs, intervalMs));
    if (clampedElapsed >= intervalMs) {
        return Math.max(0, threshold);
    }
    const tau = intervalMs / -Math.log(decayThresholdForTau(threshold));
    const retention = Math.exp(-clampedElapsed / tau);
    return Math.max(0, Math.min(1, retention));
}
export function currentRetention(pimsleurLevel, nextReviewMs, nowMs = Date.now()) {
    const level = Math.max(0, Math.min(pimsleurLevel, PIMSLEUR_LEVEL_MAX));
    const intervalMs = intervalMsForLevel(level);
    const threshold = reviewRetentionThresholdForLevel(level);
    const isOverdue = nowMs >= nextReviewMs;
    const elapsedMs = isOverdue ? intervalMs : Math.max(0, nowMs - (nextReviewMs - intervalMs));
    return {
        level,
        intervalMs,
        progress: intervalMs > 0 ? Math.min(1, elapsedMs / intervalMs) : 0,
        retention: isOverdue ? threshold : retentionAtElapsed(elapsedMs, intervalMs, threshold),
        isOverdue,
    };
}
