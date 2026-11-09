import * as adminRepository from "../db/adminRepository.js";
import { getPrisma } from "../db/prisma.js";
import * as paymentRepository from "../db/paymentRepository.js";
import * as subscriptionRepository from "../db/subscriptionRepository.js";
import * as teacherLanguageRepository from "../db/teacherLanguageRepository.js";

export async function listUsers(input: adminRepository.AdminUsersListQuery) {
  const result = await adminRepository.selectAdminUsers(input);
  return {
    ok: true as const,
    users: result.rows.map((row) => ({
      id: row.id,
      userName: row.userName,
      email: row.email,
      role: row.role,
      providers: {
        password: row.hasPassword,
        google: row.hasGoogle,
        telegram: row.hasTelegram,
      },
      vocabPairCount: row.vocabPairCount,
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
    },
  };
}

export async function getUserDetails(userId: number) {
  const row = await adminRepository.selectAdminUserDetailsById(userId);
  if (!row) {
    return { ok: false as const, status: 404, error: "user not found" };
  }
  return {
    ok: true as const,
    user: {
      id: row.id,
      userName: row.userName,
      email: row.email,
      role: row.role,
      providers: {
        password: row.hasPassword,
        google: row.hasGoogle,
        telegram: row.hasTelegram,
      },
      vocabPairCount: row.vocabPairCount,
      taughtLanguageIds: row.taughtLanguageIds,
      subscription: row.subscription,
      recentPayments: row.recentPayments,
    },
  };
}

export async function setUserTaughtLanguages(userId: number, languageIdsRaw: unknown) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 400, error: "invalid user id" };
  }
  if (!Array.isArray(languageIdsRaw)) {
    return { ok: false as const, status: 400, error: "languageIds required" };
  }

  const languageIds: number[] = [];
  for (const value of languageIdsRaw) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      return { ok: false as const, status: 400, error: "invalid language id" };
    }
    languageIds.push(value);
  }
  const unique = [...new Set(languageIds)];

  const user = await getPrisma().user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) {
    return { ok: false as const, status: 404, error: "user not found" };
  }
  if (unique.length > 0) {
    const found = await getPrisma().language.count({ where: { id: { in: unique } } });
    if (found !== unique.length) {
      return { ok: false as const, status: 400, error: "invalid language id" };
    }
  }

  const taughtLanguageIds = await teacherLanguageRepository.replaceTeacherLanguages(
    userId,
    unique,
  );
  return { ok: true as const, taughtLanguageIds };
}

export async function grantPremiumSubscriptionByAdmin(input: {
  userId: number;
  currentPeriodEnd: unknown;
}) {
  const currentPeriodEndRaw =
    typeof input.currentPeriodEnd === "string"
      ? input.currentPeriodEnd.trim()
      : "";
  if (!currentPeriodEndRaw) {
    return {
      ok: false as const,
      status: 400,
      error: "currentPeriodEnd is required",
    };
  }

  const currentPeriodEnd = new Date(currentPeriodEndRaw);
  if (Number.isNaN(currentPeriodEnd.getTime())) {
    return {
      ok: false as const,
      status: 400,
      error: "currentPeriodEnd must be a valid date",
    };
  }

  const now = new Date();
  if (currentPeriodEnd <= now) {
    return {
      ok: false as const,
      status: 400,
      error: "currentPeriodEnd must be in the future",
    };
  }

  const user = await adminRepository.selectAdminUserDetailsById(input.userId);
  if (!user) {
    return { ok: false as const, status: 404, error: "user not found" };
  }

  try {
    const subscription = await subscriptionRepository.grantPremiumByAdmin({
      userId: input.userId,
      currentPeriodEnd,
    });
    return {
      ok: true as const,
      subscription: {
        id: subscription.id,
        planCode: subscription.planCode,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        createdAt: subscription.createdAt,
        paymentId: subscription.paymentId,
      },
    };
  } catch {
    return {
      ok: false as const,
      status: 500,
      error: "failed to grant premium subscription",
    };
  }
}

