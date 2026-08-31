import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import {
  type AdminLanguage,
  type AdminTag,
  addAdminVocabWordNestMember,
  deleteAdminVocabWord,
  getAdminLanguages,
  getAdminTags,
  getAdminVocabWord,
  removeAdminVocabWordNestMember,
  updateAdminVocabWord,
} from "../../api/admin";
import PartOfSpeechSelect from "../../components/PartOfSpeechSelect";
import Button from "../../components/UI/Button/Button";
import ButtonLink from "../../components/UI/Button/ButtonLink";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import PageSection from "../../components/UI/PageSection";
import TextInput from "../../components/UI/TextInput";
import { useAdminPage } from "../../hooks/useAdminPage";
import { ADMIN_WORDS_PATH } from "../../paths";
import TagTreePicker from "./TagTreePicker";
import {
  buildTagTree,
  expandTagIdsWithAncestors,
  toggleTagSelection,
} from "./tagTree";
import "../style.scss";

function mapWordError(code: string, t: (key: string) => string): string {
  switch (code) {
    case "word text is required":
      return t("admin.wordsTextRequired");
    case "invalid language id":
      return t("admin.wordsLanguageInvalid");
    case "language not found":
      return t("admin.wordsLanguageNotFound");
    case "word already exists for language":
      return t("admin.wordsTextExists");
    case "word not found":
      return t("admin.wordsNotFound");
    case "cannot change language while word is used in pairs":
      return t("admin.wordsLanguageLocked");
    case "word is used in dictionary pairs":
      return t("admin.wordsHasPairs");
    case "invalid part of speech":
      return t("admin.wordDetailsPartOfSpeechInvalid");
    case "invalid tag ids":
      return t("admin.translationsTagsInvalid");
    case "tag not found":
      return t("admin.translationsTagNotFound");
    case "word is not used as learning word in pairs":
      return t("admin.wordDetailsMetadataLocked");
    case "nest form required":
      return t("admin.wordDetailsNestFormRequired");
    case "nest form same as anchor":
      return t("admin.wordDetailsNestFormSameAsAnchor");
    case "cannot remove anchor word":
      return t("admin.wordDetailsNestCannotRemoveAnchor");
    case "nest member not found":
      return t("admin.wordDetailsNestMemberNotFound");
    case "nest member not removable":
      return t("admin.wordDetailsNestMemberNotRemovable");
    case "invalid nest member id":
      return t("admin.wordDetailsNestMemberInvalid");
    default:
      return t("admin.wordsSaveFailed");
  }
}

