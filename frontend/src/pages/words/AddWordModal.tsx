import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  addMyWord,
  getVocabLanguages,
  lookupPrimaryWord,
  type VocabLanguages,
  type WordSuggestion,
} from "../../api/words";
import Button from "../../components/UI/Button/Button";
import ButtonLink from "../../components/UI/Button/ButtonLink";
import Modal from "../../components/UI/Modal";
import TextInput from "../../components/UI/TextInput";

type AddWordModalProps = {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
};

type Step = "primary" | "learning";

export default function AddWordModal({ open, onClose, onAdded }: AddWordModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("primary");
  const [languages, setLanguages] = useState<VocabLanguages | null>(null);
  const [primaryText, setPrimaryText] = useState("");
  const [primaryWordId, setPrimaryWordId] = useState<number | null>(null);
  const [learningText, setLearningText] = useState("");
  const [suggestions, setSuggestions] = useState<WordSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function resetForm() {
    setStep("primary");
    setPrimaryText("");
    setPrimaryWordId(null);
    setLearningText("");
    setSuggestions([]);
    setError(null);
    setSuccessMessage(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    getVocabLanguages()
      .then((result) => {
        if (!isMounted) {
          return;
        }
        setLanguages(result);
      })
      .catch((loadError) => {
        if (!isMounted) {
          return;
        }
        setLanguages(null);
        setError(
          loadError instanceof Error && loadError.message === "languages_not_set"
            ? t("wordsPage.add.languagesNotSet")
            : t("wordsPage.add.loadLanguagesFailed"),
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [open, t]);

  function mapAddError(code: string): string {
    switch (code) {
      case "languages_not_set":
        return t("wordsPage.add.languagesNotSet");
      case "primary_word_required":
        return t("wordsPage.add.primaryRequired");
      case "learning_word_required":
        return t("wordsPage.add.learningRequired");
      case "pair_not_found":
        return t("wordsPage.add.pairNotFound");
      default:
        return t("wordsPage.add.failed");
    }
  }

  async function handlePrimarySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = primaryText.trim();
    if (!trimmed) {
      setError(t("wordsPage.add.primaryRequired"));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await lookupPrimaryWord(trimmed);
      setPrimaryWordId(result.primaryWordId);
      setPrimaryText(result.primaryText);
      setSuggestions(result.suggestions);
      setLearningText("");
      setStep("learning");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t("wordsPage.add.failed");
      setError(mapAddError(message) || message);
    } finally {
      setIsLoading(false);
    }
  }

  async function completeAdd(payload: { vocabPairId: number } | { learningWord: string }) {
    if (primaryWordId == null) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await addMyWord(
        "vocabPairId" in payload
          ? { vocabPairId: payload.vocabPairId }
          : { primaryWordId, learningWord: payload.learningWord },
      );
      setSuccessMessage(
        t("wordsPage.add.success", {
          primary: result.primaryWord,
          learning: result.learningWord,
          pairId: result.vocabPairId,
        }),
      );
      onAdded();
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t("wordsPage.add.failed");
      setError(mapAddError(message) || message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLearningSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = learningText.trim();
    if (!trimmed) {
      setError(t("wordsPage.add.learningRequired"));
      return;
    }
    await completeAdd({ learningWord: trimmed });
  }

  async function handlePickSuggestion(pairId: number) {
    await completeAdd({ vocabPairId: pairId });
  }

  if (!open) {
    return null;
  }

  const primaryLangName = languages?.primaryName ?? "…";
  const learningLangName = languages?.learningName ?? "…";

  return (
    <Modal
      open={open}
      buttons={
        <>
          <Button style="secondary" onClick={handleClose} disabled={isLoading}>
            {t("wordsPage.add.cancel")}
          </Button>
          {step === "learning" ? (
            <Button
              style="secondary"
              onClick={() => {
                setStep("primary");
                setSuggestions([]);
                setLearningText("");
                setError(null);
              }}
              disabled={isLoading}
            >
              {t("wordsPage.add.back")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="add-word-modal">
        <h2 className="add-word-modal__title">{t("wordsPage.add.title")}</h2>

        {isLoading && !successMessage ? <p>{t("wordsPage.add.loading")}</p> : null}

        {error ? <p className="upload-file__error">{error}</p> : null}
        {successMessage ? (
          <p className="upload-file__profile-hint upload-file__profile-hint--success" role="status">
            {successMessage}
          </p>
        ) : null}
        {!languages && error === t("wordsPage.add.languagesNotSet") ? (
          <div className="add-word-modal__actions">
            <ButtonLink to="/profile">{t("dashboard.user.setLanguages")}</ButtonLink>
          </div>
        ) : null}

        {!successMessage && step === "primary" && languages ? (
          <form onSubmit={handlePrimarySubmit}>
            <p className="add-word-modal__hint">
              {t("wordsPage.add.promptPrimary", { langName: primaryLangName })}
            </p>
            <TextInput
              value={primaryText}
              onChange={setPrimaryText}
              disabled={isLoading || !languages}
              required
            />
            <div className="add-word-modal__actions">
              <Button type="submit" disabled={isLoading || !languages || !primaryText.trim()}>
                {t("wordsPage.add.continue")}
              </Button>
            </div>
          </form>
        ) : null}

        {!successMessage && step === "learning" ? (
          <>
            <p className="add-word-modal__primary-preview">
              {t("wordsPage.add.selectedPrimary", { word: primaryText })}
            </p>
            {suggestions.length > 0 ? (
              <div className="add-word-modal__suggestions">
                <p className="add-word-modal__hint">{t("wordsPage.add.suggestionsIntro")}</p>
                <ul className="add-word-modal__suggestion-list">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.pairId}>
                      <Button
                        type="button"
                        style="secondary"
                        disabled={isLoading}
                        onClick={() => void handlePickSuggestion(suggestion.pairId)}
                      >
                        {suggestion.learningText}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <form onSubmit={handleLearningSubmit}>
              <p className="add-word-modal__hint">
                {t("wordsPage.add.promptLearning", { langName: learningLangName })}
              </p>
              <TextInput
                value={learningText}
                onChange={setLearningText}
                disabled={isLoading}
                required
              />
              <div className="add-word-modal__actions">
                <Button type="submit" disabled={isLoading || !learningText.trim()}>
                  {t("wordsPage.add.submit")}
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
