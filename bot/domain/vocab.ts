import type { PrismaClient } from '@prisma/client';
import {
  canonicalWordPairIds,
  entryToPairSchedules,
  initialDictionarySchedules,
  planReviewScheduleUpdate,
  resolvePairSidesForUser,
  selectWorstCardDirection,
  type ReviewCardDirection,
} from '@language-turtle/shared';
import {
  ensureVocabWordWithNest,
  mergeVocabAlternateAnswers,
  nestAlternateTextsForWord,
  selectNestMembersForWordIds,
} from './nest';
import {
  attachPairToUserDefaultDictionary,
  selectDefaultDictionaryEntry,
  selectDefaultDictionaryIdForUser,
} from './dictionary';
import { upsertSkillAfterReview } from './skill-state';
import { getUserIdByTelegram, getUserLanguages } from './telegram-user';

export type DueVocabPair = {
  pairId: number;
  direction: ReviewCardDirection;
  promptWord: string;
  primaryWord: string;
  learningWord: string;
  alternateAnswers: string[];
};

export class UserLanguagesNotSetError extends Error {
  constructor() {
    super('User languages are not set yet');
    this.name = 'UserLanguagesNotSetError';
  }
}

export class LanguageNotFoundError extends Error {
  public readonly missingLangIds: number[];

  constructor(missingLangIds: number[]) {
    super(`Language(s) not found: ${missingLangIds.join(', ')}`);
    this.name = 'LanguageNotFoundError';
    this.missingLangIds = missingLangIds;
  }
}

export class UserNotLinkedError extends Error {
  constructor() {
    super('Telegram user is not linked to an account');
    this.name = 'UserNotLinkedError';
  }
}

async function requireInternalUserId(
  prisma: PrismaClient,
  telegramUserId: number,
): Promise<number> {
  const userId = await getUserIdByTelegram(prisma, telegramUserId);
  if (userId == null) {
    throw new UserNotLinkedError();
  }
  return userId;
}

export async function initVocabSchema(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.vocabPair.count();
  } catch {
    throw new Error(
      'Prisma schema is not applied yet. Run prisma migrate deploy before starting the bot.',
    );
  }
}

async function requireUserLanguages(
  prisma: PrismaClient,
  telegramUserId: number,
): Promise<{ primaryLangId: number; learningLangId: number; userId: number }> {
  const langs = await getUserLanguages(prisma, telegramUserId);

  if (langs.primaryLangId == null || langs.learningLangId == null || langs.userId == null) {
    throw new UserLanguagesNotSetError();
  }

  return {
    userId: langs.userId,
    primaryLangId: langs.primaryLangId,
    learningLangId: langs.learningLangId,
  };
}

async function upsertVocabWord(
  prisma: PrismaClient,
  languageId: number,
  text: string,
): Promise<number> {
  const word = await ensureVocabWordWithNest(prisma, languageId, text);
  return word.id;
}

export async function findOrCreateVocabWord(
  prisma: PrismaClient,
  languageId: number,
  text: string,
): Promise<{ id: number; text: string }> {
  const word = await ensureVocabWordWithNest(prisma, languageId, text);
  return { id: word.id, text: word.text };
}

export async function findExistingPairsForPrimaryWord(
  prisma: PrismaClient,
  primaryWordId: number,
  learningLangId: number,
): Promise<Array<{ pairId: number; learningText: string }>> {
  const pairs = await prisma.vocabPair.findMany({
    where: {
      relationType: 'translation',
      OR: [
        { wordAId: primaryWordId, wordB: { languageId: learningLangId } },
        { wordBId: primaryWordId, wordA: { languageId: learningLangId } },
      ],
    },
    select: {
      id: true,
      wordA: { select: { id: true, text: true } },
      wordB: { select: { id: true, text: true } },
    },
  });
  return pairs.map((p: { id: number; wordA: { id: number; text: string }; wordB: { id: number; text: string } }) => {
    const otherWord = p.wordA.id === primaryWordId ? p.wordB : p.wordA;
    return {
      pairId: p.id,
      learningText: otherWord.text,
    };
  });
}

