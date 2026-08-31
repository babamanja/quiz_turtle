import { scheduleAfterCorrect, scheduleAfterWrong } from "@language-turtle/shared";

import type { ReviewResult, ReviewWord } from "../../api/words";

export function reviewScheduleForDisplay(
  card: ReviewWord,
  revealed: ReviewResult & { awaitingConfirmation?: boolean },
): { pimsleurLevel: number; nextReviewMs: number } {
  const level = revealed.pimsleurLevel;
  const dueAt = revealed.nextReviewMs;
  if (level != null && dueAt != null && Number.isFinite(level) && Number.isFinite(dueAt) && dueAt > 0) {
    return {
      pimsleurLevel: level,
      nextReviewMs: dueAt,
    };
  }

  const nowMs = Date.now();
  const cardLevel = card.pimsleurLevel ?? 0;

  if (revealed.awaitingConfirmation) {
    return {
      pimsleurLevel: cardLevel,
      nextReviewMs: card.nextReviewMs != null && card.nextReviewMs > 0 ? card.nextReviewMs : nowMs,
    };
  }

  if (revealed.correct) {
    return scheduleAfterCorrect(cardLevel, nowMs);
  }

  return scheduleAfterWrong(nowMs);
}
