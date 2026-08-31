import {
  progressPercent,
  resolveUnlockedWordIds,
  STORY_STATUSES,
  STORY_TOKEN_KINDS,
  type AdaptiveStoryUnlockLevelInput,
  type StoryStatus,
  type StoryTokenKind,
} from "@language-turtle/shared";

import * as languageRepository from "../db/languageRepository.js";
import * as storyRepository from "../db/storyRepository.js";
import type {
  StoryGraphRow,
  StorySentenceInsert,
  StoryUnlockLevelInsert,
} from "../db/storyRepository.js";

const MAX_TITLE_LENGTH = 200;
const MAX_SLUG_LENGTH = 120;
const MAX_LABEL_LENGTH = 120;
const MAX_TOKEN_TEXT_LENGTH = 500;

type ServiceFailure = { ok: false; status: number; error: string };

export type ParsedStoryToken = {
  sortOrder: number;
  kind: StoryTokenKind;
  vocabWordId: number | null;
  baseForm: string;
  l1Text: string;
  glueToPrevious: boolean;
};

export type ParsedStorySentence = {
  sortOrder: number;
  tokens: ParsedStoryToken[];
};

export type ParsedUnlockLevel = {
  level: number;
  label: string | null;
  wordIds: number[];
};

export type ParsedStoryContent = {
  sentences: ParsedStorySentence[];
  unlockLevels: ParsedUnlockLevel[];
};

function failure(status: number, error: string): ServiceFailure {
  return { ok: false as const, status, error };
}

function isStoryStatus(value: unknown): value is StoryStatus {
  return typeof value === "string" && (STORY_STATUSES as readonly string[]).includes(value);
}

function isStoryTokenKind(value: unknown): value is StoryTokenKind {
  return typeof value === "string" && (STORY_TOKEN_KINDS as readonly string[]).includes(value);
}

function normalizeTitle(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const title = raw.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return null;
  }
  return title;
}

function normalizeSlug(raw: unknown): string | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const slug = raw.trim();
  if (!slug) {
    return null;
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    return null;
  }
  return slug;
}

function parsePositiveInt(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
    return null;
  }
  return raw;
}

function parseNonNegativeInt(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    return null;
  }
  return raw;
}

function normalizeTokenText(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const text = raw.trim();
  if (!text || text.length > MAX_TOKEN_TEXT_LENGTH) {
    return null;
  }
  return text;
}

function normalizeLabel(raw: unknown): string | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const label = raw.trim();
  if (!label) {
    return null;
  }
  if (label.length > MAX_LABEL_LENGTH) {
    return null;
  }
  return label;
}

