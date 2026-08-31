import type { Context } from 'telegraf';
import type { PrismaClient } from '@prisma/client';
import { evaluateVocabAnswer } from '@language-turtle/shared';
import {
  applyReviewResult,
  getRandomDueWordsForUser,
  type DueVocabPair,
  UserLanguagesNotSetError,
} from '../../domain/vocab';
import {
  advanceAfterCardAnswer,
  clearPendingCloseReview,
  clearReviewSession,
  getCurrentReviewCard,
  getReviewSession,
  isPendingCloseReview,
  putReviewSession,
  REVIEW_BATCH_SIZE,
  setPendingCloseReview,
  validateCurrentCard,
} from './review-session-state';
import { clearAddWordFlow } from './add-word-flow-state';
import { escapeHtmlText, type ActionContext } from '../telegraf-helpers';
import { getMessageText } from '../telegraf-helpers';
import { requireUserLanguagesSetOrReply } from '../user/telegram-ui';
import { botT } from '../../i18n';

async function sendReviewCard(ctx: Context, word: DueVocabPair, nonce: string): Promise<void> {
  const prompt = escapeHtmlText(word.promptWord);
  const body = `${prompt}\n\n${botT(ctx, 'review_type_translation')}`;

  await ctx.reply(body, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: botT(ctx, 'btn_dont_remember'), callback_data: `dont_${word.pairId}_${nonce}` }],
      ],
    },
  });
}

async function sendCloseReviewPrompt(
  ctx: Context,
  word: DueVocabPair,
  nonce: string,
  userAnswer: string,
): Promise<void> {
  await ctx.reply(
    botT(ctx, 'review_result_close', {
      learningWord: word.learningWord,
      primaryWord: word.primaryWord,
      userAnswer,
    }),
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: botT(ctx, 'btn_review_confirm_knew'),
              callback_data: `rknow_${word.pairId}_${nonce}`,
            },
            {
              text: botT(ctx, 'btn_review_confirm_wrong'),
              callback_data: `rdont_${word.pairId}_${nonce}`,
            },
          ],
        ],
      },
    },
  );
}

async function finishCurrentCard(
  ctx: Context,
  pool: PrismaClient,
  uid: number,
  card: DueVocabPair,
  result: 'know' | 'dont',
  feedbackKey: 'review_result_correct' | 'review_result_wrong' | 'review_result_forgot',
  feedbackVars: Record<string, string>,
): Promise<void> {
  const sessionBefore = getReviewSession(uid);
  const batchSize = sessionBefore?.queue.length ?? 0;

  try {
    const { learningWord, primaryWord } = await applyReviewResult(
      pool,
      uid,
      card.pairId,
      result,
      Date.now(),
      card.direction,
    );
    clearPendingCloseReview(uid);
    await ctx.reply(
      botT(ctx, feedbackKey, {
        learningWord,
        primaryWord,
        ...feedbackVars,
      }),
    );

    const next = advanceAfterCardAnswer(uid);
    if (next) {
      await sendReviewCard(ctx, next.word, next.nonce);
    } else {
      await ctx.reply(botT(ctx, 'review_session_complete', { count: String(batchSize) }), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: botT(ctx, 'btn_review_give_more'), callback_data: 'review_more' },
              { text: botT(ctx, 'btn_review_cancel'), callback_data: 'review_cancel' },
            ],
          ],
        },
      });
    }
  } catch {
    if ('answerCbQuery' in ctx && typeof ctx.answerCbQuery === 'function') {
      await ctx.answerCbQuery(botT(ctx, 'callback_word_not_found'));
    } else {
      await ctx.reply(botT(ctx, 'callback_word_not_found'));
    }
  }
}

export async function runVocabReview(ctx: Context, pool: PrismaClient): Promise<void> {
  if (!ctx.from?.id) return;
  clearAddWordFlow(ctx.from.id);

  if (!(await requireUserLanguagesSetOrReply(ctx, pool))) return;

  let words: DueVocabPair[];
  try {
    words = await getRandomDueWordsForUser(pool, ctx.from.id, Date.now(), REVIEW_BATCH_SIZE);
  } catch (e) {
    if (e instanceof UserLanguagesNotSetError) {
      await ctx.reply(botT(ctx, 'missing_langs'));
      return;
    }
    throw e;
  }

  if (words.length === 0) {
    await ctx.reply(botT(ctx, 'review_no_words'));
    return;
  }

  const nonce = putReviewSession(ctx.from.id, words);
  if (!nonce) return;

  await sendReviewCard(ctx, words[0], nonce);
}

