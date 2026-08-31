import {
  coerceReviewDirection,
  entryToPairSchedules,
  evaluateVocabAnswer,
  expectedAnswersForDirection,
  initialDictionarySchedules,
  isVocabPairRelationType,
  normalizePartOfSpeechInput,
  pairMatchesUserRelation,
  planReviewScheduleUpdate,
  resolvePairSidesForUser,
  selectWorstCardDirection,
  type NestMember,
  type ReviewCardDirection,
  type VocabPairRelationType,
} from "@language-turtle/shared";
import * as nestRepository from "../db/nestRepository.js";
import * as userRepository from "../db/userRepository.js";
import { getPrisma } from "../db/prisma.js";
import * as dictionaryRepository from "../db/dictionaryRepository.js";
import * as skillStateRepository from "../db/skillStateRepository.js";
import { shuffleArray } from "../utils/shuffle.js";
import {
  vocabPairIncludesPrimaryWordWhere,
} from "../db/vocabPairRepository.js";
import * as vocabPairRepository from "../db/vocabPairRepository.js";

export type VocabLanguages = {
  primaryLangId: number;
  learningLangId: number;
  primaryName: string;
  learningName: string;
};

export type WordSuggestion = {
  pairId: number;
  learningText: string;
};

export type AddedWord = {
  vocabPairId: number;
  relationType: VocabPairRelationType;
  primaryWord: string;
  learningWord: string;
};

async function requireUserLanguages(userId: number): Promise<VocabLanguages | null> {
  const user = await getPrisma().user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      primaryLanguageId: true,
      learningLanguageId: true,
      primaryLanguage: { select: { name: true } },
      learningLanguage: { select: { name: true } },
    },
  });
  if (
    user?.primaryLanguageId == null ||
    user.learningLanguageId == null ||
    !user.primaryLanguage ||
    !user.learningLanguage
  ) {
    return null;
  }
  return {
    primaryLangId: user.primaryLanguageId,
    learningLangId: user.learningLanguageId,
    primaryName: user.primaryLanguage.name,
    learningName: user.learningLanguage.name,
  };
}

async function findOrCreateVocabWord(
  languageId: number,
  text: string,
): Promise<{ id: number; text: string }> {
  const word = await nestRepository.ensureVocabWordWithNest(languageId, text);
  return { id: word.id, text: word.text };
}

async function upsertVocabWord(languageId: number, text: string): Promise<number> {
  const word = await nestRepository.ensureVocabWordWithNest(languageId, text);
  return word.id;
}

async function findExistingPairsForPrimaryWord(
  primaryWordId: number,
  learningLangId: number,
): Promise<WordSuggestion[]> {
  const pairs = await getPrisma().vocabPair.findMany({
    where: {
      relationType: "translation",
      ...vocabPairIncludesPrimaryWordWhere(primaryWordId, learningLangId),
    },
    select: {
      id: true,
      wordA: { select: { id: true, text: true, languageId: true } },
      wordB: { select: { id: true, text: true, languageId: true } },
    },
  });
  return pairs.map((pair) => {
    const otherWord =
      pair.wordA.id === primaryWordId ? pair.wordB : pair.wordA;
    return {
      pairId: pair.id,
      learningText: otherWord.text,
    };
  });
}

async function attachUserToVocabPair(
  userId: number,
  pairId: number,
  nowMs: number = Date.now(),
): Promise<void> {
  await dictionaryRepository.attachPairToUserDefaultDictionary(
    userId,
    pairId,
    initialDictionarySchedules(nowMs),
  );
}

async function loadAddedWord(
  pairId: number,
  primaryLangId: number,
  learningLangId: number,
): Promise<AddedWord | null> {
  const pair = await getPrisma().vocabPair.findUnique({
    where: { id: pairId },
    select: {
      id: true,
      relationType: true,
      wordA: { select: { text: true, languageId: true } },
      wordB: { select: { text: true, languageId: true } },
    },
  });
  if (!pair) {
    return null;
  }
  const resolved = resolvePairSidesForUser(
    pair.wordA,
    pair.wordB,
    pair.relationType,
    primaryLangId,
    learningLangId,
  );
  if (!resolved) {
    return null;
  }
  return {
    vocabPairId: pair.id,
    relationType: pair.relationType,
    primaryWord: resolved.primaryWord.text,
    learningWord: resolved.learningWord.text,
  };
}

