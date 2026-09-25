import type { Request, Response } from "express";

import * as authService from "../services/auth.service.js";
import { trackAuthEvent } from "../services/analytics.service.js";
import { isProd } from "../config/appEnv.js";
import { resolveOptionalAccessUserId } from "../utils/optionalAuth.js";
import {
  getRequiredUserId,
  sendUnauthorized,
} from "./helpers.js";

const REFRESH_COOKIE_NAME = "languageTurtleRefreshToken";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function refreshCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: (process.env.COOKIE_SAMESITE === "none" ? "none" : "lax") as "lax" | "none",
    secure: process.env.COOKIE_SECURE === "true" || (process.env.COOKIE_SECURE !== "false" && isProd()),
    path: "/api/auth",
  };
}

function readRefreshCookie(cookieHeader: string | undefined): string {
  if (!cookieHeader) {
    return "";
  }
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    if (part.slice(0, eq).trim() !== REFRESH_COOKIE_NAME) {
      continue;
    }
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return "";
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...refreshCookieOptions(),
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

function extractRequestId(req: Request): string | undefined {
  const header = req.headers?.["x-request-id"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  if (Array.isArray(header) && header.length > 0 && typeof header[0] === "string") {
    const candidate = header[0].trim();
    return candidate || undefined;
  }
  return undefined;
}

function resolveBodyWithAppBaseUrl(req: Request) {
  const raw = req.body ?? {};
  const fromBody = typeof raw.appBaseUrl === "string" ? raw.appBaseUrl.trim() : "";
  if (fromBody) {
    return { ...raw, appBaseUrl: fromBody };
  }
  const fromQuery =
    typeof req.query?.appBaseUrl === "string" ? req.query.appBaseUrl.trim() : "";
  if (fromQuery) {
    return { ...raw, appBaseUrl: fromQuery };
  }
  const origin = typeof req.headers?.origin === "string" ? req.headers.origin.trim() : "";
  if (origin) {
    return { ...raw, appBaseUrl: origin };
  }
  return raw;
}

export async function createGuest(req: Request, res: Response) {
  const requestId = extractRequestId(req);
  const result = await authService.createGuestSession();
  setRefreshCookie(res, result.refreshToken);
  trackAuthEvent({
    event: "auth_signup_succeeded",
    authMethod: "guest",
    flow: "guest",
    result: "success",
    requestId,
    userId: result.auth.user.id,
  });
  return res.status(201).json(result.auth);
}

export async function signUpWithPassword(req: Request, res: Response) {
  const requestId = extractRequestId(req);
  const guestUserId = resolveOptionalAccessUserId(req);
  const result = await authService.signUpWithPassword(resolveBodyWithAppBaseUrl(req), {
    guestUserId,
  });
  if (!result.ok) {
    trackAuthEvent({
      event: "auth_failed",
      authMethod: "password",
      flow: "signup",
      result: "failed",
      reason: result.error,
      requestId,
    });
    return res.status(result.status).json({ error: result.error });
  }
  setRefreshCookie(res, result.refreshToken);
  trackAuthEvent({
    event: "auth_signup_succeeded",
    authMethod: "password",
    flow: "signup",
    result: "success",
    requestId,
    userId: result.auth.user.id,
  });
  return res.status(201).json(result.auth);
}

export async function logInWithPassword(req: Request, res: Response) {
  const requestId = extractRequestId(req);
  const guestUserId = resolveOptionalAccessUserId(req);
  const result = await authService.logInWithPassword(req.body ?? {}, { guestUserId });
  if (!result.ok) {
    trackAuthEvent({
      event: "auth_failed",
      authMethod: "password",
      flow: "login",
      result: "failed",
      reason: result.error,
      requestId,
    });
    return res.status(result.status).json({ error: result.error });
  }
  setRefreshCookie(res, result.refreshToken);
  trackAuthEvent({
    event: "auth_login_succeeded",
    authMethod: "password",
    flow: "login",
    result: "success",
    requestId,
    userId: result.auth.user.id,
  });
  return res.status(200).json(result.auth);
}

export async function logInWithGoogle(req: Request, res: Response) {
  const requestId = extractRequestId(req);
  const guestUserId = resolveOptionalAccessUserId(req);
  const result = await authService.logInWithGoogle(req.body ?? {}, { guestUserId });
  if (!result.ok) {
    trackAuthEvent({
      event: "auth_failed",
      authMethod: "google",
      flow: "login",
      result: "failed",
      reason: result.error,
      requestId,
    });
    return res.status(result.status).json({ error: result.error });
  }
  setRefreshCookie(res, result.refreshToken);
  const isNewUser =
    "isNewUser" in result.auth && result.auth.isNewUser === true;
  trackAuthEvent({
    event: isNewUser ? "auth_signup_succeeded" : "auth_login_succeeded",
    authMethod: "google",
    flow: isNewUser ? "signup" : "login",
    result: "success",
    requestId,
    userId: result.auth.user.id,
  });
  return res.status(200).json(result.auth);
}

export async function restoreDeletedAccount(req: Request, res: Response) {
  const requestId = extractRequestId(req);
  const body = req.body ?? {};
  const authMethod =
    typeof body.idToken === "string" && body.idToken.trim().length > 0 ? "google" : "password";
  const result = await authService.restoreDeletedAccount(body);
  if (!result.ok) {
    trackAuthEvent({
      event: "auth_failed",
      authMethod,
      flow: "restore",
      result: "failed",
      reason: result.error,
      requestId,
    });
    return res.status(result.status).json({ error: result.error });
  }
  setRefreshCookie(res, result.refreshToken);
  trackAuthEvent({
    event: "auth_login_succeeded",
    authMethod,
    flow: "restore",
    result: "success",
    requestId,
    userId: result.auth.user.id,
  });
  return res.status(200).json(result.auth);
}

export async function refresh(req: Request, res: Response) {
  const requestId = extractRequestId(req);
  const refreshToken = readRefreshCookie(req.headers.cookie);
  const result = await authService.refreshSession(refreshToken);
  if (!result.ok) {
    clearRefreshCookie(res);
    return res.status(result.status).json({ error: result.error });
  }
  setRefreshCookie(res, result.refreshToken);
  trackAuthEvent({
    event: "auth_refresh_succeeded",
    authMethod: "password",
    flow: "refresh",
    result: "success",
    requestId,
    userId: result.auth.user.id,
  });
  return res.status(200).json(result.auth);
}

export async function logout(_req: Request, res: Response) {
  clearRefreshCookie(res);
  return res.status(204).send();
}

export async function me(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await authService.getCurrentUser(userId);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.status(200).json(result.currentUser);
}

export async function forgotPassword(req: Request, res: Response) {
  const result = await authService.forgotPassword(resolveBodyWithAppBaseUrl(req));
  return res.status(200).json({
    ok: true,
    resetToken: result.resetToken,
  });
}

export async function verifyEmail(req: Request, res: Response) {
  const result = await authService.verifyEmailWithToken(req.body ?? {});
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.status(200).json({ ok: true });
}

export async function resendVerificationEmail(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await authService.resendVerificationEmail(
    userId,
    resolveBodyWithAppBaseUrl(req),
  );
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.status(200).json({ ok: true });
}

export async function resetPassword(req: Request, res: Response) {
  const result = await authService.resetPassword(req.body ?? {});
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.status(200).json({ ok: true });
}
