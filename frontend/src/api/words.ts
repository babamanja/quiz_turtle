import { apiClient } from "./_api";
import type { PaginatedResponse, PaginationMeta } from "./admin";

import type {
  ReviewCardDirection,
  VocabAnswerMatch,
  VocabPairRelationType,
} from "@language-turtle/shared";

export type NestMember = {
  wordId: number;
  text: string;
};

export type NestMemberView = NestMember & {
  isAnchor: boolean;
};

export type WordNestSide = "primary" | "learning";

export type UserWord = {
  vocabPairId: number;
  relationType: VocabPairRelationType;
  dictionaryId: number;
  dictionaryName: string;
  primaryWord: string;
  learningWord: string;
  partOfSpeech: string | null;
  example: string | null;
  pimsleurLevel: number;
  pimsleurLevelForward: number;
  pimsleurLevelReverse: number;
  nextReviewMs: string;
};

export type UserWordDetail = UserWord & {
  nextReviewMsForward: string;
  nextReviewMsReverse: string;
  primaryNestMembers: NestMember[];
  learningNestMembers: NestMember[];
  learningNest: NestMemberView[];
};

export type UpdateMyWordInput = {
  partOfSpeech?: string | null;
  example?: string | null;
};

export type VocabLanguages = {
  primaryName: string;
  learningName: string;
};

export type WordSuggestion = {
  pairId: number;
  learningText: string;
};

export type PrimaryWordLookup = {
  primaryWordId: number;
  primaryText: string;
  suggestions: WordSuggestion[];
  learningLangName: string;
};

export type AddedWord = {
  vocabPairId: number;
  primaryWord: string;
  learningWord: string;
};

export type UserWordsQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: "nextReviewMs" | "pimsleurLevel" | "primaryWord";
  sortOrder?: "asc" | "desc";
};

export type { PaginationMeta };

export async function getMyWords(
  query: UserWordsQuery = {},
): Promise<PaginatedResponse<UserWord>> {
  const { data } = await apiClient.get<PaginatedResponse<UserWord>>("/users/me/words", {
    params: query,
  });
  return data;
}

export async function getMyWord(vocabPairId: number): Promise<UserWordDetail> {
  const { data } = await apiClient.get<UserWordDetail>(`/users/me/words/${vocabPairId}`);
  return data;
}

export async function updateMyWord(
  vocabPairId: number,
  input: UpdateMyWordInput,
): Promise<UserWordDetail> {
  const { data } = await apiClient.patch<UserWordDetail>(`/users/me/words/${vocabPairId}`, input);
  return data;
}

export async function addMyWordNestMember(
  vocabPairId: number,
  input: { side: WordNestSide; form: string },
): Promise<UserWordDetail> {
  const { data } = await apiClient.post<UserWordDetail>(
    `/users/me/words/${vocabPairId}/nest-members`,
    input,
  );
  return data;
}

export async function removeMyWordNestMember(
  vocabPairId: number,
  memberWordId: number,
): Promise<UserWordDetail> {
  const { data } = await apiClient.delete<UserWordDetail>(
    `/users/me/words/${vocabPairId}/nest-members/${memberWordId}`,
  );
  return data;
}

export async function getVocabLanguages(): Promise<VocabLanguages> {
  const { data } = await apiClient.get<VocabLanguages>("/users/me/vocab-languages");
  return data;
}

export async function lookupPrimaryWord(primaryWord: string): Promise<PrimaryWordLookup> {
  const { data } = await apiClient.post<PrimaryWordLookup>("/users/me/words/lookup-primary", {
    primaryWord,
  });
  return data;
}

export type { ReviewCardDirection };
export type ReviewMatch = VocabAnswerMatch;

export type ReviewWord = {
  vocabPairId: number;
  direction: ReviewCardDirection;
  promptWord: string;
  primaryWord: string;
  learningWord: string;
  pimsleurLevel?: number;
  nextReviewMs?: number;
};

export type ReviewResult = {
  direction?: ReviewCardDirection;
  promptWord?: string;
  expectedWord?: string;
  primaryWord: string;
  learningWord: string;
  correct: boolean;
  match: ReviewMatch;
  userAnswer?: string;
  pimsleurLevel?: number;
  nextReviewMs?: number;
};

export async function getDueReviewWords(): Promise<ReviewWord[]> {
  const { data } = await apiClient.get<{ words: ReviewWord[] }>("/users/me/review/due");
  return data.words;
}

export async function submitReviewCheck(
  vocabPairId: number,
  answer: string,
  direction: ReviewCardDirection,
): Promise<ReviewResult> {
  const { data } = await apiClient.post<ReviewResult>(`/users/me/review/${vocabPairId}`, {
    answer,
    direction,
  });
  return data;
}

export async function submitReviewDontRemember(
  vocabPairId: number,
  direction: ReviewCardDirection,
): Promise<ReviewResult> {
  const { data } = await apiClient.post<ReviewResult>(`/users/me/review/${vocabPairId}`, {
    result: "dont",
    direction,
  });
  return data;
}

export async function submitReviewConfirm(
  vocabPairId: number,
  result: "know" | "dont",
  direction: ReviewCardDirection,
): Promise<ReviewResult> {
  const { data } = await apiClient.post<ReviewResult>(`/users/me/review/${vocabPairId}`, {
    result,
    direction,
  });
  return data;
}

export async function addMyWord(
  input:
    | { vocabPairId: number }
    | { primaryWordId: number; learningWord: string },
): Promise<AddedWord> {
  const { data } = await apiClient.post<AddedWord>("/users/me/words", input);
  return data;
}
