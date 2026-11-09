import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getCurrentUser,
  getLanguageOptions,
  type LanguageOption,
  updateCurrentUser,
} from "../api/user";
import Button from "../components/UI/Button/Button";
import Modal from "../components/UI/Modal";
import { setStoredUser } from "../userStorage";

type SetLanguagesModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function SetLanguagesModal({ open, onClose, onSaved }: SetLanguagesModalProps) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<LanguageOption[]>([]);
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [primaryLanguageId, setPrimaryLanguageId] = useState<number | "">("");
  const [learningLanguageId, setLearningLanguageId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getLanguageOptions(), getCurrentUser()])
      .then(([languageOptions, user]) => {
        if (cancelled) {
          return;
        }
        setOptions(languageOptions);
        setUserName(user.userName);
        setEmail(user.email);
        setPrimaryLanguageId(user.primaryLanguageId ?? "");
        setLearningLanguageId(user.learningLanguageId ?? "");
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("profilePage.saveFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const languagesIncomplete = (primaryLanguageId === "") !== (learningLanguageId === "");
  const languagesMatch = primaryLanguageId !== "" && primaryLanguageId === learningLanguageId;
  const canSave =
    primaryLanguageId !== "" &&
    learningLanguageId !== "" &&
    !languagesMatch &&
    Boolean(userName.trim() && email.trim());

  async function handleSave() {
    if (!canSave) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const user = await updateCurrentUser({
        userName,
        email,
        primaryLanguageId,
        learningLanguageId,
      });
      setStoredUser(user);
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("profilePage.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      buttons={
        <>
          <Button style="secondary" onClick={onClose} disabled={saving}>
            {t("wordsPage.add.cancel")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || loading || !canSave}>
            {saving ? t("profilePage.saving") : t("wordDetailPage.save")}
          </Button>
        </>
      }
    >
      <div className="add-word-modal">
        <h2 className="add-word-modal__title">{t("dashboard.user.setLanguages")}</h2>
        {loading ? <p className="add-word-modal__hint">{t("wordsPage.add.loading")}</p> : null}
        {error ? <p className="upload-file__error">{error}</p> : null}
        <label className="upload-file__label" htmlFor="set-primary-language">
          {t("profilePage.primaryLanguage")}
        </label>
        <select
          id="set-primary-language"
          className="upload-file__input upload-file__select"
          value={primaryLanguageId === "" ? "" : String(primaryLanguageId)}
          onChange={(event) => {
            const value = event.target.value;
            setPrimaryLanguageId(value ? Number(value) : "");
          }}
          disabled={loading || saving}
        >
          <option value="">{t("profilePage.languagePlaceholder")}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <label className="upload-file__label" htmlFor="set-learning-language">
          {t("profilePage.learningLanguage")}
        </label>
        <select
          id="set-learning-language"
          className="upload-file__input upload-file__select"
          value={learningLanguageId === "" ? "" : String(learningLanguageId)}
          onChange={(event) => {
            const value = event.target.value;
            setLearningLanguageId(value ? Number(value) : "");
          }}
          disabled={loading || saving}
        >
          <option value="">{t("profilePage.languagePlaceholder")}</option>
          {options.map((option) => (
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
      </div>
    </Modal>
  );
}