/** Pure content validation (no DB). Exported for unit tests. */
export function validateStoryContent(
  input: unknown,
): { ok: true; content: ParsedStoryContent } | ServiceFailure {
  if (input == null || typeof input !== "object") {
    return failure(400, "content is required");
  }
  const body = input as Record<string, unknown>;
  if (!Array.isArray(body.sentences)) {
    return failure(400, "sentences must be an array");
  }
  if (!Array.isArray(body.unlockLevels)) {
    return failure(400, "unlockLevels must be an array");
  }

  const sentenceSortOrders = new Set<number>();
  const sentences: ParsedStorySentence[] = [];
  const storyWordIds = new Set<number>();

  for (let i = 0; i < body.sentences.length; i++) {
    const sentenceRaw = body.sentences[i];
    if (sentenceRaw == null || typeof sentenceRaw !== "object") {
      return failure(400, `invalid sentence at index ${i}`);
    }
    const sentence = sentenceRaw as Record<string, unknown>;
    const sortOrder = parseNonNegativeInt(sentence.sortOrder);
    if (sortOrder == null) {
      return failure(400, `invalid sentence sortOrder at index ${i}`);
    }
    if (sentenceSortOrders.has(sortOrder)) {
      return failure(400, `duplicate sentence sortOrder ${sortOrder}`);
    }
    sentenceSortOrders.add(sortOrder);

    if (!Array.isArray(sentence.tokens)) {
      return failure(400, `tokens must be an array at sentence ${sortOrder}`);
    }

    const tokenSortOrders = new Set<number>();
    const tokens: ParsedStoryToken[] = [];

    for (let t = 0; t < sentence.tokens.length; t++) {
      const tokenRaw = sentence.tokens[t];
      if (tokenRaw == null || typeof tokenRaw !== "object") {
        return failure(400, `invalid token at sentence ${sortOrder}, index ${t}`);
      }
      const token = tokenRaw as Record<string, unknown>;
      const tokenSortOrder = parseNonNegativeInt(token.sortOrder);
      if (tokenSortOrder == null) {
        return failure(400, `invalid token sortOrder at sentence ${sortOrder}, index ${t}`);
      }
      if (tokenSortOrders.has(tokenSortOrder)) {
        return failure(400, `duplicate token sortOrder ${tokenSortOrder} in sentence ${sortOrder}`);
      }
      tokenSortOrders.add(tokenSortOrder);

      if (!isStoryTokenKind(token.kind)) {
        return failure(400, `invalid token kind at sentence ${sortOrder}, index ${t}`);
      }

      const baseForm = normalizeTokenText(token.baseForm);
      if (!baseForm) {
        return failure(400, `token baseForm is required at sentence ${sortOrder}, index ${t}`);
      }
      const l1Text = normalizeTokenText(token.l1Text);
      if (!l1Text) {
        return failure(400, `token l1Text is required at sentence ${sortOrder}, index ${t}`);
      }

      const glueToPrevious =
        token.glueToPrevious === undefined ? false : token.glueToPrevious === true;
      if (token.glueToPrevious !== undefined && typeof token.glueToPrevious !== "boolean") {
        return failure(400, `invalid glueToPrevious at sentence ${sortOrder}, index ${t}`);
      }

      if (token.kind === "word") {
        const vocabWordId = parsePositiveInt(token.vocabWordId);
        if (vocabWordId == null) {
          return failure(
            400,
            `word token requires vocabWordId at sentence ${sortOrder}, index ${t}`,
          );
        }
        storyWordIds.add(vocabWordId);
        tokens.push({
          sortOrder: tokenSortOrder,
          kind: "word",
          vocabWordId,
          baseForm,
          l1Text,
          glueToPrevious,
        });
      } else {
        if (token.vocabWordId != null && token.vocabWordId !== undefined) {
          return failure(
            400,
            `punct token must not have vocabWordId at sentence ${sortOrder}, index ${t}`,
          );
        }
        tokens.push({
          sortOrder: tokenSortOrder,
          kind: "punct",
          vocabWordId: null,
          baseForm,
          l1Text,
          glueToPrevious,
        });
      }
    }

    sentences.push({ sortOrder, tokens });
  }

  const levels: ParsedUnlockLevel[] = [];
  const levelNumbers = new Set<number>();

  for (let i = 0; i < body.unlockLevels.length; i++) {
    const levelRaw = body.unlockLevels[i];
    if (levelRaw == null || typeof levelRaw !== "object") {
      return failure(400, `invalid unlock level at index ${i}`);
    }
    const levelEntry = levelRaw as Record<string, unknown>;
    const level = parsePositiveInt(levelEntry.level);
    if (level == null) {
      return failure(400, `invalid unlock level at index ${i}`);
    }
    if (levelNumbers.has(level)) {
      return failure(400, `duplicate unlock level ${level}`);
    }
    levelNumbers.add(level);

    const labelParsed = normalizeLabel(levelEntry.label);
    if (levelEntry.label !== undefined && labelParsed === null && levelEntry.label !== null) {
      return failure(400, `invalid unlock level label at level ${level}`);
    }

    if (!Array.isArray(levelEntry.wordIds)) {
      return failure(400, `wordIds must be an array at level ${level}`);
    }

    const wordIds: number[] = [];
    const seenInLevel = new Set<number>();
    for (let w = 0; w < levelEntry.wordIds.length; w++) {
      const wordId = parsePositiveInt(levelEntry.wordIds[w]);
      if (wordId == null) {
        return failure(400, `invalid wordId at level ${level}, index ${w}`);
      }
      if (seenInLevel.has(wordId)) {
        return failure(400, `duplicate wordId ${wordId} at level ${level}`);
      }
      if (!storyWordIds.has(wordId)) {
        return failure(
          400,
          `unlock wordId ${wordId} is not used in story word tokens`,
        );
      }
      seenInLevel.add(wordId);
      wordIds.push(wordId);
    }

    const label: string | null = labelParsed === undefined ? null : labelParsed;
    levels.push({
      level,
      label,
      wordIds,
    });
  }

  const sortedLevels = [...levels].sort((a, b) => a.level - b.level);
  for (let i = 0; i < sortedLevels.length; i++) {
    if (sortedLevels[i]!.level !== i + 1) {
      return failure(400, "unlock levels must be contiguous from 1");
    }
  }

  return {
    ok: true as const,
    content: {
      sentences: sentences.sort((a, b) => a.sortOrder - b.sortOrder),
      unlockLevels: sortedLevels,
    },
  };
}

