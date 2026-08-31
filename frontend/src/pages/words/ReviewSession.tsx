import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { trackAnalyticsEvent } from "../../analytics";
import {
  getDueReviewWords,
  submitReviewCheck,
  submitReviewConfirm,
  submitReviewDontRemember,
  type ReviewMatch,
  type ReviewResult,
  type ReviewWord,
} from "../../api/words";
import Button from "../../components/UI/Button/Button";
import ButtonLink from "../../components/UI/Button/ButtonLink";
import Card from "../../components/UI/Card";
import TextInput from "../../components/UI/TextInput";
import { WORDS_PATH } from "../../paths";

import ForgettingCurve from "./ForgettingCurve";
import { reviewScheduleForDisplay } from "./reviewSchedule";

type ReviewPhase = "loading" | "empty" | "card" | "revealed";

type RevealedAnswer = ReviewResult & {
  awaitingConfirmation: boolean;
};

type ReviewSessionProps = {
  embedded?: boolean;
  trackOpen?: boolean;
};

export default function ReviewSession({ embedded = false, trackOpen = true }: ReviewSessionProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<ReviewPhase>("loading");
  const [queue, setQueue] = useState<ReviewWord[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState<RevealedAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startSession = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setRevealed(null);
    setAnswer("");
    setIndex(0);
    try {
      const words = await getDueReviewWords();
      if (words.length === 0) {
        setQueue([]);
        setPhase("empty");
        return;
      }
      setQueue(words);
      setPhase("card");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("reviewPage.loadFailed"));
      setPhase("empty");
    }
  }, [t]);

  useEffect(() => {
    if (trackOpen) {
      trackAnalyticsEvent("review_page_opened", {});
    }
    void startSession();
  }, [startSession, trackOpen]);

  const currentCard = queue[index] ?? null;
  const totalWords = queue.length;
  const trimmedAnswer = answer.trim();

  function toRevealed(result: ReviewResult): RevealedAnswer {
    return {
      ...result,
      awaitingConfirmation: result.match === "close",
    };
  }

  async function submitReview(submit: () => Promise<ReviewResult>) {
    if (!currentCard || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submit();
      setRevealed(toRevealed(result));
      setPhase("revealed");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("reviewPage.submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCheck() {
    if (!trimmedAnswer) {
      return;
    }
    void submitReview(() =>
      submitReviewCheck(currentCard!.vocabPairId, trimmedAnswer, currentCard!.direction),
    );
  }

  function handleDontRemember() {
    void submitReview(() =>
      submitReviewDontRemember(currentCard!.vocabPairId, currentCard!.direction),
    );
  }

  async function handleConfirm(result: "know" | "dont") {
    if (!currentCard || isSubmitting || !revealed?.awaitingConfirmation) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const confirmed = await submitReviewConfirm(
        currentCard.vocabPairId,
        result,
        currentCard.direction,
      );
      setRevealed({
        ...confirmed,
        userAnswer: revealed.userAnswer,
        awaitingConfirmation: false,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("reviewPage.submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      setQueue([]);
      setPhase("empty");
      setRevealed(null);
      setAnswer("");
      return;
    }
    setIndex(nextIndex);
    setRevealed(null);
    setAnswer("");
    setPhase("card");
  }

  function feedbackForMatch(match: ReviewMatch, correct: boolean): string {
    if (match === "close" && revealed?.awaitingConfirmation) {
      return t("reviewPage.closePrompt");
    }
    if (correct) {
      return t("reviewPage.correct");
    }
    return t("reviewPage.incorrect");
  }

  const reviewSchedule =
    phase === "revealed" && revealed && currentCard
      ? reviewScheduleForDisplay(currentCard, revealed)
      : null;

  return (
    <>
      {error ? <p className="upload-file__error">{error}</p> : null}

      {phase === "loading" ? <p>{t("reviewPage.loading")}</p> : null}

      {phase === "empty" ? (
        <Card className="review-card review-card--empty">
          <p>{t("reviewPage.noWords")}</p>
          {!embedded ? (
            <ButtonLink to={WORDS_PATH} style="primary">
              {t("reviewPage.backToWords")}
            </ButtonLink>
          ) : (
            <ButtonLink to={WORDS_PATH} style="secondary">
              {t("reviewPage.browseWords")}
            </ButtonLink>
          )}
        </Card>
      ) : null}

      {phase === "card" && currentCard ? (
        <Card className="review-card">
          <p className="review-card__progress">
            {t("reviewPage.progress", { current: index + 1, total: totalWords })}
          </p>
          <p className="review-card__learning">{currentCard.promptWord}</p>
          <div
            className="review-card__input"
            onKeyDown={(event) => {
              if (event.key === "Enter" && trimmedAnswer && !isSubmitting) {
                event.preventDefault();
                handleCheck();
              }
            }}
          >
            <TextInput
              label={t("reviewPage.answerLabel")}
              value={answer}
              onChange={setAnswer}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>
          <div className="review-card__actions">
            <Button type="button" onClick={handleCheck} disabled={isSubmitting || !trimmedAnswer}>
              {t("reviewPage.check")}
            </Button>
            <Button
              type="button"
              style="secondary"
              onClick={handleDontRemember}
              disabled={isSubmitting}
            >
              {t("reviewPage.dontRemember")}
            </Button>
          </div>
        </Card>
      ) : null}

      {phase === "revealed" && revealed && currentCard ? (
        <Card className="review-card">
          <p className="review-card__learning">
            {revealed.promptWord ?? currentCard.promptWord}
          </p>
          {revealed.userAnswer ? (
            <p
              className={
                revealed.correct
                  ? "review-card__user-answer review-card__user-answer--correct"
                  : "review-card__user-answer review-card__user-answer--incorrect"
              }
            >
              {revealed.userAnswer}
            </p>
          ) : null}
          {!revealed.correct || !revealed.userAnswer ? (
            <p className="review-card__primary">
              {revealed.expectedWord ??
                (currentCard.direction === "primary_to_learning"
                  ? currentCard.learningWord
                  : currentCard.primaryWord)}
            </p>
          ) : null}
          {revealed.userAnswer ? (
            <p
              className={`review-card__feedback ${
                revealed.correct
                  ? "review-card__feedback--correct"
                  : revealed.awaitingConfirmation
                    ? "review-card__feedback--close"
                    : "review-card__feedback--incorrect"
              }`}
            >
              {feedbackForMatch(revealed.match, revealed.correct)}
            </p>
          ) : null}
          <div className="review-card__curve">
            {reviewSchedule ? (
              <ForgettingCurve
                compact
                pimsleurLevel={reviewSchedule.pimsleurLevel}
                nextReviewMs={reviewSchedule.nextReviewMs}
              />
            ) : null}
          </div>
          {revealed.awaitingConfirmation ? (
            <div className="review-card__actions">
              <Button type="button" onClick={() => handleConfirm("know")} disabled={isSubmitting}>
                {t("reviewPage.confirmKnew")}
              </Button>
              <Button
                type="button"
                style="secondary"
                onClick={() => handleConfirm("dont")}
                disabled={isSubmitting}
              >
                {t("reviewPage.confirmWrong")}
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={handleNext}>
              {index + 1 >= totalWords ? t("reviewPage.finish") : t("reviewPage.next")}
            </Button>
          )}
        </Card>
      ) : null}
    </>
  );
}
