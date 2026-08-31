import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { STORY_STATUSES, type StoryStatus } from "@language-turtle/shared";

import {
  type AdminLanguage,
  getAdminLanguages,
} from "../../api/admin";
import {
  type AdminStoryListItem,
  createAdminStory,
  deleteAdminStory,
  getAdminStories,
  type PaginationMeta,
} from "../../api/adminStories";
import Button from "../../components/UI/Button/Button";
import ButtonLink from "../../components/UI/Button/ButtonLink";
import Modal from "../../components/UI/Modal";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import ResponsiveDataList from "../../components/UI/ResponsiveDataList";
import type { DataListColumn } from "../../components/UI/dataListTypes";
import TextInput from "../../components/UI/TextInput";
import { useAdminPage } from "../../hooks/useAdminPage";
import { adminStoryPath } from "../../paths";

import "../style.scss";

const DEFAULT_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

export default function AdminStoriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StoryStatus | "">("");
  const [page, setPage] = useState(1);
  const [languages, setLanguages] = useState<AdminLanguage[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [primaryLanguageId, setPrimaryLanguageId] = useState<number | "">("");
  const [learningLanguageId, setLearningLanguageId] = useState<number | "">("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingStoryId, setDeletingStoryId] = useState<number | null>(null);

  useEffect(() => {
    void getAdminLanguages()
      .then(setLanguages)
      .catch(() => {
        // Language select is required for create; ignore optional reload errors.
      });
  }, []);

  const loadStories = useCallback(
    () =>
      getAdminStories({
        status: statusFilter,
        page,
        pageSize: 20,
      }),
    [page, statusFilter],
  );

  const { data, error, isLoading, reload } = useAdminPage({
    load: loadStories,
    loadErrorMessage: t("admin.storiesLoadFailed"),
  });

  const stories = data?.items ?? [];
  const paginationMeta = data?.pagination ?? {
    ...DEFAULT_PAGINATION,
    page,
  };

  function openCreateForm() {
    setTitle("");
    setPrimaryLanguageId(languages[0]?.id ?? "");
    setLearningLanguageId(languages[1]?.id ?? languages[0]?.id ?? "");
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError(t("admin.storiesTitleRequired"));
      return;
    }
    if (primaryLanguageId === "" || learningLanguageId === "") {
      setFormError(t("admin.storiesLanguagesRequired"));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await createAdminStory({
        title: trimmedTitle,
        primaryLanguageId,
        learningLanguageId,
        status: "draft",
      });
      closeForm();
      navigate(adminStoryPath(created.id));
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : t("admin.storiesSaveFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(story: AdminStoryListItem) {
    const confirmed = window.confirm(t("admin.storiesDeleteConfirm", { title: story.title }));
    if (!confirmed) {
      return;
    }
    setDeletingStoryId(story.id);
    try {
      await deleteAdminStory(story.id);
      await reload();
    } catch (deleteError) {
      window.alert(
        deleteError instanceof Error ? deleteError.message : t("admin.storiesDeleteFailed"),
      );
    } finally {
      setDeletingStoryId(null);
    }
  }

  const languageNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const language of languages) {
      map.set(language.id, language.name);
    }
    return map;
  }, [languages]);

  const columns = useMemo<DataListColumn<AdminStoryListItem>[]>(
    () => [
      {
        id: "adminStories.title",
        label: t("table.adminStories.title"),
        mobileRole: "summary-primary",
        render: (row) => row.title,
      },
      {
        id: "adminStories.status",
        label: t("table.adminStories.status"),
        mobileRole: "summary-secondary",
        render: (row) => (
          <span
            className={`story-status-badge story-status-badge--${row.status}`}
          >
            {t(`admin.storiesStatus.${row.status}`)}
          </span>
        ),
      },
      {
        id: "adminStories.languages",
        label: t("table.adminStories.languages"),
        mobileRole: "detail",
        render: (row) =>
          `${languageNameById.get(row.primaryLanguageId) ?? row.primaryLanguageId} → ${
            languageNameById.get(row.learningLanguageId) ?? row.learningLanguageId
          }`,
      },
      {
        id: "adminStories.sentences",
        label: t("table.adminStories.sentenceCount"),
        mobileRole: "detail",
        render: (row) => row.sentenceCount,
      },
      {
        id: "adminStories.levels",
        label: t("table.adminStories.unlockLevelCount"),
        mobileRole: "detail",
        render: (row) => row.unlockLevelCount,
      },
      {
        id: "adminStories.actions",
        label: t("admin.storiesActions"),
        mobileRole: "detail",
        render: (row) => (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <ButtonLink to={adminStoryPath(row.id)} style="secondary">
              {t("admin.storiesEdit")}
            </ButtonLink>
            <Button
              type="button"
              style="secondary"
              disabled={deletingStoryId === row.id}
              onClick={() => void handleDelete(row)}
            >
              {deletingStoryId === row.id
                ? t("admin.storiesDeleting")
                : t("admin.storiesDelete")}
            </Button>
          </div>
        ),
      },
    ],
    [deletingStoryId, languageNameById, t],
  );

  return (
    <Page width="full">
      <PageHeader
        title={t("admin.storiesTitle")}
        subtitle={t("admin.storiesDescription")}
        actions={
          <Button type="button" onClick={openCreateForm} disabled={languages.length === 0}>
            {t("admin.storiesAdd")}
          </Button>
        }
      />
      <div className="page-toolbar">
        <select
          className="text-input"
          style={{ maxWidth: 180, marginBottom: 0 }}
          value={statusFilter}
          onChange={(event) => {
            const value = event.target.value as StoryStatus | "";
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <option value="">{t("admin.storiesAllStatuses")}</option>
          {STORY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`admin.storiesStatus.${status}`)}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="upload-file__error">{error}</p> : null}
      {isLoading ? <p>{t("admin.storiesLoading")}</p> : null}
      {!isLoading ? (
        <>
          <ResponsiveDataList
            columns={columns}
            data={stories}
            getRowKey={(row) => String(row.id)}
            emptyMessage={t("admin.storiesEmpty")}
          />
          <div
            className="admin-pagination"
            style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "12px" }}
          >
            <Button
              style="secondary"
              disabled={paginationMeta.page <= 1}
              onClick={() => setPage(paginationMeta.page - 1)}
            >
              {t("admin.prevPage")}
            </Button>
            <span>
              {t("admin.page")} {paginationMeta.page} / {paginationMeta.totalPages}
            </span>
            <Button
              style="secondary"
              disabled={paginationMeta.page >= paginationMeta.totalPages}
              onClick={() => setPage(paginationMeta.page + 1)}
            >
              {t("admin.nextPage")}
            </Button>
            <span>
              {t("admin.totalRows")}: {paginationMeta.total}
            </span>
          </div>
        </>
      ) : null}

      <Modal
        open={formOpen}
        buttons={
          <>
            <Button type="button" style="secondary" onClick={closeForm} disabled={isSubmitting}>
              {t("admin.storiesCancel")}
            </Button>
            <Button type="submit" form="admin-story-create-form" disabled={isSubmitting}>
              {isSubmitting ? t("admin.storiesCreating") : t("admin.storiesCreate")}
            </Button>
          </>
        }
      >
        <form
          id="admin-story-create-form"
          className="add-word-modal"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <h2 className="add-word-modal__title">{t("admin.storiesAddTitle")}</h2>
          <TextInput
            label={t("admin.storiesFieldTitle")}
            value={title}
            onChange={setTitle}
            required
          />
          <label className="admin-field">
            <span className="admin-field__label">{t("admin.storiesPrimaryLanguage")}</span>
            <select
              className="text-input"
              value={primaryLanguageId}
              onChange={(event) => {
                const value = event.target.value;
                setPrimaryLanguageId(value ? Number(value) : "");
              }}
              required
            >
              <option value="">{t("admin.storiesSelectLanguage")}</option>
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
              required
            >
              <option value="">{t("admin.storiesSelectLanguage")}</option>
              {languages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>
          {formError ? <p className="upload-file__error">{formError}</p> : null}
        </form>
      </Modal>
    </Page>
  );
}