export function maxUnlockLevel(
  levels: readonly { level: number }[],
): number {
  let max = 0;
  for (const entry of levels) {
    if (entry.level > max) {
      max = entry.level;
    }
  }
  return max;
}

export function clampUnlockedLevel(
  unlockedLevel: number,
  maxLevel: number,
): number {
  if (!Number.isFinite(unlockedLevel) || unlockedLevel < 0) {
    return 0;
  }
  return Math.min(Math.floor(unlockedLevel), Math.max(0, maxLevel));
}

export function collectStoryWordIds(story: StoryGraphRow): number[] {
  const ids = new Set<number>();
  for (const sentence of story.sentences) {
    for (const token of sentence.tokens) {
      if (token.kind === "word" && token.vocabWordId != null) {
        ids.add(token.vocabWordId);
      }
    }
  }
  return [...ids];
}

export function unlockLevelsForShared(
  story: StoryGraphRow,
): AdaptiveStoryUnlockLevelInput[] {
  return story.unlockLevels.map((level) => ({
    level: level.level,
    wordIds: level.words.map((word) => word.vocabWordId),
  }));
}

export function computeStoryProgress(
  unlockedLevel: number,
  story: StoryGraphRow,
): {
  unlockedLevel: number;
  maxLevel: number;
  unlockedWordIds: number[];
  totalUniqueWords: number;
  percent: number;
} {
  const maxLevel = maxUnlockLevel(story.unlockLevels);
  const clamped = clampUnlockedLevel(unlockedLevel, maxLevel);
  const levels = unlockLevelsForShared(story);
  const unlockedWordIds = resolveUnlockedWordIds(clamped, levels);
  const storyWordIdSet = new Set(collectStoryWordIds(story));
  const unlockedUniqueWordCount = unlockedWordIds.filter((id) =>
    storyWordIdSet.has(id),
  ).length;
  const totalUniqueWords = storyWordIdSet.size;
  const percent = progressPercent(unlockedUniqueWordCount, totalUniqueWords);
  return {
    unlockedLevel: clamped,
    maxLevel,
    unlockedWordIds,
    totalUniqueWords,
    percent,
  };
}

function mapToken(token: StoryGraphRow["sentences"][number]["tokens"][number]) {
  return {
    id: token.id,
    sortOrder: token.sortOrder,
    kind: token.kind,
    vocabWordId: token.vocabWordId,
    baseForm: token.baseForm,
    l1Text: token.l1Text,
    glueToPrevious: token.glueToPrevious,
  };
}

