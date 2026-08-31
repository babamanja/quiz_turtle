import type { StoryStatus, StoryTokenKind } from "@language-turtle/shared";

import { apiClient } from "./_api";

export type UserStoryListItem = {
  id: number;
  title: string;
  slug: string | null;
  primaryLanguageId: number;
  learningLanguageId: number;
  unlockedLevel: number;
  maxLevel: number;
  percent: number;
  totalUniqueWords: number;
};

export type UserStoryToken = {
  id: number;
  sortOrder: number;
  kind: StoryTokenKind;
  vocabWordId: number | null;
  baseForm: string;
  l1Text: string;
  glueToPrevious: boolean;
};

export type UserStorySentence = {
  id: number;
  sortOrder: number;
  tokens: UserStoryToken[];
};

export type UserStoryUnlockLevel = {
  id: number;
  level: number;
  label: string | null;
  wordIds: number[];
};

export type UserStory = {
  id: number;
  title: string;
  slug: string | null;
  primaryLanguageId: number;
  learningLanguageId: number;
  status: StoryStatus;
  sentences: UserStorySentence[];
  unlockLevels: UserStoryUnlockLevel[];
  unlockedLevel: number;
  maxLevel: number;
  unlockedWordIds: number[];
  totalUniqueWords: number;
  percent: number;
};

export async function getMyStories(): Promise<UserStoryListItem[]> {
  const { data } = await apiClient.get<{ items: UserStoryListItem[] }>("/users/me/stories");
  return data.items;
}

export async function getMyStory(storyId: number): Promise<UserStory> {
  const { data } = await apiClient.get<UserStory>(`/users/me/stories/${storyId}`);
  return data;
}

export async function advanceMyStoryLevel(storyId: number): Promise<UserStory> {
  const { data } = await apiClient.post<UserStory>(`/users/me/stories/${storyId}/next-level`);
  return data;
}
