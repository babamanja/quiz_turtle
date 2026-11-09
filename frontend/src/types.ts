export type UserDashboardStats = {
  vocabPairCount: number;
  dictionaryCount: number;
  dueWordCount: number;
  primaryLanguage: string | null;
  learningLanguage: string | null;
};

export type User = {
  id: number;
  userName: string;
  email: string;
  role: "user" | "admin" | "guest";
  /** Present when the API includes verification state (password signup / Google). */
  emailVerified?: boolean;
  /** Temporary guest account before signup. */
  isGuest?: boolean;
  /** Languages this account may teach. Empty means not a teacher. */
  taughtLanguageIds?: number[];
  primaryLanguageId?: number | null;
  learningLanguageId?: number | null;
};

export type AuthSession = {
  token: string;
  user: User;
  providers: {
    password: boolean;
    google: boolean;
  };
  /** Present after Google login/signup: first-time account (new user row) vs returning. */
  isNewUser?: boolean;
};