function mapStoryGraph(story: StoryGraphRow) {
  return {
    id: story.id,
    title: story.title,
    slug: story.slug,
    primaryLanguageId: story.primaryLanguageId,
    learningLanguageId: story.learningLanguageId,
    status: story.status,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
    sentences: story.sentences.map((sentence) => ({
      id: sentence.id,
      sortOrder: sentence.sortOrder,
      tokens: sentence.tokens.map(mapToken),
    })),
    unlockLevels: story.unlockLevels.map((level) => ({
      id: level.id,
      level: level.level,
      label: level.label,
      words: level.words.map((word) => ({
        vocabWordId: word.vocabWordId,
        sortOrder: word.sortOrder,
      })),
      wordIds: level.words.map((word) => word.vocabWordId),
    })),
  };
}

async function assertLanguagesExist(
  primaryLanguageId: number,
  learningLanguageId: number,
): Promise<ServiceFailure | null> {
  const languages = await languageRepository.findLanguagesByIds([
    primaryLanguageId,
    learningLanguageId,
  ]);
  const found = new Set(languages.map((row) => row.id));
  if (!found.has(primaryLanguageId)) {
    return failure(404, "primary language not found");
  }
  if (!found.has(learningLanguageId)) {
    return failure(404, "learning language not found");
  }
  return null;
}

export async function listAdminStories(input: {
  status?: unknown;
  page: number;
  pageSize: number;
}) {
  let status: StoryStatus | undefined;
  if (input.status !== undefined && input.status !== "") {
    if (!isStoryStatus(input.status)) {
      return failure(400, "invalid status");
    }
    status = input.status;
  }

  const result = await storyRepository.selectStories({
    status,
    page: input.page,
    pageSize: input.pageSize,
  });

  return {
    ok: true as const,
    items: result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      primaryLanguageId: row.primaryLanguageId,
      learningLanguageId: row.learningLanguageId,
      status: row.status,
      sentenceCount: row._count.sentences,
      unlockLevelCount: row._count.unlockLevels,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
    },
  };
}

export async function createAdminStory(input: {
  title: unknown;
  primaryLanguageId: unknown;
  learningLanguageId: unknown;
  status?: unknown;
  slug?: unknown;
}) {
  const title = normalizeTitle(input.title);
  if (!title) {
    return failure(400, "title is required");
  }

  const primaryLanguageId = parsePositiveInt(input.primaryLanguageId);
  if (primaryLanguageId == null) {
    return failure(400, "invalid primary language id");
  }
  const learningLanguageId = parsePositiveInt(input.learningLanguageId);
  if (learningLanguageId == null) {
    return failure(400, "invalid learning language id");
  }

  let status: StoryStatus = "draft";
  if (input.status !== undefined) {
    if (!isStoryStatus(input.status)) {
      return failure(400, "invalid status");
    }
    status = input.status;
  }

  const slug = normalizeSlug(input.slug);
  if (input.slug !== undefined && slug === null && input.slug !== null) {
    return failure(400, "invalid slug");
  }

  const languagesError = await assertLanguagesExist(
    primaryLanguageId,
    learningLanguageId,
  );
  if (languagesError) {
    return languagesError;
  }

  if (slug && (await storyRepository.isStorySlugTaken(slug))) {
    return failure(409, "slug already exists");
  }

  const story = await storyRepository.insertStory({
    title,
    slug: slug ?? null,
    primaryLanguageId,
    learningLanguageId,
    status,
  });

  return { ok: true as const, story: mapStoryGraph(story) };
}

export async function getAdminStory(storyId: number) {
  if (!Number.isInteger(storyId) || storyId < 1) {
    return failure(400, "invalid story id");
  }
  const story = await storyRepository.selectStoryById(storyId);
  if (!story) {
    return failure(404, "story not found");
  }
  return { ok: true as const, story: mapStoryGraph(story) };
}

