import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { mapTranslationRow, translationSelect } from "./vocabPairRepository.js";

export type AdminUserRow = {
  id: number;
  userName: string;
  email: string | null;
  telegramId: string | null;
  role: "user" | "admin";
  hasPassword: boolean;
  hasGoogle: boolean;
  hasTelegram: boolean;
  vocabPairCount: number;
};

export type AdminUsersListQuery = {
  page: number;
  pageSize: number;
  sortBy: "id" | "userName" | "email" | "role";
  sortOrder: "asc" | "desc";
  role?: "user" | "admin";
  search?: string;
};

export type AdminUserDetailsRow = {
  id: number;
  userName: string;
  email: string | null;
  telegramId: string | null;
  role: "user" | "admin";
  hasPassword: boolean;
  hasGoogle: boolean;
  hasTelegram: boolean;
  vocabPairCount: number;
  taughtLanguageIds: number[];
  subscription: {
    id: string;
    planCode: "basic" | "premium";
    status: "active" | "canceled" | "past_due";
    currentPeriodEnd: string | null;
    createdAt: string;
    paymentId: string | null;
  } | null;
  recentPayments: Array<{
    id: string;
    date: string;
    amount: number;
    currency: string;
    status: "pending" | "succeeded" | "failed" | "refunded";
    transactionType: "payment" | "refund";
    provider: string | null;
  }>;
};

export type AppSettingRow = {
  key: string;
  value: unknown;
};

export type AiUsageRecordRow = {
  id: string;
  feature: string;
  createdAt: string;
  userId: number | null;
  status: "success" | "failed";
  sourceTextLength: number;
  estimatedTokens: number;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  aiTotalTokens: number | null;
  aiModel: string | null;
  errorMessage: string | null;
};

export type AiUsageRecordsQuery = {
  days: number;
  page: number;
  pageSize: number;
  sortBy: "createdAt" | "aiTotalTokens" | "estimatedTokens" | "sourceTextLength";
  sortOrder: "asc" | "desc";
  status?: "success" | "failed";
  userId?: number;
  search?: string;
};

