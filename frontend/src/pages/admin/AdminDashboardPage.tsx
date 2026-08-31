import { useTranslation } from "react-i18next";

import ButtonLink from "../../components/UI/Button/ButtonLink";
import Card from "../../components/UI/Card";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";

import "../style.scss";

type AdminDashboardLink = {
  to: string;
  titleKey: string;
  descKey: string;
};

const LINKS: AdminDashboardLink[] = [
  { to: "/admin/users", titleKey: "dashboard.admin.links.users.title", descKey: "dashboard.admin.links.users.desc" },
  { to: "/admin/user-pairs", titleKey: "dashboard.admin.links.userPairs.title", descKey: "dashboard.admin.links.userPairs.desc" },
  { to: "/admin/payments", titleKey: "dashboard.admin.links.payments.title", descKey: "dashboard.admin.links.payments.desc" },
  { to: "/admin/qualification", titleKey: "dashboard.admin.links.qualification.title", descKey: "dashboard.admin.links.qualification.desc" },
  { to: "/admin/feedback", titleKey: "dashboard.admin.links.feedback.title", descKey: "dashboard.admin.links.feedback.desc" },
  { to: "/admin/tags", titleKey: "dashboard.admin.links.tags.title", descKey: "dashboard.admin.links.tags.desc" },
  { to: "/admin/languages", titleKey: "dashboard.admin.links.languages.title", descKey: "dashboard.admin.links.languages.desc" },
  { to: "/admin/words", titleKey: "dashboard.admin.links.words.title", descKey: "dashboard.admin.links.words.desc" },
  { to: "/admin/stories", titleKey: "dashboard.admin.links.stories.title", descKey: "dashboard.admin.links.stories.desc" },
  { to: "/admin/translations", titleKey: "dashboard.admin.links.translations.title", descKey: "dashboard.admin.links.translations.desc" },
  { to: "/admin/ai-usage", titleKey: "dashboard.admin.links.aiUsage.title", descKey: "dashboard.admin.links.aiUsage.desc" },
];

export default function AdminDashboardPage() {
  const { t } = useTranslation();

  return (
    <Page>
      <PageHeader title={t("dashboard.admin.heading")} subtitle={t("dashboard.admin.intro")} />
      <ul className="link-card-grid">
        {LINKS.map((link) => (
          <li key={link.to}>
            <Card className="link-card">
              <h2 className="link-card__title">{t(link.titleKey)}</h2>
              <p className="link-card__desc">{t(link.descKey)}</p>
              <ButtonLink to={link.to} style="primary">
                {t("dashboard.admin.open")}
              </ButtonLink>
            </Card>
          </li>
        ))}
      </ul>
    </Page>
  );
}
