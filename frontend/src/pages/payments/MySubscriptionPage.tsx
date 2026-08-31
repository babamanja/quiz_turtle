import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PREMIUM_USD_MONTHLY, PREMIUM_USD_YEARLY } from "@language-turtle/shared";

import { createRequestId, trackAnalyticsEvent, trackUiCtaClick } from "../../analytics";
import {
  cancelMySubscription,
  createCheckoutSession,
  getMySubscription,
  resumeMySubscription,
  type MySubscription,
} from "../../api/subscription";
import Button from "../../components/UI/Button/Button";
import Card from "../../components/UI/Card";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import "../style.scss";
import { formatRelativeTime } from "../../utils/convertTime";

export default function MySubscriptionPage() {
  const { t } = useTranslation();
  const [premiumBillingPeriod, setPremiumBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingUpgradeCheckout, setIsStartingUpgradeCheckout] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  useEffect(() => {
    trackAnalyticsEvent("subscription_opened", {});
  }, []);

  useEffect(() => {
    let isCancelled = false;
    getMySubscription()
      .then((subscriptionData) => {
        if (isCancelled) {
          return;
        }
        setSubscription(subscriptionData);
      })
      .catch((loadError) => {
        if (isCancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : t("subscription.loadFailed"));
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [t]);

  async function handleUpgradeSubscription() {
    trackUiCtaClick("app_subscription_upgrade_premium", premiumBillingPeriod);
    const requestId = createRequestId();
    trackAnalyticsEvent("checkout_started", {
      request_id: requestId,
      checkout_type: "subscription",
      plan_code: "premium",
    });
    setError(null);
    setIsStartingUpgradeCheckout(true);
    try {
      const session = await createCheckoutSession("premium", {
        billingPeriod: premiumBillingPeriod,
      });
      trackAnalyticsEvent("checkout_redirected", {
        request_id: requestId,
        payment_id: session.paymentId,
        checkout_type: "subscription",
        plan_code: session.planCode,
      });
      window.location.assign(
        `/payment/checkout?paymentId=${encodeURIComponent(session.paymentId)}`,
      );
    } catch (checkoutError) {
      trackAnalyticsEvent("checkout_failed", {
        request_id: requestId,
        reason:
          checkoutError instanceof Error ? checkoutError.message : "checkout_session_failed",
        stage: "create_session",
      });
      setError(checkoutError instanceof Error ? checkoutError.message : t("billing.checkoutFailed"));
      setIsStartingUpgradeCheckout(false);
    }
  }

  async function handleCancelSubscription() {
    setError(null);
    setIsCanceling(true);
    try {
      const updated = await cancelMySubscription();
      setSubscription(updated);
    } catch (cancelError) {
      setError(
        cancelError instanceof Error ? cancelError.message : t("mySubscription.cancelFailed"),
      );
    } finally {
      setIsCanceling(false);
    }
  }

  async function handleResumeSubscription() {
    setError(null);
    setIsResuming(true);
    try {
      const updated = await resumeMySubscription();
      setSubscription(updated);
    } catch (resumeError) {
      setError(
        resumeError instanceof Error ? resumeError.message : t("mySubscription.resumeFailed"),
      );
    } finally {
      setIsResuming(false);
    }
  }

  if (isLoading) {
    return <p>{t("subscription.loading")}</p>;
  }

  if (error && !subscription) {
    return <p className="upload-file__error">{error}</p>;
  }

  const effectivePlanCode = subscription?.effectivePlanCode ?? "basic";
  const isPremiumPlan = effectivePlanCode === "premium";
  const canCancel =
    subscription?.planCode === "premium" &&
    (subscription.status === "active" || subscription.status === "past_due");
  const canResume = subscription?.cancelAtPeriodEnd === true;
  const periodEndLabel = subscription?.currentPeriodEnd
    ? formatRelativeTime(subscription.currentPeriodEnd)
    : null;

  return (
    <Page width="full" className="subscription-page">
      <PageHeader title={t("mySubscription.title")} />
      {error ? <p className="upload-file__error">{error}</p> : null}
      {subscription?.cancelAtPeriodEnd && periodEndLabel ? (
        <p className="subscription-page__notice" role="status">
          {t("subscription.premiumAccessUntil", { date: periodEndLabel })}
        </p>
      ) : null}

      <section className="subscription-page__plans">
        <Card
          className={`subscription-page__plan-card ${
            !isPremiumPlan ? "subscription-page__plan-card--current" : ""
          }`}
        >
          <h2>{t("mySubscription.plans.basic.title")}</h2>
          <p className="subscription-page__plan-price">{t("mySubscription.plans.basic.price")}</p>
          <ul className="subscription-page__benefits">
            <li>{t("mySubscription.plans.basic.benefits.telegramPractice")}</li>
            <li>{t("mySubscription.plans.basic.benefits.telegramAccess")}</li>
            <li>{t("mySubscription.plans.basic.benefits.communitySupport")}</li>
          </ul>
          <Button style="secondary" disabled>
            {isPremiumPlan
              ? t("mySubscription.switchToBasicDisabled")
              : t("mySubscription.currentPlan")}
          </Button>
        </Card>

        <Card
          className={`subscription-page__plan-card ${
            isPremiumPlan ? "subscription-page__plan-card--current" : ""
          }`}
        >
          <h2>{t("mySubscription.plans.premium.title")}</h2>
          {isPremiumPlan && periodEndLabel ? (
            <p className="subscription-page__plan-meta">
              {subscription?.cancelAtPeriodEnd
                ? t("mySubscription.premiumEndsOn", { date: periodEndLabel })
                : t("mySubscription.nextBillingDateDescription")}
            </p>
          ) : null}
          <div
            className="subscription-page__billing-tabs"
            role="tablist"
            aria-label={t("mySubscription.billingPeriod")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={premiumBillingPeriod === "monthly"}
              className={`subscription-page__billing-tab ${
                premiumBillingPeriod === "monthly" ? "subscription-page__billing-tab--active" : ""
              }`}
              onClick={() => setPremiumBillingPeriod("monthly")}
            >
              {t("mySubscription.monthly")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={premiumBillingPeriod === "yearly"}
              className={`subscription-page__billing-tab ${
                premiumBillingPeriod === "yearly" ? "subscription-page__billing-tab--active" : ""
              }`}
              onClick={() => setPremiumBillingPeriod("yearly")}
            >
              {t("mySubscription.yearly")}
            </button>
          </div>
          <p className="subscription-page__plan-price">
            {premiumBillingPeriod === "monthly"
              ? t("mySubscription.plans.premium.priceMonthly", {
                  price: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    PREMIUM_USD_MONTHLY,
                  ),
                })
              : t("mySubscription.plans.premium.priceYearly", {
                  price: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    PREMIUM_USD_YEARLY,
                  ),
                })}
          </p>
          <ul className="subscription-page__benefits">
            <li>{t("mySubscription.plans.premium.benefits.prioritySupport")}</li>
            <li>{t("mySubscription.plans.premium.benefits.telegramPremium")}</li>
            <li>{t("mySubscription.plans.premium.benefits.earlyAccess")}</li>
          </ul>
          <Button onClick={handleUpgradeSubscription} disabled={isStartingUpgradeCheckout || isPremiumPlan}>
            {isPremiumPlan
              ? t("mySubscription.currentPlan")
              : isStartingUpgradeCheckout
                ? t("billing.redirecting")
                : t("subscription.upgradeSubscription")}
          </Button>
          {canCancel ? (
            <Button style="secondary" onClick={handleCancelSubscription} disabled={isCanceling}>
              {isCanceling ? t("mySubscription.canceling") : t("mySubscription.cancelSubscription")}
            </Button>
          ) : null}
          {canResume ? (
            <Button onClick={handleResumeSubscription} disabled={isResuming}>
              {isResuming ? t("mySubscription.resuming") : t("mySubscription.resumeSubscription")}
            </Button>
          ) : null}
        </Card>
      </section>
    </Page>
  );
}
