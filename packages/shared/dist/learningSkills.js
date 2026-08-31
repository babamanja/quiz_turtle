export const LEARNING_SKILL_CODES = ["recall", "recall_reverse"];
export const REVIEW_DIRECTION_TO_SKILL = {
    learning_to_primary: "recall",
    primary_to_learning: "recall_reverse",
};
export function skillCodeForDirection(direction) {
    return REVIEW_DIRECTION_TO_SKILL[direction];
}
