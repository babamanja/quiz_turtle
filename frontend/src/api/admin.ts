import { apiClient } from "./_api";

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: PaginationMeta;
};

export type AdminUser = {
  id: number;
  userName: string;
  email: string | null;
  role: "user" | "admin";
  providers: {
    password: boolean;
    google: boolean;
    telegram: boolean;
  };
  vocabPairCount: number;
};

export type AdminUserDetails = {
  id: number;
  userName: string;
  email: string | null;
  role: "user" | "admin";
  providers: {
    password: boolean;
    google: boolean;
    telegram: boolean;
  };
  vocabPairCount: number;
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

export type AdminPayment = {
  id: string;
  date: string;
  userId: number;
  userName: string;
  email: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  provider: string | null;
  providerTransactionId: string | null;
  description: string | null;
  metadata: unknown;
  originalPaymentId: string | null;
  refundReason: string | null;
  transactionType: "payment" | "refund";
  createdAt: string;
  updatedAt: string;
};

export type AdminAiUsage = {
  periodDays: number;
  items: Array<{
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
  }>;
  pagination: PaginationMeta;
};

export type AdminAiUsageQuery = {
  days?: number;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "aiTotalTokens" | "estimatedTokens" | "sourceTextLength";
  sortOrder?: "asc" | "desc";
  status?: "success" | "failed";
  userId?: number;
  search?: string;
};

export type AdminQualificationTemplate = {
  questions: Array<{ id: string; prompt: string; options: string[] }>;
  defaultQuestions: Array<{ id: string; prompt: string; options: string[] }>;
};

export type AdminQualificationSubmission = {
  id: string;
  userId: number;
  userName: string;
  email: string;
  status: "completed" | "skipped";
  submittedAt: string;
  completedAt: string | null;
  deferredUntil: string | null;
  answers: Array<{
    questionId: string;
    prompt: string;
    selectedOption: string | null;
    freeText: string;
  }>;
};

export type AdminQualificationSubmissionsQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "completed" | "skipped";
};

export type AdminUsersQuery = {
  page?: number;
  pageSize?: number;
  sortBy?: "id" | "userName" | "email" | "role";
  sortOrder?: "asc" | "desc";
  role?: "user" | "admin";
  search?: string;
};

export type AdminPaymentsQuery = {
  page?: number;
  pageSize?: number;
  sortBy?: "date" | "amount" | "status" | "transactionType";
  sortOrder?: "asc" | "desc";
  status?: "pending" | "succeeded" | "failed" | "refunded";
  transactionType?: "payment" | "refund";
  search?: string;
};

export type AdminUserPair = {
  id: string;
  userId: number;
  userName: string | null;
  email: string | null;
  vocabPairId: number;
  pimsleurLevel: number;
  nextReviewMs: string;
};

export type AdminUserPairsQuery = {
  page?: number;
  pageSize?: number;
  sortBy?: "nextReviewMs" | "pimsleurLevel";
  sortOrder?: "asc" | "desc";
  search?: string;
};

export type AdminFeedbackItem = {
  id: string;
  userId: number;
  userName: string;
  email: string;
  category: "bug" | "feature" | "question" | "other";
  message: string;
  createdAt: string;
};

export type AdminFeedbackQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: "bug" | "feature" | "question" | "other";
};

export async function getAdminUsers(
  query: AdminUsersQuery = {},
): Promise<PaginatedResponse<AdminUser>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminUser>>("/admin/users", {
    params: query,
  });
  return data;
}

export async function getAdminUserDetails(userId: number): Promise<AdminUserDetails> {
  const { data } = await apiClient.get<AdminUserDetails>(`/admin/users/${userId}`);
  return data;
}

export type AdminGrantPremiumSubscriptionResult = {
  subscription: NonNullable<AdminUserDetails["subscription"]>;
};

export async function grantAdminPremiumSubscription(
  userId: number,
  payload: { currentPeriodEnd: string },
): Promise<AdminGrantPremiumSubscriptionResult> {
  const { data } = await apiClient.post<AdminGrantPremiumSubscriptionResult>(
    `/admin/users/${userId}/subscription/grant-premium`,
    payload,
  );
  return data;
}

export async function getAdminPayments(
  query: AdminPaymentsQuery = {},
): Promise<PaginatedResponse<AdminPayment>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminPayment>>("/admin/payments", {
    params: query,
  });
  return data;
}

