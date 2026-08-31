import type { Context, Telegraf } from 'telegraf';
import type { PrismaClient } from '@prisma/client';
import {
  TELEGRAM_STARS_PREMIUM_MONTHLY,
  TELEGRAM_STARS_PREMIUM_YEARLY,
} from '@language-turtle/shared';
import { getUserIdByTelegram } from '../../domain/telegram-user';
import config from '../../config';

type StarsPayload = {
  userId: number;
  billingPeriod: 'monthly' | 'yearly';
};

async function handleStarsCheckout(
  ctx: Context,
  prisma: PrismaClient,
  billingPeriod: 'monthly' | 'yearly',
): Promise<void> {
  if (!ctx.from?.id) return;
  const userId = await getUserIdByTelegram(prisma, ctx.from.id);
  if (userId == null) {
    await ctx.answerCbQuery('Send /start first');
    return;
  }

  const amount =
    billingPeriod === 'yearly' ? TELEGRAM_STARS_PREMIUM_YEARLY : TELEGRAM_STARS_PREMIUM_MONTHLY;
  const payload: StarsPayload = { userId, billingPeriod };
  await ctx.answerCbQuery();
  await ctx.replyWithInvoice({
    title: 'Language Turtle Premium',
    description:
      billingPeriod === 'yearly' ? 'Premium access for 12 months' : 'Premium access for 1 month',
    payload: JSON.stringify(payload),
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: 'Premium', amount }],
  });
}

async function recordStarsPayment(
  userId: number,
  amount: number,
  providerTransactionId: string,
  billingPeriod: 'monthly' | 'yearly',
): Promise<void> {
  const response = await fetch(`${config.backendInternalUrl}/api/internal/telegram/stars-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': config.internalApiKey,
    },
    body: JSON.stringify({
      userId,
      amount,
      currency: 'XTR',
      providerTransactionId,
      billingPeriod,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`stars payment sync failed: ${response.status} ${text}`);
  }
}

export function registerSubscriptionCommands(bot: Telegraf, prisma: PrismaClient): void {
  bot.command('subscribe', async (ctx) => {
    if (!ctx.from?.id) return;
    const userId = await getUserIdByTelegram(prisma, ctx.from.id);
    if (userId == null) {
      return ctx.reply('Account not found. Send /start first.');
    }

    return ctx.reply('Choose a Premium plan:', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `Premium monthly (${TELEGRAM_STARS_PREMIUM_MONTHLY} ⭐)`,
              callback_data: 'stars_sub_monthly',
            },
          ],
          [
            {
              text: `Premium yearly (${TELEGRAM_STARS_PREMIUM_YEARLY} ⭐)`,
              callback_data: 'stars_sub_yearly',
            },
          ],
        ],
      },
    });
  });

  bot.action('stars_sub_monthly', async (ctx) => {
    await handleStarsCheckout(ctx, prisma, 'monthly');
  });

  bot.action('stars_sub_yearly', async (ctx) => {
    await handleStarsCheckout(ctx, prisma, 'yearly');
  });

  bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    if (!payment) return;

    let payload: StarsPayload;
    try {
      payload = JSON.parse(payment.invoice_payload) as StarsPayload;
    } catch {
      return ctx.reply('Payment received but payload is invalid. Contact support.');
    }

    try {
      await recordStarsPayment(
        payload.userId,
        payment.total_amount,
        payment.telegram_payment_charge_id,
        payload.billingPeriod,
      );
      await ctx.reply('Premium activated. Thank you!');
    } catch (error) {
      console.error('[bot] stars payment sync failed', error);
      await ctx.reply('Payment received. Premium activation is pending — we will retry shortly.');
    }
  });
}
