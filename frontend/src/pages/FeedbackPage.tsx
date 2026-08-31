import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { trackAnalyticsEvent } from "../analytics";
import { type FeedbackCategory, submitFeedback } from "../api/feedback";
import Button from "../components/UI/Button/Button";
import Card from "../components/UI/Card";
import Page from "../components/UI/Page";
import PageHeader from "../components/UI/PageHeader";
import "./style.scss";

const FEEDBACK_CATEGORIES: FeedbackCategory[] = ["bug", "feature", "question", "other"];
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 5000;

export default function FeedbackPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const trimmedMessage = message.trim();
  const canSubmit =
    trimmedMessage.length >= MESSAGE_MIN_LENGTH &&
    trimmedMessage.length <= MESSAGE_MAX_LENGTH &&
    !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    setIsSuccess(false);

    try {
      await submitFeedback({ category, message: trimmedMessage });
      trackAnalyticsEvent("feedback_submitted", { category });
      setMessage("");
      setCategory("other");
      setIsSuccess(true);
      setStatusMessage(t("feedbackPage.success"));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("feedbackPage.submitFailed");
      trackAnalyticsEvent("feedback_submit_failed", {
        category,
        reason: errorMessage,
      });
      setStatusMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Page width="full">
      <PageHeader title={t("feedbackPage.title")} subtitle={t("feedbackPage.description")} />

      <Card>
        <form onSubmit={handleSubmit}>
        <label className="upload-file__label" htmlFor="feedback-category">
          {t("feedbackPage.categoryLabel")}
        </label>
        <select
          id="feedback-category"
          className="upload-file__input upload-file__select"
          value={category}
          onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
          disabled={isSubmitting}
        >
          {FEEDBACK_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {t(`feedbackPage.categories.${value}`)}
            </option>
          ))}
        </select>

        <label className="upload-file__label" htmlFor="feedback-message">
          {t("feedbackPage.messageLabel")}
        </label>
        <textarea
          id="feedback-message"
          className="upload-file__textarea"
          rows={8}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={isSubmitting}
          placeholder={t("feedbackPage.messagePlaceholder")}
          maxLength={MESSAGE_MAX_LENGTH}
          required
        />
        <p className="upload-file__profile-hint">
          {t("feedbackPage.messageHint", {
            min: MESSAGE_MIN_LENGTH,
            max: MESSAGE_MAX_LENGTH,
          })}
        </p>

        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting ? t("feedbackPage.submitting") : t("feedbackPage.submit")}
        </Button>

        {statusMessage ? (
          <p
            className={`upload-file__profile-hint${isSuccess ? " upload-file__profile-hint--success" : ""}`}
            role="status"
          >
            {statusMessage}
          </p>
        ) : null}
        </form>
      </Card>
    </Page>
  );
}
