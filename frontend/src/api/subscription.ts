import { apiClient } from "./_api";

export type MySubscription = {
  id: string;
  userId: number;
  planCode: "basic" | "premium";
  effectivePlanCode: "basic" | "premium";
  cancelAtPeriodEnd: boolean;
  status: "active" | "canceled" | "past_due";
  currentPeriodEnd: string | null;
  createdAt: string;
  paymentId: string | null;
};

export type SubscriptionPlanCode = "basic" | "premium";

export type SubscriptionPaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type CheckoutSession = {
  paymentId: string;
  planCode: SubscriptionPlanCode;
  amount: number;
  currency: string;
  provider: string;
  status: SubscriptionPaymentStatus;
  checkoutUrl: string;
};

export type SubscriptionPayment = {
  paymentId: string;
  paymentType: "payment" | "refund";
  date: string;
  planCode: SubscriptionPlanCode;
  amount: number;
  currency: string;
  provider: string | null;
  status: SubscriptionPaymentStatus;
  checkoutUrl: string | null;
  failureReason: string | null;
};

export type SubscriptionPaymentLedgerItem = {
  paymentId: string;
  paymentType: "payment" | "refund";
  date: string;
  amount: number;
  currency: string;
  provider: string | null;
  status: SubscriptionPaymentStatus;
  description: string | null;
};

export async function getMySubscription(): Promise<MySubscription> {
  const { data } = await apiClient.get<MySubscription>("/subscriptions/me");
  return data;
}

export async function cancelMySubscription(): Promise<MySubscription> {
  const { data } = await apiClient.post<MySubscription>("/subscriptions/me/cancel");
  return data;
}

export async function resumeMySubscription(): Promise<MySubscription> {
  const { data } = await apiClient.post<MySubscription>("/subscriptions/me/resume");
  return data;
}

export type SubscriptionBillingPeriod = "monthly" | "yearly";

export async function createCheckoutSession(
  planCode: SubscriptionPlanCode,
  options?: {
    billingPeriod?: SubscriptionBillingPeriod;
  },
): Promise<CheckoutSession> {
  const { data } = await apiClient.post<CheckoutSession>("/subscriptions/checkout-session", {
    planCode,
    billingPeriod: options?.billingPeriod,
    appBaseUrl: window.location.origin,
  });
  return data;
}

export async function resolvePaymentFromPaddleTransaction(
  paddleTransactionId: string,
): Promise<{ paymentId: string }> {
  const { data } = await apiClient.get<{ paymentId: string }>(
    "/subscriptions/payments/resolve",
    {
      params: { paddleTransactionId },
    },
  );
  return data;
}

export async function getMyPaymentStatus(paymentId: string): Promise<SubscriptionPayment> {
  const { data } = await apiClient.get<SubscriptionPayment>(
    `/subscriptions/payments/${paymentId}`,
    {
      params: { appBaseUrl: window.location.origin },
    },
  );
  return data;
}

export async function syncPaymentFromPaddle(
  paymentId: string,
): Promise<SubscriptionPayment> {
  const { data } = await apiClient.post<SubscriptionPayment>(
    `/subscriptions/payments/${paymentId}/sync-paddle`,
    { appBaseUrl: window.location.origin },
  );
  return data;
}

export type AbandonPaymentReason = "checkout_canceled" | "checkout_abandoned";

export async function abandonPayment(
  paymentId: string,
  reason: AbandonPaymentReason = "checkout_canceled",
): Promise<SubscriptionPayment> {
  const { data } = await apiClient.post<SubscriptionPayment>(
    `/subscriptions/payments/${paymentId}/abandon`,
    { reason, appBaseUrl: window.location.origin },
  );
  return data;
}

export async function getMyPayments(): Promise<SubscriptionPaymentLedgerItem[]> {
  const { data } = await apiClient.get<SubscriptionPaymentLedgerItem[]>("/subscriptions/payments");
  return data;
}

