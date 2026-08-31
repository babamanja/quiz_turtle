import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getMyStories, type UserStoryListItem } from "../../api/stories";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import ResponsiveDataList from "../../components/UI/ResponsiveDataList";
import type { DataListColumn } from "../../components/UI/dataListTypes";
import { storyPath } from "../../paths";

import "../style.scss";

export default function StoriesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<UserStoryListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stories = await getMyStories();
      setItems(stories);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("storiesPage.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  const columns = useMemo<DataListColumn<UserStoryListItem>[]>(
    () => [
      {
        id: "stories.title",
        label: t("table.stories.title"),
        mobileRole: "summary-primary",
        render: (row) => <Link to={storyPath(row.id)}>{row.title}</Link>,
      },
      {
        id: "stories.percent",
        label: t("table.stories.percent"),
        mobileRole: "summary-secondary",
        render: (row) => `${row.percent}%`,
      },
      {
        id: "stories.level",
        label: t("table.stories.level"),
        mobileRole: "detail",
        render: (row) =>
          t("storiesPage.levelProgress", {
            unlocked: row.unlockedLevel,
            max: row.maxLevel,
          }),
      },
      {
        id: "stories.words",
        label: t("table.stories.totalWords"),
        mobileRole: "detail",
        render: (row) => row.totalUniqueWords,
      },
    ],
    [t],
  );

  return (
    <Page width="full">
      <PageHeader title={t("storiesPage.title")} subtitle={t("storiesPage.description")} />
      {error ? <p className="upload-file__error">{error}</p> : null}
      {isLoading ? <p>{t("storiesPage.loading")}</p> : null}
      {!isLoading ? (
        <ResponsiveDataList
          columns={columns}
          data={items}
          getRowKey={(row) => String(row.id)}
          emptyMessage={t("storiesPage.empty")}
        />
      ) : null}
    </Page>
  );
}
