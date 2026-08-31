import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import {
  entryToPairSchedules,
  scheduleForDirection,
  selectWorstCardDirection,
} from "@language-turtle/shared";

import { getMyWord, type NestMemberView, type UserWordDetail } from "../../api/words";
import ButtonLink from "../../components/UI/Button/ButtonLink";
import Card from "../../components/UI/Card";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import { WORDS_PATH } from "../../paths";

import ForgettingCurve from "./ForgettingCurve";
import "../style.scss";

function sortNestMembers(members: NestMemberView[]): NestMemberView[] {
  return [...members].sort((a, b) => {
    if (a.isAnchor !== b.isAnchor) {
      return a.isAnchor ? -1 : 1;
    }
    return a.text.localeCompare(b.text);
  });
}

export default function WordDetailPage() {
  const { t } = useTranslation();
  const { vocabPairId: vocabPairIdParam } = useParams();
  const vocabPairId = Number(vocabPairIdParam);

  const [word, setWord] = useState<UserWordDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWord = useCallback(async () => {
    if (!Number.isInteger(vocabPairId) || vocabPairId < 1) {
      setError(t("wordDetailPage.invalidId"));
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const detail = await getMyWord(vocabPairId);
      setWord(detail);
    } catch (loadError) {
      setWord(null);
      setError(loadError instanceof Error ? loadError.message : t("wordDetailPage.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t, vocabPairId]);

  useEffect(() => {
    void loadWord();
  }, [loadWord]);

  const worstCardSchedule = useMemo(() => {
    if (!word) {
      return null;
    }
    const schedules = entryToPairSchedules({
      pimsleurLevel: word.pimsleurLevelForward,
      nextReviewMs: BigInt(word.nextReviewMsForward),
      pimsleurLevelReverse: word.pimsleurLevelReverse,
      nextReviewMsReverse: BigInt(word.nextReviewMsReverse),
    });
    return scheduleForDirection(schedules, selectWorstCardDirection(schedules));
  }, [word]);

  const learningNest = useMemo(() => {
    if (!word) {
      return [];
    }
    if (word.learningNest?.length) {
      return sortNestMembers(word.learningNest);
    }
    return [{ wordId: 0, text: word.learningWord, isAnchor: true }];
  }, [word]);

  const relatedNestMembers = useMemo(
    () => learningNest.filter((member) => !member.isAnchor),
    [learningNest],
  );

  const partOfSpeechLabel = word?.partOfSpeech
    ? t(`partOfSpeech.${word.partOfSpeech}`)
    : t("wordDetailPage.partOfSpeechUnset");

  return (
    <Page width="default">
      <PageHeader
        title={word?.learningWord ?? t("wordDetailPage.title")}
        subtitle={word?.dictionaryName}
        actions={
          <ButtonLink to={WORDS_PATH} style="secondary">
            {t("wordDetailPage.backToWords")}
          </ButtonLink>
        }
      />

      {isLoading ? <p>{t("wordDetailPage.loading")}</p> : null}
      {error ? <p className="upload-file__error">{error}</p> : null}

      {!isLoading && word ? (
        <div className="word-detail">
          <Card className="word-detail__card">
            <h2 className="word-detail__section-title">{t("wordDetailPage.word")}</h2>
            <p className="word-detail__relation-type">{t(`relationType.${word.relationType}`)}</p>
            <dl className="word-detail__pair">
              <div>
                <dt>{t("table.words.learningWord")}</dt>
                <dd className="word-detail__learning-word">{word.learningWord}</dd>
              </div>
            </dl>
          </Card>

          <Card className="word-detail__card">
            <h2 className="word-detail__section-title">{t("wordDetailPage.nest.title")}</h2>
            <p className="word-detail__relation-type">{t("wordDetailPage.nest.hint")}</p>
            <ul className="word-detail__nest-list">
              {learningNest.map((member) => (
                <li
                  key={member.wordId}
                  className={`word-detail__nest-item word-detail__nest-item--readonly${
                    member.isAnchor ? " word-detail__nest-item--anchor" : ""
                  }`}
                >
                  <span className="word-detail__nest-text">{member.text}</span>
                  <span className="word-detail__nest-role">
                    {member.isAnchor
                      ? t("wordDetailPage.nest.mainWord")
                      : t("wordDetailPage.nest.relatedWord")}
                  </span>
                </li>
              ))}
            </ul>
            {relatedNestMembers.length === 0 ? (
              <p className="word-detail__nest-empty">{t("wordDetailPage.nest.empty")}</p>
            ) : null}
          </Card>

          {word.partOfSpeech || word.example ? (
            <Card className="word-detail__card">
              <h2 className="word-detail__section-title">{t("wordDetailPage.details")}</h2>
              <dl className="word-detail__pair">
                {word.partOfSpeech ? (
                  <div>
                    <dt>{t("wordDetailPage.partOfSpeech")}</dt>
                    <dd>{partOfSpeechLabel}</dd>
                  </div>
                ) : null}
                {word.example ? (
                  <div className="word-detail__field--wide">
                    <dt>{t("wordDetailPage.example")}</dt>
                    <dd className="word-detail__example">{word.example}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ) : null}

          <Card className="word-detail__card">
            <h2 className="word-detail__section-title">{t("wordDetailPage.forgettingCurve.title")}</h2>
            <p className="word-detail__relation-type">{t("wordDetailPage.forgettingCurve.hint")}</p>
            <ForgettingCurve
              pimsleurLevel={worstCardSchedule?.pimsleurLevel ?? 0}
              nextReviewMs={Number(worstCardSchedule?.nextReviewMs ?? 0)}
            />
          </Card>
        </div>
      ) : null}

      {!isLoading && !word && !error ? (
        <Card className="word-detail__card">
          <p>{t("wordDetailPage.notFound")}</p>
          <Link to={WORDS_PATH}>{t("wordDetailPage.backToWords")}</Link>
        </Card>
      ) : null}
    </Page>
  );
}
