import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { logOut, resendVerificationEmail } from "../../api/auth";
import { getMySubscription, type MySubscription } from "../../api/subscription";
import {
  activeAppMode,
  homePathForMode,
  modesForUser,
  setAppMode,
  subscribeAppMode,
  type AppMode,
} from "../../appMode";
import { MEDIA_MOBILE } from "../../constants/breakpoints";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import {
  ADMIN_STORIES_PATH,
  ADMIN_WORDS_PATH,
  DICTIONARIES_PATH,
  FEEDBACK_PATH,
  STORIES_PATH,
  USER_HOME_PATH,
  WORDS_PATH,
} from "../../paths";
import { clearStoredSession, getStoredUser, subscribeToSession } from "../../userStorage";
import Button from "../UI/Button/Button";

import "./AppLayout.scss";

type NavItem = {
  to: string;
  labelKey: string;
  end?: boolean;
};

const USER_NAV_ITEMS: NavItem[] = [
  { to: USER_HOME_PATH, labelKey: "nav.dashboard", end: true },
  { to: WORDS_PATH, labelKey: "nav.words" },
  { to: DICTIONARIES_PATH, labelKey: "nav.dictionaries" },
  { to: STORIES_PATH, labelKey: "nav.stories" },
  { to: "/billing-history", labelKey: "nav.billing" },
  { to: "/profile", labelKey: "nav.profile" },
  { to: FEEDBACK_PATH, labelKey: "nav.feedback" },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/admin/dashboard", labelKey: "nav.adminDashboard", end: true },
  { to: "/admin/users", labelKey: "nav.adminUsers" },
  { to: "/admin/payments", labelKey: "nav.adminPayments" },
  { to: "/admin/qualification", labelKey: "nav.adminQualification" },
  { to: "/admin/feedback", labelKey: "nav.adminFeedback" },
  { to: "/admin/tags", labelKey: "nav.adminTags" },
  { to: "/admin/languages", labelKey: "nav.adminLanguages" },
  { to: "/admin/user-pairs", labelKey: "nav.adminUserPairs" },
  { to: "/admin/ai-usage", labelKey: "nav.adminAiUsage" },
];

const TEACHER_NAV_ITEMS: NavItem[] = [
  { to: "/admin/review", labelKey: "nav.teacherReview" },
  { to: ADMIN_WORDS_PATH, labelKey: "nav.adminWords" },
  { to: ADMIN_STORIES_PATH, labelKey: "nav.adminStories" },
  { to: "/admin/translations", labelKey: "nav.adminTranslations" },
];

