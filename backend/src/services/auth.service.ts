import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import * as authRepository from "../db/authRepository.js";
import * as userRepository from "../db/userRepository.js";
import {
  getAuthPublicAppUrl,
  isPostmarkConfigured,
  resolveAuthEmailAppBase,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from "./postmarkEmail.service.js";
import * as subscriptionRepository from "../db/subscriptionRepository.js";
import * as dictionaryRepository from "../db/dictionaryRepository.js";
import {
  convertGuestWithGoogle,
  convertGuestWithPassword,
  createGuestUser,
  mergeGuestIntoUser,
} from "./guest.service.js";
import { getJwtSecret } from "../utils/optionalAuth.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "30d";
const PASSWORD_RESET_EXPIRES_IN = "30m";
const EMAIL_VERIFY_EXPIRES_IN = "7d";

type AuthUser = {
  id: number;
  userName: string;
  email: string | null;
  role: "user" | "admin";
  passwordHash: string | null;
  googleSub: string | null;
  emailVerifiedAt: Date | null;
  isGuest: boolean;
};

function userAuthRowToAuthUser(
  row: import("../db/authRepository.js").UserAuthRow,
): AuthUser {
  return {
    id: row.id,
    userName: row.userName,
    email: row.email,
    role: row.role,
    passwordHash: row.passwordHash,
    googleSub: row.googleSub,
    emailVerifiedAt: row.emailVerifiedAt,
    isGuest: row.isGuest,
  };
}

function getRefreshJwtSecret(): string {
  const secret = process.env.AUTH_REFRESH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_REFRESH_SECRET is required");
  }
  return secret;
}

function getPasswordResetSecret(): string {
  const explicitSecret = process.env.AUTH_PASSWORD_RESET_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }
  return getJwtSecret();
}

function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is required");
  }
  return clientId;
}

function signRefreshToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, type: "refresh" }, getRefreshJwtSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

function createAuthResponse(user: AuthUser, options?: { isNewUser?: boolean }) {
  const token = jwt.sign(
    { sub: user.id, email: user.email, type: "access" },
    getJwtSecret(),
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    },
  );
  const base = {
    token,
    user: {
      id: user.id,
      userName: user.userName,
      email: user.email,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
      isGuest: user.isGuest,
    },
    providers: {
      password: Boolean(user.passwordHash),
      google: Boolean(user.googleSub),
    },
  };
  if (typeof options?.isNewUser === "boolean") {
    return { ...base, isNewUser: options.isNewUser };
  }
  return base;
}

function createAuthResult(user: AuthUser, options?: { isNewUser?: boolean }) {
  return {
    auth: createAuthResponse(user, options),
    refreshToken: signRefreshToken(user),
  };
}

export async function createGuestSession() {
  const row = await createGuestUser();
  return { ok: true as const, ...createAuthResult(userAuthRowToAuthUser(row), { isNewUser: true }) };
}

