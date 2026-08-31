import type { SubscriptionBillingPeriod } from "../config/paddle.js";
import * as subscriptionRepository from "../db/subscriptionRepository.js";
import {
  PREMIUM_USD_MONTHLY,
  PREMIUM_USD_YEARLY,
} from "@language-turtle/shared";

export function getSubscriptionAmount(
  planCode: subscriptionRepository.SubscriptionPlanCode,
  billingPeriod: SubscriptionBillingPeriod,
): number {
  if (planCode !== "premium") {
    return 0;
  }
  return billingPeriod === "yearly" ? PREMIUM_USD_YEARLY : PREMIUM_USD_MONTHLY;
}

export function parseBillingPeriod(rawValue: unknown): SubscriptionBillingPeriod {
  if (rawValue === "yearly") {
    return "yearly";
  }
  if (rawValue === "monthly" || rawValue === undefined || rawValue === null) {
    return "monthly";
  }
  throw new Error("invalid billingPeriod");
}
