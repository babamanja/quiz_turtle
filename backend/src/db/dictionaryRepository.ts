import type { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import * as skillStateRepository from "./skillStateRepository.js";

const DEFAULT_DICTIONARY_NAME = "My dictionary";

export async function selectDefaultDictionaryIdForUser(
  userId: number,
): Promise<number | null> {
  const link = await getPrisma().userDictionary.findFirst({
    where: { userId, isDefault: true },
    select: { dictionaryId: true },
  });
  return link?.dictionaryId ?? null;
}

export async function ensureDefaultDictionaryForUser(userId: number): Promise<number> {
  const existingId = await selectDefaultDictionaryIdForUser(userId);
  if (existingId != null) {
    return existingId;
  }

  const prisma = getPrisma();
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
  userId: number,
  vocabPairId: number,
  schedule: {
    pimsleurLevel: number;
    nextReviewMs: bigint;
    pimsleurLevelReverse: number;
    nextReviewMsReverse: bigint;
  },
): Promise<void> {
  const dictionaryId = await ensureDefaultDictionaryForUser(userId);
  await getPrisma().dictionaryEntry.createMany({
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
  await skillStateRepository.upsertInitialSkillsFromEntrySchedule(userId, vocabPairId, schedule);
}

export type DictionaryEntryWithPair = Prisma.DictionaryEntryGetPayload<{
  include: {
    vocabPair: {
      include: {
        wordA: { select: { id: true; text: true; languageId: true } };
        wordB: { select: { id: true; text: true; languageId: true } };
      };
    };
  };
}>;

export async function selectDefaultDictionaryEntry(
  userId: number,
  vocabPairId: number,
): Promise<DictionaryEntryWithPair | null> {
  const dictionaryId = await selectDefaultDictionaryIdForUser(userId);
  if (dictionaryId == null) {
    return null;
  }
  return getPrisma().dictionaryEntry.findUnique({
    where: {
      dictionaryId_vocabPairId: { dictionaryId, vocabPairId },
    },
    include: {
      vocabPair: {
        include: {
          wordA: { select: { id: true, text: true, languageId: true } },
          wordB: { select: { id: true, text: true, languageId: true } },
        },
      },
    },
  });
}

export async function countDefaultDictionaryEntries(userId: number): Promise<number> {
  const dictionaryId = await selectDefaultDictionaryIdForUser(userId);
  if (dictionaryId == null) {
    return 0;
  }
  return getPrisma().dictionaryEntry.count({ where: { dictionaryId } });
}

export type UserDictionaryRow = {
  id: number;
  name: string;
  creatorId: number;
  creatorName: string;
  isDefault: boolean;
  isOwner: boolean;
  entryCount: number;
  createdAt: string;
};

export async function selectUserDictionaries(userId: number): Promise<UserDictionaryRow[]> {
  await ensureDefaultDictionaryForUser(userId);

  const links = await getPrisma().userDictionary.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      dictionary: {
        include: {
          creator: { select: { id: true, userName: true } },
          _count: { select: { entries: true } },
        },
      },
    },
  });

  return links.map((link) => ({
    id: link.dictionary.id,
    name: link.dictionary.name,
    creatorId: link.dictionary.creatorId,
    creatorName: link.dictionary.creator.userName,
    isDefault: link.isDefault,
    isOwner: link.dictionary.creatorId === userId,
    entryCount: link.dictionary._count.entries,
    createdAt: link.dictionary.createdAt.toISOString(),
  }));
}