export async function attachUserToVocabPair(
  prisma: PrismaClient,
  telegramUserId: number,
  pairId: number,
  nowMs: number = Date.now(),
): Promise<void> {
  const userId = await requireInternalUserId(prisma, telegramUserId);
  await attachPairToUserDefaultDictionary(
    prisma,
    userId,
    pairId,
    initialDictionarySchedules(nowMs),
  );
}

async function findOrCreateTranslationPair(
  prisma: PrismaClient,
  wordIdOne: number,
  wordIdTwo: number,
) {
  const { wordAId, wordBId } = canonicalWordPairIds(wordIdOne, wordIdTwo);
  let pair = await prisma.vocabPair.findUnique({
    where: {
      wordAId_wordBId_relationType: { wordAId, wordBId, relationType: 'translation' },
    },
  });
  if (!pair) {
    pair = await prisma.vocabPair.create({
      data: { wordAId, wordBId, relationType: 'translation' },
    });
  }
  return pair;
}

export async function createPairFromPrimaryWordAndLearningText(
  prisma: PrismaClient,
  telegramUserId: number,
  primaryWordId: number,
  learningLangId: number,
  learningText: string,
  nowMs: number,
): Promise<number> {
  const userId = await requireInternalUserId(prisma, telegramUserId);
  const learningWordId = await upsertVocabWord(prisma, learningLangId, learningText);

  const pair = await findOrCreateTranslationPair(prisma, primaryWordId, learningWordId);

  await attachPairToUserDefaultDictionary(
    prisma,
    userId,
    pair.id,
    initialDictionarySchedules(nowMs),
  );

  return pair.id;
}

export async function getRandomDueWordsForUser(
  prisma: PrismaClient,
  telegramUserId: number,
  nowMs: number,
  limit: number,
): Promise<DueVocabPair[]> {
  const { userId, primaryLangId, learningLangId } = await requireUserLanguages(
    prisma,
    telegramUserId,
  );

  const dictionaryId = await selectDefaultDictionaryIdForUser(prisma, userId);
  if (dictionaryId == null) {
    return [];
  }

  const dueRows = await prisma.dictionaryEntry.findMany({
    where: {
      dictionaryId,
      OR: [{ nextReviewMs: { lte: BigInt(nowMs) } }, { nextReviewMsReverse: { lte: BigInt(nowMs) } }],
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

  if (dueRows.length === 0) return [];

  const lemmaWordIds: number[] = [];
  type PairWord = { id: number; text: string; languageId: number };
  const resolvedRows: Array<{
    row: (typeof dueRows)[number];
    resolved: { primaryWord: PairWord; learningWord: PairWord };
  }> = [];

  for (const row of dueRows) {
    const vp = row.vocabPair;
    const resolved = resolvePairSidesForUser<PairWord>(
      vp.wordA,
      vp.wordB,
      vp.relationType,
      primaryLangId,
      learningLangId,
    );
    if (!resolved) {
      continue;
    }
    resolvedRows.push({ row, resolved });
    lemmaWordIds.push(resolved.primaryWord.id, resolved.learningWord.id);
  }

  const nestMembersMap = await selectNestMembersForWordIds(prisma, lemmaWordIds);

  for (let i = resolvedRows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [resolvedRows[i], resolvedRows[j]] = [resolvedRows[j], resolvedRows[i]];
  }

  const cap = Math.min(limit, resolvedRows.length);
  const out: DueVocabPair[] = [];
  for (let i = 0; i < cap; i++) {
    const { row, resolved } = resolvedRows[i];
    const vp = row.vocabPair;
    const direction = selectWorstCardDirection(entryToPairSchedules(row));
    const manualAlternates =
      direction === 'learning_to_primary'
        ? row.alternatePrimaryAnswers
        : row.alternateLearningAnswers;
    const expectedText =
      direction === 'learning_to_primary' ? resolved.primaryWord.text : resolved.learningWord.text;
    const anchorWordId =
      direction === 'learning_to_primary' ? resolved.primaryWord.id : resolved.learningWord.id;
    const nestMembers = nestMembersMap.get(anchorWordId) ?? [];
    const alternateAnswers = mergeVocabAlternateAnswers(
      manualAlternates,
      nestAlternateTextsForWord(nestMembers, expectedText),
    );
    out.push({
      pairId: vp.id,
      direction,
      promptWord: direction === 'learning_to_primary' ? resolved.learningWord.text : resolved.primaryWord.text,
      primaryWord: resolved.primaryWord.text,
      learningWord: resolved.learningWord.text,
      alternateAnswers,
    });
  }
  return out;
}

export async function addLanguageByName(prisma: PrismaClient, langName: string): Promise<number> {
  const lang = await prisma.language.upsert({
    where: { name: langName },
    update: {},
    create: { name: langName },
  });
  return lang.id;
}

export async function getAllLanguages(
  prisma: PrismaClient,
): Promise<Array<{ id: number; name: string }>> {
  return prisma.language.findMany({
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });
}

export async function getUserLanguageNames(
  prisma: PrismaClient,
  telegramUserId: number,
): Promise<{ primaryName: string; learningName: string } | null> {
  const userId = await getUserIdByTelegram(prisma, telegramUserId);
  if (userId == null) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      primaryLanguage: { select: { name: true } },
      learningLanguage: { select: { name: true } },
    },
  });

  const primaryName = user?.primaryLanguage?.name;
  const learningName = user?.learningLanguage?.name;
  if (!primaryName || !learningName) return null;

  return { primaryName, learningName };
}

