import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { createRequestId, trackAnalyticsEvent } from "../../analytics";
import { refreshSession } from "../../api/auth";
import {
  type AdminLanguage,
  type AdminUserDetails,
  getAdminLanguages,
  getAdminUserDetails,
  grantAdminPremiumSubscription,
  refundAdminPayment,
  setAdminUserTaughtLanguages,
} from "../../api/admin";
import Button from "../../components/UI/Button/Button";
import ResponsiveDataList from "../../components/UI/ResponsiveDataList";
import type { DataListColumn } from "../../components/UI/dataListTypes";
import { useAdminPage } from "../../hooks/useAdminPage";
import { getStoredUser, setStoredSession } from "../../userStorage";
import { formatRelativeTime } from "../../utils/convertTime";

type FieldRow = {
  id: string;
  field: string;
  value: ReactNode;
};

type UserPayment = AdminUserDetails["recentPayments"][number];
type UserSubscription = NonNullable<AdminUserDetails["subscription"]>;

export default function AdminUserDetailsPage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [premiumEndAt, setPremiumEndAt] = useState("");
  const [isGrantingPremium, setIsGrantingPremium] = useState(false);
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);
  const [languages, setLanguages] = useState<AdminLanguage[]>([]);
  const [taughtLanguageIds, setTaughtLanguageIds] = useState<number[]>([]);
  const [isSavingLanguages, setIsSavingLanguages] = useState(false);
  const [languagesMessage, setLanguagesMessage] = useState<string | null>(null);

  const loadUserDetails = useCallback(async () => {
    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) {
      throw new Error(t("admin.userDetailsInvalidId"));
    }
    return getAdminUserDetails(id);
  }, [t, userId]);

  const {
    data: user,
    error,
    isLoading,
    reload,
  } = useAdminPage({
    load: loadUserDetails,
    loadErrorMessage: t("admin.userDetailsLoadFailed"),
  });

  useEffect(() => {
    if (user) {
      trackAnalyticsEvent("admin_user_details_opened", { admin_user_id: user.id });
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      setTaughtLanguageIds(user.taughtLanguageIds);
    }
  }, [user?.id, user?.taughtLanguageIds]);

  useEffect(() => {
    void getAdminLanguages()
      .then(setLanguages)
      .catch(() => {
        setLanguages([]);
      });
  }, []);

  const premiumEndAtMin = (() => {
    const nextMinute = new Date(Date.now() + 60_000);
    const offsetMinutes = nextMinute.getTimezoneOffset();
    const local = new Date(nextMinute.getTime() - offsetMinutes * 60_000);
    return local.toISOString().slice(0, 16);
  })();

  async function handleSaveTaughtLanguages() {
    setActionError(null);
    setLanguagesMessage(null);
    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) {
      setActionError(t("admin.userDetailsInvalidId"));
      return;
    }
    setIsSavingLanguages(true);
    try {
      const saved = await setAdminUserTaughtLanguages(id, taughtLanguageIds);
      setTaughtLanguageIds(saved.taughtLanguageIds);
      setLanguagesMessage(t("admin.userDetailsTaughtLanguagesSaved"));
      if (getStoredUser()?.id === id) {
        const session = await refreshSession();
        setStoredSession({ token: session.token, user: session.user });
      }
    } catch (saveError) {
      setActionError(
        saveError instanceof Error
          ? saveError.message
          : t("admin.userDetailsTaughtLanguagesFailed"),
      );
    } finally {
      setIsSavingLanguages(false);
    }
  }

  async function handleGrantPremium() {
    setActionError(null);
    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) {
      setActionError(t("admin.userDetailsInvalidId"));
      return;
    }
    if (!premiumEndAt.trim()) {
      setActionError(t("admin.userDetailsPremiumEndInvalid"));
      return;
    }

    const currentPeriodEnd = new Date(premiumEndAt);
    if (Number.isNaN(currentPeriodEnd.getTime()) || currentPeriodEnd <= new Date()) {
      setActionError(t("admin.userDetailsPremiumEndInvalid"));
      return;
    }

    setIsGrantingPremium(true);
    const requestId = createRequestId();
    try {
      await grantAdminPremiumSubscription(id, {
        currentPeriodEnd: currentPeriodEnd.toISOString(),
      });
      trackAnalyticsEvent("admin_premium_granted", {
        request_id: requestId,
        admin_user_id: id,
        premium_until: currentPeriodEnd.toISOString(),
      });
      setPremiumEndAt("");
      await reload();
    } catch (grantError) {
      setActionError(
        grantError instanceof Error ? grantError.message : t("admin.userDetailsGrantPremiumFailed"),
      );
    } finally {
      setIsGrantingPremium(false);
    }
  }

  async function handleRefundPayment(paymentId: string) {
    setActionError(null);
    const reason = window.prompt(t("admin.refundReasonPrompt"));
    if (reason == null) {
      return;
    }
    if (!reason.trim()) {
      setActionError(t("admin.refundReasonRequired"));
      return;
    }

    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) {
      setActionError(t("admin.userDetailsInvalidId"));
      return;
    }

    setRefundingPaymentId(paymentId);
    const requestId = createRequestId();
    trackAnalyticsEvent("admin_refund_started", {
      request_id: requestId,
      payment_id: paymentId,
    });
    try {
      await refundAdminPayment(paymentId, { reason: reason.trim() });
      trackAnalyticsEvent("admin_refund_succeeded", {
        request_id: requestId,
        payment_id: paymentId,
      });
      await reload();
    } catch (refundError) {
      trackAnalyticsEvent("admin_refund_failed", {
        request_id: requestId,
        payment_id: paymentId,
        reason: refundError instanceof Error ? refundError.message : "refund_failed",
      });
      setActionError(refundError instanceof Error ? refundError.message : t("admin.refundFailed"));
    } finally {
      setRefundingPaymentId(null);
    }
  }

  const fieldColumns = useMemo<DataListColumn<FieldRow>[]>(
    () => [
      {
        id: "adminUserDetails.field",
        label: t("table.adminUserDetails.field"),
        mobileRole: "summary-primary",
        render: (row) => row.field,
      },
      {
        id: "adminUserDetails.value",
        label: t("table.adminUserDetails.value"),
        mobileRole: "summary-secondary",
        render: (row) => row.value,
      },
    ],
    [t],
  );

  const subscriptionColumns = useMemo<DataListColumn<UserSubscription>[]>(
    () => [
      {
        id: "adminUserDetailsSubscription.planCode",
        label: t("table.adminUserDetailsSubscription.planCode"),
        mobileRole: "summary-primary",
        render: (subscription) => subscription.planCode,
      },
      {
        id: "adminUserDetailsSubscription.status",
        label: t("table.adminUserDetailsSubscription.status"),
        mobileRole: "summary-secondary",
        render: (subscription) => subscription.status,
      },
      {
        id: "adminUserDetailsSubscription.id",
        label: t("table.adminUserDetailsSubscription.id"),
        mobileRole: "detail",
        mobileWide: true,
        render: (subscription) => subscription.id,
      },
      {
        id: "adminUserDetailsSubscription.currentPeriodEnd",
        label: t("table.adminUserDetailsSubscription.currentPeriodEnd"),
        mobileRole: "detail",
        render: (subscription) =>
          subscription.currentPeriodEnd
            ? formatRelativeTime(subscription.currentPeriodEnd)
            : "-",
      },
      {
        id: "adminUserDetailsSubscription.createdAt",
        label: t("table.adminUserDetailsSubscription.createdAt"),
        mobileRole: "detail",
        render: (subscription) => formatRelativeTime(subscription.createdAt),
      },
      {
        id: "adminUserDetailsSubscription.paymentId",
        label: t("table.adminUserDetailsSubscription.paymentId"),
        mobileRole: "detail",
        mobileWide: true,
        render: (subscription) => subscription.paymentId ?? "-",
      },
    ],
    [t],
  );

  const paymentColumns = useMemo<DataListColumn<UserPayment>[]>(
    () => [
      {
        id: "adminUserDetailsPayments.amount",
        label: t("table.adminUserDetailsPayments.amount"),
        mobileRole: "summary-primary",
        render: (payment) => `${payment.amount.toFixed(2)} ${payment.currency}`,
      },
      {
        id: "adminUserDetailsPayments.status",
        label: t("table.adminUserDetailsPayments.status"),
        mobileRole: "summary-secondary",
        render: (payment) => payment.status,
      },
      {
        id: "adminUserDetailsPayments.id",
        label: t("table.adminUserDetailsPayments.id"),
        mobileRole: "detail",
        mobileWide: true,
        render: (payment) => payment.id,
      },
      {
        id: "adminUserDetailsPayments.date",
        label: t("table.adminUserDetailsPayments.date"),
        mobileRole: "detail",
        render: (payment) => formatRelativeTime(payment.date),
      },
      {
        id: "adminUserDetailsPayments.type",
        label: t("table.adminUserDetailsPayments.type"),
        mobileRole: "detail",
        render: (payment) => payment.transactionType,
      },
      {
        id: "adminUserDetailsPayments.provider",
        label: t("table.adminUserDetailsPayments.provider"),
        mobileRole: "detail",
        render: (payment) => payment.provider ?? "-",
      },
      {
        id: "adminUserDetailsPayments.actions",
        label: t("table.adminUserDetailsPayments.actions"),
        mobileRole: "footer",
        render: (payment) =>
          payment.transactionType === "payment" && payment.status === "succeeded" ? (
            <Button
              style="secondary"
              disabled={refundingPaymentId === payment.id}
              onClick={() => void handleRefundPayment(payment.id)}
            >
              {refundingPaymentId === payment.id ? t("admin.refunding") : t("admin.refund")}
            </Button>
          ) : null,
      },
    ],
    [refundingPaymentId, t],
  );

  if (isLoading) {
    return <p>{t("admin.userDetailsLoading")}</p>;
  }

  if (error) {
    return <p className="upload-file__error">{error}</p>;
  }

  if (!user) {
    return <p className="upload-file__error">{t("admin.userDetailsNotFound")}</p>;
  }

  const providers = [
    user.providers.password ? "password" : "",
    user.providers.google ? "google" : "",
    user.providers.telegram ? "telegram" : "",
  ]
    .filter(Boolean)
    .join(" + ");

  const profileRows: FieldRow[] = [
    { id: "id", field: "ID", value: user.id },
    {
      id: "userName",
      field: t("table.adminUsers.userName"),
      value: user.userName,
    },
    {
      id: "email",
      field: t("table.adminUsers.email"),
      value: user.email,
    },
    {
      id: "role",
      field: t("table.adminUsers.role"),
      value: user.role,
    },
    {
      id: "providers",
      field: t("table.adminUsers.providers"),
      value: providers || "-",
    },
    {
      id: "vocabPairCount",
      field: t("table.adminUsers.vocabPairCount"),
      value: user.vocabPairCount,
    },
  ];

  return (
    <section>
      <h1>{t("admin.userDetailsTitle", { userId: user.id })}</h1>
      <p>
        <Link to="/admin/users">{t("admin.userDetailsBackToUsers")}</Link>
      </p>

      <h2>{t("admin.userDetailsProfileSection")}</h2>
      <ResponsiveDataList
        columns={fieldColumns}
        data={profileRows}
        getRowKey={(row) => row.id}
      />

      <h2>{t("admin.userDetailsTaughtLanguages")}</h2>
      <ul className="app-nav__list">
        {languages.map((language) => (
          <li key={language.id}>
            <label>
              <input
                type="checkbox"
                checked={taughtLanguageIds.includes(language.id)}
                onChange={(event) => {
                  setTaughtLanguageIds((current) =>
                    event.target.checked
                      ? [...current, language.id]
                      : current.filter((languageId) => languageId !== language.id),
                  );
                }}
              />{" "}
              {language.name}
            </label>
          </li>
        ))}
      </ul>
      <Button onClick={() => void handleSaveTaughtLanguages()} disabled={isSavingLanguages}>
        {isSavingLanguages
          ? t("admin.userDetailsTaughtLanguagesSaving")
          : t("admin.userDetailsTaughtLanguagesSave")}
      </Button>
      {languagesMessage ? <p role="status">{languagesMessage}</p> : null}

      <h2>{t("admin.userDetailsSubscriptionSection")}</h2>
      <h3>{t("admin.userDetailsGrantPremiumSection")}</h3>
      <label className="upload-file__label" htmlFor="admin-premium-end">
        {t("admin.userDetailsPremiumEndLabel")}
      </label>
      <input
        id="admin-premium-end"
        className="upload-file__textarea"
        type="datetime-local"
        min={premiumEndAtMin}
        value={premiumEndAt}
        onChange={(event) => setPremiumEndAt(event.target.value)}
      />
      <Button onClick={() => void handleGrantPremium()} disabled={isGrantingPremium}>
        {isGrantingPremium
          ? t("admin.userDetailsGrantingPremium")
          : t("admin.userDetailsGrantPremiumButton")}
      </Button>
      {actionError ? <p className="upload-file__error">{actionError}</p> : null}
      <ResponsiveDataList
        columns={subscriptionColumns}
        data={user.subscription ? [user.subscription] : []}
        getRowKey={(subscription) => subscription.id}
        emptyMessage={t("table.empty")}
      />

      <h2>{t("admin.userDetailsPaymentsSection")}</h2>
      <ResponsiveDataList
        columns={paymentColumns}
        data={user.recentPayments}
        getRowKey={(payment) => payment.id}
      />
    </section>
  );
}
