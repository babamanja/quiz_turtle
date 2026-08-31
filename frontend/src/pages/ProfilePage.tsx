import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { createRequestId, resetAnalyticsUser, trackAnalyticsEvent } from "../analytics";
import { logOut } from "../api/auth";
import {
  deleteCurrentUser,
  getCurrentUser,
  getLanguageOptions,
  type LanguageOption,
  updateCurrentUser,
} from "../api/user";
import Button from "../components/UI/Button/Button";
import Card from "../components/UI/Card";
import Page from "../components/UI/Page";
import PageHeader from "../components/UI/PageHeader";
import TextInput from "../components/UI/TextInput";
import { clearStoredSession, getStoredUser, setStoredUser } from "../userStorage";
import TelegramLinkCard from "./profile/TelegramLinkCard";

import "./style.scss";

function mapProfileUpdateFailureReason(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown_error";
  }
  const msg = error.message.trim().toLowerCase();
  if (msg === "unauthorized" || msg.startsWith("http 401")) {
    return "unauthorized";
  }
  if (msg === "email already registered" || msg.startsWith("http 409")) {
    return "email_taken";
  }
  if (msg === "user not found" || msg.startsWith("http 404")) {
    return "user_not_found";
  }
  if (msg === "invalid email" || msg === "username, email required") {
    return "validation_error";
  }
  if (msg.startsWith("http 400")) {
    return "bad_request";
  }
  if (msg.startsWith("http 5")) {
    return "server_error";
  }
  if (msg === "network error" || msg.includes("network")) {
    return "network_error";
  }
  return "request_failed";
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [primaryLanguageId, setPrimaryLanguageId] = useState<number | "">("");
  const [learningLanguageId, setLearningLanguageId] = useState<number | "">("");
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const storedUser = getStoredUser();
    if (storedUser && !isCancelled) {
      setUserName(storedUser.userName);
      setEmail(storedUser.email);
      if (storedUser.primaryLanguageId != null) {
        setPrimaryLanguageId(storedUser.primaryLanguageId);
      }
      if (storedUser.learningLanguageId != null) {
        setLearningLanguageId(storedUser.learningLanguageId);
      }
    }
    getCurrentUser()
      .then((currentUser) => {
        if (isCancelled) {
          return;
        }
        setUserName(currentUser.userName);
        setEmail(currentUser.email);
        setPrimaryLanguageId(currentUser.primaryLanguageId ?? "");
        setLearningLanguageId(currentUser.learningLanguageId ?? "");
        setStoredUser(currentUser);
      })
      .catch(() => {
        // Keep local session snapshot if /me request fails.
      });
    getLanguageOptions()
      .then((options) => {
        if (!isCancelled) {
          setLanguageOptions(options);
        }
      })
      .catch(() => {
        // Language list is optional for viewing name/email.
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingLanguages(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  const languagesIncomplete =
    (primaryLanguageId === "") !== (learningLanguageId === "");
  const languagesMatch = primaryLanguageId !== "" && primaryLanguageId === learningLanguageId;
  const canSaveProfile =
    Boolean(userName.trim() && email.trim()) && !languagesIncomplete && !languagesMatch;

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!canSaveProfile) {
      return;
    }
    setProfileMessage(null);
    setIsSaving(true);
    const previous = getStoredUser();
    const requestId = createRequestId();
    try {
      const user = await updateCurrentUser({
        userName,
        email,
        ...(primaryLanguageId !== "" ? { primaryLanguageId } : { primaryLanguageId: null }),
        ...(learningLanguageId !== "" ? { learningLanguageId } : { learningLanguageId: null }),
      });
      setStoredUser(user);
      setProfileMessage(t("profilePage.saved"));
      const prevEmail = (previous?.email ?? "").trim().toLowerCase();
      const prevName = (previous?.userName ?? "").trim();
      trackAnalyticsEvent("profile_updated", {
        request_id: requestId,
        email_changed: prevEmail !== user.email.trim().toLowerCase(),
        user_name_changed: prevName !== user.userName.trim(),
        primary_language_changed:
          (previous?.primaryLanguageId ?? null) !== (user.primaryLanguageId ?? null),
        learning_language_changed:
          (previous?.learningLanguageId ?? null) !== (user.learningLanguageId ?? null),
      });
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : t("profilePage.saveFailed"));
      trackAnalyticsEvent("profile_update_failed", {
        request_id: requestId,
        failure_reason: mapProfileUpdateFailureReason(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(t("profilePage.deleteConfirm"));
    if (!confirmed) {
      return;
    }
    const requestId = createRequestId();
    trackAnalyticsEvent("account_delete_started", { flow: "delete", result: "started", request_id: requestId });
    setProfileMessage(null);
    setIsDeleting(true);
    try {
      await deleteCurrentUser();
      trackAnalyticsEvent("account_delete_succeeded", { flow: "delete", result: "success", request_id: requestId });
      try {
        await logOut();
      } catch {
        // Session can still be cleaned up locally if logout request fails.
      }
      clearStoredSession();
      resetAnalyticsUser();
      navigate("/", { replace: true });
    } catch (error) {
      trackAnalyticsEvent("account_delete_failed", {
        flow: "delete",
        result: "failed",
        reason: error instanceof Error ? error.message : "delete_failed",
        request_id: requestId,
      });
      setProfileMessage(error instanceof Error ? error.message : t("profilePage.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Page>
      <PageHeader title={t("profilePage.title")} />
      <Card>
        <form onSubmit={handleSaveProfile}>
        <TextInput label={t("profilePage.userName")} value={userName} onChange={setUserName} />
        <TextInput label={t("profilePage.email")} value={email} onChange={setEmail} />
        <label className="upload-file__label" htmlFor="profile-primary-language">
          {t("profilePage.primaryLanguage")}
        </label>
        <select
          id="profile-primary-language"
          className="upload-file__input upload-file__select"
          value={primaryLanguageId === "" ? "" : String(primaryLanguageId)}
          onChange={(event) => {
            const value = event.target.value;
            setPrimaryLanguageId(value ? Number(value) : "");
          }}
          disabled={isSaving || isDeleting || isLoadingLanguages}
        >
          <option value="">{t("profilePage.languagePlaceholder")}</option>
          {languageOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <label className="upload-file__label" htmlFor="profile-learning-language">
          {t("profilePage.learningLanguage")}
        </label>
        <select
          id="profile-learning-language"
          className="upload-file__input upload-file__select"
          value={learningLanguageId === "" ? "" : String(learningLanguageId)}
          onChange={(event) => {
            const value = event.target.value;
            setLearningLanguageId(value ? Number(value) : "");
          }}
          disabled={isSaving || isDeleting || isLoadingLanguages}
        >
          <option value="">{t("profilePage.languagePlaceholder")}</option>
          {languageOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        {languagesIncomplete ? (
          <p className="upload-file__profile-hint" role="status">
            {t("profilePage.languagesIncomplete")}
          </p>
        ) : null}
        {languagesMatch ? (
          <p className="upload-file__profile-hint" role="status">
            {t("profilePage.languagesMustDiffer")}
          </p>
        ) : null}
        <Button
          style="primary"
          onClick={handleSaveProfile}
          disabled={isSaving || isDeleting || !canSaveProfile}
        >
          {isSaving ? t("profilePage.saving") : t("profilePage.save")}
        </Button>
        <Button style="secondary" onClick={handleDeleteAccount} disabled={isSaving || isDeleting}>
          {isDeleting ? t("profilePage.deleting") : t("profilePage.delete")}
        </Button>
        {profileMessage && (
          <p className="upload-file__profile-hint" role="status">
            {profileMessage}
          </p>
        )}
        </form>
      </Card>
      <TelegramLinkCard />
    </Page>
  );
}
