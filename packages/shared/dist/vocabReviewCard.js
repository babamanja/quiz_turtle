import { scheduleAfterCorrect, scheduleAfterWrong, } from "./pimsleurSchedule.js";
import { collectNestAlternateTexts, mergeVocabAlternateAnswers } from "./vocabNest.js";
export function entryToPairSchedules(entry) {
    return {
        learningToPrimary: {
            pimsleurLevel: entry.pimsleurLevel,
            nextReviewMs: entry.nextReviewMs,
        },
        primaryToLearning: {
            pimsleurLevel: entry.pimsleurLevelReverse,
            nextReviewMs: entry.nextReviewMsReverse,
        },
    };
}
export function pairPimsleurLevel(schedules) {
    return Math.min(schedules.learningToPrimary.pimsleurLevel, schedules.primaryToLearning.pimsleurLevel);
}
export function pairNextReviewMs(schedules) {
    const forward = schedules.learningToPrimary.nextReviewMs;
    const reverse = schedules.primaryToLearning.nextReviewMs;
    return forward < reverse ? forward : reverse;
}
export function selectWorstCardDirection(schedules) {
    const forward = schedules.learningToPrimary;
    const reverse = schedules.primaryToLearning;
    if (forward.pimsleurLevel < reverse.pimsleurLevel) {
        return "learning_to_primary";
    }
    if (reverse.pimsleurLevel < forward.pimsleurLevel) {
        return "primary_to_learning";
    }
    if (forward.nextReviewMs < reverse.nextReviewMs) {
        return "learning_to_primary";
    }
    if (reverse.nextReviewMs < forward.nextReviewMs) {
        return "primary_to_learning";
    }
    return "primary_to_learning";
}
export function scheduleForDirection(schedules, direction) {
    return direction === "learning_to_primary"
        ? schedules.learningToPrimary
        : schedules.primaryToLearning;
}
export function isValidReviewCardDirection(value) {
    return value === "learning_to_primary" || value === "primary_to_learning";
}
/** Prefer the worst card; coerce mismatched client direction back to worst. */
export function coerceReviewDirection(entry, direction) {
    const schedules = entryToPairSchedules(entry);
    const worstDirection = selectWorstCardDirection(schedules);
    if (direction != null && direction !== worstDirection) {
        return worstDirection;
    }
    return direction ?? worstDirection;
}
/** Pure review scheduling: direction coerce → ladder → Prisma field patch. */
export function planReviewScheduleUpdate(entry, result, nowMs, directionRaw) {
    const direction = coerceReviewDirection(entry, directionRaw);
    const schedules = entryToPairSchedules(entry);
    const currentLevel = scheduleForDirection(schedules, direction).pimsleurLevel;
    const schedule = result === "know" ? scheduleAfterCorrect(currentLevel, nowMs) : scheduleAfterWrong(nowMs);
    const nextReviewMs = BigInt(schedule.nextReviewMs);
    const updateData = direction === "learning_to_primary"
        ? {
            pimsleurLevel: schedule.pimsleurLevel,
            nextReviewMs,
        }
        : {
            pimsleurLevelReverse: schedule.pimsleurLevel,
            nextReviewMsReverse: nextReviewMs,
        };
    return { direction, schedule, updateData };
}
/** Initial forward+reverse schedules for a newly attached dictionary entry. */
export function initialDictionarySchedules(nowMs = Date.now()) {
    const schedule = scheduleAfterWrong(nowMs);
    const nextReviewMs = BigInt(schedule.nextReviewMs);
    return {
        pimsleurLevel: schedule.pimsleurLevel,
        nextReviewMs,
        pimsleurLevelReverse: schedule.pimsleurLevel,
        nextReviewMsReverse: nextReviewMs,
    };
}
export function expectedAnswersForDirection(direction, primaryWord, learningWord, alternatePrimaryAnswers = [], alternateLearningAnswers = [], primaryNestMembers = [], learningNestMembers = []) {
    if (direction === "learning_to_primary") {
        return {
            expected: primaryWord,
            alternates: mergeVocabAlternateAnswers(alternatePrimaryAnswers, collectNestAlternateTexts(primaryNestMembers, primaryWord)),
        };
    }
    return {
        expected: learningWord,
        alternates: mergeVocabAlternateAnswers(alternateLearningAnswers, collectNestAlternateTexts(learningNestMembers, learningWord)),
    };
}
