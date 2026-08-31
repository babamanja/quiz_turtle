export type PaddleEnvironment = "sandbox" | "live";

export type SubscriptionBillingPeriod = "monthly" | "yearly";

type PaddlePriceIds = {
  subscription_1_month: string;
  subscription_1_year: string;
};

/** Paddle Billing API origins per environment. */
export const PADDLE_API_BASE_URL_BY_ENV: Record<PaddleEnvironment, string> = {
  sandbox: "https://sandbox-api.paddle.com",
  live: "https://api.paddle.com",
};

/** Price IDs from the Paddle dashboard (Catalog → Prices). Not secrets — differ per environment. */
export const PADDLE_PRICE_IDS_BY_ENV: Record<PaddleEnvironment, PaddlePriceIds> = {
  sandbox: {
    subscription_1_month: "pri_01kpx8yqfq5j5r8hkdgwmq4acs",
    subscription_1_year: "pri_01krzpzz41rwprn2w588y2zq13",
  },
  live: {
    subscription_1_month: "pri_01kpx86fv6f7k3rrv8y9sq8f5s",
    subscription_1_year: "pri_01krxbmynqzrtm3pyjt9x2wqqf",
  },
};

function isPaddleEnvironment(value: string): value is PaddleEnvironment {
  return value === "sandbox" || value === "live";
}

export function getPaddleEnvironment(): PaddleEnvironment {
  const raw = process.env.PADDLE_ENV?.trim().toLowerCase();
  if (!raw) {
    return "sandbox";
  }
  if (!isPaddleEnvironment(raw)) {
    throw new Error('PADDLE_ENV must be "sandbox" or "live"');
  }
  return raw;
}

export function getPaddleApiBaseUrl(): string {
  return PADDLE_API_BASE_URL_BY_ENV[getPaddleEnvironment()];
}

function assertValidPriceId(priceId: string, label: string): string {
  const value = priceId.trim();
  if (!value.startsWith("pri_")) {
    throw new Error(`invalid Paddle price id for ${label}`);
  }
  return value;
}

function subscriptionPriceKey(
  billingPeriod: SubscriptionBillingPeriod,
): keyof PaddlePriceIds {
  return billingPeriod === "yearly"
    ? "subscription_1_year"
    : "subscription_1_month";
}

export function getPaddlePriceId(input: {
  planCode: "basic" | "premium";
  billingPeriod?: SubscriptionBillingPeriod;
}): string {
  const prices = PADDLE_PRICE_IDS_BY_ENV[getPaddleEnvironment()];

  if (input.planCode !== "premium") {
    throw new Error("unsupported planCode");
  }
  const billingPeriod = input.billingPeriod ?? "monthly";
  if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
    throw new Error("invalid billingPeriod");
  }
  const key = subscriptionPriceKey(billingPeriod);
  return assertValidPriceId(
    prices[key],
    billingPeriod === "yearly" ? "yearly subscription" : "monthly subscription",
  );
}
