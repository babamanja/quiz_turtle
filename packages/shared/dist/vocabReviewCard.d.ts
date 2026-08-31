import { type PimsleurSchedule } from "./pimsleurSchedule.js";
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
export declare function entryToPairSchedules(entry: DictionaryEntrySchedules): PairCardSchedules;
export declare function pairPimsleurLevel(schedules: PairCardSchedules): number;
export declare function pairNextReviewMs(schedules: PairCardSchedules): bigint;
export declare function selectWorstCardDirection(schedules: PairCardSchedules): ReviewCardDirection;
export declare function scheduleForDirection(schedules: PairCardSchedules, direction: ReviewCardDirection): CardSchedule;
export declare function isValidReviewCardDirection(value: unknown): value is ReviewCardDirection;
/** Prefer the worst card; coerce mismatched client direction back to worst. */
export declare function coerceReviewDirection(entry: DictionaryEntrySchedules, direction?: ReviewCardDirection | null): ReviewCardDirection;
export type ReviewScheduleUpdateData = {
    pimsleurLevel: number;
    nextReviewMs: bigint;
} | {
    pimsleurLevelReverse: number;
    nextReviewMsReverse: bigint;
};
export type PlannedReviewScheduleUpdate = {
    direction: ReviewCardDirection;
    schedule: PimsleurSchedule;
    updateData: ReviewScheduleUpdateData;
};
/** Pure review scheduling: direction coerce → ladder → Prisma field patch. */
export declare function planReviewScheduleUpdate(entry: DictionaryEntrySchedules, result: ReviewOutcome, nowMs: number, directionRaw?: ReviewCardDirection | null): PlannedReviewScheduleUpdate;
/** Initial forward+reverse schedules for a newly attached dictionary entry. */
export declare function initialDictionarySchedules(nowMs?: number): DictionaryEntrySchedules;
export declare function expectedAnswersForDirection(direction: ReviewCardDirection, primaryWord: string, learningWord: string, alternatePrimaryAnswers?: readonly string[], alternateLearningAnswers?: readonly string[], primaryNestMembers?: readonly {
    text: string;
}[], learningNestMembers?: readonly {
    text: string;
}[]): {
    expected: string;
    alternates: string[];
};
//# sourceMappingURL=vocabReviewCard.d.ts.map