export async function selectAdminUsers(input: AdminUsersListQuery): Promise<{
  rows: AdminUserRow[];
  total: number;
}> {
  const where = {
    deletedAt: null,
    ...(input.role ? { role: input.role } : {}),
    ...(input.search
      ? {
          OR: [
            {
              userName: {
                contains: input.search,
                mode: "insensitive" as const,
              },
            },
            { email: { contains: input.search, mode: "insensitive" as const } },
            {
              telegramUsername: {
                contains: input.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    getPrisma().user.findMany({
      where,
      orderBy: { [input.sortBy]: input.sortOrder },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        auth: true,
        _count: {
          select: {
            userDictionaries: true,
          },
        },
        userDictionaries: {
          where: { isDefault: true },
          select: {
            dictionary: {
              select: {
                _count: { select: { entries: true } },
              },
            },
          },
          take: 1,
        },
      },
    }),
    getPrisma().user.count({ where }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      userName: row.userName,
      email: row.email,
      telegramId: row.telegramId != null ? row.telegramId.toString() : null,
      role: row.role === "admin" ? "admin" : "user",
      hasPassword: Boolean(row.auth?.passwordHash),
      hasGoogle: Boolean(row.auth?.googleSub),
      hasTelegram: row.telegramId != null,
      vocabPairCount: row.userDictionaries[0]?.dictionary._count.entries ?? 0,
    })),
    total,
  };
}

export async function selectAdminUserDetailsById(
  userId: number,
): Promise<AdminUserDetailsRow | null> {
  const row = await getPrisma().user.findUnique({
    where: { id: userId },
    include: {
      auth: true,
      subscription: true,
      payments: {
        orderBy: { date: "desc" },
        take: 10,
      },
      _count: {
        select: {
          userDictionaries: true,
        },
      },
      userDictionaries: {
        where: { isDefault: true },
        select: {
          dictionary: {
            select: {
              _count: { select: { entries: true } },
            },
          },
        },
        take: 1,
      },
      taughtLanguages: {
        select: { languageId: true },
        orderBy: { languageId: "asc" },
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userName: row.userName,
    email: row.email,
    telegramId: row.telegramId != null ? row.telegramId.toString() : null,
    role: row.role === "admin" ? "admin" : "user",
    hasPassword: Boolean(row.auth?.passwordHash),
    hasGoogle: Boolean(row.auth?.googleSub),
    hasTelegram: row.telegramId != null,
    vocabPairCount: row.userDictionaries[0]?.dictionary._count.entries ?? 0,
    taughtLanguageIds: row.taughtLanguages.map((entry) => entry.languageId),
    subscription: row.subscription
      ? {
          id: row.subscription.id,
          planCode: row.subscription.planCode,
          status: row.subscription.status,
          currentPeriodEnd: row.subscription.currentPeriodEnd
            ? row.subscription.currentPeriodEnd.toISOString()
            : null,
          createdAt: row.subscription.createdAt.toISOString(),
          paymentId: row.subscription.paymentId,
        }
      : null,
    recentPayments: row.payments.map((payment) => ({
      id: payment.id,
      date: payment.date.toISOString(),
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      transactionType: payment.transactionType,
      provider: payment.provider,
    })),
  };
}

export async function selectAppSettingByKey(
  key: string,
): Promise<AppSettingRow | null> {
  const rows = await getPrisma().$queryRaw<
    Array<{ key: string; value: unknown }>
  >(Prisma.sql`SELECT key, value FROM app_settings WHERE key = ${key} LIMIT 1`);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    key: row.key,
    value: row.value,
  };
}

export async function upsertAppSetting(
  key: string,
  value: unknown,
): Promise<AppSettingRow> {
  const payload = value as Prisma.InputJsonValue;
  await getPrisma().$executeRaw(
    Prisma.sql`
      INSERT INTO app_settings (key, value, created_at, updated_at)
      VALUES (${key}, ${payload}::jsonb, NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `,
  );
  const row = await selectAppSettingByKey(key);
  if (!row) {
    throw new Error("Failed to store app setting");
  }
  return {
    key: row.key,
    value: row.value,
  };
}

export async function selectAiUsageRecords(
  input: AiUsageRecordsQuery,
): Promise<{ rows: AiUsageRecordRow[]; total: number }> {
  const whereClauses: Prisma.AiUsageAnalyticsWhereInput[] = [
    {
      createdAt: {
        gte: new Date(Date.now() - input.days * 24 * 60 * 60 * 1000),
      },
    },
  ];

  if (input.status) {
    whereClauses.push({ status: input.status === "success" ? "success" : "failed" });
  }
  if (input.userId !== undefined) {
    whereClauses.push({ userId: input.userId });
  }
  if (input.search) {
    whereClauses.push({
      OR: [
        { aiModel: { contains: input.search, mode: "insensitive" } },
        { errorMessage: { contains: input.search, mode: "insensitive" } },
        { feature: { contains: input.search, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.AiUsageAnalyticsWhereInput =
    whereClauses.length === 1 ? whereClauses[0]! : { AND: whereClauses };

  const sortField =
    input.sortBy === "aiTotalTokens"
      ? "aiTotalTokens"
      : input.sortBy === "estimatedTokens"
        ? "estimatedTokens"
        : input.sortBy === "sourceTextLength"
          ? "sourceTextLength"
          : "createdAt";

  const [rows, total] = await Promise.all([
    getPrisma().aiUsageAnalytics.findMany({
      where,
      orderBy: { [sortField]: input.sortOrder },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    getPrisma().aiUsageAnalytics.count({ where }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      feature: row.feature,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      status: row.status === "failed" ? "failed" : "success",
      sourceTextLength: row.sourceTextLength,
      estimatedTokens: row.estimatedTokens,
      aiInputTokens: row.aiInputTokens,
      aiOutputTokens: row.aiOutputTokens,
      aiTotalTokens: row.aiTotalTokens,
      aiModel: row.aiModel,
      errorMessage: row.errorMessage,
    })),
    total,
  };
}

export type AdminUserPairRow = {
  id: string;
  userId: number;
  userName: string | null;
  email: string | null;
  vocabPairId: number;
  pimsleurLevel: number;
  nextReviewMs: string;
};

export type AdminUserPairsListQuery = {
  page: number;
  pageSize: number;
  sortBy: "nextReviewMs" | "pimsleurLevel";
  sortOrder: "asc" | "desc";
  search?: string;
};

export async function selectAdminUserPairs(
  input: AdminUserPairsListQuery,
): Promise<{ rows: AdminUserPairRow[]; total: number }> {
  const memberFilter: Prisma.UserDictionaryWhereInput = {
    isDefault: true,
    ...(input.search
      ? {
          user: {
            OR: [
              {
                userName: { contains: input.search, mode: "insensitive" },
              },
              {
                email: { contains: input.search, mode: "insensitive" },
              },
            ],
          },
        }
      : {}),
  };

  const where: Prisma.DictionaryEntryWhereInput = {
    dictionary: {
      members: { some: memberFilter },
    },
  };

  const orderBy =
    input.sortBy === "pimsleurLevel"
      ? { pimsleurLevel: input.sortOrder }
      : input.sortOrder === "asc"
        ? { nextReviewMs: "asc" as const }
        : { nextReviewMs: "desc" as const };

  const [rows, total] = await Promise.all([
    getPrisma().dictionaryEntry.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        dictionary: {
          include: {
            members: {
              where: { isDefault: true },
              include: {
                user: { select: { id: true, userName: true, email: true } },
              },
              take: 1,
            },
          },
        },
      },
    }),
    getPrisma().dictionaryEntry.count({ where }),
  ]);

  return {
    rows: rows.flatMap((row) => {
      const user = row.dictionary.members[0]?.user;
      if (!user) {
        return [];
      }
      return [
        {
          id: `${user.id}:${row.vocabPairId}`,
          userId: user.id,
          userName: user.userName,
          email: user.email,
          vocabPairId: row.vocabPairId,
          pimsleurLevel: row.pimsleurLevel,
          nextReviewMs: row.nextReviewMs.toString(),
        },
      ];
    }),
    total,
  };
}

export type AdminVocabWordRow = {
  id: number;
  text: string;
  languageId: number;
  languageName: string;
  primaryPairCount: number;
  learningPairCount: number;
};

export type AdminVocabWordsListQuery = {
  page: number;
  pageSize: number;
  sortBy: "id" | "text" | "language";
  sortOrder: "asc" | "desc";
  search?: string;
  languageId?: number;
  languageIds?: number[];
};

function vocabWordLanguageWhere(
  languageId: number | undefined,
  languageIds: number[] | undefined,
): Prisma.VocabWordWhereInput {
  if (languageId != null && languageIds != null && !languageIds.includes(languageId)) {
    return { languageId: { in: [] } };
  }
  if (languageId != null) {
    return { languageId };
  }
  if (languageIds != null) {
    return { languageId: { in: languageIds } };
  }
  return {};
}

export async function selectAdminVocabWords(
  input: AdminVocabWordsListQuery,
): Promise<{ rows: AdminVocabWordRow[]; total: number }> {
  const where: Prisma.VocabWordWhereInput = {
    ...vocabWordLanguageWhere(input.languageId, input.languageIds),
    ...(input.search
      ? {
          OR: [
            { text: { contains: input.search, mode: "insensitive" } },
            {
              language: {
                name: { contains: input.search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };

  const orderBy =
    input.sortBy === "text"
      ? { text: input.sortOrder }
      : input.sortBy === "language"
        ? { language: { name: input.sortOrder } }
        : { id: input.sortOrder };

  const [rows, total] = await Promise.all([
    getPrisma().vocabWord.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        text: true,
        languageId: true,
        language: { select: { name: true } },
        _count: { select: { pairsAsWordA: true, pairsAsWordB: true } },
      },
    }),
    getPrisma().vocabWord.count({ where }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      text: row.text,
      languageId: row.languageId,
      languageName: row.language.name,
      primaryPairCount: row._count.pairsAsWordA,
      learningPairCount: row._count.pairsAsWordB,
    })),
    total,
  };
}

export type AdminDictionaryRow = {
  id: number;
  primaryWord: string;
  primaryLanguage: string;
  learningWord: string;
  learningLanguage: string;
  primaryLanguageId: number;
  learningLanguageId: number;
  userPairCount: number;
  tagIds: number[];
  tagNames: string[];
};

export type AdminDictionariesListQuery = {
  page: number;
  pageSize: number;
  sortBy: "id" | "primaryWord" | "learningWord" | "userPairCount";
  sortOrder: "asc" | "desc";
  search?: string;
  primaryLanguageId?: number;
  learningLanguageIds?: number[];
  tagId?: number;
};

export async function selectAdminDictionaries(
  input: AdminDictionariesListQuery,
): Promise<{ rows: AdminDictionaryRow[]; total: number }> {
  const andFilters: Prisma.VocabPairWhereInput[] = [];

  if (input.search) {
    andFilters.push({
      OR: [
        { wordA: { text: { contains: input.search, mode: "insensitive" } } },
        { wordB: { text: { contains: input.search, mode: "insensitive" } } },
      ],
    });
  }

  if (input.primaryLanguageId != null) {
    andFilters.push({
      OR: [
        { wordA: { languageId: input.primaryLanguageId } },
        { wordB: { languageId: input.primaryLanguageId } },
      ],
    });
  }

  if (input.learningLanguageIds != null) {
    andFilters.push({
      OR: [
        { learningLanguageId: { in: input.learningLanguageIds } },
        {
          AND: [
            { learningLanguageId: null },
            { wordB: { languageId: { in: input.learningLanguageIds } } },
          ],
        },
      ],
    });
  }

  if (input.tagId != null) {
    andFilters.push({
      tags: { some: { tagId: input.tagId } },
    });
  }

  const where: Prisma.VocabPairWhereInput =
    andFilters.length > 0 ? { AND: andFilters } : {};

  const orderBy =
    input.sortBy === "primaryWord"
      ? { wordA: { text: input.sortOrder } }
      : input.sortBy === "learningWord"
        ? { wordB: { text: input.sortOrder } }
        : input.sortBy === "userPairCount"
          ? { dictionaryEntries: { _count: input.sortOrder } }
          : { id: input.sortOrder };

  const [rows, total] = await Promise.all([
    getPrisma().vocabPair.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: translationSelect,
    }),
    getPrisma().vocabPair.count({ where }),
  ]);

  return {
    rows: rows.map((row) => mapTranslationRow(row, input.primaryLanguageId)),
    total,
  };
}
