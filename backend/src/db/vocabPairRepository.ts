import { canonicalWordPairIds, resolvePairWordsForUser, type VocabPairRelationType } from "@language-turtle/shared";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";

export const vocabPairWordSelect = {
  id: true,
  text: true,
  languageId: true,
  language: { select: { name: true } },
} as const;

export const translationSelect = {
  id: true,
  relationType: true,
  partOfSpeech: true,
  primaryLanguageId: true,
  learningLanguageId: true,
  wordA: { select: vocabPairWordSelect },
  wordB: { select: vocabPairWordSelect },
  tags: { select: { tag: { select: { id: true, name: true } } } },
  _count: { select: { dictionaryEntries: true } },
} as const;

export function vocabPairMatchesLanguagesWhere(
  primaryLangId: number,
  learningLangId: number,
): Prisma.VocabPairWhereInput {
  return {
    OR: [
      { wordA: { languageId: primaryLangId }, wordB: { languageId: learningLangId } },
      { wordB: { languageId: primaryLangId }, wordA: { languageId: learningLangId } },
    ],
  };
}

export function vocabPairIncludesPrimaryWordWhere(
  primaryWordId: number,
  learningLangId: number,
): Prisma.VocabPairWhereInput {
  return {
    OR: [
      { wordAId: primaryWordId, wordB: { languageId: learningLangId } },
      { wordBId: primaryWordId, wordA: { languageId: learningLangId } },
    ],
  };
}

export async function selectTranslationById(translationId: number) {
  return getPrisma().vocabPair.findUnique({
    where: { id: translationId },
    select: translationSelect,
  });
}

export async function findTranslationByWordIds(
  wordIdOne: number,
  wordIdTwo: number,
  relationType: VocabPairRelationType = "translation",
) {
  const { wordAId, wordBId } = canonicalWordPairIds(wordIdOne, wordIdTwo);
  return getPrisma().vocabPair.findUnique({
    where: {
      wordAId_wordBId_relationType: { wordAId, wordBId, relationType },
    },
    select: translationSelect,
  });
}

/** @deprecated Use findTranslationByWordIds */
export const findVocabPairByWordIds = findTranslationByWordIds;

export async function insertTranslation(input: {
  wordIdOne: number;
  wordIdTwo: number;
  relationType?: VocabPairRelationType;
  primaryLanguageId?: number;
  learningLanguageId?: number;
  partOfSpeech?: string | null;
}) {
  const { wordAId, wordBId } = canonicalWordPairIds(input.wordIdOne, input.wordIdTwo);
  return getPrisma().vocabPair.create({
    data: {
      wordAId,
      wordBId,
      relationType: input.relationType ?? "translation",
      primaryLanguageId: input.primaryLanguageId ?? null,
      learningLanguageId: input.learningLanguageId ?? null,
      partOfSpeech: input.partOfSpeech ?? null,
    },
    select: translationSelect,
  });
}

export async function deleteTranslationById(translationId: number) {
  await getPrisma().vocabPair.delete({ where: { id: translationId } });
}

export async function updateTranslationWordIds(
  translationId: number,
  input: {
    wordIdOne: number;
    wordIdTwo: number;
    primaryLanguageId: number;
    learningLanguageId: number;
    partOfSpeech?: string | null;
  },
) {
  const { wordAId, wordBId } = canonicalWordPairIds(input.wordIdOne, input.wordIdTwo);
  return getPrisma().vocabPair.update({
    where: { id: translationId },
    data: {
      wordAId,
      wordBId,
      primaryLanguageId: input.primaryLanguageId,
      learningLanguageId: input.learningLanguageId,
      ...(input.partOfSpeech !== undefined ? { partOfSpeech: input.partOfSpeech } : {}),
    },
    select: translationSelect,
  });
}

export async function replaceTranslationTags(translationId: number, tagIds: number[]) {
  await getPrisma().$transaction(async (tx) => {
    await tx.vocabPairTag.deleteMany({ where: { vocabPairId: translationId } });
    if (tagIds.length > 0) {
      await tx.vocabPairTag.createMany({
        data: tagIds.map((tagId) => ({ vocabPairId: translationId, tagId })),
        skipDuplicates: true,
      });
    }
  });

  return selectTranslationById(translationId);
}

type TranslationRow = {
  id: number;
  relationType: VocabPairRelationType;
  partOfSpeech: string | null;
  primaryLanguageId: number | null;
  learningLanguageId: number | null;
  wordA: { text: string; languageId: number; language: { name: string } };
  wordB: { text: string; languageId: number; language: { name: string } };
  tags: Array<{ tag: { id: number; name: string } }>;
  _count: { dictionaryEntries: number };
};

function otherLanguageIdInPair(row: TranslationRow, languageId: number): number | null {
  if (row.wordA.languageId === languageId) {
    return row.wordB.languageId;
  }
  if (row.wordB.languageId === languageId) {
    return row.wordA.languageId;
  }
  return null;
}

export function mapTranslationRow(row: TranslationRow, viewPrimaryLanguageId?: number) {
  const viewOtherLanguageId =
    viewPrimaryLanguageId != null
      ? otherLanguageIdInPair(row, viewPrimaryLanguageId)
      : null;
  const viewResolved =
    viewPrimaryLanguageId != null && viewOtherLanguageId != null
      ? resolvePairWordsForUser(
          row.wordA,
          row.wordB,
          viewPrimaryLanguageId,
          viewOtherLanguageId,
        )
      : null;

  const storedResolved =
    row.primaryLanguageId != null && row.learningLanguageId != null
      ? resolvePairWordsForUser(
          row.wordA,
          row.wordB,
          row.primaryLanguageId,
          row.learningLanguageId,
        )
      : null;

  const resolved = viewResolved ?? storedResolved;
  const primaryWord = resolved?.primaryWord ?? row.wordA;
  const learningWord = resolved?.learningWord ?? row.wordB;

  return {
    id: row.id,
    relationType: row.relationType,
    primaryWord: primaryWord.text,
    primaryLanguage: primaryWord.language.name,
    learningWord: learningWord.text,
    learningLanguage: learningWord.language.name,
    primaryLanguageId: viewPrimaryLanguageId ?? row.primaryLanguageId ?? primaryWord.languageId,
    learningLanguageId:
      viewOtherLanguageId ?? row.learningLanguageId ?? learningWord.languageId,
    userPairCount: row._count.dictionaryEntries,
    partOfSpeech: row.partOfSpeech,
    tagIds: row.tags.map((entry) => entry.tag.id),
    tagNames: row.tags.map((entry) => entry.tag.name),
  };
}
