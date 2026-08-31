import type { PrismaClient } from "@prisma/client";
import { upsertInitialSkillsFromEntrySchedule } from "./skill-state";

const DEFAULT_DICTIONARY_NAME = "My dictionary";

export async function selectDefaultDictionaryIdForUser(
  prisma: PrismaClient,
  userId: number,
): Promise<number | null> {
  const link = await prisma.userDictionary.findFirst({
    where: { userId, isDefault: true },
    select: { dictionaryId: true },
  });
  return link?.dictionaryId ?? null;
}

export async function ensureDefaultDictionaryForUser(
  prisma: PrismaClient,
  userId: number,
): Promise<number> {
  const existingId = await selectDefaultDictionaryIdForUser(prisma, userId);
  if (existingId != null) {
    return existingId;
  }

  const dictionary = await prisma.dictionary.create({
    data: {
      creatorId: userId,
      name: DEFAULT_DICTIONARY_NAME,
      members: {
        create: {
          userId,
          isDefault: true,
        },
      },
    },
    select: { id: true },
  });
  return dictionary.id;
}

export async function attachPairToUserDefaultDictionary(
  prisma: PrismaClient,
  userId: number,
  vocabPairId: number,
  schedule: {
    pimsleurLevel: number;
    nextReviewMs: bigint;
    pimsleurLevelReverse: number;
    nextReviewMsReverse: bigint;
  },
): Promise<void> {
  const dictionaryId = await ensureDefaultDictionaryForUser(prisma, userId);
  await prisma.dictionaryEntry.createMany({
    data: [
      {
        dictionaryId,
        vocabPairId,
        pimsleurLevel: schedule.pimsleurLevel,
        nextReviewMs: schedule.nextReviewMs,
        pimsleurLevelReverse: schedule.pimsleurLevelReverse,
        nextReviewMsReverse: schedule.nextReviewMsReverse,
      },
    ],
    skipDuplicates: true,
  });
  await upsertInitialSkillsFromEntrySchedule(prisma, userId, vocabPairId, schedule);
}

export async function selectDefaultDictionaryEntry(
  prisma: PrismaClient,
  userId: number,
  vocabPairId: number,
) {
  const dictionaryId = await selectDefaultDictionaryIdForUser(prisma, userId);
  if (dictionaryId == null) {
    return null;
  }
  return prisma.dictionaryEntry.findUnique({
    where: {
      dictionaryId_vocabPairId: { dictionaryId, vocabPairId },
    },
    include: {
      vocabPair: {
        include: {
          wordA: { select: { text: true, languageId: true } },
          wordB: { select: { text: true, languageId: true } },
        },
      },
    },
  });
}
