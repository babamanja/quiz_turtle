import { normalizePartOfSpeechInput } from "@language-turtle/shared";

import * as languageRepository from "../db/languageRepository.js";
import * as nestRepository from "../db/nestRepository.js";
import * as tagRepository from "../db/tagRepository.js";
import { getPrisma } from "../db/prisma.js";
import * as vocabPairRepository from "../db/vocabPairRepository.js";
import * as vocabWordRepository from "../db/vocabWordRepository.js";

const MAX_WORD_TEXT_LENGTH = 200;

function mapVocabWordRow(row: {
  id: number;
  text: string;
  languageId: number;
  language: { name: string };
  _count: { pairsAsWordA: number; pairsAsWordB: number };
}) {
  return {
    id: row.id,
    text: row.text,
    languageId: row.languageId,
    languageName: row.language.name,
    primaryPairCount: row._count.pairsAsWordA,
    learningPairCount: row._count.pairsAsWordB,
  };
}

function normalizeWordText(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const text = raw.trim();
  if (!text || text.length > MAX_WORD_TEXT_LENGTH) {
    return null;
  }
  return text;
}

function parseLanguageId(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
    return null;
  }
  return raw;
}

function parseTagIds(
  raw: unknown,
): { ok: true; tagIds: number[] } | { ok: false; status: number; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, tagIds: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, status: 400, error: "invalid tag ids" };
  }

  const tagIds: number[] = [];
  for (const item of raw) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1) {
      return { ok: false, status: 400, error: "invalid tag ids" };
    }
    if (!tagIds.includes(item)) {
      tagIds.push(item);
    }
  }

  return { ok: true, tagIds };
}

async function validateTagIds(
  tagIds: number[],
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (tagIds.length === 0) {
    return { ok: true };
  }

  const existingCount = await tagRepository.countExistingTagsByIds(tagIds);
  if (existingCount !== tagIds.length) {
    return { ok: false, status: 404, error: "tag not found" };
  }

  return { ok: true };
}

type LearningPairRow = {
  id: number;
  partOfSpeech: string | null;
  wordAId: number;
  wordBId: number;
  learningLanguageId: number | null;
  wordA: { languageId: number };
  wordB: { languageId: number };
  tags: Array<{ tag: { id: number; name: string } }>;
};

function isLearningWordInPair(wordId: number, pair: LearningPairRow): boolean {
  if (pair.learningLanguageId == null) {
    return pair.wordBId === wordId;
  }
  if (pair.wordA.languageId === pair.learningLanguageId) {
    return pair.wordAId === wordId;
  }
  if (pair.wordB.languageId === pair.learningLanguageId) {
    return pair.wordBId === wordId;
  }
  return false;
}

function collectLearningPairMetadata(pairs: LearningPairRow[]) {
  const partOfSpeechValues = [
    ...new Set(pairs.map((pair) => pair.partOfSpeech).filter((value): value is string => !!value)),
  ];
  const partOfSpeech =
    partOfSpeechValues.length === 1
      ? partOfSpeechValues[0]
      : partOfSpeechValues.length === 0
        ? null
        : null;

  const tagMap = new Map<number, string>();
  for (const pair of pairs) {
    for (const { tag } of pair.tags) {
      tagMap.set(tag.id, tag.name);
    }
  }
  const tagIds = [...tagMap.keys()].sort((left, right) => left - right);
  const tagNames = tagIds.map((tagId) => tagMap.get(tagId)!);

  return { partOfSpeech, tagIds, tagNames };
}

function mapNestMembers(
  wordId: number,
  members: Array<{ wordId: number; text: string }>,
) {
  return members
    .map((member) => ({
      wordId: member.wordId,
      text: member.text,
      isAnchor: member.wordId === wordId,
    }))
    .sort((left, right) => {
      if (left.isAnchor !== right.isAnchor) {
        return left.isAnchor ? -1 : 1;
      }
      return left.text.localeCompare(right.text);
    });
}

async function loadNestMembersForWord(wordId: number, nestId: number) {
  const members = await nestRepository.selectNestMembers(nestId);
  return mapNestMembers(wordId, members);
}

