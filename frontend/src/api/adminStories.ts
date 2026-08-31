import type { StoryStatus, StoryTokenKind } from "@language-turtle/shared";

import { apiClient } from "./_api";
import type { PaginatedResponse, PaginationMeta } from "./admin";

export type { PaginationMeta };

export type AdminStoryListItem = {
  id: number;
  title: string;
  slug: string | null;
  primaryLanguageId: number;
  learningLanguageId: number;
  status: StoryStatus;
  sentenceCount: number;
  unlockLevelCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminStoryToken = {
  id: number;
  sortOrder: number;
  kind: StoryTokenKind;
  vocabWordId: number | null;
  baseForm: string;
  l1Text: string;
  glueToPrevious: boolean;
};

export type AdminStorySentence = {
  id: number;
  sortOrder: number;
  tokens: AdminStoryToken[];
};

export type AdminStoryUnlockLevel = {
  id: number;
  level: number;
  label: string | null;
  words: Array<{ vocabWordId: number; sortOrder: number }>;
  wordIds: number[];
};

export type AdminStory = {
  id: number;
  title: string;
  slug: string | null;
  primaryLanguageId: number;
  learningLanguageId: number;
  status: StoryStatus;
  createdAt: string;
  updatedAt: string;
  sentences: AdminStorySentence[];
  unlockLevels: AdminStoryUnlockLevel[];
};

export type AdminStoriesQuery = {
  status?: StoryStatus | "";
  page?: number;
  pageSize?: number;
};

export type CreateAdminStoryInput = {
  title: string;
  primaryLanguageId: number;
  learningLanguageId: number;
  status?: StoryStatus;
  slug?: string | null;
};

export type UpdateAdminStoryInput = {
  title?: string;
  primaryLanguageId?: number;
  learningLanguageId?: number;
  status?: StoryStatus;
  slug?: string | null;
};

export type AdminStoryContentTokenInput = {
  sortOrder: number;
  kind: StoryTokenKind;
  vocabWordId?: number | null;
  baseForm: string;
  l1Text: string;
  glueToPrevious?: boolean;
};

export type AdminStoryContentSentenceInput = {
  sortOrder: number;
  tokens: AdminStoryContentTokenInput[];
};

export type AdminStoryContentUnlockLevelInput = {
  level: number;
  label?: string | null;
  wordIds: number[];
};

export type AdminStoryContentInput = {
  sentences: AdminStoryContentSentenceInput[];
  unlockLevels: AdminStoryContentUnlockLevelInput[];
};

export async function getAdminStories(
  query: AdminStoriesQuery = {},
): Promise<PaginatedResponse<AdminStoryListItem>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminStoryListItem>>("/admin/stories", {
    params: {
      status: query.status || undefined,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
  return data;
}

export async function createAdminStory(payload: CreateAdminStoryInput): Promise<AdminStory> {
  const { data } = await apiClient.post<AdminStory>("/admin/stories", payload);
  return data;
}

export async function getAdminStory(storyId: number): Promise<AdminStory> {
  const { data } = await apiClient.get<AdminStory>(`/admin/stories/${storyId}`);
  return data;
}

export async function updateAdminStory(
  storyId: number,
  payload: UpdateAdminStoryInput,
): Promise<AdminStory> {
  const { data } = await apiClient.patch<AdminStory>(`/admin/stories/${storyId}`, payload);
  return data;
}

export async function deleteAdminStory(storyId: number): Promise<void> {
  await apiClient.delete(`/admin/stories/${storyId}`);
}

export async function putAdminStoryContent(
  storyId: number,
  payload: AdminStoryContentInput,
): Promise<AdminStory> {
  const { data } = await apiClient.put<AdminStory>(`/admin/stories/${storyId}/content`, payload);
  return data;
}
