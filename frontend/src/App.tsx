import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";

import { identifyAnalyticsUser, resetAnalyticsUser } from "./analytics";
import { refreshSession } from "./api/auth";
import CookieConsentBanner from "./components/CookieConsent/CookieConsentBanner";
import AppLayout from "./components/Layout/AppLayout";
import AccountDeletedPage from "./pages/AccountDeletedPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminFeedbackPage from "./pages/admin/AdminFeedbackPage";
import AdminLanguagesPage from "./pages/admin/AdminLanguagesPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import AdminQualificationPage from "./pages/admin/AdminQualificationPage";
import AdminTagsPage from "./pages/admin/AdminTagsPage";
import AdminTranslationsPage from "./pages/admin/AdminTranslationsPage";
import AdminTokenAnalyticsPage from "./pages/admin/AdminTokenAnalyticsPage";
import AdminUserDetailsPage from "./pages/admin/AdminUserDetailsPage";
import AdminUserPairsPage from "./pages/admin/AdminUserPairsPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminWordsPage from "./pages/admin/AdminWordsPage";
import AdminWordDetailPage from "./pages/admin/AdminWordDetailPage";
import AdminStoriesPage from "./pages/admin/AdminStoriesPage";
import TeacherReviewPage from "./pages/admin/TeacherReviewPage";
import AdminStoryEditorPage from "./pages/admin/AdminStoryEditorPage";
import AuthPage from "./pages/AuthPage";
import LandingRoutePage from "./pages/landing/LandingRoutePage";
import NotFoundPage from "./pages/NotFoundPage";
import BillingHistoryPage from "./pages/payments/BillingHistoryPage";
import MyDictionariesPage from "./pages/MyDictionariesPage";
import MySubscriptionPage from "./pages/payments/MySubscriptionPage";
import PaymentCheckoutPage from "./pages/payments/PaymentCheckoutPage";
import PaymentResultPage from "./pages/payments/PaymentResultPage";
import PaymentReturnPage from "./pages/payments/PaymentReturnPage";
import ProfilePage from "./pages/ProfilePage";
import FeedbackPage from "./pages/FeedbackPage";
import StoriesPage from "./pages/stories/StoriesPage";
import StoryReaderPage from "./pages/stories/StoryReaderPage";
import UserDashboardPage from "./pages/UserDashboardPage";
import WordsPage from "./pages/WordsPage";
import WordDetailPage from "./pages/words/WordDetailPage";
import { activeAppMode, homePathForMode, modesForUser, type AppMode } from "./appMode";
import { USER_HOME_PATH } from "./paths";
import { getSessionSnapshot, setStoredSession, subscribeToSession } from "./userStorage";

type RouteConfig = {
  path: string;
  element: ReactNode;
  access: AppMode;
};

