import type { Prisma, StoryStatus, StoryTokenKind } from "@prisma/client";

import { getPrisma } from "./prisma.js";

const storyListSelect = {
  id: true,
  title: true,
  slug: true,
  primaryLanguageId: true,
  learningLanguageId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { sentences: true, unlockLevels: true } },
} satisfies Prisma.StorySelect;

const storyGraphInclude = {
  sentences: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      tokens: {
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
  unlockLevels: {
    orderBy: { level: "asc" as const },
    include: {
      words: {
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
} satisfies Prisma.StoryInclude;

export type StoryListRow = Prisma.StoryGetPayload<{ select: typeof storyListSelect }>;
export type StoryGraphRow = Prisma.StoryGetPayload<{ include: typeof storyGraphInclude }>;

export type StoryTokenInsert = {
  sortOrder: number;
  kind: StoryTokenKind;
  vocabWordId: number | null;
  baseForm: string;
  l1Text: string;
  glueToPrevious: boolean;
};

export type StorySentenceInsert = {
  sortOrder: number;
  tokens: StoryTokenInsert[];
};

export type StoryUnlockLevelInsert = {
  level: number;
  label: string | null;
  wordIds: number[];
};

export async function selectStories(input: {
  status?: StoryStatus;
  page: number;
  pageSize: number;
}): Promise<{ rows: StoryListRow[]; total: number }> {
  const where: Prisma.StoryWhereInput =
    input.status != null ? { status: input.status } : {};
  const offset = (input.page - 1) * input.pageSize;

  const [rows, total] = await Promise.all([
    getPrisma().story.findMany({
      where,
      select: storyListSelect,
      orderBy: [{ id: "desc" }],
      skip: offset,
      take: input.pageSize,
    }),
    getPrisma().story.count({ where }),
  ]);

  return { rows, total };
}

export async function selectStoryById(storyId: number): Promise<StoryGraphRow | null> {
  return getPrisma().story.findUnique({
    where: { id: storyId },
    include: storyGraphInclude,
  });
}

export async function selectPublishedStories(): Promise<StoryGraphRow[]> {
  return getPrisma().story.findMany({
    where: { status: "published" },
    include: storyGraphInclude,
    orderBy: [{ id: "desc" }],
  });
}

export async function selectPublishedStoryById(
  storyId: number,
): Promise<StoryGraphRow | null> {
  return getPrisma().story.findFirst({
    where: { id: storyId, status: "published" },
    include: storyGraphInclude,
  });
}

export async function insertStory(input: {
  title: string;
  slug: string | null;
  primaryLanguageId: number;
  learningLanguageId: number;
  status: StoryStatus;
}): Promise<StoryGraphRow> {
  return getPrisma().story.create({
    data: {
      title: input.title,
      slug: input.slug,
      primaryLanguageId: input.primaryLanguageId,
      learningLanguageId: input.learningLanguageId,
      status: input.status,
    },
    include: storyGraphInclude,
  });
}

export async function updateStoryById(
  storyId: number,
  data: {
    title?: string;
    slug?: string | null;
    primaryLanguageId?: number;
    learningLanguageId?: number;
    status?: StoryStatus;
  },
): Promise<StoryGraphRow> {
  return getPrisma().story.update({
    where: { id: storyId },
    data,
    include: storyGraphInclude,
  });
}

export async function deleteStoryById(storyId: number): Promise<void> {
  await getPrisma().story.delete({ where: { id: storyId } });
}

export async function replaceStoryContent(
  storyId: number,
  input: {
    sentences: StorySentenceInsert[];
    unlockLevels: StoryUnlockLevelInsert[];
  },
): Promise<StoryGraphRow> {
  return getPrisma().$transaction(async (tx) => {
    await tx.storySentence.deleteMany({ where: { storyId } });
    await tx.storyUnlockLevel.deleteMany({ where: { storyId } });

    for (const sentence of input.sentences) {
      await tx.storySentence.create({
        data: {
          storyId,
          sortOrder: sentence.sortOrder,
          tokens: {
            create: sentence.tokens.map((token) => ({
              sortOrder: token.sortOrder,
              kind: token.kind,
              vocabWordId: token.vocabWordId,
              baseForm: token.baseForm,
              l1Text: token.l1Text,
              glueToPrevious: token.glueToPrevious,
            })),
          },
        },
      });
    }

    for (const level of input.unlockLevels) {
      await tx.storyUnlockLevel.create({
        data: {
          storyId,
          level: level.level,
          label: level.label,
          words: {
            create: level.wordIds.map((vocabWordId, index) => ({
              vocabWordId,
              sortOrder: index,
            })),
          },
        },
      });
    }

    const story = await tx.story.findUniqueOrThrow({
      where: { id: storyId },
      include: storyGraphInclude,
    });
    return story;
  });
}

export async function selectProgressForUser(
  userId: number,
  storyIds: number[],
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (storyIds.length === 0) {
    return result;
  }
  const rows = await getPrisma().userStoryProgress.findMany({
    where: { userId, storyId: { in: storyIds } },
    select: { storyId: true, unlockedLevel: true },
  });
  for (const row of rows) {
    result.set(row.storyId, row.unlockedLevel);
  }
  return result;
}

export async function selectOrCreateProgress(
  userId: number,
  storyId: number,
): Promise<{ unlockedLevel: number }> {
  const existing = await getPrisma().userStoryProgress.findUnique({
    where: { userId_storyId: { userId, storyId } },
    select: { unlockedLevel: true },
  });
  if (existing) {
    return existing;
  }
  return getPrisma().userStoryProgress.create({
    data: { userId, storyId, unlockedLevel: 0 },
    select: { unlockedLevel: true },
  });
}

export async function updateProgressUnlockedLevel(
  userId: number,
  storyId: number,
  unlockedLevel: number,
): Promise<{ unlockedLevel: number }> {
  return getPrisma().userStoryProgress.upsert({
    where: { userId_storyId: { userId, storyId } },
    create: { userId, storyId, unlockedLevel },
    update: { unlockedLevel },
    select: { unlockedLevel: true },
  });
}

export async function selectVocabWordIdsExisting(
  wordIds: number[],
): Promise<Set<number>> {
  const unique = [...new Set(wordIds)];
  if (unique.length === 0) {
    return new Set();
  }
  const rows = await getPrisma().vocabWord.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

export async function isStorySlugTaken(
  slug: string,
  excludeStoryId?: number,
): Promise<boolean> {
  const existing = await getPrisma().story.findFirst({
    where: {
      slug,
      ...(excludeStoryId != null ? { id: { not: excludeStoryId } } : {}),
    },
    select: { id: true },
  });
  return existing != null;
}
