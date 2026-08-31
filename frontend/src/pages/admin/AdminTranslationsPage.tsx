import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";

import {
  type AdminLanguage,
  type AdminTag,
  type AdminTranslation,
  createAdminTranslationRows,
  deleteAdminTranslation,
  getAdminLanguages,
  getAdminTags,
  getAdminTranslation,

  getAdminTranslations,

  type PaginationMeta,

  updateAdminTranslation,

} from "../../api/admin";

import PartOfSpeechSelect from "../../components/PartOfSpeechSelect";
import Button from "../../components/UI/Button/Button";

import Modal from "../../components/UI/Modal";

import Page from "../../components/UI/Page";

import PageHeader from "../../components/UI/PageHeader";

import ResponsiveDataList from "../../components/UI/ResponsiveDataList";

import type { DataListColumn } from "../../components/UI/dataListTypes";

import TextInput from "../../components/UI/TextInput";

import { useAdminPage } from "../../hooks/useAdminPage";

import TranslationRowsEditor, {

  createTranslationDraftRows,

  type TranslationDraftRow,

  toTranslationRowInputs,

} from "./TranslationRowsEditor";

import {

  buildTagTree,

  expandTagIdsWithAncestors,

  toggleTagSelection,

} from "./tagTree";

import TagTreePicker from "./TagTreePicker";

import "../style.scss";



const DEFAULT_PAGINATION: PaginationMeta = {

  page: 1,

  pageSize: 20,

  total: 0,

  totalPages: 1,

};



function mapTranslationError(code: string, t: (key: string) => string): string {

  switch (code) {

    case "word text is required":

      return t("admin.translationsTextRequired");

    case "invalid language id":

      return t("admin.translationsLanguageInvalid");

    case "language not found":

      return t("admin.translationsLanguageNotFound");

    case "primary and learning language must differ":

      return t("admin.translationsLanguagesMustDiffer");

    case "primary and learning word must differ":

      return t("admin.translationsWordsMustDiffer");

    case "translation pair already exists":

      return t("admin.translationsAlreadyExists");

    case "invalid translation rows":

      return t("admin.translationsInvalidRows");

    case "invalid part of speech":

      return t("admin.translationsPartOfSpeechInvalid");

    case "translation not found":

      return t("admin.translationsNotFound");

    case "translation is used by users":

      return t("admin.translationsHasUsers");

    case "invalid tag ids":

      return t("admin.translationsTagsInvalid");

    case "tag not found":

      return t("admin.translationsTagNotFound");

    default:

      return t("admin.translationsSaveFailed");

  }

}



function hasPartialRow(rows: TranslationDraftRow[]): boolean {

  return rows.some((row) => {

    const primary = row.primaryText.trim();

    const learning = row.learningText.trim();

    return (primary && !learning) || (!primary && learning);

  });

}



