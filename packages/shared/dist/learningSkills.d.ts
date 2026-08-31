import type { ReviewCardDirection } from "./vocabReviewCard.js";
export declare const LEARNING_SKILL_CODES: readonly ["recall", "recall_reverse"];
export type LearningSkillCode = (typeof LEARNING_SKILL_CODES)[number];
export declare const REVIEW_DIRECTION_TO_SKILL: {
    readonly learning_to_primary: "recall";
    readonly primary_to_learning: "recall_reverse";
};
export declare function skillCodeForDirection(direction: ReviewCardDirection): LearningSkillCode;
//# sourceMappingURL=learningSkills.d.ts.map