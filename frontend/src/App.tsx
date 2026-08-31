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
import { homePathForRole, USER_HOME_PATH } from "./paths";
import { getSessionSnapshot, setStoredSession, subscribeToSession } from "./userStorage";

type RouteConfig = {
  path: string;
  element: ReactNode;
  roles: ReadonlyArray<"user" | "admin">;
};

const ROUTES: ReadonlyArray<RouteConfig> = [
  { path: "/dashboard", element: <UserDashboardPage />, roles: ["user"] },
  { path: "/admin/dashboard", element: <AdminDashboardPage />, roles: ["admin"] },
  { path: "/admin/users", element: <AdminUsersPage />, roles: ["admin"] },
  { path: "/admin/users/:userId", element: <AdminUserDetailsPage />, roles: ["admin"] },
  { path: "/admin/payments", element: <AdminPaymentsPage />, roles: ["admin"] },
  { path: "/admin/qualification", element: <AdminQualificationPage />, roles: ["admin"] },
  { path: "/admin/feedback", element: <AdminFeedbackPage />, roles: ["admin"] },
  { path: "/admin/tags", element: <AdminTagsPage />, roles: ["admin"] },
  { path: "/admin/languages", element: <AdminLanguagesPage />, roles: ["admin"] },
  { path: "/admin/words", element: <AdminWordsPage />, roles: ["admin"] },
  { path: "/admin/words/:wordId", element: <AdminWordDetailPage />, roles: ["admin"] },
  { path: "/admin/stories", element: <AdminStoriesPage />, roles: ["admin"] },
  { path: "/admin/stories/:storyId", element: <AdminStoryEditorPage />, roles: ["admin"] },
  { path: "/admin/dictionaries", element: <Navigate to="/admin/translations" replace />, roles: ["admin"] },
  { path: "/admin/translations", element: <AdminTranslationsPage />, roles: ["admin"] },
  { path: "/admin/user-pairs", element: <AdminUserPairsPage />, roles: ["admin"] },
  { path: "/admin/quizzes", element: <Navigate to="/admin/user-pairs" replace />, roles: ["admin"] },
  { path: "/admin/ai-usage", element: <AdminTokenAnalyticsPage />, roles: ["admin"] },
  { path: "/admin/token-analytics", element: <Navigate to="/admin/ai-usage" replace />, roles: ["admin"] },
  { path: "/my-subscription", element: <MySubscriptionPage />, roles: ["user"] },
  { path: "/payment/checkout", element: <PaymentCheckoutPage />, roles: ["user"] },
  { path: "/payment/success", element: <PaymentResultPage outcome="success" />, roles: ["user"] },
  { path: "/payment/failed", element: <PaymentResultPage outcome="failed" />, roles: ["user"] },
  { path: "/payment/canceled", element: <PaymentResultPage outcome="canceled" />, roles: ["user"] },
  { path: "/payment/pending", element: <PaymentResultPage outcome="pending" />, roles: ["user"] },
  { path: "/billing-history", element: <BillingHistoryPage />, roles: ["user"] },
  { path: "/words", element: <WordsPage />, roles: ["user"] },
  { path: "/words/:vocabPairId", element: <WordDetailPage />, roles: ["user"] },
  { path: "/words/review", element: <Navigate to={USER_HOME_PATH} replace />, roles: ["user"] },
  { path: "/dictionaries", element: <MyDictionariesPage />, roles: ["user"] },
  { path: "/stories", element: <StoriesPage />, roles: ["user"] },
  { path: "/stories/:storyId", element: <StoryReaderPage />, roles: ["user"] },
  { path: "/profile", element: <ProfilePage />, roles: ["user"] },
  { path: "/feedback", element: <FeedbackPage />, roles: ["user"] },
  { path: "/payment", element: <PaymentReturnPage />, roles: ["user"] },
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
    const role = sessionState.user?.role ?? "guest";
    if (route.roles.includes(role as "user" | "admin")) {
      return route.element;
    }
    if (role === "guest") {
      return <Navigate to="/" replace />;
    }
    return <Navigate to={homePathForRole(role)} replace />;
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
