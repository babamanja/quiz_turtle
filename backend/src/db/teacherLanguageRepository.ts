import { getPrisma } from "./prisma.js";

export async function listTeacherLanguageIds(userId: number): Promise<number[]> {
  const rows = await getPrisma().teacherLanguage.findMany({
    where: { userId },
    select: { languageId: true },
    orderBy: { languageId: "asc" },
  });
  return rows.map((row) => row.languageId);
}

export async function replaceTeacherLanguages(
  userId: number,
  languageIds: readonly number[],
): Promise<number[]> {
  const unique = [...new Set(languageIds)].sort((left, right) => left - right);
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.teacherLanguage.deleteMany({ where: { userId } });
    if (unique.length > 0) {
      await tx.teacherLanguage.createMany({
        data: unique.map((languageId) => ({ userId, languageId })),
      });
    }
  });
  return unique;
}
