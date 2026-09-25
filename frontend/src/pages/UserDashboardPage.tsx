import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { trackAnalyticsEvent } from "../analytics";
import { getVocabLanguages, type VocabLanguages } from "../api/words";
import ButtonLink from "../components/UI/Button/ButtonLink";
import Card from "../components/UI/Card";
import Page from "../components/UI/Page";
import PageHeader from "../components/UI/PageHeader";
import ReviewSession from "./words/ReviewSession";

import "./style.scss";

export default function UserDashboardPage() {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState<VocabLanguages | null>(null);
  const [languagesLoading, setLanguagesLoading] = useState(true);
  const [languagesMissing, setLanguagesMissing] = useState(false);

  useEffect(() => {
    trackAnalyticsEvent("user_dashboard_opened", {});
    let cancelled = false;
    setLanguagesLoading(true);
    void getVocabLanguages()
      .then((result) => {
        if (!cancelled) {
          setLanguages(result);
          setLanguagesMissing(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLanguages(null);
          setLanguagesMissing(error instanceof Error && error.message === "languages_not_set");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLanguagesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const languagesLabel =
    languages?.primaryName && languages?.learningName
      ? t("dashboard.user.languagesValue", {
          primary: languages.primaryName,
          learning: languages.learningName,
        })
      : null;

  return (
    <Page>
      <PageHeader title={t("dashboard.user.heading")} />
      {languagesLabel ? (
        <p className="dashboard-user__languages">{languagesLabel}</p>
      ) : null}
      {languagesLoading ? null : languagesMissing ? (
        <Card className="review-card review-card--empty">
          <p>{t("dashboard.user.languagesNotSet")}</p>
          <ButtonLink to="/profile">{t("dashboard.user.setLanguages")}</ButtonLink>
        </Card>
      ) : (
        <ReviewSession embedded trackOpen={false} />
      )}
    </Page>
  );
}
