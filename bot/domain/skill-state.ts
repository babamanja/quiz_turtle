import type { PrismaClient } from "@prisma/client";
import {
  skillCodeForDirection,
  type DictionaryEntrySchedules,
  type LearningSkillCode,
  type ReviewCardDirection,
  type ReviewOutcome,
} from "@language-turtle/shared";

type SkillSchedulePatch = {
  level: number;
  dueMs: bigint;
  bumpReps?: boolean;
  bumpLapses?: boolean;
};

export async function upsertSkillState(
  prisma: PrismaClient,
  userId: number,
  vocabPairId: number,
  skillCode: LearningSkillCode,
  patch: SkillSchedulePatch,
): Promise<void> {
  const existing = await prisma.skillState.findUnique({
    where: {
      userId_vocabPairId_skillCode: { userId, vocabPairId, skillCode },
    },
    select: { reps: true, lapses: true },
  });

  const reps = (existing?.reps ?? 0) + (patch.bumpReps ? 1 : 0);
  const lapses = (existing?.lapses ?? 0) + (patch.bumpLapses ? 1 : 0);

  await prisma.skillState.upsert({
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

export async function upsertInitialSkillsFromEntrySchedule(
  prisma: PrismaClient,
  userId: number,
  vocabPairId: number,
  schedule: DictionaryEntrySchedules,
): Promise<void> {
  await upsertSkillState(prisma, userId, vocabPairId, "recall", {
    level: schedule.pimsleurLevel,
    dueMs: schedule.nextReviewMs,
  });
  await upsertSkillState(prisma, userId, vocabPairId, "recall_reverse", {
    level: schedule.pimsleurLevelReverse,
    dueMs: schedule.nextReviewMsReverse,
  });
}

export async function upsertSkillAfterReview(
  prisma: PrismaClient,
  userId: number,
  vocabPairId: number,
  direction: ReviewCardDirection,
  schedule: { pimsleurLevel: number; nextReviewMs: number },
  result: ReviewOutcome,
): Promise<void> {
  await upsertSkillState(prisma, userId, vocabPairId, skillCodeForDirection(direction), {
    level: schedule.pimsleurLevel,
    dueMs: BigInt(schedule.nextReviewMs),
    bumpReps: true,
    bumpLapses: result === "dont",
  });
}
