import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";

const QUALIFICATION_TEMPLATE_KEY = "qualification_questionnaire";

type QualificationTemplateValue = {
  questions: Array<{
    id: string;
    prompt: string;
    options: string[];
  }>;
};

function normalizeTemplateValue(
  value: unknown,
): QualificationTemplateValue | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { questions?: unknown };
  if (!Array.isArray(candidate.questions)) {
    return null;
  }
  const questions = candidate.questions
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const question = item as {
        id?: unknown;
        prompt?: unknown;
        options?: unknown;
      };
      const prompt =
        typeof question.prompt === "string" ? question.prompt.trim() : "";
      const id =
        typeof question.id === "string" && question.id.trim().length > 0
          ? question.id.trim()
          : `q${index + 1}`;
      if (!prompt || !Array.isArray(question.options)) {
        return null;
      }
      const options = question.options
        .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
        .filter((opt) => opt.length > 0);
      return { id, prompt, options };
    })
    .filter(
      (
        item,
      ): item is {
        id: string;
        prompt: string;
        options: string[];
      } => item !== null,
    );
  return { questions };
}

export async function selectQualificationTemplate(): Promise<QualificationTemplateValue | null> {
  const rows = await getPrisma().$queryRaw<Array<{ value: unknown }>>(
    Prisma.sql`SELECT value FROM app_settings WHERE key = ${QUALIFICATION_TEMPLATE_KEY} LIMIT 1`,
  );
  return normalizeTemplateValue(rows[0]?.value ?? null);
}

export async function upsertQualificationTemplate(
  questions: Array<{ id: string; prompt: string; options: string[] }>,
): Promise<void> {
  const payload = JSON.stringify({ questions });
  await getPrisma().$executeRaw(
    Prisma.sql`
      INSERT INTO app_settings (key, value, created_at, updated_at)
      VALUES (${QUALIFICATION_TEMPLATE_KEY}, ${payload}::jsonb, NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `,
  );
}

export type QualificationSubmissionListRow = {
  id: string;
  userId: number;
  userName: string;
  email: string;
  answers: unknown;
  submittedAt: Date;
  qualificationCompletedAt: Date | null;
};

export async function selectQualificationSubmissions(input: {
  page: number;
  pageSize: number;
  search?: string;
  status?: "completed" | "skipped";
}): Promise<{ items: QualificationSubmissionListRow[]; total: number }> {
  const offset = (input.page - 1) * input.pageSize;
  const searchPattern =
    input.search && input.search.trim().length > 0
      ? `%${input.search.trim()}%`
      : null;

  const statusFilter =
    input.status === "completed"
      ? Prisma.sql`jsonb_typeof(qs.answers) = 'array'`
      : input.status === "skipped"
        ? Prisma.sql`qs.answers->'meta'->>'status' = 'skipped'`
        : Prisma.sql`TRUE`;

  const searchFilter = searchPattern
    ? Prisma.sql`(u.user_name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})`
    : Prisma.sql`TRUE`;

  const countRows = await getPrisma().$queryRaw<Array<{ total: bigint }>>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM qualification_submissions qs
      INNER JOIN users u ON u.id = qs.user_id
      WHERE ${statusFilter}
        AND ${searchFilter}
    `,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await getPrisma().$queryRaw<
    Array<{
      id: string;
      user_id: number;
      user_name: string;
      email: string;
      answers: unknown;
      submitted_at: Date;
      qualification_completed_at: Date | null;
    }>
  >(
    Prisma.sql`
      SELECT
        qs.id,
        qs.user_id,
        u.user_name,
        u.email,
        qs.answers,
        qs.submitted_at,
        u.qualification_completed_at
      FROM qualification_submissions qs
      INNER JOIN users u ON u.id = qs.user_id
      WHERE ${statusFilter}
        AND ${searchFilter}
      ORDER BY qs.submitted_at DESC
      LIMIT ${input.pageSize}
      OFFSET ${offset}
    `,
  );

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      email: row.email,
      answers: row.answers,
      submittedAt: row.submitted_at,
      qualificationCompletedAt: row.qualification_completed_at,
    })),
  };
}
