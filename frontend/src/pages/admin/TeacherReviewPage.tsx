import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { apiClient } from "../../api/_api";
import Button from "../../components/UI/Button/Button";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import { adminStoryPath } from "../../paths";

type ReviewQueue = {
  stories: Array<{ id: number; title: string }>;
  dictionaries: Array<{ id: number; name: string; creatorName: string }>;
  words: Array<{ id: number; label: string }>;
};

export default function TeacherReviewPage() {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await apiClient.get<ReviewQueue>("/admin/review");
    setQueue(data);
  }, []);

  useEffect(() => {
    void load().catch(() => setError(t("review.loadFailed")));
  }, [load, t]);

  async function verify(path: string) {
    await apiClient.post(path);
    await load();
  }

  return (
    <Page width="full">
      <PageHeader title={t("review.title")} subtitle={t("review.description")} />
      {error ? <p className="upload-file__error">{error}</p> : null}
      <h2>{t("review.stories")}</h2>
      <ul>
        {queue?.stories.map((story) => (
          <li key={story.id}>
            <Link to={adminStoryPath(story.id)}>{story.title}</Link>{" "}
            <Button style="secondary" onClick={() => void verify(`/admin/review/stories/${story.id}/verify`)}>
              {t("review.verify")}
            </Button>
          </li>
        ))}
      </ul>
      <h2>{t("review.dictionaries")}</h2>
      <ul>
        {queue?.dictionaries.map((dictionary) => (
          <li key={dictionary.id}>
            {dictionary.name} · {dictionary.creatorName}{" "}
            <Button
              style="secondary"
              onClick={() => void verify(`/admin/review/dictionaries/${dictionary.id}/verify`)}
            >
              {t("review.verify")}
            </Button>
          </li>
        ))}
      </ul>
      <h2>{t("review.words")}</h2>
      <ul>
        {queue?.words.map((word) => (
          <li key={word.id}>
            {word.label}{" "}
            <Button style="secondary" onClick={() => void verify(`/admin/review/words/${word.id}/verify`)}>
              {t("review.verify")}
            </Button>
          </li>
        ))}
      </ul>
    </Page>
  );
}
