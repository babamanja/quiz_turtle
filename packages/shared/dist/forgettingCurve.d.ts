export declare function reviewRetentionThresholdForLevel(level: number): number;
export declare function retentionAtElapsed(elapsedMs: number, intervalMs: number, threshold?: number): number;
export type CurrentRetention = {
    level: number;
    intervalMs: number;
    progress: number;
    retention: number;
    isOverdue: boolean;
};
export declare function currentRetention(pimsleurLevel: number, nextReviewMs: number, nowMs?: number): CurrentRetention;
//# sourceMappingURL=forgettingCurve.d.ts.map