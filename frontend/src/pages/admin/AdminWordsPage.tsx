import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  type AdminLanguage,
  type AdminVocabWord,
  createAdminVocabWord,
  deleteAdminVocabWord,
  getAdminLanguages,
  getAdminVocabWords,
  type PaginationMeta,
} from "../../api/admin";
import { languagesTaughtByUser } from "../../appMode";
import { getStoredUser } from "../../userStorage";
import Button from "../../components/UI/Button/Button";
import ButtonLink from "../../components/UI/Button/ButtonLink";
import Modal from "../../components/UI/Modal";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import ResponsiveDataList from "../../components/UI/ResponsiveDataList";
import type { DataListColumn } from "../../components/UI/dataListTypes";
import TextInput from "../../components/UI/TextInput";
import { useAdminPage } from "../../hooks/useAdminPage";
import { adminWordDetailPath } from "../../paths";
import "../style.scss";

const DEFAULT_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

type WordsSortBy = "id" | "text" | "language";

type AdminWordsQuery = {
  search: string;
  languageId: number | "";
  sortBy: WordsSortBy;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
};

function parseAdminWordsQuery(params: URLSearchParams): AdminWordsQuery {
  const search = params.get("search") ?? "";
  const languageIdRaw = Number(params.get("languageId"));
  const languageId =
    Number.isInteger(languageIdRaw) && languageIdRaw > 0 ? languageIdRaw : "";
  const sortByRaw = params.get("sortBy");
  const sortBy: WordsSortBy =
    sortByRaw === "text" || sortByRaw === "language" ? sortByRaw : "id";
  const sortOrder = params.get("sortOrder") === "desc" ? "desc" : "asc";
  const pageRaw = Number(params.get("page"));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSizeRaw = Number(params.get("pageSize"));
  const pageSize = pageSizeRaw === 50 || pageSizeRaw === 100 ? pageSizeRaw : 20;
  return { search, languageId, sortBy, sortOrder, page, pageSize };
}

function buildAdminWordsQueryParams(query: AdminWordsQuery): URLSearchParams {
  const params = new URLSearchParams();
  const trimmedSearch = query.search.trim();
  if (trimmedSearch) {
    params.set("search", trimmedSearch);
  }
  if (query.languageId !== "") {
    params.set("languageId", String(query.languageId));
  }
  if (query.sortBy !== "id") {
    params.set("sortBy", query.sortBy);
  }
  if (query.sortOrder !== "asc") {
    params.set("sortOrder", query.sortOrder);
  }
  if (query.page > 1) {
    params.set("page", String(query.page));
  }
  if (query.pageSize !== 20) {
    params.set("pageSize", String(query.pageSize));
  }
  return params;
}

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
    default:
      return t("admin.wordsSaveFailed");
  }
}