export async function getVocabLanguages(userId: number) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  const languages = await requireUserLanguages(userId);
  if (!languages) {
    return { ok: false as const, status: 400, error: "languages_not_set" };
  }
  return {
    ok: true as const,
    languages: {
      primaryName: languages.primaryName,
      learningName: languages.learningName,
    },
  };
}

export async function lookupPrimaryWord(userId: number, primaryWordRaw: string) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  const primaryWord = primaryWordRaw.trim();
  if (!primaryWord) {
    return { ok: false as const, status: 400, error: "primary_word_required" };
  }

  const languages = await requireUserLanguages(userId);
  if (!languages) {
    return { ok: false as const, status: 400, error: "languages_not_set" };
  }

  const primary = await findOrCreateVocabWord(languages.primaryLangId, primaryWord);
  const suggestions = await findExistingPairsForPrimaryWord(primary.id, languages.learningLangId);

  return {
    ok: true as const,
    primaryWordId: primary.id,
    primaryText: primary.text,
    suggestions,
    learningLangName: languages.learningName,
  };
}

export async function addWordForUser(
  userId: number,
  input: {
    vocabPairId?: number;
    primaryWordId?: number;
    learningWord?: string;
    relationType?: VocabPairRelationType;
  },
) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }

  const languages = await requireUserLanguages(userId);
  if (!languages) {
    return { ok: false as const, status: 400, error: "languages_not_set" };
  }

  const nowMs = Date.now();
  const relationType =
    input.relationType != null && isVocabPairRelationType(input.relationType)
      ? input.relationType
      : "translation";

  if (input.vocabPairId != null) {
    const pairId = input.vocabPairId;
    if (!Number.isInteger(pairId) || pairId < 1) {
      return { ok: false as const, status: 400, error: "invalid_pair_id" };
    }

    const pair = await getPrisma().vocabPair.findUnique({
      where: { id: pairId },
      select: {
        relationType: true,
        wordA: { select: { languageId: true } },
        wordB: { select: { languageId: true } },
      },
    });
    if (
      !pair ||
      !pairMatchesUserRelation(
        pair.wordA,
        pair.wordB,
        pair.relationType,
        languages.primaryLangId,
        languages.learningLangId,
      )
    ) {
      return { ok: false as const, status: 404, error: "pair_not_found" };
    }

    await attachUserToVocabPair(userId, pairId, nowMs);
    const added = await loadAddedWord(pairId, languages.primaryLangId, languages.learningLangId);
    if (!added) {
      return { ok: false as const, status: 404, error: "pair_not_found" };
    }
    return { ok: true as const, word: added };
  }

  const rawPrimaryWordId = input.primaryWordId;
  const learningWord = input.learningWord?.trim() ?? "";
  if (
    typeof rawPrimaryWordId !== "number" ||
    !Number.isInteger(rawPrimaryWordId) ||
    rawPrimaryWordId < 1 ||
    !learningWord
  ) {
    return { ok: false as const, status: 400, error: "learning_word_required" };
  }
  const primaryWordId = rawPrimaryWordId;

  const primary = await getPrisma().vocabWord.findUnique({
    where: { id: primaryWordId },
    select: { id: true, languageId: true },
  });
  if (!primary || primary.languageId !== languages.primaryLangId) {
    return { ok: false as const, status: 400, error: "invalid_primary_word" };
  }

  const learningWordId = await upsertVocabWord(languages.learningLangId, learningWord);

  let pair = await vocabPairRepository.findTranslationByWordIds(
    primaryWordId,
    learningWordId,
    relationType,
  );
  if (!pair) {
    pair = await vocabPairRepository.insertTranslation({
      wordIdOne: primaryWordId,
      wordIdTwo: learningWordId,
      relationType,
      primaryLanguageId: languages.primaryLangId,
      learningLanguageId: languages.learningLangId,
    });
  }

  await attachUserToVocabPair(userId, pair.id, nowMs);
  const added = await loadAddedWord(pair.id, languages.primaryLangId, languages.learningLangId);
  if (!added) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }
  return { ok: true as const, word: added };
}

