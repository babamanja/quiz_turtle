import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import PaymentResultView from "./PaymentResultView";
import { trackAnalyticsEvent } from "../../analytics";
import { getMyPaymentStatus, abandonPayment, type SubscriptionPayment } from "../../api/subscription";
import Card from "../../components/UI/Card";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import {
  extractPaddleTransactionId,
  isPaddleConfigured,
  openPaddleCheckoutForTransaction,
} from "../../lib/paddleCheckout";
import { pollPaymentUntilSettled } from "../../lib/pollPaymentStatus";
import {
  paymentResultPath,
  paymentTerminalOutcomeFromStatus,
} from "../../lib/paymentRoutes";

import "../style.scss";

export default function PaymentCheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("paymentId")?.trim() ?? "";
  const isCanceledReturn = searchParams.get("status") === "canceled";

  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaddleCheckoutOpen, setIsPaddleCheckoutOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const paddleOpenedForPaymentRef = useRef<string | null>(null);

  const pageTitle = t("billing.checkoutTitle");

  const goToTerminalResult = useCallback(
    (row: SubscriptionPayment) => {
      const outcome = paymentTerminalOutcomeFromStatus(row.status, {
        failureReason: row.failureReason,
      });
      if (!outcome) {
        return false;
      }
      navigate(paymentResultPath(outcome, row.paymentId), { replace: true });
      return true;
    },
    [navigate],
  );

  const waitForPaymentResult = useCallback(async () => {
    if (!paymentId) {
      return;
    }
    setIsProcessingPayment(true);
    setLoadError(null);
    try {
      const result = await pollPaymentUntilSettled(paymentId);
      if (goToTerminalResult(result.payment)) {
        return;
      }
      navigate(paymentResultPath("pending", paymentId), { replace: true });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : t("billing.checkoutLoadFailed"),
      );
      setIsProcessingPayment(false);
    }
  }, [goToTerminalResult, navigate, paymentId, t]);

  const openPaddleCheckout = useCallback(
    async (transactionId: string) => {
      if (!isPaddleConfigured()) {
        setLoadError(t("billing.paddleNotConfigured"));
        setIsPaddleCheckoutOpen(false);
        return;
      }

      setIsPaddleCheckoutOpen(true);
      setLoadError(null);

      try {
        await openPaddleCheckoutForTransaction(transactionId, {
          onCompleted: () => {
            setIsPaddleCheckoutOpen(false);
            void waitForPaymentResult();
          },
          onClosed: () => {
            setIsPaddleCheckoutOpen(false);
            void abandonPayment(paymentId, "checkout_abandoned")
              .then((row) => {
                navigate(paymentResultPath("canceled", row.paymentId), { replace: true });
              })
              .catch(() => {
                setLoadError(t("billing.checkoutClosed"));
              });
          },
          onError: (message) => {
            setIsPaddleCheckoutOpen(false);
            setLoadError(message || t("billing.checkoutActionFailed"));
          },
        });
      } catch (error) {
        setIsPaddleCheckoutOpen(false);
        setLoadError(
          error instanceof Error ? error.message : t("billing.checkoutActionFailed"),
        );
      }
    },
    [navigate, paymentId, t, waitForPaymentResult],
  );

  const loadPayment = useCallback(async () => {
    if (!paymentId) {
      setLoadError(t("billing.paymentIdMissing"));
      setIsLoading(false);
      trackAnalyticsEvent("checkout_failed", {
        reason: "payment_id_missing",
        stage: "checkout_page",
      });
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      if (isCanceledReturn) {
        const row = await abandonPayment(paymentId, "checkout_canceled");
        navigate(paymentResultPath("canceled", row.paymentId), { replace: true });
        return;
      }

      const row = await getMyPaymentStatus(paymentId);

      if (row.status === "succeeded") {
        goToTerminalResult(row);
        return;
      }

      const transactionId = extractPaddleTransactionId(row.checkoutUrl);

      if (row.status === "failed" && !transactionId) {
        goToTerminalResult(row);
        return;
      }

      if (!transactionId) {
        setLoadError(t("billing.checkoutUrlMissing"));
        setIsLoading(false);
        return;
      }

      if (paddleOpenedForPaymentRef.current === row.paymentId) {
        setIsLoading(false);
        return;
      }

      paddleOpenedForPaymentRef.current = row.paymentId;
      setIsLoading(false);
      void openPaddleCheckout(transactionId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "load_failed";
      setLoadError(reason);
      trackAnalyticsEvent("checkout_failed", {
        payment_id: paymentId || undefined,
        reason,
        stage: "checkout_page",
      });
      setIsLoading(false);
    }
  }, [goToTerminalResult, isCanceledReturn, navigate, openPaddleCheckout, paymentId, t]);

  useEffect(() => {
    void loadPayment();
  }, [loadPayment]);

  if (loadError && !isLoading && !isPaddleCheckoutOpen && !isProcessingPayment) {
    return (
      <PaymentResultView
        variant="failed"
        title={pageTitle}
        message={loadError}
        showBackLink
      />
    );
  }

  return (
    <Page width="full" className="subscription-page payment-result-page">
      <PageHeader title={pageTitle} subtitle={t("billing.checkoutInProgress")} />

      <Card className="payment-result">
        <p className="payment-result__loading">
          {isProcessingPayment
            ? t("billing.processingPayment")
            : isPaddleCheckoutOpen
              ? t("billing.completePaymentInPaddle")
              : t("billing.openingPaddleCheckout")}
        </p>
      </Card>
    </Page>
  );
}
