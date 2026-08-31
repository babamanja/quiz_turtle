import * as subscriptionRepository from "../db/subscriptionRepository.js";
import * as paymentRepository from "../db/paymentRepository.js";
import { createCheckoutSession } from "./paddleCheckout.service.js";
import { handlePaddleWebhook as processPaddleWebhook } from "./paddleWebhook.service.js";
import {
  abandonPendingPayment,
  getPaymentStatus,
  resolvePaymentIdFromPaddleTransaction,
  syncPaymentFromPaddle,
} from "./paymentStatus.service.js";
import {
  canCancelSubscription,
  canResumeSubscription,
  toSubscriptionView,
  type SubscriptionView,
} from "./subscriptionPlan.service.js";

async function loadMySubscriptionView(
  userId: number,
): Promise<SubscriptionView> {
  await subscriptionRepository.ensureDefaultBasicSubscription(userId);
  await subscriptionRepository.downgradeExpiredCanceledPremium(userId);
  const subscription =
    await subscriptionRepository.selectSubscriptionByUserId(userId);
  if (!subscription) {
    const created =
      await subscriptionRepository.ensureDefaultBasicSubscription(userId);
    return toSubscriptionView(created);
  }
  return toSubscriptionView(subscription);
}

export async function getMySubscription(userId: number) {
  const subscription = await loadMySubscriptionView(userId);
  return { ok: true as const, subscription };
}

export async function cancelMySubscription(userId: number) {
  await subscriptionRepository.ensureDefaultBasicSubscription(userId);
  await subscriptionRepository.downgradeExpiredCanceledPremium(userId);
  const subscription =
    await subscriptionRepository.selectSubscriptionByUserId(userId);
  if (!subscription) {
    return { ok: false as const, status: 404, error: "subscription not found" };
  }
  if (!canCancelSubscription(subscription)) {
    return {
      ok: false as const,
      status: 400,
      error: "cancel not available for this plan",
    };
  }
  if (subscription.status === "canceled") {
    return { ok: true as const, subscription: toSubscriptionView(subscription) };
  }
  const updated =
    await subscriptionRepository.cancelSubscriptionByUserId(userId);
  if (!updated) {
    return {
      ok: false as const,
      status: 400,
      error: "cancel not available for this plan",
    };
  }
  return { ok: true as const, subscription: toSubscriptionView(updated) };
}

export async function resumeMySubscription(userId: number) {
  await subscriptionRepository.ensureDefaultBasicSubscription(userId);
  await subscriptionRepository.downgradeExpiredCanceledPremium(userId);
  const subscription =
    await subscriptionRepository.selectSubscriptionByUserId(userId);
  if (!subscription) {
    return { ok: false as const, status: 404, error: "subscription not found" };
  }
  if (!canResumeSubscription(subscription)) {
    return {
      ok: false as const,
      status: 400,
      error: "resume not available for this plan",
    };
  }
  if (subscription.status === "active") {
    return { ok: true as const, subscription: toSubscriptionView(subscription) };
  }
  const updated =
    await subscriptionRepository.resumeSubscriptionByUserId(userId);
  if (!updated) {
    return {
      ok: false as const,
      status: 400,
      error: "resume not available for this plan",
    };
  }
  return { ok: true as const, subscription: toSubscriptionView(updated) };
}

export async function createMyCheckoutSession(
  userId: number,
  planCode: subscriptionRepository.SubscriptionPlanCode,
  appBaseUrl: string,
  billingPeriod?: unknown,
) {
  return await createCheckoutSession(
    userId,
    planCode,
    appBaseUrl,
    billingPeriod,
  );
}

export async function getMyPaymentStatus(
  userId: number,
  paymentId: string,
  appBaseUrl: string,
) {
  return await getPaymentStatus(userId, paymentId, appBaseUrl);
}

export async function syncMyPaymentFromPaddle(
  userId: number,
  paymentId: string,
  appBaseUrl: string,
  paddleTransactionId?: string | null,
) {
  const result = await syncPaymentFromPaddle(
    userId,
    paymentId,
    appBaseUrl,
    paddleTransactionId,
  );
  await subscriptionRepository.downgradeExpiredCanceledPremium(userId);
  return result;
}

export async function abandonMyPendingPayment(
  userId: number,
  paymentId: string,
  appBaseUrl: string,
  failureReason?: unknown,
) {
  return await abandonPendingPayment(
    userId,
    paymentId,
    appBaseUrl,
    failureReason,
  );
}

export async function resolveMyPaymentFromPaddleTransaction(
  userId: number,
  paddleTransactionId: string,
) {
  return await resolvePaymentIdFromPaddleTransaction(
    userId,
    paddleTransactionId,
  );
}

export async function listMyPayments(userId: number) {
  const payments = await paymentRepository.selectPaymentsByUserId(userId);
  return {
    ok: true as const,
    payments: payments.map((payment) => ({
      paymentId: payment.id,
      paymentType: payment.transactionType,
      date: payment.createdAt,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      status: payment.status,
      description: payment.description,
    })),
  };
}

export async function handlePaddleWebhook(input: {
  rawBody: Buffer | string;
  signatureHeader: string;
}) {
  const result = await processPaddleWebhook(input);
  await subscriptionRepository.downgradeExpiredCanceledPremium();
  return result;
}