export type DueReviewWord = {
  vocabPairId: number;
  direction: ReviewCardDirection;
  promptWord: string;
  primaryWord: string;
  learningWord: string;
  pimsleurLevel: number;
  nextReviewMs: number;
};

function buildDueReviewWord(
  vocabPairId: number,
  direction: ReviewCardDirection,
  primaryWord: string,
  learningWord: string,
  entry: {
    pimsleurLevel: number;
    nextReviewMs: bigint;
    pimsleurLevelReverse: number;
    nextReviewMsReverse: bigint;
  },
): DueReviewWord {
  const promptWord = direction === "learning_to_primary" ? learningWord : primaryWord;
  const schedules = entryToPairSchedules(entry);
  const schedule =
    direction === "learning_to_primary" ? schedules.learningToPrimary : schedules.primaryToLearning;
  return {
    vocabPairId,
    direction,
    promptWord,
    primaryWord,
    learningWord,
    pimsleurLevel: schedule.pimsleurLevel,
    nextReviewMs: Number(schedule.nextReviewMs),
  };
}

async function resolveLemmaWordIdsForEntry(
  vocabPair: {
    wordA: { id: number; text: string; languageId: number };
    wordB: { id: number; text: string; languageId: number };
    relationType: VocabPairRelationType;
  },
  primaryLangId: number,
  learningLangId: number,
): Promise<{ primaryWordId: number; learningWordId: number } | null> {
  const resolved = resolvePairSidesForUser(
    vocabPair.wordA,
    vocabPair.wordB,
    vocabPair.relationType,
    primaryLangId,
    learningLangId,
  );
  if (!resolved) {
    return null;
  }
  const primaryWord = resolved.primaryWord as { id: number };
  const learningWord = resolved.learningWord as { id: number };
  return {
    primaryWordId: primaryWord.id,
    learningWordId: learningWord.id,
  };
}

async function loadNestMembersForWordIds(
  primaryWordId: number,
  learningWordId: number,
): Promise<{ primaryNestMembers: NestMember[]; learningNestMembers: NestMember[] }> {
  const membersByWordId = await nestRepository.selectNestMembersForWordIds([
    primaryWordId,
    learningWordId,
  ]);
  return {
    primaryNestMembers: membersByWordId.get(primaryWordId) ?? [],
    learningNestMembers: membersByWordId.get(learningWordId) ?? [],
  };
}

function formatNestMembersForDetail(
  members: NestMember[],
  anchorWordId: number,
): NestMember[] {
  return members.filter((member) => member.wordId !== anchorWordId);
}

function mapLearningNestForDetail(
  members: NestMember[],
  anchorWordId: number,
): Array<NestMember & { isAnchor: boolean }> {
  return members.map((member) => ({
    ...member,
    isAnchor: member.wordId === anchorWordId,
  }));
}

