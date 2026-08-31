import {
  scheduleAfterCorrect,
  scheduleAfterWrong,
  type PimsleurSchedule,
} from "./pimsleurSchedule.js";
import { collectNestAlternateTexts, mergeVocabAlternateAnswers } from "./vocabNest.js";

export type ReviewCardDirection = "learning_to_primary" | "primary_to_learning";

export type ReviewOutcome = "know" | "dont";

export type CardSchedule = {
  pimsleurLevel: number;
  nextReviewMs: bigint;
};

export type PairCardSchedules = {
  learningToPrimary: CardSchedule;
  primaryToLearning: CardSchedule;
};

export type DictionaryEntrySchedules = {
  pimsleurLevel: number;
  nextReviewMs: bigint;
  pimsleurLevelReverse: number;
  nextReviewMsReverse: bigint;
};

export function entryToPairSchedules(entry: DictionaryEntrySchedules): PairCardSchedules {
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

export function pairPimsleurLevel(schedules: PairCardSchedules): number {
  return Math.min(
    schedules.learningToPrimary.pimsleurLevel,
    schedules.primaryToLearning.pimsleurLevel,
  );
}

export function pairNextReviewMs(schedules: PairCardSchedules): bigint {
  const forward = schedules.learningToPrimary.nextReviewMs;
  const reverse = schedules.primaryToLearning.nextReviewMs;
  return forward < reverse ? forward : reverse;
}

export function selectWorstCardDirection(schedules: PairCardSchedules): ReviewCardDirection {
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

export function scheduleForDirection(
  schedules: PairCardSchedules,
  direction: ReviewCardDirection,
): CardSchedule {
  return direction === "learning_to_primary"
    ? schedules.learningToPrimary
    : schedules.primaryToLearning;
}

export function isValidReviewCardDirection(value: unknown): value is ReviewCardDirection {
  return value === "learning_to_primary" || value === "primary_to_learning";
}

/** Prefer the worst card; coerce mismatched client direction back to worst. */
export function coerceReviewDirection(
  entry: DictionaryEntrySchedules,
  direction?: ReviewCardDirection | null,
): ReviewCardDirection {
  const schedules = entryToPairSchedules(entry);
  const worstDirection = selectWorstCardDirection(schedules);
  if (direction != null && direction !== worstDirection) {
    return worstDirection;
  }
  return direction ?? worstDirection;
}

export type ReviewScheduleUpdateData =
  | { pimsleurLevel: number; nextReviewMs: bigint }
  | { pimsleurLevelReverse: number; nextReviewMsReverse: bigint };

export type PlannedReviewScheduleUpdate = {
  direction: ReviewCardDirection;
  schedule: PimsleurSchedule;
  updateData: ReviewScheduleUpdateData;
};

/** Pure review scheduling: direction coerce → ladder → Prisma field patch. */
export function planReviewScheduleUpdate(
  entry: DictionaryEntrySchedules,
  result: ReviewOutcome,
  nowMs: number,
  directionRaw?: ReviewCardDirection | null,
): PlannedReviewScheduleUpdate {
  const direction = coerceReviewDirection(entry, directionRaw);
  const schedules = entryToPairSchedules(entry);
  const currentLevel = scheduleForDirection(schedules, direction).pimsleurLevel;
  const schedule =
    result === "know" ? scheduleAfterCorrect(currentLevel, nowMs) : scheduleAfterWrong(nowMs);
  const nextReviewMs = BigInt(schedule.nextReviewMs);

  const updateData: ReviewScheduleUpdateData =
    direction === "learning_to_primary"
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
export function initialDictionarySchedules(nowMs: number = Date.now()): DictionaryEntrySchedules {
  const schedule = scheduleAfterWrong(nowMs);
  const nextReviewMs = BigInt(schedule.nextReviewMs);
  return {
    pimsleurLevel: schedule.pimsleurLevel,
    nextReviewMs,
    pimsleurLevelReverse: schedule.pimsleurLevel,
    nextReviewMsReverse: nextReviewMs,
  };
}

export function expectedAnswersForDirection(
  direction: ReviewCardDirection,
  primaryWord: string,
  learningWord: string,
  alternatePrimaryAnswers: readonly string[] = [],
  alternateLearningAnswers: readonly string[] = [],
  primaryNestMembers: readonly { text: string }[] = [],
  learningNestMembers: readonly { text: string }[] = [],
): { expected: string; alternates: string[] } {
  if (direction === "learning_to_primary") {
    return {
      expected: primaryWord,
      alternates: mergeVocabAlternateAnswers(
        alternatePrimaryAnswers,
        collectNestAlternateTexts(primaryNestMembers, primaryWord),
      ),
    };
  }
  return {
    expected: learningWord,
    alternates: mergeVocabAlternateAnswers(
      alternateLearningAnswers,
      collectNestAlternateTexts(learningNestMembers, learningWord),
    ),
  };
}
