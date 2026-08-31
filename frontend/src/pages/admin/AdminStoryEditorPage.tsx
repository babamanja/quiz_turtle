import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  resolveUnlockedWordIds,
  STORY_STATUSES,
  STORY_TOKEN_KINDS,
  type StoryStatus,
  type StoryTokenKind,
} from "@language-turtle/shared";

import {
  type AdminLanguage,
  type AdminVocabWord,
  getAdminLanguages,
  getAdminVocabWords,
} from "../../api/admin";
import {
  type AdminStory,
  deleteAdminStory,
  getAdminStory,
  putAdminStoryContent,
  updateAdminStory,
} from "../../api/adminStories";
import StoryReader from "../../components/StoryReader";
import Button from "../../components/UI/Button/Button";
import ButtonLink from "../../components/UI/Button/ButtonLink";
import Checkbox from "../../components/UI/Checkbox";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import PageSection from "../../components/UI/PageSection";
import TextInput from "../../components/UI/TextInput";
import { useAdminPage } from "../../hooks/useAdminPage";
import { ADMIN_STORIES_PATH } from "../../paths";

import "../style.scss";

type DraftToken = {
  key: string;
  kind: StoryTokenKind;
  vocabWordId: number | null;
  baseForm: string;
  l1Text: string;
  glueToPrevious: boolean;
};

type DraftSentence = {
  key: string;
  tokens: DraftToken[];
};

type DraftUnlockLevel = {
  key: string;
  level: number;
  label: string;
  wordIds: number[];
};

let draftKeyCounter = 0;
function nextDraftKey(prefix: string): string {
  draftKeyCounter += 1;
  return `${prefix}-${draftKeyCounter}`;
}

function emptyToken(): DraftToken {
  return {
    key: nextDraftKey("token"),
    kind: "word",
    vocabWordId: null,
    baseForm: "",
    l1Text: "",
    glueToPrevious: false,
  };
}

function emptySentence(): DraftSentence {
  return {
    key: nextDraftKey("sentence"),
    tokens: [emptyToken()],
  };
}

function storyToDraft(story: AdminStory): {
  sentences: DraftSentence[];
  unlockLevels: DraftUnlockLevel[];
} {
  return {
    sentences:
      story.sentences.length > 0
        ? [...story.sentences]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((sentence) => ({
              key: nextDraftKey(`sentence-${sentence.id}`),
              tokens: [...sentence.tokens]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((token) => ({
                  key: nextDraftKey(`token-${token.id}`),
                  kind: token.kind,
                  vocabWordId: token.vocabWordId,
                  baseForm: token.baseForm,
                  l1Text: token.l1Text,
                  glueToPrevious: token.glueToPrevious,
                })),
            }))
        : [emptySentence()],
    unlockLevels: [...story.unlockLevels]
      .sort((a, b) => a.level - b.level)
      .map((level) => ({
        key: nextDraftKey(`level-${level.id}`),
        level: level.level,
        label: level.label ?? "",
        wordIds: [...level.wordIds],
      })),
  };
}

