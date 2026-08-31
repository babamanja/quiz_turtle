import { getPrisma } from "./prisma.js";

export type SubscriptionPlanCode = "basic" | "premium";
export type SubscriptionStatus = "active" | "canceled" | "past_due";

export type SubscriptionRow = {
  id: string;
  userId: number;
  planCode: SubscriptionPlanCode;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  createdAt: string;
  paymentId: string | null;
};

function normalizePlanCode(planCode: string): SubscriptionPlanCode {
  return planCode === "premium" ? "premium" : "basic";
}

function normalizeStatus(status: string): SubscriptionStatus {
  return status === "canceled" || status === "past_due" ? status : "active";
}

function toIsoString(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapSubscriptionRow(row: {
  id: string;
  userId: number;
  planCode: string;
  status: string;
  currentPeriodEnd: Date | string | null;
  createdAt: Date | string;
  paymentId: string | null;
}): SubscriptionRow {
  return {
    id: row.id,
    userId: row.userId,
    planCode: normalizePlanCode(row.planCode),
    status: normalizeStatus(row.status),
    currentPeriodEnd: toIsoString(row.currentPeriodEnd),
    createdAt: toIsoString(row.createdAt)!,
    paymentId: row.paymentId,
  };
}

export async function ensureDefaultBasicSubscription(
  userId: number,
): Promise<SubscriptionRow> {
  const subscription = await getPrisma().subscription.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      planCode: "basic",
      status: "active",
    },
  });

  return mapSubscriptionRow({
    id: subscription.id,
    userId: subscription.userId,
    planCode: subscription.planCode,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    createdAt: subscription.createdAt,
    paymentId: subscription.paymentId,
  });
}

export async function downgradeExpiredCanceledPremium(
  userId?: number,
): Promise<number> {
  if (userId != null) {
    const result = await getPrisma().$executeRaw`
      UPDATE subscriptions
      SET
        plan_code = 'basic',
        status = 'active',
        current_period_end = NULL
      WHERE user_id = ${userId}
        AND plan_code = 'premium'
        AND status = 'canceled'
        AND (
          current_period_end IS NULL
          OR current_period_end < NOW()
        )
    `;
    return Number(result);
  }

  const result = await getPrisma().$executeRaw`
    UPDATE subscriptions
    SET
      plan_code = 'basic',
      status = 'active',
      current_period_end = NULL
    WHERE plan_code = 'premium'
      AND status = 'canceled'
      AND (
        current_period_end IS NULL
        OR current_period_end < NOW()
      )
  `;
  return Number(result);
}

export async function selectSubscriptionByUserId(
  userId: number,
): Promise<SubscriptionRow | null> {
  const rows = await getPrisma().$queryRaw<
    Array<{
      id: string;
      user_id: number;
      plan_code: string;
      status: string;
      current_period_end: Date | null;
      created_at: Date;
      payment_id: string | null;
    }>
  >`
    SELECT
      s.id,
      s.user_id,
      s.plan_code,
      s.status,
      s.current_period_end,
      s.created_at,
      s.payment_id
    FROM subscriptions s
    WHERE s.user_id = ${userId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapSubscriptionRow({
    id: row.id,
    userId: row.user_id,
    planCode: row.plan_code,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    paymentId: row.payment_id,
  });
}

export async function activateSubscriptionFromPayment(input: {
  userId: number;
  planCode: SubscriptionPlanCode;
  paymentId: string;
  billingPeriod?: "monthly" | "yearly";
}): Promise<SubscriptionRow> {
  return await getPrisma().$transaction(async (tx) => {
    const periodDays = input.billingPeriod === "yearly" ? 365 : 30;
    const currentPeriodEnd = new Date(
      Date.now() + periodDays * 24 * 60 * 60 * 1000,
    );

    const subscription = await tx.subscription.upsert({
      where: { userId: input.userId },
      update: {
        planCode: input.planCode,
        status: "active",
        currentPeriodEnd,
        paymentId: input.paymentId,
      },
      create: {
        userId: input.userId,
        planCode: input.planCode,
        status: "active",
        currentPeriodEnd,
        paymentId: input.paymentId,
      },
    });

    return mapSubscriptionRow({
      id: subscription.id,
      userId: subscription.userId,
      planCode: subscription.planCode,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      createdAt: subscription.createdAt,
      paymentId: subscription.paymentId,
    });
  });
}

export async function grantPremiumByAdmin(input: {
  userId: number;
  currentPeriodEnd: Date;
}): Promise<SubscriptionRow> {
  const subscription = await getPrisma().subscription.upsert({
    where: { userId: input.userId },
    update: {
      planCode: "premium",
      status: "active",
      currentPeriodEnd: input.currentPeriodEnd,
    },
    create: {
      userId: input.userId,
      planCode: "premium",
      status: "active",
      currentPeriodEnd: input.currentPeriodEnd,
    },
  });

  return mapSubscriptionRow({
    id: subscription.id,
    userId: subscription.userId,
    planCode: subscription.planCode,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    createdAt: subscription.createdAt,
    paymentId: subscription.paymentId,
  });
}

export async function cancelSubscriptionByUserId(
  userId: number,
): Promise<SubscriptionRow | null> {
  const subscription = await getPrisma().subscription.findUnique({
    where: { userId },
  });
  if (!subscription || subscription.planCode !== "premium") {
    return null;
  }
  if (subscription.status !== "active" && subscription.status !== "past_due") {
    return null;
  }
  const updated = await getPrisma().subscription.update({
    where: { userId },
    data: {
      status: "canceled",
    },
  });
  return mapSubscriptionRow({
    id: updated.id,
    userId: updated.userId,
    planCode: updated.planCode,
    status: updated.status,
    currentPeriodEnd: updated.currentPeriodEnd,
    createdAt: updated.createdAt,
    paymentId: updated.paymentId,
  });
}

export async function resumeSubscriptionByUserId(
  userId: number,
): Promise<SubscriptionRow | null> {
  const subscription = await getPrisma().subscription.findUnique({
    where: { userId },
  });
  if (!subscription) {
    return null;
  }
  const now = new Date();
  const existingPeriodEnd = subscription.currentPeriodEnd;
  const nextPeriodEnd =
    existingPeriodEnd && existingPeriodEnd > now
      ? existingPeriodEnd
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const updated = await getPrisma().subscription.update({
    where: { userId },
    data: {
      status: "active",
      currentPeriodEnd: nextPeriodEnd,
    },
  });
  return mapSubscriptionRow({
    id: updated.id,
    userId: updated.userId,
    planCode: updated.planCode,
    status: updated.status,
    currentPeriodEnd: updated.currentPeriodEnd,
    createdAt: updated.createdAt,
    paymentId: updated.paymentId,
  });
}