export default function AdminWordsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseAdminWordsQuery(searchParams), [searchParams]);
  const [languages, setLanguages] = useState<AdminLanguage[]>([]);
  const taughtLanguages = languagesTaughtByUser(languages, getStoredUser()?.taughtLanguageIds);
  const [formOpen, setFormOpen] = useState(false);
  const [text, setText] = useState("");
  const [formLanguageId, setFormLanguageId] = useState<number | "">("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingWordId, setDeletingWordId] = useState<number | null>(null);

  const updateQuery = useCallback(
    (patch: Partial<AdminWordsQuery>, options?: { resetPage?: boolean }) => {
      const nextQuery: AdminWordsQuery = {
        ...query,
        ...patch,
        ...(options?.resetPage ? { page: 1 } : {}),
      };
      setSearchParams(buildAdminWordsQueryParams(nextQuery), { replace: true });
    },
    [query, setSearchParams],
  );

  useEffect(() => {
    void getAdminLanguages()
      .then(setLanguages)
      .catch(() => {
        // Language filter is optional; ignore load errors.
      });
  }, []);

  const loadWords = useCallback(
    () =>
      getAdminVocabWords({
        page: query.page,
        pageSize: query.pageSize,
        search: query.search.trim() || undefined,
        languageId: query.languageId === "" ? undefined : query.languageId,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      }),
    [query],
  );

  const { data, error, isLoading, reload } = useAdminPage({
    load: loadWords,
    loadErrorMessage: t("admin.wordsLoadFailed"),
    trackOpenEvent: "admin_words_opened",
  });

  const words = data?.items ?? [];
  const paginationMeta = data?.pagination ?? {
    ...DEFAULT_PAGINATION,
    page: query.page,
    pageSize: query.pageSize,
  };

  function openCreateForm() {
    setText("");
    const filteredLanguageId =
      query.languageId !== "" &&
      languages.some((language) => language.id === query.languageId)
        ? query.languageId
        : "";
    setFormLanguageId(filteredLanguageId || languages[0]?.id || "");
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText) {
      setFormError(t("admin.wordsTextRequired"));
      return;
    }
    if (formLanguageId === "") {
      setFormError(t("admin.wordsLanguageRequired"));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await createAdminVocabWord({ text: trimmedText, languageId: formLanguageId });
      closeForm();
      navigate(adminWordDetailPath(created.id));
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t("admin.wordsSaveFailed");
      setFormError(mapWordError(message, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(word: AdminVocabWord) {
    const pairCount = word.primaryPairCount + word.learningPairCount;
    const confirmed = window.confirm(
      t("admin.wordsDeleteConfirm", { text: word.text, count: pairCount }),
    );
    if (!confirmed) {
      return;
    }

    setDeletingWordId(word.id);
    try {
      await deleteAdminVocabWord(word.id);
      await reload();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : t("admin.wordsDeleteFailed");
      window.alert(mapWordError(message, t));
    } finally {
      setDeletingWordId(null);
    }
  }

  const columns = useMemo<DataListColumn<AdminVocabWord>[]>(
    () => [
      {
        id: "adminWords.text",
        label: t("table.adminWords.text"),
        mobileRole: "summary-primary",
        render: (row) => row.text,
      },
      {
        id: "adminWords.language",
        label: t("table.adminWords.language"),
        mobileRole: "summary-secondary",
        render: (row) => row.languageName,
      },
      {
        id: "adminWords.id",
        label: t("table.adminWords.id"),
        mobileRole: "detail",
        render: (row) => row.id,
      },
      {
        id: "adminWords.primaryPairCount",
        label: t("table.adminWords.primaryPairCount"),
        mobileRole: "detail",
        render: (row) => row.primaryPairCount,
      },
      {
        id: "adminWords.learningPairCount",
        label: t("table.adminWords.learningPairCount"),
        mobileRole: "detail",
        render: (row) => row.learningPairCount,
      },
      {
        id: "adminWords.actions",
        label: t("admin.wordsActions"),
        mobileRole: "detail",
        render: (row) => (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <ButtonLink to={adminWordDetailPath(row.id)} style="secondary">
              {t("admin.wordsEdit")}
            </ButtonLink>
            <Button
              type="button"
              style="secondary"
              disabled={deletingWordId === row.id}
              onClick={() => void handleDelete(row)}
            >
              {deletingWordId === row.id ? t("admin.wordsDeleting") : t("admin.wordsDelete")}
            </Button>
          </div>
        ),
      },
    ],
    [deletingWordId, t],
  );

  return (
    <Page width="full">
      <PageHeader
        title={t("admin.wordsTitle")}
        subtitle={t("admin.wordsDescription")}
        actions={
          <Button type="button" onClick={openCreateForm} disabled={languages.length === 0}>
            {t("admin.wordsAdd")}
          </Button>
        }
      />
      <div className="page-toolbar">
        <input
          className="text-input"
          style={{ maxWidth: 280, marginBottom: 0 }}
          value={query.search}
          onChange={(event) => {
            updateQuery({ search: event.target.value }, { resetPage: true });
          }}
          placeholder={t("admin.wordsSearchPlaceholder")}
        />
        <select
          className="text-input"
          style={{ maxWidth: 180, marginBottom: 0 }}
          value={query.languageId}
          onChange={(event) => {
            const value = event.target.value;
            updateQuery(
              { languageId: value ? Number(value) : "" },
              { resetPage: true },
            );
          }}
        >
          <option value="">{t("admin.wordsAllLanguages")}</option>
          {taughtLanguages.map((language) => (
            <option key={language.id} value={language.id}>
              {language.name}
            </option>
          ))}
        </select>
        <select
          className="text-input"
          style={{ maxWidth: 180, marginBottom: 0 }}
          value={query.sortBy}
          onChange={(event) => {
            updateQuery({ sortBy: event.target.value as WordsSortBy });
          }}
        >
          <option value="id">{t("table.adminWords.id")}</option>
          <option value="text">{t("table.adminWords.text")}</option>
          <option value="language">{t("table.adminWords.language")}</option>
        </select>
        <select
          className="text-input"
          style={{ maxWidth: 140, marginBottom: 0 }}
          value={query.sortOrder}
          onChange={(event) => {
            updateQuery({ sortOrder: event.target.value as "asc" | "desc" });
          }}
        >
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
      </div>
      {error ? <p className="upload-file__error">{error}</p> : null}
      {isLoading ? <p>{t("admin.wordsLoading")}</p> : null}
      {!isLoading ? (
        <>
          <ResponsiveDataList
            columns={columns}
            data={words}
            getRowKey={(row) => String(row.id)}
            emptyMessage={t("admin.wordsEmpty")}
          />
          <div
            className="admin-pagination"
            style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "12px" }}
          >
            <Button
              style="secondary"
              disabled={paginationMeta.page <= 1}
              onClick={() => updateQuery({ page: paginationMeta.page - 1 })}
            >
              {t("admin.prevPage")}
            </Button>
            <span>
              {t("admin.page")} {paginationMeta.page} / {paginationMeta.totalPages}
            </span>
            <Button
              style="secondary"
              disabled={paginationMeta.page >= paginationMeta.totalPages}
              onClick={() => updateQuery({ page: paginationMeta.page + 1 })}
            >
              {t("admin.nextPage")}
            </Button>
            <span>
              {t("admin.totalRows")}: {paginationMeta.total}
            </span>
            <select
              className="text-input"
              style={{ maxWidth: 120, marginBottom: 0 }}
              value={query.pageSize}
              onChange={(event) => {
                const pageSizeRaw = Number(event.target.value);
                const pageSize =
                  pageSizeRaw === 50 || pageSizeRaw === 100 ? pageSizeRaw : 20;
                updateQuery({ pageSize }, { resetPage: true });
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
            <Button style="secondary" onClick={closeForm} disabled={isSubmitting}>
              {t("admin.wordsCancel")}
            </Button>
            <Button type="submit" form="admin-word-form" disabled={isSubmitting}>
              {isSubmitting ? t("admin.wordsSaving") : t("admin.wordsCreate")}
            </Button>
          </>
        }
      >
        <form id="admin-word-form" className="add-word-modal" onSubmit={handleSubmit}>
          <h2 className="add-word-modal__title">{t("admin.wordsAddTitle")}</h2>
          {formError ? <p className="upload-file__error">{formError}</p> : null}
          <label className="add-word-modal__hint" htmlFor="admin-word-text">
            {t("table.adminWords.text")}
          </label>
          <TextInput
            id="admin-word-text"
            value={text}
            onChange={setText}
            disabled={isSubmitting}
            required
          />
          <label className="add-word-modal__hint" htmlFor="admin-word-language">
            {t("table.adminWords.language")}
          </label>
          <select
            id="admin-word-language"
            className="text-input"
            style={{ marginBottom: 0 }}
            value={formLanguageId}
            disabled={isSubmitting}
            onChange={(event) => {
              const value = event.target.value;
              setFormLanguageId(value ? Number(value) : "");
            }}
          >
            {taughtLanguages.map((language) => (
              <option key={language.id} value={language.id}>
                {language.name}
              </option>
            ))}
          </select>
        </form>
      </Modal>
    </Page>
  );
}
