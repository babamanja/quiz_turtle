import { Prisma } from "@prisma/client";
import {
  entryToPairSchedules,
  pairNextReviewMs,
  pairPimsleurLevel,
  resolvePairSidesForUser,
  type VocabPairRelationType,
} from "@language-turtle/shared";
import * as dictionaryRepository from "./dictionaryRepository.js";
import { getPrisma } from "./prisma.js";

export type UserRow = {
  id: number;
  user_name: string;
  email: string | null;
  role: "user" | "admin";
  email_verified_at: Date | null;
  is_guest: boolean;
  primary_language_id: number | null;
  learning_language_id: number | null;
};

function toRow(u: {
  id: number;
  userName: string;
  email: string | null;
  role: string;
  emailVerifiedAt: Date | null;
  isGuest: boolean;
  primaryLanguageId: number | null;
  learningLanguageId: number | null;
}): UserRow {
  return {
    id: u.id,
    user_name: u.userName,
    email: u.email,
    role: u.role === "admin" ? "admin" : "user",
    email_verified_at: u.emailVerifiedAt,
    is_guest: u.isGuest,
    primary_language_id: u.primaryLanguageId,
    learning_language_id: u.learningLanguageId,
  };
}

export async function isGuestUser(id: number): Promise<boolean> {
  const u = await getPrisma().user.findFirst({
    where: { id, deletedAt: null },
    select: { isGuest: true },
  });
  return Boolean(u?.isGuest);
}

export async function selectUserById(id: number): Promise<UserRow | null> {
  const u = await getPrisma().user.findFirst({ where: { id, deletedAt: null } });
  return u ? toRow(u) : null;
}

export async function updateUserById(
  id: number,
  input: {
    userName: string;
    email: string;
    primaryLanguageId?: number | null;
    learningLanguageId?: number | null;
  },
): Promise<UserRow> {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { id } });
  const nextEmail = input.email.trim().toLowerCase();
  const emailChanged =
    existing !== null &&
    existing.email != null &&
    existing.email.trim().toLowerCase() !== nextEmail;
  const u = await prisma.user.update({
    where: { id },
    data: {
      userName: input.userName.trim(),
      email: nextEmail,
      ...(emailChanged ? { emailVerifiedAt: null } : {}),
      ...(input.primaryLanguageId !== undefined
        ? { primaryLanguageId: input.primaryLanguageId }
        : {}),
      ...(input.learningLanguageId !== undefined
        ? { learningLanguageId: input.learningLanguageId }
        : {}),
    },
  });
  return toRow(u);
}

export async function softDeleteUserById(id: number): Promise<boolean> {
  const prisma = getPrisma();
  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    return false;
  }
  const deletedAt = new Date();
  const anonymizedEmail = `deleted+${id}+${deletedAt.getTime()}@deleted.local`;
  const anonymizedName = `Buddy ${id}`;
  const previousEmail = existing.email?.trim().toLowerCase() ?? "";
  const result = await prisma.user.updateMany({
    where: { id, deletedAt: null },
    data: {
      deletedAt,
      previousEmailForRecovery: previousEmail,
      email: anonymizedEmail,
      userName: anonymizedName,
    },
  });
  return result.count > 0;
}

export async function restoreSoftDeletedUser(id: number): Promise<boolean> {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: { not: null } },
  });
  if (!user?.previousEmailForRecovery) {
    return false;
  }
  const restoredEmail = user.previousEmailForRecovery.trim().toLowerCase();
  await prisma.user.update({
    where: { id },
    data: {
      deletedAt: null,
      email: restoredEmail,
      previousEmailForRecovery: null,
    },
  });
  return true;
}

export type UserWordRow = {
  vocabPairId: number;
  relationType: VocabPairRelationType;
  dictionaryId: number;
  dictionaryName: string;
  primaryWord: string;
  learningWord: string;
  partOfSpeech: string | null;
  example: string | null;
  pimsleurLevel: number;
  pimsleurLevelForward: number;
  pimsleurLevelReverse: number;
  nextReviewMs: string;
};

export type UserWordDetailRow = UserWordRow & {
  nextReviewMsForward: string;
  nextReviewMsReverse: string;
};

type DictionaryEntryWithPair = Prisma.DictionaryEntryGetPayload<{
  include: {
    dictionary: { select: { id: true; name: true } };
    vocabPair: {
      include: {
        wordA: { select: { id: true, text: true, languageId: true } },
        wordB: { select: { id: true, text: true, languageId: true } },
      },
    };
  };
}>;

const dictionaryEntryWithPairInclude = {
  dictionary: { select: { id: true, name: true } },
  vocabPair: {
    include: {
      wordA: { select: { id: true, text: true, languageId: true } },
      wordB: { select: { id: true, text: true, languageId: true } },
    },
  },
} as const;