export async function refundAdminPayment(
  paymentId: string,
  payload: { reason: string },
): Promise<{ originalPaymentId: string; refundPaymentId: string }> {
  const { data } = await apiClient.post<{ originalPaymentId: string; refundPaymentId: string }>(
    `/admin/payments/${paymentId}/refund`,
    payload,
  );
  return data;
}

export async function getAdminAiUsage(
  query: AdminAiUsageQuery = {},
): Promise<AdminAiUsage> {
  const { data } = await apiClient.get<AdminAiUsage>("/admin/ai-usage", {
    params: query,
  });
  return data;
}

export async function getAdminQualificationTemplate(): Promise<AdminQualificationTemplate> {
  const { data } = await apiClient.get<AdminQualificationTemplate>("/admin/qualification-template");
  return data;
}

export async function updateAdminQualificationTemplate(
  questions: Array<{ id: string; prompt: string; options: string[] }>,
): Promise<{ questions: Array<{ id: string; prompt: string; options: string[] }> }> {
  const { data } = await apiClient.put<{
    questions: Array<{ id: string; prompt: string; options: string[] }>;
  }>("/admin/qualification-template", { questions });
  return data;
}

export async function getAdminQualificationSubmissions(
  query: AdminQualificationSubmissionsQuery = {},
): Promise<PaginatedResponse<AdminQualificationSubmission>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminQualificationSubmission>>(
    "/admin/qualification-submissions",
    { params: query },
  );
  return data;
}

export async function getAdminFeedback(
  query: AdminFeedbackQuery = {},
): Promise<PaginatedResponse<AdminFeedbackItem>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminFeedbackItem>>(
    "/admin/feedback",
    { params: query },
  );
  return data;
}

export async function getAdminUserPairs(
  query: AdminUserPairsQuery = {},
): Promise<PaginatedResponse<AdminUserPair>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminUserPair>>("/admin/user-pairs", {
    params: query,
  });
  return data;
}

export type AdminTag = {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  createdAt: string;
  childCount: number;
  vocabPairCount: number;
};

export type AdminTagInput = {
  name: string;
  parentId: number | null;
};

export async function getAdminTags(): Promise<AdminTag[]> {
  const { data } = await apiClient.get<{ items: AdminTag[] }>("/admin/tags");
  return data.items;
}

export async function createAdminTag(payload: AdminTagInput): Promise<AdminTag> {
  const { data } = await apiClient.post<AdminTag>("/admin/tags", payload);
  return data;
}

export async function updateAdminTag(tagId: number, payload: Partial<AdminTagInput>): Promise<AdminTag> {
  const { data } = await apiClient.patch<AdminTag>(`/admin/tags/${tagId}`, payload);
  return data;
}

export async function deleteAdminTag(tagId: number): Promise<void> {
  await apiClient.delete(`/admin/tags/${tagId}`);
}

export type AdminLanguage = {
  id: number;
  name: string;
  vocabWordCount: number;
  primaryUserCount: number;
  learningUserCount: number;
};

export type AdminLanguageInput = {
  name: string;
};

export async function getAdminLanguages(): Promise<AdminLanguage[]> {
  const { data } = await apiClient.get<{ items: AdminLanguage[] }>("/admin/languages");
  return data.items;
}

export async function createAdminLanguage(payload: AdminLanguageInput): Promise<AdminLanguage> {
  const { data } = await apiClient.post<AdminLanguage>("/admin/languages", payload);
  return data;
}

export async function updateAdminLanguage(
  languageId: number,
  payload: Partial<AdminLanguageInput>,
): Promise<AdminLanguage> {
  const { data } = await apiClient.patch<AdminLanguage>(
    `/admin/languages/${languageId}`,
    payload,
  );
  return data;
}

export async function deleteAdminLanguage(languageId: number): Promise<void> {
  await apiClient.delete(`/admin/languages/${languageId}`);
}

export type AdminVocabWord = {
  id: number;
  text: string;
  languageId: number;
  languageName: string;
  primaryPairCount: number;
  learningPairCount: number;
};

export type AdminVocabWordsQuery = {
  page?: number;
  pageSize?: number;
  sortBy?: "id" | "text" | "language";
  sortOrder?: "asc" | "desc";
  search?: string;
  languageId?: number;
};