export default function AdminWordDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { wordId: wordIdParam } = useParams();
  const wordId = Number(wordIdParam);

  const [languages, setLanguages] = useState<AdminLanguage[]>([]);
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [text, setText] = useState("");
  const [languageId, setLanguageId] = useState<number | "">("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [nestForm, setNestForm] = useState("");
  const [nestError, setNestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNestSubmitting, setIsNestSubmitting] = useState(false);
  const [removingNestMemberId, setRemovingNestMemberId] = useState<number | null>(null);

  const loadWord = useCallback(async () => {
    if (!Number.isInteger(wordId) || wordId < 1) {
      throw new Error(t("admin.wordDetailsInvalidId"));
    }
    return getAdminVocabWord(wordId);
  }, [t, wordId]);

  const {
    data: word,
    error,
    isLoading,
    setData,
  } = useAdminPage({
    load: loadWord,
    loadErrorMessage: t("admin.wordDetailsLoadFailed"),
  });

  useEffect(() => {
    void Promise.all([getAdminLanguages(), getAdminTags()])
      .then(([loadedLanguages, loadedTags]) => {
        setLanguages(loadedLanguages);
        setTags(loadedTags);
      })
      .catch(() => {
        // Optional filters; ignore load errors.
      });
  }, []);

  useEffect(() => {
    if (!word) {
      return;
    }
    setText(word.text);
    setLanguageId(word.languageId);
    setPartOfSpeech(word.partOfSpeech ?? "");
    setSelectedTagIds(expandTagIdsWithAncestors(word.tagIds ?? [], tags));
  }, [tags, word]);

  const tagTree = useMemo(() => buildTagTree(tags), [tags]);
  const metadataEditable = (word?.learningRolePairCount ?? 0) > 0;
  const relatedNestMembers = useMemo(
    () => (word?.nestMembers ?? []).filter((member) => !member.isAnchor),
    [word?.nestMembers],
  );
  const languageChangeLocked =
    word != null && word.primaryPairCount + word.learningPairCount > 0;

  function toggleTag(tagId: number) {
    setSelectedTagIds((current) => toggleTagSelection(tagId, current, tags));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!word) {
      return;
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      setFormError(t("admin.wordsTextRequired"));
      return;
    }
    if (languageId === "") {
      setFormError(t("admin.wordsLanguageRequired"));
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const updated = await updateAdminVocabWord(word.id, {
        text: trimmedText,
        languageId,
        ...(metadataEditable
          ? {
              partOfSpeech: partOfSpeech.trim() ? partOfSpeech : null,
              tagIds: selectedTagIds,
            }
          : {}),
      });
      setData(updated);
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : t("admin.wordsSaveFailed");
      setFormError(mapWordError(message, t));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddNestMember() {
    if (!word) {
      return;
    }

    const trimmedForm = nestForm.trim();
    if (!trimmedForm) {
      setNestError(t("admin.wordDetailsNestFormRequired"));
      return;
    }

    setIsNestSubmitting(true);
    setNestError(null);
    try {
      const updated = await addAdminVocabWordNestMember(word.id, trimmedForm);
      setData(updated);
      setNestForm("");
    } catch (addError) {
      const message =
        addError instanceof Error ? addError.message : t("admin.wordDetailsNestAddFailed");
      setNestError(mapWordError(message, t));
    } finally {
      setIsNestSubmitting(false);
    }
  }

  async function handleRemoveNestMember(memberWordId: number) {
    if (!word) {
      return;
    }

    const member = word.nestMembers.find((item) => item.wordId === memberWordId);
    const confirmed = window.confirm(
      t("admin.wordDetailsNestRemoveConfirm", { text: member?.text ?? "" }),
    );
    if (!confirmed) {
      return;
    }

    setRemovingNestMemberId(memberWordId);
    setNestError(null);
    try {
      const updated = await removeAdminVocabWordNestMember(word.id, memberWordId);
      setData(updated);
    } catch (removeError) {
      const message =
        removeError instanceof Error
          ? removeError.message
          : t("admin.wordDetailsNestRemoveFailed");
      setNestError(mapWordError(message, t));
    } finally {
      setRemovingNestMemberId(null);
    }
  }

  async function handleDelete() {
    if (!word) {
      return;
    }

    const pairCount = word.primaryPairCount + word.learningPairCount;
    const confirmed = window.confirm(
      t("admin.wordsDeleteConfirm", { text: word.text, count: pairCount }),
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setFormError(null);
    try {
      await deleteAdminVocabWord(word.id);
      navigate(ADMIN_WORDS_PATH);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : t("admin.wordsDeleteFailed");
      setFormError(mapWordError(message, t));
      setIsDeleting(false);
    }
  }

  if (!Number.isInteger(wordId) || wordId < 1) {
    return (
      <Page width="default">
        <p className="upload-file__error">{t("admin.wordDetailsInvalidId")}</p>
      </Page>
    );
  }

  return (
    <Page width="default">
      <PageHeader
        title={word?.text ?? t("admin.wordDetailsTitle")}
        subtitle={word ? `${word.languageName} · ID ${word.id}` : undefined}
        actions={
          <ButtonLink to={ADMIN_WORDS_PATH} style="secondary">
            {t("admin.wordDetailsBackToWords")}
          </ButtonLink>
        }
      />

      {isLoading ? <p>{t("admin.wordDetailsLoading")}</p> : null}
      {error ? <p className="upload-file__error">{error}</p> : null}

      {!isLoading && word ? (
        <PageSection title={t("admin.wordDetailsSettingsSection")}>
          <form className="add-word-modal" onSubmit={handleSave}>
            {formError ? <p className="upload-file__error">{formError}</p> : null}
            <label className="add-word-modal__hint" htmlFor="admin-word-detail-text">
              {t("table.adminWords.text")}
            </label>
            <TextInput
              id="admin-word-detail-text"
              value={text}
              onChange={setText}
              disabled={isSaving}
              required
            />
            <label className="add-word-modal__hint" htmlFor="admin-word-detail-language">
              {t("table.adminWords.language")}
            </label>
            <select
              id="admin-word-detail-language"
              className="text-input"
              style={{ marginBottom: 0 }}
              value={languageId}
              disabled={isSaving || languageChangeLocked}
              onChange={(event) => {
                const value = event.target.value;
                setLanguageId(value ? Number(value) : "");
              }}
            >
              {languages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
            {languageChangeLocked ? (
              <p className="add-word-modal__hint">{t("admin.wordsLanguageLockedHint")}</p>
            ) : null}

            <label className="add-word-modal__hint" htmlFor="admin-word-detail-pos">
              {t("table.words.partOfSpeech")}
            </label>
            <PartOfSpeechSelect
              id="admin-word-detail-pos"
              className="text-input"
              value={partOfSpeech}
              disabled={isSaving || !metadataEditable}
              onChange={setPartOfSpeech}
            />

            <p className="add-word-modal__hint">{t("table.adminTranslations.tags")}</p>
            {!metadataEditable ? (
              <p className="add-word-modal__hint">{t("admin.wordDetailsMetadataLocked")}</p>
            ) : tags.length === 0 ? (
              <p className="add-word-modal__hint">{t("admin.wordDetailsTagsEmpty")}</p>
            ) : (
              <div className="add-word-modal__tag-list">
                <TagTreePicker
                  nodes={tagTree}
                  selectedTagIds={selectedTagIds}
                  disabled={isSaving}
                  onToggle={toggleTag}
                />
              </div>
            )}

            <div className="word-detail__nest-side" style={{ marginTop: "12px" }}>
              <p className="add-word-modal__hint" style={{ marginBottom: 0 }}>
                {t("wordDetailPage.nest.title")}
              </p>
              <p className="word-detail__relation-type">{t("admin.wordDetailsNestHint")}</p>
              <ul className="word-detail__nest-list">
                {(word.nestMembers ?? []).map((member) => (
                  <li
                    key={member.wordId}
                    className={`word-detail__nest-item${
                      member.isAnchor ? " word-detail__nest-item--anchor" : ""
                    }`}
                  >
                    <span className="word-detail__nest-text">{member.text}</span>
                    <span className="word-detail__nest-role">
                      {member.isAnchor
                        ? t("wordDetailPage.nest.mainWord")
                        : t("wordDetailPage.nest.relatedWord")}
                    </span>
                    {!member.isAnchor ? (
                      <Button
                        type="button"
                        style="secondary"
                        disabled={
                          isSaving || isNestSubmitting || removingNestMemberId === member.wordId
                        }
                        onClick={() => void handleRemoveNestMember(member.wordId)}
                      >
                        {removingNestMemberId === member.wordId
                          ? t("admin.wordDetailsNestRemoving")
                          : t("admin.wordDetailsNestRemove")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {relatedNestMembers.length === 0 ? (
                <p className="word-detail__nest-empty">{t("wordDetailPage.nest.empty")}</p>
              ) : null}
              {nestError ? <p className="upload-file__error">{nestError}</p> : null}
              <div className="word-detail__nest-add">
                <div style={{ flex: 1 }}>
                  <label className="add-word-modal__hint" htmlFor="admin-word-detail-nest-form">
                    {t("admin.wordDetailsNestFormLabel")}
                  </label>
                  <TextInput
                    id="admin-word-detail-nest-form"
                    value={nestForm}
                    onChange={setNestForm}
                    disabled={isSaving || isNestSubmitting}
                    placeholder={t("admin.wordDetailsNestFormPlaceholder")}
                  />
                </div>
                <Button
                  type="button"
                  disabled={isSaving || isNestSubmitting}
                  onClick={() => void handleAddNestMember()}
                >
                  {isNestSubmitting
                    ? t("admin.wordDetailsNestAdding")
                    : t("admin.wordDetailsNestAdd")}
                </Button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t("admin.wordsSaving") : t("admin.wordsSave")}
              </Button>
              <Button
                type="button"
                style="secondary"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? t("admin.wordsDeleting") : t("admin.wordsDelete")}
              </Button>
            </div>
          </form>
        </PageSection>
      ) : null}
    </Page>
  );
}