async function requireLanguageExists(prisma: PrismaClient, langId: number): Promise<void> {
  const lang = await prisma.language.findUnique({ where: { id: langId } });
  if (!lang) {
    throw new LanguageNotFoundError([langId]);
  }
}

export async function setUserLanguage(
  prisma: PrismaClient,
  telegramUserId: number,
  langId: number,
  kind?: 'primary' | 'learning',
): Promise<void> {
  const userId = await requireInternalUserId(prisma, telegramUserId);
  await requireLanguageExists(prisma, langId);
  if (!kind) {
    throw new Error('Kind is required');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { [`${kind}LanguageId`]: langId },
  });
}

export async function applyReviewResult(
  prisma: PrismaClient,
  telegramUserId: number,
  pairId: number,
  result: 'know' | 'dont',
  nowMs: number,
  direction: ReviewCardDirection,
): Promise<{ learningWord: string; primaryWord: string }> {
  const { userId, primaryLangId, learningLangId } = await requireUserLanguages(
    prisma,
    telegramUserId,
  );

  const entry = await selectDefaultDictionaryEntry(prisma, userId, pairId);

  if (!entry) {
    throw new Error(`Dictionary entry not found: user=${telegramUserId} pair=${pairId}`);
  }

  const { direction: resolvedDirection, schedule, updateData } = planReviewScheduleUpdate(
    entry,
    result,
    nowMs,
    direction,
  );

  await prisma.dictionaryEntry.update({
    where: {
      dictionaryId_vocabPairId: {
        dictionaryId: entry.dictionaryId,
        vocabPairId: pairId,
      },
    },
    data: updateData,
  });

  await upsertSkillAfterReview(prisma, userId, pairId, resolvedDirection, schedule, result);

  const resolved = resolvePairSidesForUser(
    entry.vocabPair.wordA,
    entry.vocabPair.wordB,
    entry.vocabPair.relationType,
    primaryLangId,
    learningLangId,
  );
  if (!resolved) {
    throw new Error(`Pair languages do not match user settings: pair=${pairId}`);
  }

  return {
    learningWord: resolved.learningWord.text,
    primaryWord: resolved.primaryWord.text,
  };
}