export async function updateAdminStory(
  storyId: number,
  input: {
    title?: unknown;
    primaryLanguageId?: unknown;
    learningLanguageId?: unknown;
    status?: unknown;
    slug?: unknown;
  },
) {
  if (!Number.isInteger(storyId) || storyId < 1) {
    return failure(400, "invalid story id");
  }

  const existing = await storyRepository.selectStoryById(storyId);
  if (!existing) {
    return failure(404, "story not found");
  }

  const data: {
    title?: string;
    slug?: string | null;
    primaryLanguageId?: number;
    learningLanguageId?: number;
    status?: StoryStatus;
  } = {};

  if (input.title !== undefined) {
    const title = normalizeTitle(input.title);
    if (!title) {
      return failure(400, "title is required");
    }
    data.title = title;
  }

  if (input.slug !== undefined) {
    const slug = normalizeSlug(input.slug);
    if (slug === null && input.slug !== null) {
      return failure(400, "invalid slug");
    }
    if (typeof slug === "string" && (await storyRepository.isStorySlugTaken(slug, storyId))) {
      return failure(409, "slug already exists");
    }
    data.slug = slug ?? null;
  }

  if (input.primaryLanguageId !== undefined) {
    const primaryLanguageId = parsePositiveInt(input.primaryLanguageId);
    if (primaryLanguageId == null) {
      return failure(400, "invalid primary language id");
    }
    data.primaryLanguageId = primaryLanguageId;
  }

  if (input.learningLanguageId !== undefined) {
    const learningLanguageId = parsePositiveInt(input.learningLanguageId);
    if (learningLanguageId == null) {
      return failure(400, "invalid learning language id");
    }
    data.learningLanguageId = learningLanguageId;
  }

  if (input.status !== undefined) {
    if (!isStoryStatus(input.status)) {
      return failure(400, "invalid status");
    }
    data.status = input.status;
  }

  if (Object.keys(data).length === 0) {
    return failure(400, "nothing to update");
  }

  const nextPrimary = data.primaryLanguageId ?? existing.primaryLanguageId;
  const nextLearning = data.learningLanguageId ?? existing.learningLanguageId;
  if (
    data.primaryLanguageId !== undefined ||
    data.learningLanguageId !== undefined
  ) {
    const languagesError = await assertLanguagesExist(nextPrimary, nextLearning);
    if (languagesError) {
      return languagesError;
    }
  }

  const story = await storyRepository.updateStoryById(storyId, data);
  return { ok: true as const, story: mapStoryGraph(story) };
}

export async function deleteAdminStory(storyId: number) {
  if (!Number.isInteger(storyId) || storyId < 1) {
    return failure(400, "invalid story id");
  }
  const existing = await storyRepository.selectStoryById(storyId);
  if (!existing) {
    return failure(404, "story not found");
  }
  await storyRepository.deleteStoryById(storyId);
  return { ok: true as const };
}

export async function replaceAdminStoryContent(storyId: number, input: unknown) {
  if (!Number.isInteger(storyId) || storyId < 1) {
    return failure(400, "invalid story id");
  }

  const existing = await storyRepository.selectStoryById(storyId);
  if (!existing) {
    return failure(404, "story not found");
  }

  const parsed = validateStoryContent(input);
  if (parsed.ok === false) {
    return parsed;
  }

  const allWordIds = [
    ...new Set(
      parsed.content.sentences.flatMap((sentence) =>
        sentence.tokens
          .filter((token) => token.kind === "word" && token.vocabWordId != null)
          .map((token) => token.vocabWordId as number),
      ),
    ),
  ];

  const existingWordIds = await storyRepository.selectVocabWordIdsExisting(allWordIds);
  for (const wordId of allWordIds) {
    if (!existingWordIds.has(wordId)) {
      return failure(400, `vocab word ${wordId} not found`);
    }
  }

  const sentences: StorySentenceInsert[] = parsed.content.sentences;
  const unlockLevels: StoryUnlockLevelInsert[] = parsed.content.unlockLevels;
  const story = await storyRepository.replaceStoryContent(storyId, {
    sentences,
    unlockLevels,
  });

  return { ok: true as const, story: mapStoryGraph(story) };
}