function ModeSwitch({
  modes,
  active,
  onSelect,
}: {
  modes: AppMode[];
  active: AppMode;
  onSelect: (mode: AppMode) => void;
}) {
  const { t } = useTranslation();
  if (modes.length < 2) {
    return null;
  }
  return (
    <div className="app-mode-switch" role="group" aria-label={t("nav.modeSwitch")}>
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          className={`app-mode-switch__button${
            mode === active ? " app-mode-switch__button--active" : ""
          }`}
          aria-pressed={mode === active}
          onClick={() => onSelect(mode)}
        >
          {t(`nav.mode.${mode}`)}
        </button>
      ))}
    </div>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const menuId = useId();
  const isMobile = useMediaQuery(MEDIA_MOBILE);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setSessionVersion] = useState(0);
  const [, setModeVersion] = useState(0);

  useEffect(() => {
    return subscribeToSession(() => {
      setSessionVersion((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    return subscribeAppMode(() => {
      setModeVersion((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMenuOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const user = getStoredUser();
  const modes = modesForUser(user);
  const activeMode = activeAppMode(user);
  const brandHomePath = homePathForMode(activeMode);
  const navItems =
    activeMode === "admin"
      ? ADMIN_NAV_ITEMS
      : activeMode === "teacher"
        ? TEACHER_NAV_ITEMS
        : USER_NAV_ITEMS;
  const [planCode, setPlanCode] = useState<MySubscription["effectivePlanCode"] | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;
    getMySubscription()
      .then((subscription) => {
        if (!isMounted) {
          return;
        }
        setPlanCode(subscription.effectivePlanCode);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setPlanCode(null);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  const closeMenu = () => setMenuOpen(false);

  function selectMode(mode: AppMode) {
    setAppMode(mode);
    navigate(homePathForMode(mode));
    closeMenu();
  }

  async function handleLogOut() {
    closeMenu();
    try {
      await logOut();
    } catch {
      // Clear local session even if the API call fails.
    }
    clearStoredSession();
    navigate("/", { replace: true });
  }

  const [verifyBanner, setVerifyBanner] = useState<string | null>(null);

  async function handleResendVerification() {
    setVerifyBanner(null);
    try {
      await resendVerificationEmail();
      setVerifyBanner(t("auth.verificationEmailResent"));
    } catch (error) {
      setVerifyBanner(
        error instanceof Error ? error.message : t("auth.verificationEmailResendFailed"),
      );
    }
  }

  const navLinkTabIndex =
    isMobile && !menuOpen ? ({ tabIndex: -1 as const } as const) : {};

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <NavLink to={brandHomePath} className="app-topbar__brand" end onClick={closeMenu}>
          <img className="app-brand__icon" src="/landing/logo-icon.png" alt="" width={28} height={28} />
          <span className="app-topbar__title">{t("nav.brandTitle")}</span>
        </NavLink>
        <ModeSwitch modes={modes} active={activeMode} onSelect={selectMode} />
        <button
          type="button"
          className={`app-topbar__burger${menuOpen ? " app-topbar__burger--open" : ""}`}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? t("nav.menuClose") : t("nav.menuOpen")}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="app-topbar__burger-lines" aria-hidden>
            <span className="app-topbar__burger-line" />
            <span className="app-topbar__burger-line" />
            <span className="app-topbar__burger-line" />
          </span>
        </button>
      </header>

      {menuOpen && isMobile ? (
        <button
          type="button"
          className="app-sidebar__backdrop"
          aria-label={t("nav.menuClose")}
          onClick={closeMenu}
        />
      ) : null}

      <aside
        id={menuId}
        className={`app-sidebar${menuOpen ? " app-sidebar--open" : ""}`}
        aria-label={t("nav.mainNavigation")}
        aria-hidden={isMobile ? !menuOpen : false}
      >
        <NavLink to={brandHomePath} className="app-sidebar__brand" end onClick={closeMenu}>
          <span className="app-sidebar__brand-row">
            <img className="app-brand__icon" src="/landing/logo-icon.png" alt="" width={32} height={32} />
            <span className="app-sidebar__title">{t("nav.brandTitle")}</span>
          </span>
          <span className="app-sidebar__tagline">{user?.userName || t("nav.brandTagline")}</span>
          <div className="app-sidebar__account-meta">
            <div className="app-sidebar__meta-row">
              <span className="app-sidebar__meta-label">{t("nav.currentPlan")}</span>
              <span
                className={`app-sidebar__plan-badge app-sidebar__plan-badge--${planCode ?? "basic"}`}
              >
                {planCode ? t(`nav.plan.${planCode}`) : t("nav.plan.basic")}
              </span>
            </div>
          </div>
        </NavLink>
        <ModeSwitch modes={modes} active={activeMode} onSelect={selectMode} />
        <nav className="app-nav">
          <ul className="app-nav__list">
            {navItems.map(({ to, labelKey, end }) => (
              <li key={to} className="app-nav__item">
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    isActive ? "app-nav__link app-nav__link--active" : "app-nav__link"
                  }
                  onClick={closeMenu}
                  {...navLinkTabIndex}
                >
                  {t(labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <Button style="secondary" onClick={handleLogOut} {...navLinkTabIndex}>
          {t("nav.logOut")}
        </Button>
      </aside>

      <main className="app-main">
        {user?.emailVerified === false ? (
          <div className="app-email-verify-banner" role="status">
            <p className="app-email-verify-banner__text">{t("auth.emailUnverifiedBanner")}</p>
            {verifyBanner ? (
              <p className="app-email-verify-banner__sub">{verifyBanner}</p>
            ) : null}
            <Button type="button" style="secondary" onClick={handleResendVerification}>
              {t("auth.resendVerification")}
            </Button>
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
