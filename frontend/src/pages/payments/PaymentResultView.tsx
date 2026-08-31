import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import ButtonLink from "../../components/UI/Button/ButtonLink";
import Card from "../../components/UI/Card";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";

import "../style.scss";

export type PaymentResultVariant = "success" | "failed" | "pending" | "canceled";

type PaymentResultDetail = {
  label: string;
  value: string;
};

type PaymentResultViewProps = {
  variant: PaymentResultVariant;
  title: string;
  message: string;
  details?: PaymentResultDetail[];
  amountUsd?: number;
  currency?: string;
  actions?: ReactNode;
  showBackLink?: boolean;
};

const VARIANT_ICON: Record<PaymentResultVariant, string> = {
  success: "✓",
  failed: "✕",
  pending: "…",
  canceled: "—",
};

export function formatPaymentFailureReason(
  reason: string | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!reason?.trim()) {
    return null;
  }
  const key = `billing.failureReasons.${reason.trim()}`;
  const translated = t(key);
  return translated === key ? reason : translated;
}

export default function PaymentResultView({
  variant,
  title,
  message,
  details = [],
  amountUsd,
  currency = "USD",
  actions,
  showBackLink = true,
}: PaymentResultViewProps) {
  const { t } = useTranslation();

  const amountDetail =
    amountUsd != null
      ? {
          label: t("billing.amountLabel"),
          value:
            currency.toUpperCase() === "USD"
              ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountUsd)
              : `${amountUsd} ${currency.toUpperCase()}`,
        }
      : null;

  const allDetails = amountDetail ? [amountDetail, ...details] : details;

  return (
    <Page width="full" className="subscription-page payment-result-page">
      <PageHeader title={title} />

      <Card className="payment-result">
        <div className={`payment-result__banner payment-result__banner--${variant}`}>
          <span className="payment-result__icon" aria-hidden>
            {VARIANT_ICON[variant]}
          </span>
          <p className="payment-result__message">{message}</p>
        </div>

        {allDetails.length > 0 ? (
          <dl className="payment-result__details">
            {allDetails.map((row) => (
              <div key={`${row.label}-${row.value}`} className="payment-result__detail-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {actions ? <div className="payment-result__actions">{actions}</div> : null}

        {showBackLink ? (
          <p className="payment-result__footer">
            <ButtonLink to="/my-subscription" style={variant === "success" ? "primary" : "secondary"}>
              {t("billing.backToSubscription")}
            </ButtonLink>
          </p>
        ) : null}
      </Card>
    </Page>
  );
}