export async function getAdminVocabWords(
  query: AdminVocabWordsQuery = {},
): Promise<PaginatedResponse<AdminVocabWord>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminVocabWord>>("/admin/words", {
    params: query,
  });
  return data;
}

export type AdminVocabWordInput = {
  text: string;
  languageId: number;
  partOfSpeech?: string | null;
  tagIds?: number[];
};

export async function createAdminVocabWord(payload: AdminVocabWordInput): Promise<AdminVocabWord> {
  const { data } = await apiClient.post<AdminVocabWord>("/admin/words", payload);
  return data;
}

export async function updateAdminVocabWord(
  wordId: number,
  payload: Partial<AdminVocabWordInput>,
): Promise<AdminVocabWordDetail> {
  const { data } = await apiClient.patch<AdminVocabWordDetail>(`/admin/words/${wordId}`, payload);
  return data;
}

export async function deleteAdminVocabWord(wordId: number): Promise<void> {
  await apiClient.delete(`/admin/words/${wordId}`);
}

export type AdminVocabWordNestMember = {
  wordId: number;
  text: string;
  isAnchor: boolean;
};

export type AdminVocabWordDetail = {
  id: number;
  text: string;
  languageId: number;
  languageName: string;
  primaryPairCount: number;
  learningPairCount: number;
  learningRolePairCount: number;
  partOfSpeech: string | null;
  tagIds: number[];
  tagNames: string[];
  nestMembers: AdminVocabWordNestMember[];
};

export async function getAdminVocabWord(wordId: number): Promise<AdminVocabWordDetail> {
  const { data } = await apiClient.get<AdminVocabWordDetail>(`/admin/words/${wordId}`);
  return data;
}

export async function addAdminVocabWordNestMember(
  wordId: number,
  form: string,
): Promise<AdminVocabWordDetail> {
  const { data } = await apiClient.post<AdminVocabWordDetail>(`/admin/words/${wordId}/nest-members`, {
    form,
  });
  return data;
}

export async function removeAdminVocabWordNestMember(
  wordId: number,
  memberWordId: number,
): Promise<AdminVocabWordDetail> {
  const { data } = await apiClient.delete<AdminVocabWordDetail>(
    `/admin/words/${wordId}/nest-members/${memberWordId}`,
  );
  return data;
}

export type AdminDictionary = {
  id: number;
  primaryWord: string;
  primaryLanguage: string;
  learningWord: string;
  learningLanguage: string;
  primaryLanguageId: number;
  learningLanguageId: number;
  userPairCount: number;
  partOfSpeech: string | null;
  tagIds: number[];
  tagNames: string[];
};

export type AdminTranslation = AdminDictionary;

export type AdminTranslationsQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  primaryLanguageId?: number;
  tagId?: number;
};

export type AdminTranslationInput = {
  primaryLanguageId: number;
  primaryText: string;
  learningLanguageId: number;
  learningText?: string;
  learningTexts?: string[];
  tagIds?: number[];
  partOfSpeech?: string | null;
};

export type AdminTranslationRowInput = {
  primaryText: string;
  learningText: string;
  tagIds?: number[];
  partOfSpeech?: string | null;
};

export type AdminTranslationBatchResult = {
  created: AdminTranslation[];
  skipped: Array<{ label: string; error: string }>;
};

export async function getAdminTranslations(
  query: AdminTranslationsQuery = {},
): Promise<PaginatedResponse<AdminTranslation>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminTranslation>>("/admin/translations", {
    params: query,
  });
  return data;
}

export async function getAdminTranslation(translationId: number): Promise<AdminTranslation> {
  const { data } = await apiClient.get<AdminTranslation>(`/admin/translations/${translationId}`);
  return data;
}

export async function createAdminTranslationRows(
  payload: {
    primaryLanguageId: number;
    learningLanguageId: number;
    rows: AdminTranslationRowInput[];
  },
): Promise<AdminTranslationBatchResult> {
  const { data } = await apiClient.post<AdminTranslationBatchResult>(
    "/admin/translations",
    payload,
  );
  return data;
}

export async function updateAdminTranslation(
  translationId: number,
  payload: AdminTranslationInput,
): Promise<AdminTranslation> {
  const { data } = await apiClient.patch<AdminTranslation>(
    `/admin/translations/${translationId}`,
    payload,
  );
  return data;
}

export async function deleteAdminTranslation(translationId: number): Promise<void> {
  await apiClient.delete(`/admin/translations/${translationId}`);
}
