import {
  skillCodeForDirection,
  type DictionaryEntrySchedules,
  type LearningSkillCode,
  type ReviewCardDirection,
} from "@language-turtle/shared";
import { getPrisma } from "./prisma.js";

export type SkillSchedulePatch = {
  level: number;
  dueMs: bigint;
  bumpReps?: boolean;
  bumpLapses?: boolean;
};

export async function upsertSkillState(
  userId: number,
  vocabPairId: number,
  skillCode: LearningSkillCode,
  patch: SkillSchedulePatch,
): Promise<void> {
  const existing = await getPrisma().skillState.findUnique({
    where: {
      userId_vocabPairId_skillCode: { userId, vocabPairId, skillCode },
    },
    select: { reps: true, lapses: true },
  });

  const reps = (existing?.reps ?? 0) + (patch.bumpReps ? 1 : 0);
  const lapses =
    (existing?.lapses ?? 0) + (patch.bumpLapses ? 1 : 0);

  await getPrisma().skillState.upsert({
    where: {
      userId_vocabPairId_skillCode: { userId, vocabPairId, skillCode },
    },
    create: {
      userId,
      vocabPairId,
      skillCode,
      algorithm: "pimsleur",
      level: patch.level,
      dueMs: patch.dueMs,
      reps: patch.bumpReps ? 1 : 0,
      lapses: patch.bumpLapses ? 1 : 0,
    },
    update: {
      level: patch.level,
      dueMs: patch.dueMs,
      algorithm: "pimsleur",
      reps,
      lapses,
      archivedAt: null,
    },
  });
}

/** Seed both recall polarities from a DictionaryEntry schedule (attach / backfill). */
export async function upsertInitialSkillsFromEntrySchedule(
  userId: number,
  vocabPairId: number,
  schedule: DictionaryEntrySchedules,
): Promise<void> {
  await upsertSkillState(userId, vocabPairId, "recall", {
    level: schedule.pimsleurLevel,
    dueMs: schedule.nextReviewMs,
  });
  await upsertSkillState(userId, vocabPairId, "recall_reverse", {
    level: schedule.pimsleurLevelReverse,
    dueMs: schedule.nextReviewMsReverse,
  });
}

export async function upsertSkillAfterReview(
  userId: number,
  vocabPairId: number,
  direction: ReviewCardDirection,
  schedule: { pimsleurLevel: number; nextReviewMs: number },
  result: "know" | "dont",
): Promise<void> {
  await upsertSkillState(userId, vocabPairId, skillCodeForDirection(direction), {
    level: schedule.pimsleurLevel,
    dueMs: BigInt(schedule.nextReviewMs),
    bumpReps: true,
    bumpLapses: result === "dont",
  });
}
