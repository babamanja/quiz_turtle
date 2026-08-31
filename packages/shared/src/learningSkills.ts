import type { ReviewCardDirection } from "./vocabReviewCard.js";

export const LEARNING_SKILL_CODES = ["recall", "recall_reverse"] as const;

export type LearningSkillCode = (typeof LEARNING_SKILL_CODES)[number];

export const REVIEW_DIRECTION_TO_SKILL = {
  learning_to_primary: "recall",
  primary_to_learning: "recall_reverse",
} as const satisfies Record<ReviewCardDirection, LearningSkillCode>;

export function skillCodeForDirection(direction: ReviewCardDirection): LearningSkillCode {
  return REVIEW_DIRECTION_TO_SKILL[direction];
}
