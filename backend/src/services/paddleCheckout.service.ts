import {
  getPaddleApiBaseUrl,
  getPaddlePriceId,
  type SubscriptionBillingPeriod,
} from "../config/paddle.js";
import * as paymentRepository from "../db/paymentRepository.js";
import * as subscriptionRepository from "../db/subscriptionRepository.js";
import {
  buildPaymentReturnUrl,
  getRequiredEnv,
  normalizeAppBaseUrl,
} from "./paymentMetadata.js";
import {
  getSubscriptionAmount,
  parseBillingPeriod,
} from "./paymentPricing.js";

export const PADDLE_PROVIDER = "paddle";

export type CheckoutSession = {
  paymentId: string;
  planCode: subscriptionRepository.SubscriptionPlanCode;
  amount: number;
  currency: string;
  provider: string;
  status: paymentRepository.PaymentStatus;
  checkoutUrl: string;
};

type PaddleCheckoutResponse = {
  data?: {
    id?: string;
    checkout?: {
      url?: string;
    };
  };
};

async function createPaddleCheckout(input: {
  paymentId: string;
  userId: number;
  planCode: subscriptionRepository.SubscriptionPlanCode;
  appBaseUrl: string;
  billingPeriod: SubscriptionBillingPeriod;
}): Promise<{ checkoutUrl: string; providerTransactionId: string | null }> {
  const apiKey = getRequiredEnv("PADDLE_API_KEY");
  const priceId = getPaddlePriceId({
    planCode: input.planCode,
    billingPeriod: input.billingPeriod,
  });

  const appOrigin = normalizeAppBaseUrl(input.appBaseUrl);
  const successUrl = buildPaymentReturnUrl(input.appBaseUrl, input.paymentId);
  const cancelUrl =
    `${appOrigin.replace(/\/+$/, "")}` +
    `/payment?paymentId=${encodeURIComponent(input.paymentId)}&status=canceled`;

  const response = await fetch(`${getPaddleApiBaseUrl()}/transactions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      items: [
        {
          price_id: priceId,
          quantity: 1,
        },
      ],
      custom_data: {
        paymentId: input.paymentId,
        userId: input.userId,
        planCode: input.planCode,
        checkoutType: "subscription",
        billingPeriod: input.billingPeriod,
      },
      collection_mode: "automatic",
      currency_code: "USD",
      checkout: {
        settings: {
          success_url: successUrl,
        },
      },
      metadata: {
        cancelUrl,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    let requestId: string | null = null;
    try {
      const parsed = JSON.parse(message) as { meta?: { request_id?: string } };
      requestId = parsed.meta?.request_id ?? null;
    } catch {
      requestId = null;
    }
    console.error("[payments] Paddle transaction create failed", {
      paymentId: input.paymentId,
      status: response.status,
      requestId,
      errorBody: message,
    });
    throw new Error(`Paddle checkout failed: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as PaddleCheckoutResponse;
  const checkoutUrl = payload.data?.checkout?.url?.trim();
  if (!checkoutUrl) {
    throw new Error("Paddle checkout url missing");
  }

  const providerTransactionId = payload.data?.id
    ? String(payload.data.id)
    : null;
  return { checkoutUrl, providerTransactionId };
}

export async function createCheckoutSession(
  userId: number,
  planCode: subscriptionRepository.SubscriptionPlanCode,
  appBaseUrl: string,
  billingPeriod?: unknown,
) {
  const normalizedBillingPeriod = parseBillingPeriod(billingPeriod);
  const amount = getSubscriptionAmount(planCode, normalizedBillingPeriod);
  const payment = await paymentRepository.createPendingSubscriptionPayment({
    userId,
    amount,
    currency: "USD",
    provider: PADDLE_PROVIDER,
    description: `${planCode} ${normalizedBillingPeriod} subscription checkout`,
    metadata: {
      flow: "subscription_checkout",
      planCode,
      billingPeriod: normalizedBillingPeriod,
    },
  });

  let checkoutUrl = buildPaymentReturnUrl(appBaseUrl, payment.id);
  let providerTransactionId: string | null = null;
  const paddleCheckout = await createPaddleCheckout({
    paymentId: payment.id,
    userId,
    planCode,
    appBaseUrl,
    billingPeriod: normalizedBillingPeriod,
  });
  checkoutUrl = paddleCheckout.checkoutUrl;
  providerTransactionId = paddleCheckout.providerTransactionId;

  await paymentRepository.updatePendingPaymentCheckoutData({
    paymentId: payment.id,
    providerTransactionId,
    metadataPatch: {
      checkoutUrl,
      checkoutCreatedAt: new Date().toISOString(),
    },
  });

  const checkoutSession: CheckoutSession = {
    paymentId: payment.id,
    planCode,
    amount: payment.amount,
    currency: payment.currency,
    provider: PADDLE_PROVIDER,
    status: "pending",
    checkoutUrl,
  };

  return { ok: true as const, checkoutSession };
}
