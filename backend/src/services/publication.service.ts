import { getPrisma } from "../db/prisma.js";
import * as storyRepository from "../db/storyRepository.js";
import { taughtLanguageDenied } from "./teacherScope.js";

function sentencesFromText(text: string) {
  const parts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks = parts.length > 0 ? parts : [text.trim()];
  return chunks.map((sentence, sentenceIndex) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    return {
      sortOrder: sentenceIndex,
      tokens: words.map((word, tokenIndex) => ({
        sortOrder: tokenIndex,
        kind: "word" as const,
        vocabWordId: null,
        baseForm: word,
        l1Text: word,
        glueToPrevious: false,
      })),
    };
  });
}

export async function setDictionaryPublic(userId: number, dictionaryId: number, isPublic: boolean) {
  const dictionary = await getPrisma().dictionary.findUnique({
    where: { id: dictionaryId },
    select: { id: true, creatorId: true },
  });
  if (!dictionary || dictionary.creatorId !== userId) {
    return { ok: false as const, status: 404, error: "dictionary not found" };
  }
  const updated = await getPrisma().dictionary.update({
    where: { id: dictionaryId },
    data: { isPublic, verifiedAt: null },
    select: { id: true, isPublic: true, verifiedAt: true },
  });
  return { ok: true as const, dictionary: updated };
}

export async function listPublicDictionaries() {
  const rows = await getPrisma().dictionary.findMany({
    where: { isPublic: true },
    orderBy: { id: "desc" },
    include: {
      creator: { select: { userName: true } },
      _count: { select: { entries: true } },
      entries: {
        take: 20,
        select: {
          vocabPair: { select: { wordA: { select: { text: true } }, wordB: { select: { text: true } } } },
        },
      },
    },
  });
  return {
    ok: true as const,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      creatorName: row.creator.userName,
      entryCount: row._count.entries,
      verified: row.verifiedAt != null,
      words: row.entries.map(
        (entry) => `${entry.vocabPair.wordA.text} → ${entry.vocabPair.wordB.text}`,
      ),
    })),
  };
}

export async function publishMyWord(userId: number, vocabPairId: number) {
  const entry = await getPrisma().dictionaryEntry.findFirst({
    where: { vocabPairId, dictionary: { members: { some: { userId } } } },
    select: { vocabPairId: true },
  });
  if (!entry) {
    return { ok: false as const, status: 404, error: "word not found" };
  }
  const pair = await getPrisma().vocabPair.update({
    where: { id: vocabPairId },
    data: {
      publishedAt: new Date(),
      authorId: userId,
      verifiedAt: null,
    },
    select: { id: true, publishedAt: true, verifiedAt: true },
  });
  return { ok: true as const, word: { id: pair.id, verified: pair.verifiedAt != null } };
}

export async function publishMyStory(userId: number, input: { title: unknown; text: unknown }) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!title || !text) {
    return { ok: false as const, status: 400, error: "title and text required" };
  }
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { primaryLanguageId: true, learningLanguageId: true },
  });
  if (!user?.primaryLanguageId || !user.learningLanguageId) {
    return { ok: false as const, status: 400, error: "language pair required" };
  }
  const story = await storyRepository.insertStory({
    title,
    slug: null,
    primaryLanguageId: user.primaryLanguageId,
    learningLanguageId: user.learningLanguageId,
    status: "published",
    authorId: userId,
    verifiedAt: null,
  });
  await storyRepository.replaceStoryContent(story.id, {
    sentences: sentencesFromText(text),
    unlockLevels: [],
  });
  return { ok: true as const, storyId: story.id };
}

async function assertTeacherLanguage(taughtLanguageIds: readonly number[], languageId: number | null) {
  return taughtLanguageDenied(taughtLanguageIds, languageId);
}

export async function verifyStory(storyId: number, taughtLanguageIds: readonly number[]) {
  const story = await getPrisma().story.findUnique({
    where: { id: storyId },
    select: { id: true, learningLanguageId: true, status: true },
  });
  if (!story || story.status !== "published") {
    return { ok: false as const, status: 404, error: "story not found" };
  }
  const denied = await assertTeacherLanguage(taughtLanguageIds, story.learningLanguageId);
  if (denied) return denied;
  await getPrisma().story.update({
    where: { id: storyId },
    data: { verifiedAt: new Date() },
  });
  return { ok: true as const };
}

export async function verifyDictionary(dictionaryId: number, taughtLanguageIds: readonly number[]) {
  const dictionary = await getPrisma().dictionary.findUnique({
    where: { id: dictionaryId },
    select: {
      id: true,
      isPublic: true,
      entries: {
        take: 1,
        select: { vocabPair: { select: { learningLanguageId: true } } },
      },
    },
  });
  if (!dictionary?.isPublic) {
    return { ok: false as const, status: 404, error: "dictionary not found" };
  }
  const languageId = dictionary.entries[0]?.vocabPair.learningLanguageId ?? null;
  if (languageId != null) {
    const denied = await assertTeacherLanguage(taughtLanguageIds, languageId);
    if (denied) return denied;
  }
  await getPrisma().dictionary.update({
    where: { id: dictionaryId },
    data: { verifiedAt: new Date() },
  });
  return { ok: true as const };
}

export async function verifyWord(vocabPairId: number, taughtLanguageIds: readonly number[]) {
  const pair = await getPrisma().vocabPair.findUnique({
    where: { id: vocabPairId },
    select: { id: true, publishedAt: true, learningLanguageId: true },
  });
  if (!pair?.publishedAt) {
    return { ok: false as const, status: 404, error: "word not found" };
  }
  const denied = await assertTeacherLanguage(taughtLanguageIds, pair.learningLanguageId);
  if (denied) return denied;
  await getPrisma().vocabPair.update({
    where: { id: vocabPairId },
    data: { verifiedAt: new Date() },
  });
  return { ok: true as const };
}

export async function listReview(taughtLanguageIds: readonly number[]) {
  const [stories, dictionaries, words] = await Promise.all([
    getPrisma().story.findMany({
      where: {
        status: "published",
        verifiedAt: null,
        learningLanguageId: { in: [...taughtLanguageIds] },
      },
      select: { id: true, title: true },
      orderBy: { id: "desc" },
      take: 50,
    }),
    getPrisma().dictionary.findMany({
      where: { isPublic: true, verifiedAt: null },
      select: { id: true, name: true, creator: { select: { userName: true } } },
      orderBy: { id: "desc" },
      take: 50,
    }),
    getPrisma().vocabPair.findMany({
      where: {
        publishedAt: { not: null },
        verifiedAt: null,
        learningLanguageId: { in: [...taughtLanguageIds] },
      },
      select: {
        id: true,
        wordA: { select: { text: true } },
        wordB: { select: { text: true } },
      },
      orderBy: { id: "desc" },
      take: 50,
    }),
  ]);
  return {
    ok: true as const,
    stories,
    dictionaries: dictionaries.map((row) => ({
      id: row.id,
      name: row.name,
      creatorName: row.creator.userName,
    })),
    words: words.map((row) => ({
      id: row.id,
      label: `${row.wordA.text} → ${row.wordB.text}`,
    })),
  };
}