async function selectLearningPairsForWord(wordId: number): Promise<LearningPairRow[]> {
  const pairs = await getPrisma().vocabPair.findMany({
    where: { OR: [{ wordAId: wordId }, { wordBId: wordId }] },
    select: {
      id: true,
      partOfSpeech: true,
      wordAId: true,
      wordBId: true,
      learningLanguageId: true,
      wordA: { select: { languageId: true } },
      wordB: { select: { languageId: true } },
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
    orderBy: { id: "asc" },
  });

  return pairs.filter((pair) => isLearningWordInPair(wordId, pair));
}

async function applyLearningPairMetadata(
  wordId: number,
  input: { partOfSpeech?: string | null; tagIds?: number[] },
) {
  const learningPairs = await selectLearningPairsForWord(wordId);
  if (learningPairs.length === 0) {
    if (input.partOfSpeech !== undefined || input.tagIds !== undefined) {
      return {
        ok: false as const,
        status: 409,
        error: "word is not used as learning word in pairs",
      };
    }
    return { ok: true as const };
  }

  await getPrisma().$transaction(async (tx) => {
    for (const pair of learningPairs) {
      if (input.partOfSpeech !== undefined) {
        await tx.vocabPair.update({
          where: { id: pair.id },
          data: { partOfSpeech: input.partOfSpeech },
        });
      }
      if (input.tagIds !== undefined) {
        await tx.vocabPairTag.deleteMany({ where: { vocabPairId: pair.id } });
        if (input.tagIds.length > 0) {
          await tx.vocabPairTag.createMany({
            data: input.tagIds.map((tagId) => ({ vocabPairId: pair.id, tagId })),
            skipDuplicates: true,
          });
        }
      }
    }
  });

  return { ok: true as const };
}

export async function createVocabWord(input: { text: unknown; languageId: unknown }) {
  const text = normalizeWordText(input.text);
  if (!text) {
    return { ok: false as const, status: 400, error: "word text is required" };
  }

  const languageId = parseLanguageId(input.languageId);
  if (!languageId) {
    return { ok: false as const, status: 400, error: "invalid language id" };
  }

  const language = await languageRepository.selectLanguageById(languageId);
  if (!language) {
    return { ok: false as const, status: 404, error: "language not found" };
  }

  if (await vocabWordRepository.isVocabWordTextTaken(languageId, text)) {
    return { ok: false as const, status: 409, error: "word already exists for language" };
  }

  const row = await vocabWordRepository.insertVocabWord({ languageId, text });
  return { ok: true as const, word: mapVocabWordRow(row) };
}

export async function updateVocabWord(
  wordId: number,
  input: {
    text?: unknown;
    languageId?: unknown;
    partOfSpeech?: unknown;
    tagIds?: unknown;
  },
) {
  if (!Number.isInteger(wordId) || wordId < 1) {
    return { ok: false as const, status: 400, error: "invalid word id" };
  }

  const existing = await vocabWordRepository.selectVocabWordById(wordId);
  if (!existing) {
    return { ok: false as const, status: 404, error: "word not found" };
  }

  const text = input.text !== undefined ? normalizeWordText(input.text) : undefined;
  if (input.text !== undefined && !text) {
    return { ok: false as const, status: 400, error: "word text is required" };
  }

  const languageId =
    input.languageId !== undefined ? parseLanguageId(input.languageId) : undefined;
  if (input.languageId !== undefined && !languageId) {
    return { ok: false as const, status: 400, error: "invalid language id" };
  }

  const partOfSpeech =
    input.partOfSpeech !== undefined ? normalizePartOfSpeechInput(input.partOfSpeech) : undefined;
  if (partOfSpeech === undefined && input.partOfSpeech !== undefined) {
    return { ok: false as const, status: 400, error: "invalid part of speech" };
  }

  const parsedTags =
    input.tagIds !== undefined ? parseTagIds(input.tagIds) : { ok: true as const, tagIds: undefined };
  if (parsedTags.ok === false) {
    return parsedTags;
  }
  if (parsedTags.tagIds !== undefined) {
    const tagCheck = await validateTagIds(parsedTags.tagIds);
    if (tagCheck.ok === false) {
      return tagCheck;
    }
  }

  const pairCount = existing._count.pairsAsWordA + existing._count.pairsAsWordB;
  if (languageId != null && languageId !== existing.languageId && pairCount > 0) {
    return {
      ok: false as const,
      status: 409,
      error: "cannot change language while word is used in pairs",
    };
  }

  if (languageId != null && languageId !== existing.languageId) {
    const language = await languageRepository.selectLanguageById(languageId);
    if (!language) {
      return { ok: false as const, status: 404, error: "language not found" };
    }
  }

  const nextLanguageId = languageId ?? existing.languageId;
  const nextText = text ?? existing.text;
  if (await vocabWordRepository.isVocabWordTextTaken(nextLanguageId, nextText, wordId)) {
    return { ok: false as const, status: 409, error: "word already exists for language" };
  }

  const updateData: { text?: string; languageId?: number } = {};
  if (typeof text === "string") {
    updateData.text = text;
  }
  if (typeof languageId === "number") {
    updateData.languageId = languageId;
  }

  if (Object.keys(updateData).length > 0) {
    await vocabWordRepository.updateVocabWordById(wordId, updateData);
  }

  const metadataResult = await applyLearningPairMetadata(wordId, {
    ...(partOfSpeech !== undefined ? { partOfSpeech } : {}),
    ...(parsedTags.tagIds !== undefined ? { tagIds: parsedTags.tagIds } : {}),
  });
  if (metadataResult.ok === false) {
    return metadataResult;
  }

  return getVocabWordDetail(wordId);
}

export async function deleteVocabWord(wordId: number) {
  if (!Number.isInteger(wordId) || wordId < 1) {
    return { ok: false as const, status: 400, error: "invalid word id" };
  }

  const existing = await vocabWordRepository.selectVocabWordById(wordId);
  if (!existing) {
    return { ok: false as const, status: 404, error: "word not found" };
  }

  const pairCount = existing._count.pairsAsWordA + existing._count.pairsAsWordB;
  if (pairCount > 0) {
    return {
      ok: false as const,
      status: 409,
      error: "word is used in dictionary pairs",
    };
  }

  await vocabWordRepository.deleteVocabWordById(wordId);
  return { ok: true as const };
}

export async function getVocabWordDetail(wordId: number) {
  if (!Number.isInteger(wordId) || wordId < 1) {
    return { ok: false as const, status: 400, error: "invalid word id" };
  }

  const word = await vocabWordRepository.selectVocabWordById(wordId);
  if (!word) {
    return { ok: false as const, status: 404, error: "word not found" };
  }

  const learningPairs = await selectLearningPairsForWord(wordId);
  const metadata = collectLearningPairMetadata(learningPairs);
  const nestMembers = await loadNestMembersForWord(word.id, word.nestId);

  return {
    ok: true as const,
    word: {
      id: word.id,
      text: word.text,
      languageId: word.languageId,
      languageName: word.language.name,
      primaryPairCount: word._count.pairsAsWordA,
      learningPairCount: word._count.pairsAsWordB,
      learningRolePairCount: learningPairs.length,
      partOfSpeech: metadata.partOfSpeech,
      tagIds: metadata.tagIds,
      tagNames: metadata.tagNames,
      nestMembers,
    },
  };
}

export async function addNestMemberToVocabWord(wordId: number, formRaw: unknown) {
  if (!Number.isInteger(wordId) || wordId < 1) {
    return { ok: false as const, status: 400, error: "invalid word id" };
  }

  const form = typeof formRaw === "string" ? formRaw.trim() : "";
  if (!form) {
    return { ok: false as const, status: 400, error: "nest form required" };
  }

  const word = await vocabWordRepository.selectVocabWordById(wordId);
  if (!word) {
    return { ok: false as const, status: 404, error: "word not found" };
  }
  if (word.text.trim().toLowerCase() === form.toLowerCase()) {
    return { ok: false as const, status: 400, error: "nest form same as anchor" };
  }

  await nestRepository.addMemberToNest(word.nestId, word.languageId, form);
  return getVocabWordDetail(wordId);
}

export async function removeNestMemberFromVocabWord(wordId: number, memberWordId: number) {
  if (!Number.isInteger(wordId) || wordId < 1) {
    return { ok: false as const, status: 400, error: "invalid word id" };
  }
  if (!Number.isInteger(memberWordId) || memberWordId < 1) {
    return { ok: false as const, status: 400, error: "invalid nest member id" };
  }
  if (memberWordId === wordId) {
    return { ok: false as const, status: 400, error: "cannot remove anchor word" };
  }

  const word = await vocabWordRepository.selectVocabWordById(wordId);
  if (!word) {
    return { ok: false as const, status: 404, error: "word not found" };
  }

  const memberNestId = await nestRepository.selectNestIdForWord(memberWordId);
  if (memberNestId !== word.nestId) {
    return { ok: false as const, status: 404, error: "nest member not found" };
  }

  const removed = await nestRepository.removeNestMember(memberWordId, word.nestId);
  if (!removed) {
    return { ok: false as const, status: 400, error: "nest member not removable" };
  }

  return getVocabWordDetail(wordId);
}
