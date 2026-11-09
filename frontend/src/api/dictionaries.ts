import { apiClient } from "./_api";

export type UserDictionary = {
  id: number;
  name: string;
  creatorId: number;
  creatorName: string;
  isDefault: boolean;
  isOwner: boolean;
  isPublic: boolean;
  verified: boolean;
  entryCount: number;
  createdAt: string;
};

export async function getMyDictionaries(): Promise<UserDictionary[]> {
  const { data } = await apiClient.get<{ items: UserDictionary[] }>("/users/me/dictionaries");
  return data.items;
}

export async function setDictionaryPublic(dictionaryId: number, isPublic: boolean): Promise<void> {
  await apiClient.post(`/users/me/dictionaries/${dictionaryId}/public`, { isPublic });
}

export type PublicDictionary = {
  id: number;
  name: string;
  creatorName: string;
  entryCount: number;
  verified: boolean;
  words: string[];
};

export async function getPublicDictionaries(): Promise<PublicDictionary[]> {
  const { data } = await apiClient.get<{ items: PublicDictionary[] }>("/users/public/dictionaries");
  return data.items;
}