export async function getDueWordsForReview(userId: number) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }

  const languages = await requireUserLanguages(userId);
  if (!languages) {
    return { ok: false as const, status: 400, error: "languages_not_set" };
  }

  await dictionaryRepository.ensureDefaultDictionaryForUser(userId);

  const dictionaryId = await dictionaryRepository.selectDefaultDictionaryIdForUser(userId);
  if (dictionaryId == null) {
    return { ok: true as const, words: [] as DueReviewWord[] };
  }

  const nowMs = BigInt(Date.now());
  const dueRows = await getPrisma().dictionaryEntry.findMany({
    where: {
      dictionaryId,
      OR: [{ nextReviewMs: { lte: nowMs } }, { nextReviewMsReverse: { lte: nowMs } }],
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

  const shuffledDueRows = shuffleArray(dueRows);
  const words: DueReviewWord[] = [];

  for (const row of shuffledDueRows) {
    const resolved = resolvePairSidesForUser(
      row.vocabPair.wordA,
      row.vocabPair.wordB,
      row.vocabPair.relationType,
      languages.primaryLangId,
      languages.learningLangId,
    );
    if (!resolved) {
      continue;
    }
    const direction = selectWorstCardDirection(entryToPairSchedules(row));
    words.push(
      buildDueReviewWord(
        row.vocabPairId,
        direction,
        resolved.primaryWord.text,
        resolved.learningWord.text,
        row,
      ),
    );
  }

  return { ok: true as const, words };
}

export async function checkReviewAnswer(
  userId: number,
  vocabPairId: number,
  answer: string,
  directionRaw?: ReviewCardDirection,
) {
  const trimmed = answer.trim();
  if (!trimmed) {
    return { ok: false as const, status: 400, error: "invalid_review_answer" };
  }

  const languages = await requireUserLanguages(userId);
  if (!languages) {
    return { ok: false as const, status: 400, error: "languages_not_set" };
  }

  const entry = await dictionaryRepository.selectDefaultDictionaryEntry(userId, vocabPairId);
  if (!entry) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const resolved = resolvePairSidesForUser(
    entry.vocabPair.wordA,
    entry.vocabPair.wordB,
    entry.vocabPair.relationType,
    languages.primaryLangId,
    languages.learningLangId,
  );
  if (!resolved) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const direction = coerceReviewDirection(entry, directionRaw);
  const lemmaIds = await resolveLemmaWordIdsForEntry(
    entry.vocabPair,
    languages.primaryLangId,
    languages.learningLangId,
  );
  if (!lemmaIds) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }
  const nestMembers = await loadNestMembersForWordIds(
    lemmaIds.primaryWordId,
    lemmaIds.learningWordId,
  );
  const { expected, alternates } = expectedAnswersForDirection(
    direction,
    resolved.primaryWord.text,
    resolved.learningWord.text,
    entry.alternatePrimaryAnswers,
    entry.alternateLearningAnswers,
    nestMembers.primaryNestMembers,
    nestMembers.learningNestMembers,
  );

  const match = evaluateVocabAnswer(trimmed, expected, alternates);
  const schedules = entryToPairSchedules(entry);
  const activeSchedule =
    direction === "learning_to_primary" ? schedules.learningToPrimary : schedules.primaryToLearning;

  if (match === "close") {
    return {
      ok: true as const,
      direction,
      promptWord: direction === "learning_to_primary" ? resolved.learningWord.text : resolved.primaryWord.text,
      expectedWord: expected,
      primaryWord: resolved.primaryWord.text,
      learningWord: resolved.learningWord.text,
      correct: false,
      match,
      userAnswer: trimmed,
      pimsleurLevel: activeSchedule.pimsleurLevel,
      nextReviewMs: Number(activeSchedule.nextReviewMs),
    };
  }

  const reviewResult = await applyReviewResult(
    userId,
    vocabPairId,
    match === "exact" ? "know" : "dont",
    direction,
  );
  if (reviewResult.ok === false) {
    return reviewResult;
  }

  return {
    ok: true as const,
    direction,
    promptWord: direction === "learning_to_primary" ? reviewResult.learningWord : reviewResult.primaryWord,
    expectedWord: expected,
    primaryWord: reviewResult.primaryWord,
    learningWord: reviewResult.learningWord,
    correct: match === "exact",
    match,
    userAnswer: trimmed,
    pimsleurLevel: reviewResult.pimsleurLevel,
    nextReviewMs: reviewResult.nextReviewMs,
  };
}

export async function applyReviewResult(
  userId: number,
  vocabPairId: number,
  result: "know" | "dont",
  directionRaw?: ReviewCardDirection,
) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  if (!Number.isInteger(vocabPairId) || vocabPairId < 1) {
    return { ok: false as const, status: 400, error: "invalid_pair_id" };
  }
  if (result !== "know" && result !== "dont") {
    return { ok: false as const, status: 400, error: "invalid_review_result" };
  }

  const languages = await requireUserLanguages(userId);
  if (!languages) {
    return { ok: false as const, status: 400, error: "languages_not_set" };
  }

  const entry = await dictionaryRepository.selectDefaultDictionaryEntry(userId, vocabPairId);
  if (!entry) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const nowMs = Date.now();
  const { direction, schedule, updateData } = planReviewScheduleUpdate(
    entry,
    result,
    nowMs,
    directionRaw,
  );

  await getPrisma().dictionaryEntry.update({
    where: {
      dictionaryId_vocabPairId: {
        dictionaryId: entry.dictionaryId,
        vocabPairId,
      },
    },
    data: updateData,
  });

  await skillStateRepository.upsertSkillAfterReview(
    userId,
    vocabPairId,
    direction,
    schedule,
    result,
  );

  const resolved = resolvePairSidesForUser(
    entry.vocabPair.wordA,
    entry.vocabPair.wordB,
    entry.vocabPair.relationType,
    languages.primaryLangId,
    languages.learningLangId,
  );
  if (!resolved) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  return {
    ok: true as const,
    direction,
    primaryWord: resolved.primaryWord.text,
    learningWord: resolved.learningWord.text,
    pimsleurLevel: schedule.pimsleurLevel,
    nextReviewMs: schedule.nextReviewMs,
  };
}