export default function AdminTranslationsPage() {

  const { t } = useTranslation();

  const [pagination, setPagination] = useState<PaginationMeta>(DEFAULT_PAGINATION);

  const [search, setSearch] = useState("");

  const [filterPrimaryLanguageId, setFilterPrimaryLanguageId] = useState<number | "">("");

  const [filterTagId, setFilterTagId] = useState<number | "">("");

  const [languages, setLanguages] = useState<AdminLanguage[]>([]);

  const [tags, setTags] = useState<AdminTag[]>([]);

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [draftRows, setDraftRows] = useState<TranslationDraftRow[]>(() =>

    createTranslationDraftRows(),

  );

  const [formMode, setFormMode] = useState<"create" | "edit">("create");

  const [editingTranslation, setEditingTranslation] = useState<AdminTranslation | null>(null);

  const [formOpen, setFormOpen] = useState(false);

  const [primaryLanguageId, setPrimaryLanguageId] = useState<number | "">("");

  const [primaryText, setPrimaryText] = useState("");

  const [learningLanguageId, setLearningLanguageId] = useState<number | "">("");

  const [learningText, setLearningText] = useState("");

  const [partOfSpeech, setPartOfSpeech] = useState("");

  const [formError, setFormError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isFormLoading, setIsFormLoading] = useState(false);

  const [deletingTranslationId, setDeletingTranslationId] = useState<number | null>(null);



  useEffect(() => {

    void Promise.all([getAdminLanguages(), getAdminTags()])

      .then(([loadedLanguages, loadedTags]) => {

        setLanguages(loadedLanguages);

        setTags(loadedTags);

      })

      .catch(() => {

        // Selectors stay empty until loaded.

      });

  }, []);



  const loadTranslations = useCallback(

    () =>

      getAdminTranslations({

        page: pagination.page,

        pageSize: pagination.pageSize,

        search: search || undefined,

        primaryLanguageId: filterPrimaryLanguageId === "" ? undefined : filterPrimaryLanguageId,

        tagId: filterTagId === "" ? undefined : filterTagId,

      }),

    [pagination.page, pagination.pageSize, search, filterPrimaryLanguageId, filterTagId],

  );



  const { data, error, isLoading, reload } = useAdminPage({

    load: loadTranslations,

    loadErrorMessage: t("admin.translationsLoadFailed"),

    trackOpenEvent: "admin_translations_opened",

  });



  const translations = data?.items ?? [];

  const paginationMeta = data?.pagination ?? pagination;

  const tagTree = useMemo(() => buildTagTree(tags), [tags]);
  const primaryLanguageName =
    languages.find((language) => language.id === primaryLanguageId)?.name ?? "";
  const learningLanguageName =
    languages.find((language) => language.id === learningLanguageId)?.name ?? "";



  const populateFormFromTranslation = useCallback(

    (translation: AdminTranslation) => {

      setPrimaryText(translation.primaryWord);

      setLearningText(translation.learningWord);

      setPartOfSpeech(translation.partOfSpeech ?? "");

      setPrimaryLanguageId(translation.primaryLanguageId);

      setLearningLanguageId(translation.learningLanguageId);

      setSelectedTagIds(expandTagIdsWithAncestors(translation.tagIds ?? [], tags));

    },

    [tags],

  );



  useEffect(() => {

    if (formMode !== "edit" || !editingTranslation || tags.length === 0) {

      return;

    }

    setSelectedTagIds(expandTagIdsWithAncestors(editingTranslation.tagIds ?? [], tags));

  }, [formMode, editingTranslation, tags]);



  function openCreateForm() {

    setFormMode("create");

    setEditingTranslation(null);

    setDraftRows(createTranslationDraftRows());

    setPrimaryLanguageId(languages[0]?.id ?? "");

    setLearningLanguageId(languages[1]?.id ?? languages[0]?.id ?? "");

    setFormError(null);

    setFormOpen(true);

  }



  function openEditForm(translation: AdminTranslation) {

    setFormMode("edit");

    setEditingTranslation(translation);

    populateFormFromTranslation(translation);

    setFormError(null);

    setFormOpen(true);



    void (async () => {

      setIsFormLoading(true);

      try {

        const fresh = await getAdminTranslation(translation.id);

        setEditingTranslation(fresh);

        populateFormFromTranslation(fresh);

      } catch {

        setFormError(t("admin.translationsLoadFailed"));

      } finally {

        setIsFormLoading(false);

      }

    })();

  }



  function closeForm() {

    setFormOpen(false);

    setFormMode("create");

    setEditingTranslation(null);

    setSelectedTagIds([]);

    setDraftRows(createTranslationDraftRows());

    setPartOfSpeech("");

    setFormError(null);

    setIsFormLoading(false);

  }



  function toggleTag(tagId: number) {

    setSelectedTagIds((current) => toggleTagSelection(tagId, current, tags));

  }



  async function handleSubmit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (primaryLanguageId === "" || learningLanguageId === "") {

      setFormError(t("admin.translationsLanguageRequired"));

      return;

    }

    if (primaryLanguageId === learningLanguageId) {

      setFormError(t("admin.translationsLanguagesMustDiffer"));

      return;

    }



    setIsSubmitting(true);

    setFormError(null);

    try {

      if (formMode === "edit" && editingTranslation) {

        const trimmedPrimary = primaryText.trim();

        const trimmedLearning = learningText.trim();

        if (!trimmedPrimary || !trimmedLearning) {

          setFormError(t("admin.translationsTextRequired"));

          return;

        }

        await updateAdminTranslation(editingTranslation.id, {

          primaryLanguageId,

          primaryText: trimmedPrimary,

          learningLanguageId,

          learningText: trimmedLearning,

          partOfSpeech: partOfSpeech || null,

          tagIds: selectedTagIds,

        });

      } else {

        if (hasPartialRow(draftRows)) {

          setFormError(t("admin.translationsPartialRow"));

          return;

        }

        const rows = toTranslationRowInputs(draftRows);

        if (rows.length === 0) {

          setFormError(t("admin.translationsTextRequired"));

          return;

        }

        const result = await createAdminTranslationRows({

          primaryLanguageId,

          learningLanguageId,

          rows,

        });

        if (result.skipped.length > 0) {

          const details = result.skipped

            .map((item) => `${item.label}: ${mapTranslationError(item.error, t)}`)

            .join("\n");

          window.alert(

            t("admin.translationsBatchPartial", {

              created: result.created.length,

              skipped: result.skipped.length,

              details,

            }),

          );

        }

      }

      closeForm();

      await reload();

    } catch (submitError) {

      const message =

        submitError instanceof Error

          ? submitError.message

          : t("admin.translationsSaveFailed");

      setFormError(mapTranslationError(message, t));

    } finally {

      setIsSubmitting(false);

    }

  }



  async function handleDelete(translation: AdminTranslation) {

    const confirmed = window.confirm(

      t("admin.translationsDeleteConfirm", {

        primary: translation.primaryWord,

        learning: translation.learningWord,

        count: translation.userPairCount,

      }),

    );

    if (!confirmed) {

      return;

    }



    setDeletingTranslationId(translation.id);

    try {

      await deleteAdminTranslation(translation.id);

      await reload();

    } catch (deleteError) {

      const message =

        deleteError instanceof Error

          ? deleteError.message

          : t("admin.translationsDeleteFailed");

      window.alert(mapTranslationError(message, t));

    } finally {

      setDeletingTranslationId(null);

    }

  }



  const columns = useMemo<DataListColumn<AdminTranslation>[]>(

    () => [

      {

        id: "adminTranslations.primaryWord",

        label: t("table.adminTranslations.primaryWord"),

        mobileRole: "summary-primary",

        render: (row) => `${row.primaryWord} (${row.primaryLanguage})`,

      },

      {

        id: "adminTranslations.learningWord",

        label: t("table.adminTranslations.learningWord"),

        mobileRole: "summary-secondary",

        render: (row) => `${row.learningWord} (${row.learningLanguage})`,

      },

      {

        id: "adminTranslations.id",

        label: t("table.adminTranslations.id"),

        mobileRole: "detail",

        render: (row) => row.id,

      },

      {

        id: "adminTranslations.userPairCount",

        label: t("table.adminTranslations.userPairCount"),

        mobileRole: "detail",

        render: (row) => row.userPairCount,

      },

      {

        id: "adminTranslations.tags",

        label: t("table.adminTranslations.tags"),

        mobileRole: "detail",

        mobileWide: true,

        render: (row) => (row.tagNames.length > 0 ? row.tagNames.join(", ") : "—"),

      },

      {

        id: "adminTranslations.actions",

        label: t("admin.translationsActions"),

        mobileRole: "detail",

        render: (row) => (

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>

            <Button type="button" style="secondary" onClick={() => openEditForm(row)}>

              {t("admin.translationsEdit")}

            </Button>

            <Button

              type="button"

              style="secondary"

              disabled={deletingTranslationId === row.id}

              onClick={() => void handleDelete(row)}

            >

              {deletingTranslationId === row.id

                ? t("admin.translationsDeleting")

                : t("admin.translationsDelete")}

            </Button>

          </div>

        ),

      },

    ],

    [deletingTranslationId, t],

  );



  return (

    <Page width="full">

      <PageHeader

        title={t("admin.translationsTitle")}

        subtitle={t("admin.translationsDescription")}

        actions={

          <Button

            type="button"

            onClick={openCreateForm}

            disabled={languages.length < 2}

          >

            {t("admin.translationsAdd")}

          </Button>

        }

      />

      <div className="page-toolbar">

        <input

          className="text-input"

          style={{ maxWidth: 280, marginBottom: 0 }}

          value={search}

          onChange={(event) => {

            setPagination((prev) => ({ ...prev, page: 1 }));

            setSearch(event.target.value);

          }}

          placeholder={t("admin.translationsSearchPlaceholder")}

        />

        <select

          className="text-input"

          style={{ maxWidth: 180, marginBottom: 0 }}

          value={filterPrimaryLanguageId}

          onChange={(event) => {

            const value = event.target.value;

            setPagination((prev) => ({ ...prev, page: 1 }));

            setFilterPrimaryLanguageId(value ? Number(value) : "");

          }}

        >

          <option value="">{t("admin.translationsAllLanguages")}</option>

          {languages.map((language) => (

            <option key={language.id} value={language.id}>

              {language.name}

            </option>

          ))}

        </select>

        <select

          className="text-input"

          style={{ maxWidth: 200, marginBottom: 0 }}

          value={filterTagId}

          onChange={(event) => {

            const value = event.target.value;

            setPagination((prev) => ({ ...prev, page: 1 }));

            setFilterTagId(value ? Number(value) : "");

          }}

        >

          <option value="">{t("admin.translationsAllTags")}</option>

          {tags.map((tag) => (

            <option key={tag.id} value={tag.id}>

              {tag.name}

            </option>

          ))}

        </select>

      </div>

      {error ? <p className="upload-file__error">{error}</p> : null}

      {isLoading ? <p>{t("admin.translationsLoading")}</p> : null}

      {!isLoading ? (

        <>

          <ResponsiveDataList

            columns={columns}

            data={translations}

            getRowKey={(row) => String(row.id)}

            emptyMessage={t("admin.translationsEmpty")}

          />

          <div

            className="admin-pagination"

            style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "12px" }}

          >

            <Button

              style="secondary"

              disabled={paginationMeta.page <= 1}

              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}

            >

              {t("admin.prevPage")}

            </Button>

            <span>

              {t("admin.page")} {paginationMeta.page} / {paginationMeta.totalPages}

            </span>

            <Button

              style="secondary"

              disabled={paginationMeta.page >= paginationMeta.totalPages}

              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}

            >

              {t("admin.nextPage")}

            </Button>

            <span>

              {t("admin.totalRows")}: {paginationMeta.total}

            </span>

            <select

              className="text-input"

              style={{ maxWidth: 120, marginBottom: 0 }}

              value={pagination.pageSize}

              onChange={(event) => {

                setPagination({

                  page: 1,

                  pageSize: Number(event.target.value),

                  total: paginationMeta.total,

                  totalPages: paginationMeta.totalPages,

                });

              }}

            >

              <option value={20}>20</option>

              <option value={50}>50</option>

              <option value={100}>100</option>

            </select>

          </div>

        </>

      ) : null}



      <Modal

        open={formOpen}

        buttons={

          <>

            <Button style="secondary" onClick={closeForm} disabled={isSubmitting || isFormLoading}>

              {t("admin.translationsCancel")}

            </Button>

            <Button

              type="submit"

              form="admin-translation-form"

              disabled={isSubmitting || isFormLoading}

            >

              {isSubmitting

                ? t("admin.translationsSaving")

                : formMode === "create"

                  ? t("admin.translationsCreate")

                  : t("admin.translationsSave")}

            </Button>

          </>

        }

      >

        <form

          id="admin-translation-form"

          className={`add-word-modal${formMode === "create" ? " add-word-modal--table" : ""}`}

          onSubmit={handleSubmit}

        >

          <h2 className="add-word-modal__title">

            {formMode === "create"

              ? t("admin.translationsAddTitle")

              : t("admin.translationsEditTitle")}

          </h2>

          {formError ? <p className="upload-file__error">{formError}</p> : null}

          {isFormLoading ? <p className="add-word-modal__hint">{t("admin.translationsFormLoading")}</p> : null}



          <div className="add-word-modal__languages">

            <div>

              <label className="add-word-modal__hint" htmlFor="admin-translation-primary-language">

                {t("admin.translationsLanguage1")}

              </label>

              <select

                id="admin-translation-primary-language"

                className="text-input"

                value={primaryLanguageId}

                disabled={isSubmitting || isFormLoading}

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

            </div>

            <div>

              <label className="add-word-modal__hint" htmlFor="admin-translation-learning-language">

                {t("admin.translationsLanguage2")}

              </label>

              <select

                id="admin-translation-learning-language"

                className="text-input"

                value={learningLanguageId}

                disabled={isSubmitting || isFormLoading}

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

            </div>

          </div>

          {formMode === "edit" ? (
            <div className="add-word-modal__pos-field">
              <label className="add-word-modal__hint" htmlFor="admin-translation-pos">
                {t("wordDetailPage.partOfSpeech")}
              </label>
              <PartOfSpeechSelect
                id="admin-translation-pos"
                value={partOfSpeech}
                disabled={isSubmitting || isFormLoading}
                onChange={setPartOfSpeech}
              />
            </div>
          ) : null}

          {formMode === "create" ? (

            <TranslationRowsEditor

              rows={draftRows}

              tags={tags}

              tagTree={tagTree}

              primaryLanguageName={primaryLanguageName}

              learningLanguageName={learningLanguageName}

              disabled={isSubmitting || isFormLoading}

              onChange={setDraftRows}

            />

          ) : (

            <>

              <label className="add-word-modal__hint" htmlFor="admin-translation-primary-text">

                {t("admin.translationsWordLanguage1")}

              </label>

              <TextInput

                id="admin-translation-primary-text"

                value={primaryText}

                onChange={setPrimaryText}

                disabled={isSubmitting || isFormLoading}

                required

              />

              <label className="add-word-modal__hint" htmlFor="admin-translation-learning-text">

                {t("admin.translationsWordLanguage2")}

              </label>

              <TextInput

                id="admin-translation-learning-text"

                value={learningText}

                onChange={setLearningText}

                disabled={isSubmitting || isFormLoading}

                required

              />

              <p className="add-word-modal__hint">{t("admin.translationsTags")}</p>

              {tags.length === 0 ? (

                <p className="add-word-modal__hint">{t("admin.translationsTagsEmpty")}</p>

              ) : (

                <div className="add-word-modal__tag-list">

                  <TagTreePicker

                    nodes={tagTree}

                    selectedTagIds={selectedTagIds}

                    disabled={isSubmitting || isFormLoading}

                    onToggle={toggleTag}

                  />

                </div>

              )}

            </>

          )}

        </form>

      </Modal>

    </Page>

  );

}