export async function signUpWithPassword(
  body: {
    userName?: string;
    email?: string;
    password?: string;
    appBaseUrl?: string;
  },
  options?: { guestUserId?: number | null },
) {
  const userName = body.userName?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!userName || !email || !password) {
    return {
      ok: false as const,
      status: 400,
      error: "userName, email, password required",
    };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false as const, status: 400, error: "invalid email" };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false as const,
      status: 400,
      error: `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }

  const existing = await authRepository.selectAuthByEmail(email);
  const guestUserId =
    Number.isInteger(options?.guestUserId) && (options?.guestUserId ?? 0) > 0
      ? Number(options?.guestUserId)
      : null;

  if (guestUserId) {
    const passwordHash = await bcrypt.hash(password, 12);
    const converted = await convertGuestWithPassword({
      guestUserId,
      userName,
      email,
      passwordHash,
    });
    if (converted.ok === false) {
      return {
        ok: false as const,
        status: converted.status,
        error: converted.error,
      };
    }
    const row = converted.row;
    const appBase = resolveAuthEmailAppBase(body.appBaseUrl?.trim());
    if (isPostmarkConfigured() && appBase) {
      const verifyToken = jwt.sign(
        { sub: row.id, type: "email_verify" },
        getJwtSecret(),
        { expiresIn: EMAIL_VERIFY_EXPIRES_IN },
      );
      const verifyUrl = `${appBase}/login?verifyToken=${encodeURIComponent(verifyToken)}`;
      try {
        await sendEmailVerificationEmail({
          to: email,
          verifyUrl,
          userName: row.userName,
        });
      } catch (error) {
        console.error("[auth] Failed to send verification email", { email, error });
      }
    }
    return { ok: true as const, ...createAuthResult(row, { isNewUser: true }) };
  }

  if (existing) {
    return {
      ok: false as const,
      status: 409,
      error: "email already registered",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const row = await authRepository.upsertPasswordAuth({
    userName,
    email,
    passwordHash,
  });

  const appBase = resolveAuthEmailAppBase(body.appBaseUrl?.trim());
  if (isPostmarkConfigured() && appBase) {
    const verifyToken = jwt.sign(
      { sub: row.id, type: "email_verify" },
      getJwtSecret(),
      { expiresIn: EMAIL_VERIFY_EXPIRES_IN },
    );
    const verifyUrl = `${appBase}/login?verifyToken=${encodeURIComponent(verifyToken)}`;
    try {
      await sendEmailVerificationEmail({
        to: email,
        verifyUrl,
        userName: row.userName,
      });
    } catch (error) {
      console.error("[auth] Failed to send verification email", { email, error });
    }
  } else if (process.env.NODE_ENV !== "production") {
    const verifyToken = jwt.sign(
      { sub: row.id, type: "email_verify" },
      getJwtSecret(),
      { expiresIn: EMAIL_VERIFY_EXPIRES_IN },
    );
    console.info("[auth] Email verification token (dev)", {
      email,
      verifyToken,
      hint: "Use POST /api/auth/email/verify with { token } or open /login?verifyToken=…",
    });
  }

  await subscriptionRepository.ensureDefaultBasicSubscription(row.id);
  await dictionaryRepository.ensureDefaultDictionaryForUser(row.id);

  return { ok: true as const, ...createAuthResult(row, { isNewUser: true }) };
}

export async function logInWithPassword(
  body: {
    email?: string;
    password?: string;
  },
  options?: { guestUserId?: number | null },
) {
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return {
      ok: false as const,
      status: 400,
      error: "email, password required",
    };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false as const, status: 400, error: "invalid email" };
  }

  const row = await authRepository.selectAuthByEmail(email);
  if (!row?.passwordHash) {
    return { ok: false as const, status: 401, error: "invalid credentials" };
  }
  if (row.deletedAt) {
    const isValidForDeleted = await bcrypt.compare(password, row.passwordHash);
    if (!isValidForDeleted) {
      return { ok: false as const, status: 401, error: "invalid credentials" };
    }
    return { ok: false as const, status: 403, error: "account deleted" };
  }
  const isValid = await bcrypt.compare(password, row.passwordHash);
  if (!isValid) {
    return { ok: false as const, status: 401, error: "invalid credentials" };
  }
  const guestUserId =
    Number.isInteger(options?.guestUserId) && (options?.guestUserId ?? 0) > 0
      ? Number(options?.guestUserId)
      : null;
  if (guestUserId && guestUserId !== row.id) {
    await mergeGuestIntoUser(guestUserId, row.id);
  }
  return { ok: true as const, ...createAuthResult(row) };
}

function deriveUserName(
  payloadName: string | undefined,
  email: string,
): string {
  const candidate = payloadName?.trim();
  if (candidate) {
    return candidate;
  }
  return email.split("@")[0] || "google-user";
}

export async function logInWithGoogle(
  body: { idToken?: string },
  options?: { guestUserId?: number | null },
) {
  const idToken = body.idToken?.trim() ?? "";
  if (!idToken) {
    return { ok: false as const, status: 400, error: "idToken required" };
  }

  const oauthClient = new OAuth2Client(getGoogleClientId());
  let ticket;
  try {
    ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: getGoogleClientId(),
    });
  } catch {
    return {
      ok: false as const,
      status: 401,
      error: "google token is invalid",
    };
  }
  const payload = ticket.getPayload();
  const googleSub = payload?.sub?.trim() ?? "";
  const email = payload?.email?.trim().toLowerCase() ?? "";
  if (!googleSub || !email) {
    return {
      ok: false as const,
      status: 401,
      error: "google token is invalid",
    };
  }

  const guestUserId =
    Number.isInteger(options?.guestUserId) && (options?.guestUserId ?? 0) > 0
      ? Number(options?.guestUserId)
      : null;

  const existingBySub = await authRepository.selectAuthByGoogleSub(googleSub);
  if (existingBySub) {
    if (existingBySub.deletedAt) {
      return { ok: false as const, status: 403, error: "account deleted" };
    }
    if (guestUserId && guestUserId !== existingBySub.id) {
      await mergeGuestIntoUser(guestUserId, existingBySub.id);
    }
    return { ok: true as const, ...createAuthResult(existingBySub, { isNewUser: false }) };
  }

  if (guestUserId) {
    const converted = await convertGuestWithGoogle({
      guestUserId,
      googleSub,
      email,
      userName: deriveUserName(payload?.name, email),
    });
    if (converted.ok === false) {
      return {
        ok: false as const,
        status: converted.status,
        error: converted.error,
      };
    }
    return {
      ok: true as const,
      ...createAuthResult(converted.row, { isNewUser: true }),
    };
  }

  const { row, isNewUser } = await authRepository.upsertGoogleAuth({
    googleSub,
    email,
    userName: deriveUserName(payload?.name, email),
  });
  if (isNewUser) {
    await subscriptionRepository.ensureDefaultBasicSubscription(row.id);
    await dictionaryRepository.ensureDefaultDictionaryForUser(row.id);
  }
  return { ok: true as const, ...createAuthResult(row, { isNewUser }) };
}

export async function restoreDeletedAccount(body: {
  email?: string;
  password?: string;
  idToken?: string;
}) {
  const idToken = body.idToken?.trim() ?? "";
  if (idToken) {
    const oauthClient = new OAuth2Client(getGoogleClientId());
    let ticket;
    try {
      ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: getGoogleClientId(),
      });
    } catch {
      return {
        ok: false as const,
        status: 401,
        error: "google token is invalid",
      };
    }
    const payload = ticket.getPayload();
    const googleSub = payload?.sub?.trim() ?? "";
    if (!googleSub) {
      return {
        ok: false as const,
        status: 401,
        error: "google token is invalid",
      };
    }
    const row = await authRepository.selectAuthByGoogleSub(googleSub);
    if (!row?.deletedAt) {
      return {
        ok: false as const,
        status: 400,
        error: "account is not deleted",
      };
    }
    const restored = await userRepository.restoreSoftDeletedUser(row.id);
    if (!restored) {
      return {
        ok: false as const,
        status: 400,
        error: "account cannot be restored",
      };
    }
    const authRow = await authRepository.selectAuthByUserId(row.id);
    if (!authRow || authRow.deletedAt) {
      return {
        ok: false as const,
        status: 500,
        error: "restore failed",
      };
    }
    return { ok: true as const, ...createAuthResult(authRow) };
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return {
      ok: false as const,
      status: 400,
      error: "email, password required",
    };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false as const, status: 400, error: "invalid email" };
  }
  const row = await authRepository.selectAuthByEmail(email);
  if (!row?.passwordHash) {
    return { ok: false as const, status: 401, error: "invalid credentials" };
  }
  const isValid = await bcrypt.compare(password, row.passwordHash);
  if (!isValid) {
    return { ok: false as const, status: 401, error: "invalid credentials" };
  }
  if (!row.deletedAt) {
    return {
      ok: false as const,
      status: 400,
      error: "account is not deleted",
    };
  }
  const restored = await userRepository.restoreSoftDeletedUser(row.id);
  if (!restored) {
    return {
      ok: false as const,
      status: 400,
      error: "account cannot be restored",
    };
  }
  const authRow = await authRepository.selectAuthByUserId(row.id);
  if (!authRow || authRow.deletedAt) {
    return {
      ok: false as const,
      status: 500,
      error: "restore failed",
    };
  }
  return { ok: true as const, ...createAuthResult(authRow) };
}

export async function refreshSession(refreshToken: string) {
  if (!refreshToken) {
    return { ok: false as const, status: 401, error: "refresh token required" };
  }
  try {
    const payload = jwt.verify(refreshToken, getRefreshJwtSecret()) as {
      sub?: number | string;
      type?: string;
    };
    if (payload.type !== "refresh") {
      return {
        ok: false as const,
        status: 401,
        error: "invalid refresh token",
      };
    }
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      return {
        ok: false as const,
        status: 401,
        error: "invalid refresh token",
      };
    }
    const authRow = await authRepository.selectAuthByUserId(userId);
    if (!authRow || authRow.deletedAt) {
      return {
        ok: false as const,
        status: 401,
        error: "invalid refresh token",
      };
    }
    return { ok: true as const, ...createAuthResult(userAuthRowToAuthUser(authRow)) };
  } catch {
    return { ok: false as const, status: 401, error: "invalid refresh token" };
  }
}

export async function getCurrentUser(userId: number) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  const authRow = await authRepository.selectAuthByUserId(userId);
  if (!authRow || authRow.deletedAt) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  return { ok: true as const, currentUser: createAuthResponse(userAuthRowToAuthUser(authRow)) };
}

export async function forgotPassword(body: { email?: string; appBaseUrl?: string }) {
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email || !EMAIL_REGEX.test(email)) {
    return { ok: true as const, resetToken: undefined as string | undefined };
  }
  const row = await authRepository.selectAuthByEmail(email);
  if (!row || row.deletedAt) {
    return { ok: true as const, resetToken: undefined as string | undefined };
  }
  if (!row.passwordHash) {
    return { ok: true as const, resetToken: undefined as string | undefined };
  }

  const resetToken = jwt.sign(
    { sub: row.id, type: "password_reset" },
    getPasswordResetSecret(),
    { expiresIn: PASSWORD_RESET_EXPIRES_IN },
  );

  if (isPostmarkConfigured()) {
    const appBase = resolveAuthEmailAppBase(body.appBaseUrl?.trim());
    if (!appBase) {
      console.error(
        "[auth] Postmark is configured but no app base URL (set AUTH_PUBLIC_APP_URL or pass appBaseUrl from the client); cannot send reset email",
      );
      return { ok: true as const, resetToken: undefined as string | undefined };
    }
    const resetUrl = `${appBase}/login?resetToken=${encodeURIComponent(resetToken)}`;
    try {
      await sendPasswordResetEmail({
        to: email,
        resetUrl,
        userName: row.userName,
      });
    } catch (error) {
      console.error("[auth] Failed to send password reset email", { email, error });
    }
    return { ok: true as const, resetToken: undefined as string | undefined };
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth] Password reset token generated", {
      email,
      resetToken,
    });
    return { ok: true as const, resetToken };
  }
  return { ok: true as const, resetToken: undefined as string | undefined };
}

export async function resetPassword(body: {
  token?: string;
  newPassword?: string;
}) {
  const token = body.token?.trim() ?? "";
  const newPassword = body.newPassword ?? "";
  if (!token || !newPassword) {
    return {
      ok: false as const,
      status: 400,
      error: "token and newPassword required",
    };
  }
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false as const,
      status: 400,
      error: `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }
  let payload: { sub?: number | string; type?: string };
  try {
    payload = jwt.verify(token, getPasswordResetSecret()) as {
      sub?: number | string;
      type?: string;
    };
  } catch {
    return { ok: false as const, status: 401, error: "invalid or expired reset token" };
  }
  if (payload.type !== "password_reset") {
    return { ok: false as const, status: 401, error: "invalid or expired reset token" };
  }
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "invalid or expired reset token" };
  }
  const user = await userRepository.selectUserById(userId);
  if (!user) {
    return { ok: false as const, status: 401, error: "invalid or expired reset token" };
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await authRepository.upsertPasswordHashByUserId(userId, passwordHash);
  return { ok: true as const };
}