export type UpdateMyWordInput = {
  partOfSpeech?: string | null;
  example?: string | null;
};

export async function getMyWordDetail(userId: number, vocabPairId: number) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  if (!Number.isInteger(vocabPairId) || vocabPairId < 1) {
    return { ok: false as const, status: 400, error: "invalid_pair_id" };
  }

  const languages = await requireUserLanguages(userId);
  if (!languages) {
    return { ok: false as const, status: 400, error: "languages_not_set" };
  }

  const word = await userRepository.selectUserWordByPairId(userId, vocabPairId);
  if (!word) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const entry = await userRepository.selectDictionaryEntryForUserPair(userId, vocabPairId);
  if (!entry) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const lemmaIds = await resolveLemmaWordIdsForEntry(
    entry.vocabPair,
    languages.primaryLangId,
    languages.learningLangId,
  );
  if (!lemmaIds) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const nestMembers = await loadNestMembersForWordIds(
    lemmaIds.primaryWordId,
    lemmaIds.learningWordId,
  );

  return {
    ok: true as const,
    word: {
      ...word,
      primaryNestMembers: formatNestMembersForDetail(
        nestMembers.primaryNestMembers,
        lemmaIds.primaryWordId,
      ),
      learningNestMembers: formatNestMembersForDetail(
        nestMembers.learningNestMembers,
        lemmaIds.learningWordId,
      ),
      learningNest: mapLearningNestForDetail(
        nestMembers.learningNestMembers,
        lemmaIds.learningWordId,
      ),
    },
  };
}

export async function updateMyWord(
  userId: number,
  vocabPairId: number,
  input: UpdateMyWordInput,
) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  if (!Number.isInteger(vocabPairId) || vocabPairId < 1) {
    return { ok: false as const, status: 400, error: "invalid_pair_id" };
  }

  const partOfSpeech = normalizePartOfSpeechInput(input.partOfSpeech);
  if (partOfSpeech === undefined && input.partOfSpeech !== undefined) {
    return { ok: false as const, status: 400, error: "invalid_part_of_speech" };
  }

  const entry = await userRepository.selectDictionaryEntryForUserPair(userId, vocabPairId);
  if (!entry) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const pairUpdate: { partOfSpeech?: string | null; example?: string | null } = {};
  if (partOfSpeech !== undefined) {
    pairUpdate.partOfSpeech = partOfSpeech;
  }
  if (input.example !== undefined) {
    pairUpdate.example = typeof input.example === "string" ? input.example.trim() || null : null;
  }

  if (Object.keys(pairUpdate).length === 0) {
    return { ok: false as const, status: 400, error: "nothing_to_update" };
  }

  await getPrisma().vocabPair.update({
    where: { id: vocabPairId },
    data: pairUpdate,
  });

  return getMyWordDetail(userId, vocabPairId);
}

