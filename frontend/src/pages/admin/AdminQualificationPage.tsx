import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { trackAnalyticsEvent } from "../../analytics";
import {
  type AdminQualificationSubmission,
  getAdminQualificationSubmissions,
  getAdminQualificationTemplate,
  type PaginationMeta,
  updateAdminQualificationTemplate,
} from "../../api/admin";
import Button from "../../components/UI/Button/Button";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import PageSection from "../../components/UI/PageSection";
import ResponsiveDataList from "../../components/UI/ResponsiveDataList";
import type { DataListColumn } from "../../components/UI/dataListTypes";
import { useAdminPage } from "../../hooks/useAdminPage";
import { formatRelativeTime } from "../../utils/convertTime";
import "../style.scss";

type AdminEditableQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

function parseQuestionsJson(raw: string): AdminEditableQuestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("questions must be valid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("questions must be an array");
  }
  const questions = parsed
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const obj = item as { id?: unknown; prompt?: unknown; options?: unknown };
      const id =
        typeof obj.id === "string" && obj.id.trim().length > 0 ? obj.id.trim() : `q${index + 1}`;
      const prompt = typeof obj.prompt === "string" ? obj.prompt.trim() : "";
      if (!prompt || !Array.isArray(obj.options)) {
        return null;
      }
      const options = obj.options
        .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
        .filter((opt) => opt.length > 0);
      if (options.length < 2 || options.length > 10) {
        return null;
      }
      return { id, prompt, options };
    })
    .filter((item): item is AdminEditableQuestion => item !== null);
  if (!questions.length) {
    throw new Error("at least one valid question is required");
  }
  return questions;
}

function formatSubmissionAnswers(
  submission: AdminQualificationSubmission,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (submission.status === "skipped") {
    if (submission.deferredUntil) {
      return t("admin.qualificationResponsesSkippedUntil", {
        date: formatRelativeTime(submission.deferredUntil),
      });
    }
    return t("admin.qualificationResponsesSkipped");
  }

  return submission.answers
    .map((answer) => {
      const parts = [answer.selectedOption, answer.freeText].filter(Boolean);
      return `${answer.prompt}: ${parts.join(" — ") || "—"}`;
    })
    .join("\n");
}