const ROUTES: ReadonlyArray<RouteConfig> = [
  { path: "/dashboard", element: <UserDashboardPage />, access: "student" },
  { path: "/admin/dashboard", element: <AdminDashboardPage />, access: "admin" },
  { path: "/admin/users", element: <AdminUsersPage />, access: "admin" },
  { path: "/admin/users/:userId", element: <AdminUserDetailsPage />, access: "admin" },
  { path: "/admin/payments", element: <AdminPaymentsPage />, access: "admin" },
  { path: "/admin/qualification", element: <AdminQualificationPage />, access: "admin" },
  { path: "/admin/feedback", element: <AdminFeedbackPage />, access: "admin" },
  { path: "/admin/tags", element: <AdminTagsPage />, access: "admin" },
  { path: "/admin/languages", element: <AdminLanguagesPage />, access: "admin" },
  { path: "/admin/words", element: <AdminWordsPage />, access: "teacher" },
  { path: "/admin/words/:wordId", element: <AdminWordDetailPage />, access: "teacher" },
  { path: "/admin/stories", element: <AdminStoriesPage />, access: "teacher" },
  { path: "/admin/review", element: <TeacherReviewPage />, access: "teacher" },
  { path: "/admin/stories/:storyId", element: <AdminStoryEditorPage />, access: "teacher" },
  { path: "/admin/dictionaries", element: <Navigate to="/admin/translations" replace />, access: "teacher" },
  { path: "/admin/translations", element: <AdminTranslationsPage />, access: "teacher" },
  { path: "/admin/user-pairs", element: <AdminUserPairsPage />, access: "admin" },
  { path: "/admin/quizzes", element: <Navigate to="/admin/user-pairs" replace />, access: "admin" },
  { path: "/admin/ai-usage", element: <AdminTokenAnalyticsPage />, access: "admin" },
  { path: "/admin/token-analytics", element: <Navigate to="/admin/ai-usage" replace />, access: "admin" },
  { path: "/my-subscription", element: <MySubscriptionPage />, access: "student" },
  { path: "/payment/checkout", element: <PaymentCheckoutPage />, access: "student" },
  { path: "/payment/success", element: <PaymentResultPage outcome="success" />, access: "student" },
  { path: "/payment/failed", element: <PaymentResultPage outcome="failed" />, access: "student" },
  { path: "/payment/canceled", element: <PaymentResultPage outcome="canceled" />, access: "student" },
  { path: "/payment/pending", element: <PaymentResultPage outcome="pending" />, access: "student" },
  { path: "/billing-history", element: <BillingHistoryPage />, access: "student" },
  { path: "/words", element: <WordsPage />, access: "student" },
  { path: "/words/:vocabPairId", element: <WordDetailPage />, access: "student" },
  { path: "/words/review", element: <Navigate to={USER_HOME_PATH} replace />, access: "student" },
  { path: "/dictionaries", element: <MyDictionariesPage />, access: "student" },
  { path: "/stories", element: <StoriesPage />, access: "student" },
  { path: "/stories/:storyId", element: <StoryReaderPage />, access: "student" },
  { path: "/profile", element: <ProfilePage />, access: "student" },
  { path: "/feedback", element: <FeedbackPage />, access: "student" },
  { path: "/payment", element: <PaymentReturnPage />, access: "student" },
];

export default function App() {
  const { t } = useTranslation();
  const [isHydrating, setIsHydrating] = useState(true);
  const [sessionState, setSessionState] = useState(() => getSessionSnapshot());

  useEffect(() => {
    const unsubscribe = subscribeToSession(() => {
      setSessionState(getSessionSnapshot());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (sessionState.user?.id) {
      identifyAnalyticsUser(String(sessionState.user.id));
      return;
    }
    resetAnalyticsUser();
  }, [sessionState.user?.id]);

  useEffect(() => {
    let isMounted = true;
    refreshSession()
      .then((session) => {
        if (!isMounted) {
          return;
        }
        setStoredSession({ user: session.user, token: session.token });
      })
      .catch(() => {
        // Ignore startup refresh errors. User can still authenticate manually.
      })
      .finally(() => {
        if (isMounted) {
          setIsHydrating(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (isHydrating) {
    return (
      <div className="app-boot" role="status" aria-live="polite">
        {t("app.loading")}
      </div>
    );
  }

  function resolveRouteElement(route: RouteConfig) {
    const modes = modesForUser(sessionState.user);
    if (modes.includes(route.access)) {
      return route.element;
    }
    if (modes.length === 0) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to={homePathForMode(activeAppMode(sessionState.user))} replace />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingRoutePage />} />
        <Route path="/privacy" element={<Navigate to="/?legal=privacy" replace />} />
        <Route path="/terms" element={<Navigate to="/?legal=terms" replace />} />
        <Route path="/refund" element={<Navigate to="/?legal=refund" replace />} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route path="/account-deleted" element={<AccountDeletedPage />} />
        <Route element={<AppLayout />}>
          {ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={resolveRouteElement(route)} />
          ))}
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <CookieConsentBanner />
    </>
  );
}