function collectAvailableWords(
  sentences: DraftSentence[],
  wordLabels: Record<number, string>,
): Array<{ id: number; label: string }> {
  const ids = new Set<number>();
  const items: Array<{ id: number; label: string }> = [];
  for (const sentence of sentences) {
    for (const token of sentence.tokens) {
      if (token.kind !== "word" || token.vocabWordId == null) {
        continue;
      }
      if (ids.has(token.vocabWordId)) {
        continue;
      }
      ids.add(token.vocabWordId);
      items.push({
        id: token.vocabWordId,
        label: wordLabels[token.vocabWordId] || token.baseForm || `#${token.vocabWordId}`,
      });
    }
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}

export default function AdminStoryEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { storyId: storyIdParam } = useParams();
  const storyId = Number(storyIdParam);

  const [languages, setLanguages] = useState<AdminLanguage[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<StoryStatus>("draft");
  const [primaryLanguageId, setPrimaryLanguageId] = useState<number | "">("");
  const [learningLanguageId, setLearningLanguageId] = useState<number | "">("");
  const [sentences, setSentences] = useState<DraftSentence[]>([emptySentence()]);
  const [unlockLevels, setUnlockLevels] = useState<DraftUnlockLevel[]>([]);
  const [previewLevel, setPreviewLevel] = useState(0);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [metaSuccess, setMetaSuccess] = useState<string | null>(null);
  const [contentSuccess, setContentSuccess] = useState<string | null>(null);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [wordSearchByToken, setWordSearchByToken] = useState<Record<string, string>>({});
  const [wordResultsByToken, setWordResultsByToken] = useState<Record<string, AdminVocabWord[]>>(
    {},
  );
  const [wordLabels, setWordLabels] = useState<Record<number, string>>({});

  const loadStory = useCallback(async () => {
    if (!Number.isInteger(storyId) || storyId < 1) {
      throw new Error(t("admin.storiesInvalidId"));
    }
    return getAdminStory(storyId);
  }, [storyId, t]);

  const { data: story, error, isLoading, setData, reload } = useAdminPage({
    load: loadStory,
    loadErrorMessage: t("admin.storiesLoadFailed"),
  });

  useEffect(() => {
    void getAdminLanguages()
      .then(setLanguages)
      .catch(() => {
        // Optional for display labels.
      });
  }, []);

  useEffect(() => {
    if (!story) {
      return;
    }
    setTitle(story.title);
    setStatus(story.status);
    setPrimaryLanguageId(story.primaryLanguageId);
    setLearningLanguageId(story.learningLanguageId);
    const draft = storyToDraft(story);
    setSentences(draft.sentences);
    setUnlockLevels(draft.unlockLevels);
    setPreviewLevel(0);
    setMetaError(null);
    setContentError(null);
    setMetaSuccess(null);
    setContentSuccess(null);

    const labels: Record<number, string> = {};
    for (const sentence of story.sentences) {
      for (const token of sentence.tokens) {
        if (token.vocabWordId != null) {
          labels[token.vocabWordId] = token.baseForm;
        }
      }
    }
    setWordLabels(labels);
  }, [story]);

  const learningLanguageFilter =
    learningLanguageId === "" ? undefined : learningLanguageId;

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (const [tokenKey, query] of Object.entries(wordSearchByToken)) {
      const trimmed = query.trim();
      if (trimmed.length < 1) {
        continue;
      }
      const timer = setTimeout(() => {
        void getAdminVocabWords({
          search: trimmed,
          languageId: learningLanguageFilter,
          pageSize: 20,
        })
          .then((result) => {
            setWordResultsByToken((prev) => ({ ...prev, [tokenKey]: result.items }));
            setWordLabels((prev) => {
              const next = { ...prev };
              for (const word of result.items) {
                next[word.id] = word.text;
              }
              return next;
            });
          })
          .catch(() => {
            setWordResultsByToken((prev) => ({ ...prev, [tokenKey]: [] }));
          });
      }, 300);
      timers.push(timer);
    }
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [wordSearchByToken, learningLanguageFilter]);

  const availableWords = useMemo(
    () => collectAvailableWords(sentences, wordLabels),
    [sentences, wordLabels],
  );

  const maxPreviewLevel = unlockLevels.length;
  const previewUnlockedIds = useMemo(
    () =>
      resolveUnlockedWordIds(
        previewLevel,
        unlockLevels.map((level) => ({ level: level.level, wordIds: level.wordIds })),
      ),
    [previewLevel, unlockLevels],
  );

  async function handleSaveMeta(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setMetaError(t("admin.storiesTitleRequired"));
      return;
    }
    if (primaryLanguageId === "" || learningLanguageId === "") {
      setMetaError(t("admin.storiesLanguagesRequired"));
      return;
    }

    setIsSavingMeta(true);
    setMetaError(null);
    setMetaSuccess(null);
    try {
      const updated = await updateAdminStory(storyId, {
        title: trimmedTitle,
        status,
        primaryLanguageId,
        learningLanguageId,
      });
      setData(updated);
      setMetaSuccess(t("admin.storiesMetaSaved"));
    } catch (saveError) {
      setMetaError(
        saveError instanceof Error ? saveError.message : t("admin.storiesSaveFailed"),
      );
    } finally {
      setIsSavingMeta(false);
    }
  }

  async function handleSaveContent() {
    setIsSavingContent(true);
    setContentError(null);
    setContentSuccess(null);
    try {
      const payload = {
        sentences: sentences.map((sentence, sentenceIndex) => ({
          sortOrder: sentenceIndex,
          tokens: sentence.tokens.map((token, tokenIndex) => ({
            sortOrder: tokenIndex,
            kind: token.kind,
            vocabWordId: token.kind === "word" ? token.vocabWordId : null,
            baseForm: token.baseForm.trim(),
            l1Text: token.l1Text.trim(),
            glueToPrevious: token.glueToPrevious,
          })),
        })),
        unlockLevels: unlockLevels.map((level, index) => ({
          level: index + 1,
          label: level.label.trim() || null,
          wordIds: level.wordIds,
        })),
      };
      const updated = await putAdminStoryContent(storyId, payload);
      setData(updated);
      setContentSuccess(t("admin.storiesContentSaved"));
    } catch (saveError) {
      setContentError(
        saveError instanceof Error ? saveError.message : t("admin.storiesContentSaveFailed"),
      );
    } finally {
      setIsSavingContent(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      t("admin.storiesDeleteConfirm", { title: title || `#${storyId}` }),
    );
    if (!confirmed) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteAdminStory(storyId);
      navigate(ADMIN_STORIES_PATH, { replace: true });
    } catch (deleteError) {
      window.alert(
        deleteError instanceof Error ? deleteError.message : t("admin.storiesDeleteFailed"),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function updateSentence(
    sentenceKey: string,
    updater: (sentence: DraftSentence) => DraftSentence,
  ) {
    setSentences((prev) =>
      prev.map((sentence) => (sentence.key === sentenceKey ? updater(sentence) : sentence)),
    );
  }

  function updateToken(sentenceKey: string, tokenKey: string, patch: Partial<DraftToken>) {
    updateSentence(sentenceKey, (sentence) => ({
      ...sentence,
      tokens: sentence.tokens.map((token) =>
        token.key === tokenKey ? { ...token, ...patch } : token,
      ),
    }));
  }

  if (!Number.isInteger(storyId) || storyId < 1) {
    return (
      <Page>
        <PageHeader title={t("admin.storiesEditorTitle")} />
        <p className="upload-file__error">{t("admin.storiesInvalidId")}</p>
        <ButtonLink to={ADMIN_STORIES_PATH} style="secondary">
          {t("admin.storiesBack")}
        </ButtonLink>
      </Page>
    );
  }

  if (isLoading) {
    return (
      <Page>
        <PageHeader title={t("admin.storiesEditorTitle")} />
        <p>{t("admin.storiesLoading")}</p>
      </Page>
    );
  }

  if (error || !story) {
    return (
      <Page>
        <PageHeader title={t("admin.storiesEditorTitle")} />
        <p className="upload-file__error">{error ?? t("admin.storiesLoadFailed")}</p>
        <ButtonLink to={ADMIN_STORIES_PATH} style="secondary">
          {t("admin.storiesBack")}
        </ButtonLink>
      </Page>
    );
  }

  return (
    <Page width="full">
      <PageHeader
        title={t("admin.storiesEditorTitle")}
        subtitle={story.title}
        actions={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <ButtonLink to={ADMIN_STORIES_PATH} style="secondary">
              {t("admin.storiesBack")}
            </ButtonLink>
            <Button
              type="button"
              style="secondary"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? t("admin.storiesDeleting") : t("admin.storiesDelete")}
            </Button>
          </div>
        }
      />

      <PageSection title={t("admin.storiesMetaSection")} titleAs="h2" gap="md">
        <form className="story-editor__meta" onSubmit={(event) => void handleSaveMeta(event)}>
          <TextInput
            label={t("admin.storiesFieldTitle")}
            value={title}
            onChange={setTitle}
            required
          />
          <label className="admin-field">
            <span className="admin-field__label">{t("admin.storiesFieldStatus")}</span>
            <select
              className="text-input"
              value={status}
              onChange={(event) => setStatus(event.target.value as StoryStatus)}
            >
              {STORY_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`admin.storiesStatus.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span className="admin-field__label">{t("admin.storiesPrimaryLanguage")}</span>
            <select
              className="text-input"
              value={primaryLanguageId}
              onChange={(event) => {
                const value = event.target.value;
                setPrimaryLanguageId(value ? Number(value) : "");
              }}
            >
              {languages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span className="admin-field__label">{t("admin.storiesLearningLanguage")}</span>
            <select
              className="text-input"
              value={learningLanguageId}
              onChange={(event) => {
                const value = event.target.value;
                setLearningLanguageId(value ? Number(value) : "");
              }}
            >
              {languages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>
          {metaError ? <p className="upload-file__error">{metaError}</p> : null}
          {metaSuccess ? <p className="story-editor__success">{metaSuccess}</p> : null}
          <Button type="submit" disabled={isSavingMeta}>
            {isSavingMeta ? t("admin.storiesSaving") : t("admin.storiesSaveMeta")}
          </Button>
        </form>
      </PageSection>

      <PageSection title={t("admin.storiesSentencesSection")} titleAs="h2" gap="md">
        <div className="story-editor__sentences">
          {sentences.map((sentence, sentenceIndex) => (
            <div key={sentence.key} className="story-editor__sentence">
              <div className="story-editor__sentence-header">
                <h3 className="story-editor__sentence-title">
                  {t("admin.storiesSentence", { n: sentenceIndex + 1 })}
                </h3>
                <Button
                  type="button"
                  style="secondary"
                  onClick={() =>
                    setSentences((prev) => prev.filter((item) => item.key !== sentence.key))
                  }
                  disabled={sentences.length <= 1}
                >
                  {t("admin.storiesRemoveSentence")}
                </Button>
              </div>
              <div className="story-editor__tokens">
                {sentence.tokens.map((token) => (
                  <div key={token.key} className="story-editor__token-row">
                    <label className="admin-field admin-field--compact">
                      <span className="admin-field__label">{t("admin.storiesTokenKind")}</span>
                      <select
                        className="text-input"
                        value={token.kind}
                        onChange={(event) =>
                          updateToken(sentence.key, token.key, {
                            kind: event.target.value as StoryTokenKind,
                            vocabWordId:
                              event.target.value === "punct" ? null : token.vocabWordId,
                          })
                        }
                      >
                        {STORY_TOKEN_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`admin.storiesTokenKindOption.${kind}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextInput
                      label={t("admin.storiesTokenBaseForm")}
                      value={token.baseForm}
                      onChange={(value) =>
                        updateToken(sentence.key, token.key, { baseForm: value })
                      }
                    />
                    <TextInput
                      label={t("admin.storiesTokenL1")}
                      value={token.l1Text}
                      onChange={(value) =>
                        updateToken(sentence.key, token.key, { l1Text: value })
                      }
                    />
                    <Checkbox
                      label={t("admin.storiesTokenGlue")}
                      checked={token.glueToPrevious}
                      onChange={(checked) =>
                        updateToken(sentence.key, token.key, { glueToPrevious: checked })
                      }
                    />
                    {token.kind === "word" ? (
                      <div className="story-editor__vocab-search">
                        <label className="admin-field">
                          <span className="admin-field__label">
                            {t("admin.storiesTokenVocabWord")}
                            {token.vocabWordId != null
                              ? ` (#${token.vocabWordId}${
                                  wordLabels[token.vocabWordId]
                                    ? ` · ${wordLabels[token.vocabWordId]}`
                                    : ""
                                })`
                              : ""}
                          </span>
                          <input
                            className="text-input"
                            value={wordSearchByToken[token.key] ?? ""}
                            onChange={(event) =>
                              setWordSearchByToken((prev) => ({
                                ...prev,
                                [token.key]: event.target.value,
                              }))
                            }
                            placeholder={t("admin.storiesVocabSearchPlaceholder")}
                          />
                        </label>
                        {(wordResultsByToken[token.key] ?? []).length > 0 ? (
                          <ul className="story-editor__vocab-results">
                            {(wordResultsByToken[token.key] ?? []).map((word) => (
                              <li key={word.id}>
                                <button
                                  type="button"
                                  className="story-editor__vocab-result"
                                  onClick={() => {
                                    updateToken(sentence.key, token.key, {
                                      vocabWordId: word.id,
                                      baseForm: token.baseForm || word.text,
                                    });
                                    setWordLabels((prev) => ({ ...prev, [word.id]: word.text }));
                                    setWordSearchByToken((prev) => ({
                                      ...prev,
                                      [token.key]: "",
                                    }));
                                    setWordResultsByToken((prev) => ({
                                      ...prev,
                                      [token.key]: [],
                                    }));
                                  }}
                                >
                                  {word.text}{" "}
                                  <span className="story-editor__vocab-meta">#{word.id}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {token.vocabWordId != null ? (
                          <Button
                            type="button"
                            style="secondary"
                            onClick={() =>
                              updateToken(sentence.key, token.key, { vocabWordId: null })
                            }
                          >
                            {t("admin.storiesClearVocabWord")}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      style="secondary"
                      onClick={() =>
                        updateSentence(sentence.key, (current) => ({
                          ...current,
                          tokens: current.tokens.filter((item) => item.key !== token.key),
                        }))
                      }
                      disabled={sentence.tokens.length <= 1}
                    >
                      {t("admin.storiesRemoveToken")}
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                style="secondary"
                onClick={() =>
                  updateSentence(sentence.key, (current) => ({
                    ...current,
                    tokens: [...current.tokens, emptyToken()],
                  }))
                }
              >
                {t("admin.storiesAddToken")}
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          style="secondary"
          onClick={() => setSentences((prev) => [...prev, emptySentence()])}
        >
          {t("admin.storiesAddSentence")}
        </Button>
      </PageSection>

      <PageSection title={t("admin.storiesUnlockSection")} titleAs="h2" gap="md">
        <p className="story-editor__hint">{t("admin.storiesUnlockHint")}</p>
        <div className="story-editor__levels">
          {unlockLevels.map((level, index) => (
            <div key={level.key} className="story-editor__level">
              <div className="story-editor__level-header">
                <strong>{t("admin.storiesLevel", { n: index + 1 })}</strong>
                <Button
                  type="button"
                  style="secondary"
                  onClick={() =>
                    setUnlockLevels((prev) =>
                      prev
                        .filter((item) => item.key !== level.key)
                        .map((item, levelIndex) => ({ ...item, level: levelIndex + 1 })),
                    )
                  }
                >
                  {t("admin.storiesRemoveLevel")}
                </Button>
              </div>
              <TextInput
                label={t("admin.storiesLevelLabel")}
                value={level.label}
                onChange={(value) =>
                  setUnlockLevels((prev) =>
                    prev.map((item) =>
                      item.key === level.key ? { ...item, label: value } : item,
                    ),
                  )
                }
              />
              <fieldset className="story-editor__word-checks">
                <legend>{t("admin.storiesLevelWords")}</legend>
                {availableWords.length === 0 ? (
                  <p className="story-editor__hint">{t("admin.storiesNoVocabWords")}</p>
                ) : (
                  availableWords.map((word) => (
                    <Checkbox
                      key={`${level.key}-${word.id}`}
                      label={`${word.label} (#${word.id})`}
                      checked={level.wordIds.includes(word.id)}
                      onChange={(checked) =>
                        setUnlockLevels((prev) =>
                          prev.map((item) => {
                            if (item.key !== level.key) {
                              return item;
                            }
                            const wordIds = checked
                              ? [...new Set([...item.wordIds, word.id])]
                              : item.wordIds.filter((id) => id !== word.id);
                            return { ...item, wordIds };
                          }),
                        )
                      }
                    />
                  ))
                )}
              </fieldset>
            </div>
          ))}
        </div>
        <Button
          type="button"
          style="secondary"
          onClick={() =>
            setUnlockLevels((prev) => [
              ...prev,
              {
                key: nextDraftKey("level"),
                level: prev.length + 1,
                label: "",
                wordIds: [],
              },
            ])
          }
        >
          {t("admin.storiesAddLevel")}
        </Button>
        {contentError ? <p className="upload-file__error">{contentError}</p> : null}
        {contentSuccess ? <p className="story-editor__success">{contentSuccess}</p> : null}
        <div className="story-editor__actions">
          <Button type="button" disabled={isSavingContent} onClick={() => void handleSaveContent()}>
            {isSavingContent ? t("admin.storiesSaving") : t("admin.storiesSaveContent")}
          </Button>
          <Button type="button" style="secondary" onClick={() => void reload()}>
            {t("admin.storiesReload")}
          </Button>
        </div>
      </PageSection>

      <PageSection title={t("admin.storiesPreviewSection")} titleAs="h2" gap="md">
        <label className="admin-field">
          <span className="admin-field__label">
            {t("admin.storiesPreviewLevel", { level: previewLevel, max: maxPreviewLevel })}
          </span>
          <input
            className="story-editor__preview-range"
            type="range"
            min={0}
            max={Math.max(0, maxPreviewLevel)}
            value={previewLevel}
            onChange={(event) => setPreviewLevel(Number(event.target.value))}
          />
        </label>
        <StoryReader
          sentences={sentences.map((sentence, index) => ({
            sortOrder: index,
            tokens: sentence.tokens.map((token) => ({
              kind: token.kind,
              vocabWordId: token.vocabWordId,
              baseForm: token.baseForm || "…",
              l1Text: token.l1Text || "…",
              glueToPrevious: token.glueToPrevious,
            })),
          }))}
          unlockedWordIds={previewUnlockedIds}
        />
      </PageSection>
    </Page>
  );
}