export type WordNestSide = "primary" | "learning";

export async function addNestMemberToMyWord(
  userId: number,
  vocabPairId: number,
  input: { side: WordNestSide; form: string },
) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  if (!Number.isInteger(vocabPairId) || vocabPairId < 1) {
    return { ok: false as const, status: 400, error: "invalid_pair_id" };
  }

  const form = input.form.trim();
  if (!form) {
    return { ok: false as const, status: 400, error: "nest_form_required" };
  }
  if (input.side !== "primary" && input.side !== "learning") {
    return { ok: false as const, status: 400, error: "invalid_nest_side" };
  }

  const languages = await requireUserLanguages(userId);
  if (!languages) {
    return { ok: false as const, status: 400, error: "languages_not_set" };
  }

  const entry = await userRepository.selectDictionaryEntryForUserPair(userId, vocabPairId);
  if (!entry) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }
  if (entry.vocabPair.relationType !== "translation") {
    return { ok: false as const, status: 400, error: "nest_members_only_for_translation" };
  }

  const lemmaIds = await resolveLemmaWordIdsForEntry(
    entry.vocabPair,
    languages.primaryLangId,
    languages.learningLangId,
  );
  if (!lemmaIds) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const anchorWordId =
    input.side === "primary" ? lemmaIds.primaryWordId : lemmaIds.learningWordId;
  const languageId =
    input.side === "primary" ? languages.primaryLangId : languages.learningLangId;

  const anchorWord = await getPrisma().vocabWord.findUnique({
    where: { id: anchorWordId },
    select: { id: true, text: true, nestId: true },
  });
  if (!anchorWord) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }
  if (anchorWord.text.trim().toLowerCase() === form.toLowerCase()) {
    return { ok: false as const, status: 400, error: "nest_form_same_as_anchor" };
  }

  await nestRepository.addMemberToNest(anchorWord.nestId, languageId, form);
  return getMyWordDetail(userId, vocabPairId);
}

export async function removeNestMemberFromMyWord(
  userId: number,
  vocabPairId: number,
  memberWordId: number,
) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  if (!Number.isInteger(vocabPairId) || vocabPairId < 1) {
    return { ok: false as const, status: 400, error: "invalid_pair_id" };
  }
  if (!Number.isInteger(memberWordId) || memberWordId < 1) {
    return { ok: false as const, status: 400, error: "invalid_nest_member_id" };
  }

  const languages = await requireUserLanguages(userId);
  if (!languages) {
    return { ok: false as const, status: 400, error: "languages_not_set" };
  }

  const entry = await userRepository.selectDictionaryEntryForUserPair(userId, vocabPairId);
  if (!entry) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const lemmaIds = await resolveLemmaWordIdsForEntry(
    entry.vocabPair,
    languages.primaryLangId,
    languages.learningLangId,
  );
  if (!lemmaIds) {
    return { ok: false as const, status: 404, error: "pair_not_found" };
  }

  const linkedWordIds = [lemmaIds.primaryWordId, lemmaIds.learningWordId];
  if (linkedWordIds.includes(memberWordId)) {
    return { ok: false as const, status: 400, error: "cannot_remove_anchor_word" };
  }

  const memberWord = await getPrisma().vocabWord.findUnique({
    where: { id: memberWordId },
    select: { id: true, nestId: true },
  });
  if (!memberWord) {
    return { ok: false as const, status: 404, error: "nest_member_not_found" };
  }

  const anchorNestIds = await Promise.all(
    linkedWordIds.map((wordId) => nestRepository.selectNestIdForWord(wordId)),
  );
  if (!anchorNestIds.includes(memberWord.nestId)) {
    return { ok: false as const, status: 404, error: "nest_member_not_found" };
  }

  const removed = await nestRepository.removeNestMember(memberWordId, memberWord.nestId);
  if (!removed) {
    return { ok: false as const, status: 400, error: "nest_member_not_removable" };
  }

  return getMyWordDetail(userId, vocabPairId);
}
