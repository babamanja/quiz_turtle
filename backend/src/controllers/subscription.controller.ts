import type { Request, Response } from "express";

import { getRouteParam } from "../utils/routeParams.js";
import { normalizeAppBaseUrl } from "../services/paymentMetadata.js";
import * as subscriptionService from "../services/subscription.service.js";
import {
  getRequiredUserId,
  sendServiceFailure,
  sendUnauthorized,
} from "./helpers.js";

function getAppBaseUrl(req: Request): string {
  const origin =
    typeof req.body?.appBaseUrl === "string" ? req.body.appBaseUrl.trim() : "";
  if (origin) {
    return normalizeAppBaseUrl(origin);
  }
  const queryOrigin =
    typeof req.query?.appBaseUrl === "string"
      ? req.query.appBaseUrl.trim()
      : "";
  if (queryOrigin) {
    return normalizeAppBaseUrl(queryOrigin);
  }
  const headerOrigin =
    typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  if (headerOrigin) {
    return normalizeAppBaseUrl(headerOrigin);
  }
  return normalizeAppBaseUrl("");
}

export async function getMySubscription(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await subscriptionService.getMySubscription(userId);
  return res.status(200).json(result.subscription);
}

export async function cancelMySubscription(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await subscriptionService.cancelMySubscription(userId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.subscription);
}

export async function resumeMySubscription(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await subscriptionService.resumeMySubscription(userId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.subscription);
}

export async function createMyCheckoutSession(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }

  const planCode = req.body?.planCode;
  if (planCode !== "basic" && planCode !== "premium") {
    return res.status(400).json({ error: "invalid planCode" });
  }
  const billingPeriod = req.body?.billingPeriod;
  if (
    billingPeriod !== undefined &&
    billingPeriod !== "monthly" &&
    billingPeriod !== "yearly"
  ) {
    return res.status(400).json({ error: "invalid billingPeriod" });
  }

  try {
    const result = await subscriptionService.createMyCheckoutSession(
      userId,
      planCode,
      getAppBaseUrl(req),
      req.body?.billingPeriod,
    );
    return res.status(200).json(result.checkoutSession);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to create checkout session";
    const statusCode =
      message.includes("invalid planCode") ||
      message.includes("invalid billingPeriod")
        ? 400
        : 502;
    return res.status(statusCode).json({ error: message });
  }
}

export async function resolveMyPaymentReturn(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }

  const paddleTransactionId =
    typeof req.query?.paddleTransactionId === "string"
      ? req.query.paddleTransactionId.trim()
      : "";
  if (!paddleTransactionId) {
    return res.status(400).json({ error: "paddleTransactionId is required" });
  }

  try {
    const result = await subscriptionService.resolveMyPaymentFromPaddleTransaction(
      userId,
      paddleTransactionId,
    );
    return res.status(200).json({ paymentId: result.paymentId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to resolve payment";
    const statusCode =
      message === "payment not found"
        ? 404
        : message.includes("invalid paddleTransactionId")
          ? 400
          : 400;
    return res.status(statusCode).json({ error: message });
  }
}

export async function getMyPaymentStatus(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }

  const paymentId =
    typeof req.params?.paymentId === "string"
      ? getRouteParam(req, "paymentId").trim()
      : "";
  if (!paymentId) {
    return res.status(400).json({ error: "paymentId is required" });
  }

  try {
    const result = await subscriptionService.getMyPaymentStatus(
      userId,
      paymentId,
      getAppBaseUrl(req),
    );
    return res.status(200).json(result.payment);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to get payment status";
    const statusCode = message === "payment not found" ? 404 : 400;
    return res.status(statusCode).json({ error: message });
  }
}

export async function syncMyPaymentFromPaddle(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }

  const paymentId =
    typeof req.params?.paymentId === "string"
      ? getRouteParam(req, "paymentId").trim()
      : "";
  if (!paymentId) {
    return res.status(400).json({ error: "paymentId is required" });
  }

  try {
    const result = await subscriptionService.syncMyPaymentFromPaddle(
      userId,
      paymentId,
      getAppBaseUrl(req),
    );
    return res.status(200).json(result.payment);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to sync payment";
    const statusCode =
      message === "payment not found"
        ? 404
        : message.includes("invalid paddle transaction id") ||
            message.includes("provider transaction id missing")
          ? 400
          : 502;
    return res.status(statusCode).json({ error: message });
  }
}

export async function abandonMyPayment(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }

  const paymentId =
    typeof req.params?.paymentId === "string"
      ? getRouteParam(req, "paymentId").trim()
      : "";
  if (!paymentId) {
    return res.status(400).json({ error: "paymentId is required" });
  }

  try {
    const result = await subscriptionService.abandonMyPendingPayment(
      userId,
      paymentId,
      getAppBaseUrl(req),
      req.body?.reason,
    );
    return res.status(200).json(result.payment);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to abandon payment";
    const statusCode = message === "payment not found" ? 404 : 400;
    return res.status(statusCode).json({ error: message });
  }
}

export async function listMyPayments(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await subscriptionService.listMyPayments(userId);
  return res.status(200).json(result.payments);
}

export async function handlePaddleWebhook(req: Request, res: Response) {
  const signatureHeader = req.headers["paddle-signature"];
  const signature =
    typeof signatureHeader === "string"
      ? signatureHeader
      : Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : "";

  if (!signature) {
    return res
      .status(400)
      .json({ error: "paddle-signature header is required" });
  }

  const rawBody = req.rawBody ?? req.body;
  if (
    !rawBody ||
    (typeof rawBody !== "string" && !Buffer.isBuffer(rawBody))
  ) {
    return res.status(400).json({ error: "raw webhook body is required" });
  }

  try {
    await subscriptionService.handlePaddleWebhook({
      rawBody,
      signatureHeader: signature,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to process webhook";
    const statusCode = message === "invalid webhook signature" ? 401 : 400;
    return res.status(statusCode).json({ error: message });
  }
}