function mapUserStoryDetail(
  story: StoryGraphRow,
  unlockedLevelRaw: number,
) {
  const progress = computeStoryProgress(unlockedLevelRaw, story);
  return {
    id: story.id,
    title: story.title,
    slug: story.slug,
    primaryLanguageId: story.primaryLanguageId,
    learningLanguageId: story.learningLanguageId,
    status: story.status,
    sentences: story.sentences.map((sentence) => ({
      id: sentence.id,
      sortOrder: sentence.sortOrder,
      tokens: sentence.tokens.map(mapToken),
    })),
    unlockLevels: story.unlockLevels.map((level) => ({
      id: level.id,
      level: level.level,
      label: level.label,
      wordIds: level.words.map((word) => word.vocabWordId),
    })),
    unlockedLevel: progress.unlockedLevel,
    maxLevel: progress.maxLevel,
    unlockedWordIds: progress.unlockedWordIds,
    totalUniqueWords: progress.totalUniqueWords,
    percent: progress.percent,
  };
}

export async function listMyStories(userId: number) {
  if (!Number.isInteger(userId) || userId < 1) {
    return failure(401, "unauthorized");
  }

  const stories = await storyRepository.selectPublishedStories();
  const progressMap = await storyRepository.selectProgressForUser(
    userId,
    stories.map((story) => story.id),
  );

  const items = [];
  for (const story of stories) {
    const rawLevel = progressMap.get(story.id) ?? 0;
    const progress = computeStoryProgress(rawLevel, story);
    if (progressMap.has(story.id) && progress.unlockedLevel !== rawLevel) {
      await storyRepository.updateProgressUnlockedLevel(
        userId,
        story.id,
        progress.unlockedLevel,
      );
    }
    items.push({
      id: story.id,
      title: story.title,
      slug: story.slug,
      primaryLanguageId: story.primaryLanguageId,
      learningLanguageId: story.learningLanguageId,
      unlockedLevel: progress.unlockedLevel,
      maxLevel: progress.maxLevel,
      percent: progress.percent,
      totalUniqueWords: progress.totalUniqueWords,
    });
  }

  return { ok: true as const, items };
}

export async function getMyStory(userId: number, storyId: number) {
  if (!Number.isInteger(userId) || userId < 1) {
    return failure(401, "unauthorized");
  }
  if (!Number.isInteger(storyId) || storyId < 1) {
    return failure(400, "invalid story id");
  }

  const story = await storyRepository.selectPublishedStoryById(storyId);
  if (!story) {
    return failure(404, "story not found");
  }

  const progressRow = await storyRepository.selectOrCreateProgress(userId, storyId);
  const progress = computeStoryProgress(progressRow.unlockedLevel, story);
  if (progress.unlockedLevel !== progressRow.unlockedLevel) {
    await storyRepository.updateProgressUnlockedLevel(
      userId,
      storyId,
      progress.unlockedLevel,
    );
  }

  return {
    ok: true as const,
    story: mapUserStoryDetail(story, progress.unlockedLevel),
  };
}

export async function advanceMyStoryLevel(userId: number, storyId: number) {
  if (!Number.isInteger(userId) || userId < 1) {
    return failure(401, "unauthorized");
  }
  if (!Number.isInteger(storyId) || storyId < 1) {
    return failure(400, "invalid story id");
  }

  const story = await storyRepository.selectPublishedStoryById(storyId);
  if (!story) {
    return failure(404, "story not found");
  }

  const progressRow = await storyRepository.selectOrCreateProgress(userId, storyId);
  const maxLevel = maxUnlockLevel(story.unlockLevels);
  const current = clampUnlockedLevel(progressRow.unlockedLevel, maxLevel);
  const next = clampUnlockedLevel(current + 1, maxLevel);

  await storyRepository.updateProgressUnlockedLevel(userId, storyId, next);

  return {
    ok: true as const,
    story: mapUserStoryDetail(story, next),
  };
}