export async function listPayments(input: paymentRepository.PaymentsListQuery) {
  const result = await paymentRepository.selectPayments(input);
  return {
    ok: true as const,
    payments: result.rows.map((row) => ({
      id: row.id,
      date: row.date,
      userId: row.userId,
      userName: row.userName,
      email: row.email,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      provider: row.provider,
      providerTransactionId: row.providerTransactionId,
      description: row.description,
      metadata: row.metadata,
      originalPaymentId: row.originalPaymentId,
      refundReason: row.refundReason,
      transactionType: row.transactionType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
    },
  };
}

export async function refundPaymentByAdmin(input: {
  paymentId: string;
  adminUserId: number;
  reason: unknown;
}) {
  const paymentId = input.paymentId.trim();
  if (!paymentId) {
    return { ok: false as const, status: 400, error: "payment id is required" };
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) {
    return {
      ok: false as const,
      status: 400,
      error: "refund reason is required",
    };
  }

  try {
    const result = await paymentRepository.refundPaymentById({
      paymentId,
      reason,
      adminUserId: input.adminUserId,
    });
    return { ok: true as const, ...result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to refund payment";
    if (
      message === "payment not found" ||
      message === "payment already refunded" ||
      message === "only payment transaction can be refunded" ||
      message === "only succeeded payment can be refunded"
    ) {
      return { ok: false as const, status: 400, error: message };
    }
    return {
      ok: false as const,
      status: 500,
      error: "failed to refund payment",
    };
  }
}

export async function getAiUsage(input: {
  days?: unknown;
  page?: unknown;
  pageSize?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
  status?: unknown;
  userId?: unknown;
  search?: unknown;
}) {
  const parsedDays = Number(input.days);
  const days = Number.isInteger(parsedDays)
    ? Math.max(1, Math.min(90, parsedDays))
    : 30;
  const parsedPage = Number(input.page);
  const parsedPageSize = Number(input.pageSize);
  const page = Number.isInteger(parsedPage) ? Math.max(1, parsedPage) : 1;
  const pageSize = Number.isInteger(parsedPageSize)
    ? Math.min(100, Math.max(10, parsedPageSize))
    : 20;

  const sortByRaw = input.sortBy;
  const sortBy =
    sortByRaw === "createdAt" ||
    sortByRaw === "aiTotalTokens" ||
    sortByRaw === "estimatedTokens" ||
    sortByRaw === "sourceTextLength"
      ? sortByRaw
      : "createdAt";
  const sortOrderRaw = input.sortOrder;
  const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";

  const statusRaw = input.status;
  const status =
    statusRaw === "success" || statusRaw === "failed" ? statusRaw : undefined;

  const userIdRaw = Number(input.userId);
  const userId =
    Number.isInteger(userIdRaw) && userIdRaw > 0 ? userIdRaw : undefined;

  const searchRaw = input.search;
  const search =
    typeof searchRaw === "string" && searchRaw.trim().length > 0
      ? searchRaw.trim()
      : undefined;

  const generations = await adminRepository.selectAiUsageRecords({
    days,
    page,
    pageSize,
    sortBy,
    sortOrder,
    status,
    userId,
    search,
  });

  return {
    ok: true as const,
    usage: {
      periodDays: days,
      items: generations.rows,
      pagination: {
        page,
        pageSize,
        total: generations.total,
        totalPages: Math.max(1, Math.ceil(generations.total / pageSize)),
      },
    },
  };
}

export async function listUserPairs(input: adminRepository.AdminUserPairsListQuery) {
  const result = await adminRepository.selectAdminUserPairs(input);
  return {
    ok: true as const,
    userPairs: result.rows,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
    },
  };
}

export async function listVocabWords(input: adminRepository.AdminVocabWordsListQuery) {
  const result = await adminRepository.selectAdminVocabWords(input);
  return {
    ok: true as const,
    words: result.rows,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
    },
  };
}

export async function listDictionaries(input: adminRepository.AdminDictionariesListQuery) {
  const result = await adminRepository.selectAdminDictionaries(input);
  return {
    ok: true as const,
    dictionaries: result.rows,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
    },
  };
}
