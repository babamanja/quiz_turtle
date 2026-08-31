import rateLimit from "express-rate-limit";

import { getAppEnv } from "../config/appEnv.js";

function skipRateLimitInLocal(): boolean {
  return getAppEnv() !== "prod";
}

const rateLimitMessage = { error: "too many requests" };

export const authSensitiveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
  skip: skipRateLimitInLocal,
});

export const authSessionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
  skip: skipRateLimitInLocal,
});

export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
  skip: skipRateLimitInLocal,
});

export const feedbackRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
  skip: skipRateLimitInLocal,
});