export async function handleReviewFlowText(ctx: Context, pool: PrismaClient): Promise<boolean> {
  const uid = ctx.from?.id;
  const raw = getMessageText(ctx);
  if (!uid || raw === undefined) return false;
  if (raw.startsWith('/')) return false;

  const current = getCurrentReviewCard(uid);
  if (!current) return false;

  if (isPendingCloseReview(uid)) {
    await ctx.reply(botT(ctx, 'review_close_use_buttons'));
    return true;
  }

  const answer = raw.trim();
  if (!answer) {
    await ctx.reply(botT(ctx, 'review_type_translation'));
    return true;
  }

  const expectedWord =
    current.word.direction === 'learning_to_primary'
      ? current.word.primaryWord
      : current.word.learningWord;
  const match = evaluateVocabAnswer(answer, expectedWord, current.word.alternateAnswers);

  if (match === 'close') {
    if (!setPendingCloseReview(uid, answer)) {
      return true;
    }
    const pending = getCurrentReviewCard(uid);
    if (!pending) return true;
    await sendCloseReviewPrompt(ctx, pending.word, pending.nonce, answer);
    return true;
  }

  await finishCurrentCard(
    ctx,
    pool,
    uid,
    current.word,
    match === 'exact' ? 'know' : 'dont',
    match === 'exact' ? 'review_result_correct' : 'review_result_wrong',
    { userAnswer: answer },
  );
  return true;
}

async function handleReviewGrade(
  ctx: ActionContext,
  pool: PrismaClient,
  result: 'know' | 'dont',
  feedbackKey: 'review_result_correct' | 'review_result_wrong' | 'review_result_forgot',
  feedbackVars: Record<string, string>,
): Promise<void> {
  const uid = ctx.from?.id;
  if (!uid) return;

  const pairId = Number(ctx.match?.[1]);
  const nonce = ctx.match?.[2];
  if (!Number.isFinite(pairId) || !nonce) {
    await ctx.answerCbQuery(botT(ctx, 'callback_invalid_id'));
    return;
  }

  if (!validateCurrentCard(uid, pairId, nonce)) {
    await ctx.answerCbQuery(botT(ctx, 'callback_invalid_id'));
    return;
  }

  const card = getCurrentReviewCard(uid)?.word;
  if (!card) {
    await ctx.answerCbQuery(botT(ctx, 'callback_invalid_id'));
    return;
  }

  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(undefined);
  await finishCurrentCard(ctx, pool, uid, card, result, feedbackKey, feedbackVars);
}

export async function handleReviewDontCallback(ctx: ActionContext, pool: PrismaClient): Promise<void> {
  await handleReviewGrade(ctx, pool, 'dont', 'review_result_forgot', {});
}

export async function handleReviewCloseKnowCallback(
  ctx: ActionContext,
  pool: PrismaClient,
): Promise<void> {
  const uid = ctx.from?.id;
  if (!uid || !isPendingCloseReview(uid)) {
    await ctx.answerCbQuery(botT(ctx, 'callback_invalid_id'));
    return;
  }
  const pendingAnswer = getReviewSession(uid)?.pendingClose?.userAnswer ?? '';
  await handleReviewGrade(ctx, pool, 'know', 'review_result_correct', { userAnswer: pendingAnswer });
}

export async function handleReviewCloseDontCallback(
  ctx: ActionContext,
  pool: PrismaClient,
): Promise<void> {
  const uid = ctx.from?.id;
  if (!uid || !isPendingCloseReview(uid)) {
    await ctx.answerCbQuery(botT(ctx, 'callback_invalid_id'));
    return;
  }
  const pendingAnswer = getReviewSession(uid)?.pendingClose?.userAnswer ?? '';
  await handleReviewGrade(ctx, pool, 'dont', 'review_result_wrong', { userAnswer: pendingAnswer });
}

export async function handleReviewMoreCallback(ctx: ActionContext, pool: PrismaClient): Promise<void> {
  await ctx.answerCbQuery();
  await runVocabReview(ctx, pool);
}

export async function handleReviewCancelCallback(ctx: ActionContext): Promise<void> {
  if (ctx.from?.id) clearReviewSession(ctx.from.id);
  await ctx.answerCbQuery();
  await ctx.reply(botT(ctx, 'review_cancelled'));
}
