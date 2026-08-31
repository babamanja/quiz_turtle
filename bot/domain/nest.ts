import type { Prisma, PrismaClient } from '@prisma/client';
import {
  collectNestAlternateTexts,
  mergeVocabAlternateAnswers,
  type NestMember,
} from '@language-turtle/shared';

export async function ensureVocabWordWithNest(
  prisma: PrismaClient,
  languageId: number,
  text: string,
): Promise<{ id: number; text: string; nestId: number }> {
  const existing = await prisma.vocabWord.findUnique({
    where: { languageId_text: { languageId, text } },
    select: { id: true, text: true, nestId: true },
  });
  if (existing) {
    return existing;
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const nest = await tx.lexicalNest.create({
      data: { languageId },
      select: { id: true },
    });
    const word = await tx.vocabWord.create({
      data: {
        languageId,
        text,
        nestId: nest.id,
      },
      select: { id: true, text: true, nestId: true },
    });
    return word;
  });
}

export async function selectNestMembersForWordIds(
  prisma: PrismaClient,
  wordIds: number[],
): Promise<Map<number, NestMember[]>> {
  const uniqueWordIds = [...new Set(wordIds)];
  const result = new Map<number, NestMember[]>();
  for (const wordId of uniqueWordIds) {
    result.set(wordId, []);
  }
  if (uniqueWordIds.length === 0) {
    return result;
  }

  const words = (await prisma.vocabWord.findMany({
    where: { id: { in: uniqueWordIds } },
    select: { id: true, nestId: true },
  })) as Array<{ id: number; nestId: number }>;

  const nestIds = [...new Set(words.map((word: { nestId: number }) => word.nestId))];
  const members = (await prisma.vocabWord.findMany({
    where: { nestId: { in: nestIds } },
    select: { id: true, text: true, nestId: true },
    orderBy: { text: 'asc' },
  })) as Array<{ id: number; text: string; nestId: number }>;

  const membersByNest = new Map<number, NestMember[]>();
  for (const nestId of nestIds) {
    membersByNest.set(nestId, []);
  }
  for (const member of members) {
    membersByNest.get(member.nestId)!.push({ wordId: member.id, text: member.text });
  }

  for (const word of words) {
    result.set(word.id, membersByNest.get(word.nestId) ?? []);
  }

  return result;
}

export function nestAlternateTextsForWord(
  members: NestMember[],
  expectedText: string,
): string[] {
  return collectNestAlternateTexts(members, expectedText);
}

export { mergeVocabAlternateAnswers };
