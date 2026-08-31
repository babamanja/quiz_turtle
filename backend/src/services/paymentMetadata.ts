import * as paymentRepository from "../db/paymentRepository.js";
import * as subscriptionRepository from "../db/subscriptionRepository.js";
import type { SubscriptionBillingPeriod } from "../config/paddle.js";

export function normalizeAppBaseUrl(appBaseUrl: string): string {
  const fallback = "http://127.0.0.1:5173";
  const raw = appBaseUrl.trim();
  if (!raw) {
    return fallback;
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    const isLocalhost = parsed.hostname === "localhost";
    const isLoopback = parsed.hostname === "127.0.0.1";
    if (isLocalhost || isLoopback) {
      const port = parsed.port || "5173";
      return `http://127.0.0.1:${port}`;
    }
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function buildPaymentReturnUrl(appBaseUrl: string, paymentId: string): string {
  const normalizedBaseUrl = normalizeAppBaseUrl(appBaseUrl).replace(/\/+$/, "");
  return `${normalizedBaseUrl}/payment?paymentId=${encodeURIComponent(paymentId)}`;
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function readPlanCode(
  metadata: Record<string, unknown> | null,
): subscriptionRepository.SubscriptionPlanCode {
  const raw = metadata?.planCode;
  if (typeof raw === "string" && raw.toLowerCase() === "premium") {
    return "premium";
  }
  return "basic";
}

export function readBillingPeriod(
  metadata: Record<string, unknown> | null,
): SubscriptionBillingPeriod {
  const raw = metadata?.billingPeriod;
  if (raw === "yearly") {
    return "yearly";
  }
  return "monthly";
}

export function readFailureReason(
  metadata: Record<string, unknown> | null,
): string | null {
  const reason = metadata?.failureReason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

export function readCheckoutUrl(
  metadata: Record<string, unknown> | null,
): string | null {
  const checkoutUrl = metadata?.checkoutUrl;
  return typeof checkoutUrl === "string" && checkoutUrl.length > 0
    ? checkoutUrl
    : null;
}

export function extractPaddleTransactionIdFromCheckoutUrl(
  checkoutUrl: string | null | undefined,
): string | null {
  const raw = checkoutUrl?.trim();
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(raw, "http://localhost");
    const transactionId = url.searchParams.get("_ptxn")?.trim();
    if (transactionId?.startsWith("txn_")) {
      return transactionId;
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveProviderTransactionIdForPayment(
  payment: paymentRepository.UserPaymentRow,
  override?: string | null,
): string | null {
  const explicit = override?.trim();
  if (explicit?.startsWith("txn_")) {
    return explicit;
  }
  const stored = payment.providerTransactionId?.trim();
  if (stored?.startsWith("txn_")) {
    return stored;
  }
  return extractPaddleTransactionIdFromCheckoutUrl(
    readCheckoutUrl(payment.metadata),
  );
}

export type PaymentStatusResponse = {
  paymentId: string;
  paymentType: "payment" | "refund";
  date: string;
  planCode: subscriptionRepository.SubscriptionPlanCode;
  amount: number;
  currency: string;
  provider: string | null;
  status: paymentRepository.PaymentStatus;
  checkoutUrl: string | null;
  failureReason: string | null;
};

export function buildPaymentStatusResponse(
  payment: paymentRepository.UserPaymentRow,
  appBaseUrl: string,
): PaymentStatusResponse {
  const planCode = readPlanCode(payment.metadata);
  const shouldAllowResume = payment.status === "pending";
  return {
    paymentId: payment.id,
    paymentType: payment.transactionType,
    date: payment.createdAt,
    planCode,
    amount: payment.amount,
    currency: payment.currency,
    provider: payment.provider,
    status: payment.status,
    checkoutUrl: shouldAllowResume
      ? (readCheckoutUrl(payment.metadata) ??
        buildPaymentReturnUrl(appBaseUrl, payment.id))
      : null,
    failureReason: readFailureReason(payment.metadata),
  };
}
