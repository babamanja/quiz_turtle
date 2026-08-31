import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import PaymentResultView from "./PaymentResultView";
import {
  abandonPayment,
  getMyPaymentStatus,
  resolvePaymentFromPaddleTransaction,
} from "../../api/subscription";
import Button from "../../components/UI/Button/Button";
import Card from "../../components/UI/Card";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import {
  isPaddleConfigured,
  openPaddleCheckoutForTransaction,
} from "../../lib/paddleCheckout";
import { pollPaymentUntilSettled } from "../../lib/pollPaymentStatus";
import {
  paymentCheckoutPath,
  paymentOutcomeFromStatus,
  paymentResultPath,
} from "../../lib/paymentRoutes";

import "../style.scss";

function useLocalHttpRedirect(): boolean {
  const [needsRedirect, setNeedsRedirect] = useState(false);

  useEffect(() => {
    const { hostname, protocol } = window.location;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";
    if (isLocal && protocol === "https:") {
      setNeedsRedirect(true);
      const httpUrl = window.location.href.replace(/^https:/i, "http:");
      window.location.replace(httpUrl);
    }
  }, []);

  return needsRedirect;
}

export default function PaymentReturnPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRedirectingToHttp = useLocalHttpRedirect();
  const flowStartedRef = useRef(false);

  const paymentIdParam = searchParams.get("paymentId")?.trim() ?? "";
  const isCanceled = searchParams.get("status") === "canceled";
  const paddleTransactionId =
    searchParams.get("_ptxn")?.trim() ??
    searchParams.get("transaction_id")?.trim() ??
    "";

  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const goToPaymentResult = useCallback(
    (
      paymentId: string,
      status: string,
      options?: { failureReason?: string | null },
    ) => {
      const outcome = paymentOutcomeFromStatus(status, options);
      if (outcome) {
        navigate(paymentResultPath(outcome, paymentId), { replace: true });
        return;
      }
      navigate(paymentCheckoutPath(paymentId), { replace: true });
    },
    [navigate],
  );

  const waitForPaymentResult = useCallback(
    async (paymentId: string) => {
      setIsBusy(true);
      setStatusMessage(t("billing.processingPayment"));
      try {
        const result = await pollPaymentUntilSettled(paymentId);
        if (result.status === "timeout") {
          navigate(paymentResultPath("pending", paymentId), { replace: true });
          return;
        }
        goToPaymentResult(paymentId, result.payment.status, {
          failureReason: result.payment.failureReason,
        });
      } catch (pollError) {
        setError(
          pollError instanceof Error
            ? pollError.message
            : t("billing.checkoutLoadFailed"),
        );
        setIsBusy(false);
      }
    },
    [goToPaymentResult, navigate, t],
  );

  const openCheckout = useCallback(
    async (transactionId: string, paymentId: string) => {
      if (!isPaddleConfigured()) {
        setError(t("billing.paddleNotConfigured"));
        return;
      }

      setError(null);
      setIsBusy(true);
      setStatusMessage(t("billing.openingPaddleCheckout"));

      try {
        await openPaddleCheckoutForTransaction(transactionId, {
          onCompleted: () => {
            void waitForPaymentResult(paymentId);
          },
          onClosed: () => {
            setIsBusy(false);
            setStatusMessage(null);
            if (paymentId) {
              void abandonPayment(paymentId, "checkout_abandoned").finally(() => {
                setError(t("billing.checkoutClosed"));
              });
              return;
            }
            setError(t("billing.checkoutClosed"));
          },
          onError: (message) => {
            setIsBusy(false);
            setStatusMessage(null);
            setError(message || t("billing.checkoutActionFailed"));
          },
        });
        setIsBusy(false);
        setStatusMessage(null);
      } catch (openError) {
        setIsBusy(false);
        setStatusMessage(null);
        if (openError instanceof Error && openError.message === "paddle_not_configured") {
          setError(t("billing.paddleNotConfigured"));
          return;
        }
        setError(
          openError instanceof Error
            ? openError.message
            : t("billing.checkoutActionFailed"),
        );
      }
    },
    [t, waitForPaymentResult],
  );

  useEffect(() => {
    if (isRedirectingToHttp || flowStartedRef.current) {
      return;
    }
    flowStartedRef.current = true;

    async function run() {
      if (isCanceled) {
        if (paymentIdParam) {
          try {
            await abandonPayment(paymentIdParam, "checkout_canceled");
          } catch {
            // Still show checkout result even if abandon fails.
          }
          goToPaymentResult(paymentIdParam, "failed", {
            failureReason: "checkout_canceled",
          });
          return;
        }
        setError(t("billing.checkoutCanceled"));
        return;
      }

      if (paymentIdParam && !paddleTransactionId) {
        const row = await getMyPaymentStatus(paymentIdParam);
        if (row.status === "succeeded" || row.status === "failed") {
          goToPaymentResult(paymentIdParam, row.status, {
            failureReason: row.failureReason,
          });
          return;
        }
        if (row.status === "pending") {
          const txnId = row.checkoutUrl?.includes("_ptxn=")
            ? new URL(row.checkoutUrl, window.location.origin).searchParams.get("_ptxn")
            : null;
          if (txnId) {
            await openCheckout(txnId, paymentIdParam);
            return;
          }
        }
        navigate(paymentCheckoutPath(paymentIdParam), { replace: true });
        return;
      }

      if (!paddleTransactionId) {
        setError(t("billing.paymentIdMissing"));
        return;
      }

      setIsBusy(true);
      setStatusMessage(t("billing.checkoutLoading"));
      try {
        const { paymentId } = await resolvePaymentFromPaddleTransaction(
          paddleTransactionId,
        );
        const row = await getMyPaymentStatus(paymentId);

        if (row.status === "succeeded" || row.status === "failed") {
          goToPaymentResult(paymentId, row.status, {
            failureReason: row.failureReason,
          });
          return;
        }

        await openCheckout(paddleTransactionId, paymentId);
      } catch (resolveError) {
        setIsBusy(false);
        setStatusMessage(null);
        setError(
          resolveError instanceof Error
            ? resolveError.message
            : t("billing.checkoutLoadFailed"),
        );
      }
    }

    void run();
  }, [
    goToPaymentResult,
    isCanceled,
    navigate,
    isRedirectingToHttp,
    openCheckout,
    paddleTransactionId,
    paymentIdParam,
    t,
  ]);

  const pageTitle = t("billing.checkoutTitle");

  if (isRedirectingToHttp || isBusy) {
    return (
      <Page width="full" className="subscription-page payment-result-page">
        <PageHeader title={pageTitle} />
        <Card className="payment-result">
          <p className="payment-result__loading">
            {statusMessage ?? t("billing.checkoutLoading")}
          </p>
        </Card>
      </Page>
    );
  }

  if (error) {
    const canRetry =
      Boolean(paddleTransactionId) &&
      Boolean(paymentIdParam) &&
      isPaddleConfigured();

    return (
      <PaymentResultView
        variant={isCanceled ? "canceled" : "failed"}
        title={pageTitle}
        message={error}
        actions={
          canRetry ? (
            <Button
              onClick={() => void openCheckout(paddleTransactionId, paymentIdParam)}
            >
              {t("billing.tryAgain")}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <Page width="full" className="subscription-page payment-result-page">
      <PageHeader title={pageTitle} />
      <Card className="payment-result">
        <p className="payment-result__loading">{t("billing.checkoutLoading")}</p>
      </Card>
    </Page>
  );
}