export async function verifyEmailWithToken(body: { token?: string }) {
  const token = body.token?.trim() ?? "";
  if (!token) {
    console.error("[auth] !token", { body });
    return { ok: false as const, status: 400, error: "token required" };
  }
  let payload: { sub?: number | string; type?: string };
  try {
    payload = jwt.verify(token, getJwtSecret()) as {
      sub?: number | string;
      type?: string;
    };
  } catch {
    return {
      ok: false as const,
      status: 401,
      error: "invalid or expired verification token",
    };
  }
  if (payload.type !== "email_verify") {
    return {
      ok: false as const,
      status: 401,
      error: "invalid or expired verification token",
    };
  }
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId < 1) {
    return {
      ok: false as const,
      status: 401,
      error: "invalid or expired verification token",
    };
  }
  const updated = await authRepository.markUserEmailVerified(userId);
  if (!updated) {
    return {
      ok: false as const,
      status: 401,
      error: "invalid or expired verification token",
    };
  }
  return { ok: true as const };
}

export async function resendVerificationEmail(
  userId: number,
  body: { appBaseUrl?: string },
) {
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  const row = await authRepository.selectAuthByUserId(userId);
  if (!row || row.deletedAt) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }
  if (row.emailVerifiedAt) {
    return { ok: false as const, status: 400, error: "email already verified" };
  }
  const appBase = resolveAuthEmailAppBase(body.appBaseUrl?.trim());
  if (!appBase) {
    return {
      ok: false as const,
      status: 503,
      error: "email link base URL not configured",
    };
  }
  const verifyToken = jwt.sign(
    { sub: row.id, type: "email_verify" },
    getJwtSecret(),
    { expiresIn: EMAIL_VERIFY_EXPIRES_IN },
  );
  const verifyUrl = `${appBase}/login?verifyToken=${encodeURIComponent(verifyToken)}`;
  if (isPostmarkConfigured() && row.email) {
    try {
      await sendEmailVerificationEmail({
        to: row.email,
        verifyUrl,
        userName: row.userName,
      });
    } catch (error) {
      console.error("[auth] Failed to resend verification email", {
        email: row.email,
        error,
      });
      return {
        ok: false as const,
        status: 502,
        error: "failed to send verification email",
      };
    }
    return { ok: true as const };
  }
  if (process.env.NODE_ENV !== "production") {
    console.info("[auth] Email verification token resent (dev)", {
      email: row.email,
      verifyToken,
    });
    return { ok: true as const };
  }
  return { ok: false as const, status: 503, error: "email delivery unavailable" };
}
