import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { advanceMyStoryLevel, getMyStory, type UserStory } from "../../api/stories";
import StoryReader from "../../components/StoryReader";
import Button from "../../components/UI/Button/Button";
import ButtonLink from "../../components/UI/Button/ButtonLink";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import { STORIES_PATH } from "../../paths";

import "../style.scss";

export default function StoryReaderPage() {
  const { t } = useTranslation();
  const { storyId: storyIdParam } = useParams();
  const storyId = Number(storyIdParam);

  const [story, setStory] = useState<UserStory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const loadStory = useCallback(async () => {
    if (!Number.isInteger(storyId) || storyId < 1) {
      setError(t("storiesPage.invalidId"));
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMyStory(storyId);
      setStory(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("storiesPage.loadFailed"));
      setStory(null);
    } finally {
      setIsLoading(false);
    }
  }, [storyId, t]);

  useEffect(() => {
    void loadStory();
  }, [loadStory]);

  async function handleNextLevel() {
    if (!story) {
      return;
    }
    setIsAdvancing(true);
    setError(null);
    try {
      const updated = await advanceMyStoryLevel(story.id);
      setStory(updated);
    } catch (advanceError) {
      setError(
        advanceError instanceof Error ? advanceError.message : t("storiesPage.nextLevelFailed"),
      );
    } finally {
      setIsAdvancing(false);
    }
  }

  if (isLoading) {
    return (
      <Page>
        <PageHeader title={t("storiesPage.readerTitle")} />
        <p>{t("storiesPage.loading")}</p>
      </Page>
    );
  }

  if (error && !story) {
    return (
      <Page>
        <PageHeader title={t("storiesPage.readerTitle")} />
        <p className="upload-file__error">{error}</p>
        <ButtonLink to={STORIES_PATH} style="secondary">
          {t("storiesPage.back")}
        </ButtonLink>
      </Page>
    );
  }

  if (!story) {
    return null;
  }

  const atMax = story.unlockedLevel >= story.maxLevel;

  return (
    <Page>
      <PageHeader
        title={story.title}
        subtitle={t("storiesPage.readerSubtitle", {
          percent: story.percent,
          unlocked: story.unlockedLevel,
          max: story.maxLevel,
        })}
        actions={
          <ButtonLink to={STORIES_PATH} style="secondary">
            {t("storiesPage.back")}
          </ButtonLink>
        }
      />
      {error ? <p className="upload-file__error">{error}</p> : null}
      <div className="story-reader-page__meta">
        <p>
          {t("storiesPage.progress", {
            percent: story.percent,
            words: story.totalUniqueWords,
          })}
        </p>
        <Button type="button" disabled={atMax || isAdvancing} onClick={() => void handleNextLevel()}>
          {isAdvancing
            ? t("storiesPage.nextLevelLoading")
            : atMax
              ? t("storiesPage.maxLevelReached")
              : t("storiesPage.nextLevel")}
        </Button>
      </div>
      <StoryReader
        sentences={story.sentences}
        unlockedWordIds={story.unlockedWordIds}
      />
    </Page>
  );
}
