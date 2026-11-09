import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { trackAnalyticsEvent } from "../analytics";
import { getVocabLanguages, type VocabLanguages } from "../api/words";
import Button from "../components/UI/Button/Button";
import Card from "../components/UI/Card";
import Page from "../components/UI/Page";
import PageHeader from "../components/UI/PageHeader";
import ReviewSession from "./words/ReviewSession";
import SetLanguagesModal from "./SetLanguagesModal";

import "./style.scss";

export default function UserDashboardPage() {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState<VocabLanguages | null>(null);
  const [languagesLoading, setLanguagesLoading] = useState(true);
  const [languagesMissing, setLanguagesMissing] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const [languagesReload, setLanguagesReload] = useState(0);

  useEffect(() => {
    trackAnalyticsEvent("user_dashboard_opened", {});
  }, []);

  useEffect(() => {
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
  }, [languagesReload]);

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
          <Button onClick={() => setLanguagesOpen(true)}>{t("dashboard.user.setLanguages")}</Button>
        </Card>
      ) : (
        <ReviewSession embedded trackOpen={false} />
      )}
      <SetLanguagesModal
        open={languagesOpen}
        onClose={() => setLanguagesOpen(false)}
        onSaved={() => setLanguagesReload((value) => value + 1)}
      />
    </Page>
  );
}
