export {
  LEGAL_QUERY_KEY,
  legalDocumentHref,
  parseLegalDocumentId,
  type LegalDocumentId,
} from "./pages/legal/legalQuery";

export const PRIVACY_POLICY_PATH = "/?legal=privacy";
export const TERMS_OF_SERVICE_PATH = "/?legal=terms";
export const REFUND_POLICY_PATH = "/?legal=refund";

export const USER_HOME_PATH = "/dashboard";
export const WORDS_PATH = "/words";
export const wordDetailPath = (vocabPairId: number) => `/words/${vocabPairId}`;
export const ADMIN_WORDS_PATH = "/admin/words";
export const adminWordDetailPath = (wordId: number) => `/admin/words/${wordId}`;
export const DICTIONARIES_PATH = "/dictionaries";
export const FEEDBACK_PATH = "/feedback";
export const STORIES_PATH = "/stories";
export const storyPath = (storyId: number) => `/stories/${storyId}`;
export const ADMIN_STORIES_PATH = "/admin/stories";
export const adminStoryPath = (storyId: number) => `/admin/stories/${storyId}`;

/** Post-login home and sidebar brand target by role. */
export function homePathForRole(role: string | undefined): string {
  return (role ?? "").toLowerCase() === "admin" ? "/admin/dashboard" : USER_HOME_PATH;
}