function mapDictionaryEntryToUserWordRow(
  row: DictionaryEntryWithPair,
  primaryLanguageId: number,
  learningLanguageId: number,
): UserWordRow | null {
  const resolved = resolvePairSidesForUser(
    row.vocabPair.wordA,
    row.vocabPair.wordB,
    row.vocabPair.relationType,
    primaryLanguageId,
    learningLanguageId,
  );
  if (!resolved) {
    return null;
  }
  const schedules = entryToPairSchedules(row);
  return {
    vocabPairId: row.vocabPairId,
    relationType: row.vocabPair.relationType,
    dictionaryId: row.dictionary.id,
    dictionaryName: row.dictionary.name,
    primaryWord: resolved.primaryWord.text,
    learningWord: resolved.learningWord.text,
    partOfSpeech: row.vocabPair.partOfSpeech,
    example: row.vocabPair.example,
    pimsleurLevel: pairPimsleurLevel(schedules),
    pimsleurLevelForward: schedules.learningToPrimary.pimsleurLevel,
    pimsleurLevelReverse: schedules.primaryToLearning.pimsleurLevel,
    nextReviewMs: pairNextReviewMs(schedules).toString(),
  };
}

function mapDictionaryEntryToUserWordDetailRow(
  row: DictionaryEntryWithPair,
  primaryLanguageId: number,
  learningLanguageId: number,
): UserWordDetailRow | null {
  const base = mapDictionaryEntryToUserWordRow(row, primaryLanguageId, learningLanguageId);
  if (!base) {
    return null;
  }
  const schedules = entryToPairSchedules(row);
  return {
    ...base,
    nextReviewMsForward: schedules.learningToPrimary.nextReviewMs.toString(),
    nextReviewMsReverse: schedules.primaryToLearning.nextReviewMs.toString(),
  };
}

export type UserWordsListQuery = {
  userId: number;
  page: number;
  pageSize: number;
  sortBy: "nextReviewMs" | "pimsleurLevel" | "primaryWord";
  sortOrder: "asc" | "desc";
  search?: string;
};

export async function selectUserWords(
  input: UserWordsListQuery,
): Promise<{ rows: UserWordRow[]; total: number }> {
  const user = await getPrisma().user.findUnique({
    where: { id: input.userId },
    select: { primaryLanguageId: true, learningLanguageId: true },
  });
  if (user?.primaryLanguageId == null || user.learningLanguageId == null) {
    return { rows: [], total: 0 };
  }

  await dictionaryRepository.ensureDefaultDictionaryForUser(input.userId);

  const searchFilter: Prisma.DictionaryEntryWhereInput | undefined = input.search
    ? {
        OR: [
          { vocabPair: { wordA: { text: { contains: input.search, mode: "insensitive" } } } },
          { vocabPair: { wordB: { text: { contains: input.search, mode: "insensitive" } } } },
        ],
      }
    : undefined;

  const where: Prisma.DictionaryEntryWhereInput = {
    dictionary: {
      members: { some: { userId: input.userId } },
    },
    ...(searchFilter ?? {}),
  };

  const orderBy =
    input.sortBy === "pimsleurLevel"
      ? { pimsleurLevel: input.sortOrder }
      : input.sortBy === "primaryWord"
        ? { vocabPair: { wordA: { text: input.sortOrder } } }
        : input.sortOrder === "asc"
          ? { nextReviewMs: "asc" as const }
          : { nextReviewMs: "desc" as const };

  const [rows, total] = await Promise.all([
    getPrisma().dictionaryEntry.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: dictionaryEntryWithPairInclude,
    }),
    getPrisma().dictionaryEntry.count({ where }),
  ]);

  return {
    rows: rows.flatMap((row) => {
      const mapped = mapDictionaryEntryToUserWordRow(
        row,
        user.primaryLanguageId!,
        user.learningLanguageId!,
      );
      return mapped ? [mapped] : [];
    }),
    total,
  };
}

export async function selectUserWordByPairId(
  userId: number,
  vocabPairId: number,
): Promise<UserWordDetailRow | null> {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { primaryLanguageId: true, learningLanguageId: true },
  });
  if (user?.primaryLanguageId == null || user.learningLanguageId == null) {
    return null;
  }

  await dictionaryRepository.ensureDefaultDictionaryForUser(userId);

  const row = await getPrisma().dictionaryEntry.findFirst({
    where: {
      vocabPairId,
      dictionary: { members: { some: { userId } } },
    },
    include: dictionaryEntryWithPairInclude,
  });
  if (!row) {
    return null;
  }

  return mapDictionaryEntryToUserWordDetailRow(
    row,
    user.primaryLanguageId,
    user.learningLanguageId,
  );
}

export async function selectDictionaryEntryForUserPair(
  userId: number,
  vocabPairId: number,
): Promise<DictionaryEntryWithPair | null> {
  await dictionaryRepository.ensureDefaultDictionaryForUser(userId);
  return getPrisma().dictionaryEntry.findFirst({
    where: {
      vocabPairId,
      dictionary: { members: { some: { userId } } },
    },
    include: dictionaryEntryWithPairInclude,
  });
}
