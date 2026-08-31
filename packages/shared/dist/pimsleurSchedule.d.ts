/**
 * Pimsleur-style ladder: delay until the next review after landing at this level.
 */
export declare const PIMSLEUR_LEVEL_MAX = 10;
export declare const PIMSLEUR_DELAYS_MS: readonly number[];
export type PimsleurSchedule = {
    pimsleurLevel: number;
    nextReviewMs: number;
};
export declare function intervalMsForLevel(level: number): number;
/** New / failed card: level 0, first review after the shortest delay. */
export declare function initialSchedule(nowMs?: number): PimsleurSchedule;
export declare function scheduleAfterCorrect(currentLevel: number, nowMs?: number): PimsleurSchedule;
export declare function scheduleAfterWrong(nowMs?: number): PimsleurSchedule;
//# sourceMappingURL=pimsleurSchedule.d.ts.map