export default function AdminQualificationPage() {
  const { t } = useTranslation();
  const [submissions, setSubmissions] = useState<AdminQualificationSubmission[]>([]);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [isResponsesLoading, setIsResponsesLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "completed" | "skipped">("");

  const loadTemplate = useCallback(
    () => getAdminQualificationTemplate().then((data) => JSON.stringify(data.questions, null, 2)),
    [],
  );

  const saveTemplate = useCallback(async (rawQuestions: string) => {
    const questions = parseQuestionsJson(rawQuestions);
    const result = await updateAdminQualificationTemplate(questions);
    trackAnalyticsEvent("admin_qualification_template_saved", {});
    return JSON.stringify(result.questions, null, 2);
  }, []);

  const {
    data: rawQuestions,
    setData: setRawQuestions,
    isLoading,
    isSaving,
    error,
    success,
    save,
  } = useAdminPage({
    load: loadTemplate,
    save: saveTemplate,
    loadErrorMessage: t("admin.qualificationLoadFailed"),
    saveErrorMessage: t("admin.qualificationSaveFailed"),
    saveSuccessMessage: t("admin.qualificationSaved"),
  });

  useEffect(() => {
    setIsResponsesLoading(true);
    setResponsesError(null);
    getAdminQualificationSubmissions({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: search || undefined,
      status: status || undefined,
    })
      .then((data) => {
        setSubmissions(data.items);
        setPagination(data.pagination);
      })
      .catch((loadError) => {
        setResponsesError(
          loadError instanceof Error
            ? loadError.message
            : t("admin.qualificationResponsesLoadFailed"),
        );
      })
      .finally(() => setIsResponsesLoading(false));
  }, [pagination.page, pagination.pageSize, search, status, t]);

  const submissionColumns = useMemo<DataListColumn<AdminQualificationSubmission>[]>(
    () => [
      {
        id: "userNameSummary",
        label: t("admin.qualificationResponsesUser"),
        mobileRole: "summary-primary",
        desktopHidden: true,
        render: (submission) => submission.userName,
      },
      {
        id: "userName",
        label: t("admin.qualificationResponsesUser"),
        hideOnMobile: true,
        render: (submission) => (
          <Link to={`/admin/users/${submission.userId}`}>{submission.userName}</Link>
        ),
      },
      {
        id: "status",
        label: t("admin.qualificationResponsesStatus"),
        mobileRole: "summary-secondary",
        render: (submission) =>
          submission.status === "completed"
            ? t("admin.qualificationResponsesStatusCompleted")
            : t("admin.qualificationResponsesStatusSkipped"),
      },
      {
        id: "email",
        label: t("admin.qualificationResponsesEmail"),
        mobileRole: "detail",
        mobileWide: true,
        render: (submission) => submission.email,
      },
      {
        id: "submittedAt",
        label: t("admin.qualificationResponsesSubmittedAt"),
        mobileRole: "detail",
        render: (submission) => formatRelativeTime(submission.submittedAt),
      },
      {
        id: "answers",
        label: t("admin.qualificationResponsesAnswers"),
        mobileRole: "detail",
        mobileWide: true,
        render: (submission) => (
          <span style={{ whiteSpace: "pre-wrap" }}>{formatSubmissionAnswers(submission, t)}</span>
        ),
      },
    ],
    [t],
  );

  return (
    <Page width="full">
      <PageHeader
        title={t("admin.qualificationTitle")}
        subtitle={t("admin.qualificationDescription")}
      />
      {error && <p className="upload-file__error upload-file__error--alert">{error}</p>}
      {success && <p>{success}</p>}
      <label className="upload-file__label" htmlFor="admin-qualification-template">
        {t("admin.qualificationLabel")}
      </label>
      <textarea
        id="admin-qualification-template"
        className="upload-file__textarea"
        rows={12}
        value={rawQuestions ?? ""}
        onChange={(event) => setRawQuestions(event.target.value)}
        disabled={isLoading || isSaving}
      />
      <div className="upload-file__upload-control">
        <Button onClick={save} disabled={isLoading || isSaving}>
          {isSaving ? t("admin.saving") : t("admin.saveQualification")}
        </Button>
      </div>
      <p>{t("admin.qualificationHelp")}</p>

      <PageSection
        className="admin-qualification-responses"
        title={t("admin.qualificationResponsesTitle")}
        titleAs="h2"
        gap="lg"
      >
        <p className="upload-file__subtitle">{t("admin.qualificationResponsesDescription")}</p>
        {responsesError && (
          <p className="upload-file__error upload-file__error--alert">{responsesError}</p>
        )}
        <div className="page-toolbar">
          <input
            className="text-input"
            style={{ maxWidth: 260, marginBottom: 0 }}
            value={search}
            onChange={(event) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setSearch(event.target.value);
            }}
            placeholder={t("admin.filtersSearch")}
          />
          <select
            className="text-input"
            style={{ maxWidth: 180, marginBottom: 0 }}
            value={status}
            onChange={(event) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setStatus(event.target.value as typeof status);
            }}
          >
            <option value="">{t("admin.filtersStatusAll")}</option>
            <option value="completed">{t("admin.qualificationResponsesStatusCompleted")}</option>
            <option value="skipped">{t("admin.qualificationResponsesStatusSkipped")}</option>
          </select>
        </div>
        {isResponsesLoading ? (
          <p>{t("admin.qualificationResponsesLoading")}</p>
        ) : (
          <>
            <ResponsiveDataList
              columns={submissionColumns}
              data={submissions}
              getRowKey={(submission) => String(submission.id)}
            />
            <div
              className="admin-pagination"
              style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px" }}
            >
              <Button
                style="secondary"
                disabled={pagination.page <= 1 || isResponsesLoading}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                }
              >
                {t("admin.prevPage")}
              </Button>
              <span>
                {t("admin.page")} {pagination.page} / {pagination.totalPages} ({pagination.total})
              </span>
              <Button
                style="secondary"
                disabled={pagination.page >= pagination.totalPages || isResponsesLoading}
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(prev.totalPages, prev.page + 1),
                  }))
                }
              >
                {t("admin.nextPage")}
              </Button>
            </div>
          </>
        )}
      </PageSection>
    </Page>
  );
}
