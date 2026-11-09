import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { createRequestId, trackAnalyticsEvent } from "../../analytics";
import {
  forgotPassword,
  logInWithGoogle,
  logInWithPassword,
  resetPassword,
  signUpWithPassword,
  verifyEmailWithToken,
} from "../../api/auth";
import { refreshSession } from "../../api/refreshSessionApi";
import type { AccountDeletedLocationState } from "../../authNavigationTypes";
import { homePathForUser } from "../../paths";
import type { AuthSession } from "../../types";
import { getStoredAuthToken, setStoredSession } from "../../userStorage";
import Button from "../UI/Button/Button";
import TextInput from "../UI/TextInput";

import "../../pages/style.scss";

export type AuthMode = "signup" | "login";
type AuthView = "auth" | "forgot";

function normalizeAuthErrorReason(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown_error";
  }
  const normalized = error.message.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized.length > 0 ? normalized : "unknown_error";
}

function isAccountDeletedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.trim().toLowerCase() === "account deleted";
}

function upsertGoogleScript(onLoad: () => void) {
  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[src="https://accounts.google.com/gsi/client"]',
  );
  if (existingScript) {
    if (window.google?.accounts?.id) {
      onLoad();
      return;
    }
    existingScript.addEventListener("load", onLoad, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.addEventListener("load", onLoad, { once: true });
  document.head.appendChild(script);
}

export type AuthPanelProps = {
  variant: "page" | "modal";
  /** Sync login vs signup from URL (/login, /signup). */
  syncModeFromLocation?: boolean;
  /** When not using URL sync (e.g. modal), controls initial tab. */
  initialMode?: AuthMode;
  titleHeading?: "h1" | "h2";
  onAuthSuccess?: (session: AuthSession) => void | Promise<void>;
  redirectOnSuccess?: boolean;
};

export default function AuthPanel({
  variant,
  syncModeFromLocation = false,
  initialMode = "login",
  titleHeading = "h1",
  onAuthSuccess,
  redirectOnSuccess = true,
}: AuthPanelProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [view, setView] = useState<AuthView>("auth");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isResetMode, setIsResetMode] = useState(false);
  /** Token came from email link (?resetToken=) — hide manual token field. */
  const [resetTokenFromUrl, setResetTokenFromUrl] = useState(false);
  /** After stripping ?resetToken= from URL, skip one mode sync so we keep the reset form. */
  const skipOneUrlModeSyncRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

  async function finishAuthSuccess(authSession: AuthSession) {
    if (onAuthSuccess) {
      await onAuthSuccess(authSession);
      return;
    }
    if (redirectOnSuccess) {
      navigate(homePathForUser(authSession.user), { replace: true });
    }
  }

  useEffect(() => {
    if (!syncModeFromLocation) {
      return;
    }
    const params = new URLSearchParams(location.search);
    const token = params.get("resetToken")?.trim();
    if (token) {
      setResetToken(token);
      setView("forgot");
      setIsResetMode(true);
      setMode("login");
      setResetTokenFromUrl(true);
      skipOneUrlModeSyncRef.current = true;
      params.delete("resetToken");
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
      return;
    }
    const verifyTok = params.get("verifyToken")?.trim();
    if (verifyTok) {
      params.delete("verifyToken");
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
      skipOneUrlModeSyncRef.current = true;
      void (async () => {
        setIsLoading(true);
        setMessage(null);
        try {
          await verifyEmailWithToken({ token: verifyTok });
          const access = getStoredAuthToken();
          if (access) {
            const session = await refreshSession();
            setStoredSession({ token: session.token, user: session.user });
          }
          setMessage(t("auth.emailVerifiedSuccess"));
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : t("auth.emailVerifiedFailed"),
          );
        } finally {
          setIsLoading(false);
        }
      })();
      return;
    }
    if (skipOneUrlModeSyncRef.current) {
      skipOneUrlModeSyncRef.current = false;
      return;
    }
    const modeFromPath =
      location.pathname === "/signup" ? "signup" : location.pathname === "/login" ? "login" : null;
    const modeFromQuery = params.get("mode");
    const resolvedMode: AuthMode =
      modeFromPath ?? (modeFromQuery === "signup" ? "signup" : "login");
    setMode(resolvedMode);
    setView("auth");
  }, [location.pathname, location.search, navigate, syncModeFromLocation]);

  useEffect(() => {
    if (syncModeFromLocation) {
      return;
    }
    setMode(initialMode);
    setView("auth");
  }, [initialMode, syncModeFromLocation]);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) {
      return;
    }
    upsertGoogleScript(() => {
      if (!googleButtonRef.current || !window.google?.accounts?.id) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) {
            trackAnalyticsEvent("auth_failed", {
              auth_method: "google",
              flow: "login",
              result: "failed",
              reason: "google_missing_credential",
            });
            return;
          }
          const requestId = createRequestId();
          setIsLoading(true);
          setMessage(null);
          trackAnalyticsEvent("auth_login_started", {
            auth_method: "google",
            flow: "login",
            result: "started",
            request_id: requestId,
          });
          try {
            const authSession = await logInWithGoogle(response.credential);
            setStoredSession({ token: authSession.token, user: authSession.user });
            if (authSession.isNewUser) {
              trackAnalyticsEvent("auth_signup_succeeded", {
                auth_method: "google",
                flow: "signup",
                result: "success",
                request_id: requestId,
              });
            } else {
              trackAnalyticsEvent("auth_login_succeeded", {
                auth_method: "google",
                flow: "login",
                result: "success",
                request_id: requestId,
              });
            }
            await finishAuthSuccess(authSession);
          } catch (error) {
            trackAnalyticsEvent("auth_failed", {
              auth_method: "google",
              flow: "login",
              result: "failed",
              reason: normalizeAuthErrorReason(error),
              request_id: requestId,
            });
            if (isAccountDeletedError(error)) {
              navigate("/account-deleted", {
                state: { source: "google" } satisfies AccountDeletedLocationState,
              });
            } else {
              setMessage(error instanceof Error ? error.message : t("auth.loginErrorGeneric"));
            }
          } finally {
            setIsLoading(false);
          }
        },
      });
      googleButtonRef.current.innerHTML = "";
      const googleHost = googleButtonRef.current;
      window.google.accounts.id.renderButton(googleHost, {
        theme: "outline",
        size: "large",
        width: Math.floor(googleHost.clientWidth),
      });
    });
  }, [googleClientId, navigate, t]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const flow = mode === "signup" ? "signup" : "login";
    const startedEvent = mode === "signup" ? "auth_signup_started" : "auth_login_started";
    const successEvent = mode === "signup" ? "auth_signup_succeeded" : "auth_login_succeeded";
    const requestId = createRequestId();
    setIsLoading(true);
    setMessage(null);
    trackAnalyticsEvent(startedEvent, {
      auth_method: "password",
      flow,
      result: "started",
      request_id: requestId,
    });
    try {
      const authSession =
        mode === "signup"
          ? await signUpWithPassword({ userName, email, password })
          : await logInWithPassword({ email, password });
      setStoredSession({ token: authSession.token, user: authSession.user });
      trackAnalyticsEvent(successEvent, {
        auth_method: "password",
        flow,
        result: "success",
        request_id: requestId,
      });
      await finishAuthSuccess(authSession);
    } catch (error) {
      trackAnalyticsEvent("auth_failed", {
        auth_method: "password",
        flow,
        result: "failed",
        reason: normalizeAuthErrorReason(error),
        request_id: requestId,
      });
      if (mode === "login" && isAccountDeletedError(error)) {
        navigate("/account-deleted", {
          state: { prefilledEmail: email.trim(), source: "password" } satisfies AccountDeletedLocationState,
        });
      } else {
        setMessage(error instanceof Error ? error.message : t("auth.loginErrorGeneric"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await forgotPassword(email);
      if (response.resetToken) {
        setResetToken(response.resetToken);
        setIsResetMode(true);
        setResetTokenFromUrl(false);
        setMessage(t("auth.passwordResetTokenReady"));
      } else {
        setMessage(t("auth.passwordResetRequested"));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("auth.passwordResetRequestFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      await resetPassword({ token: resetToken, newPassword });
      setMessage(t("auth.passwordResetSuccess"));
      setView("auth");
      setMode("login");
      setResetToken("");
      setNewPassword("");
      setIsResetMode(false);
      setResetTokenFromUrl(false);
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("auth.passwordResetFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  const cardClassName =
    variant === "modal" ? "auth-page__card auth-page__card--modal" : "auth-page__card";

  const TitleTag = titleHeading;

  return (
    <div className={cardClassName}>
      <TitleTag className="auth-page__title">{t("auth.title")}</TitleTag>
      {view === "auth" ? (
        <>
          <div className="auth-page__tabs" role="tablist" aria-label={t("auth.modeLabel")}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={
                mode === "login" ? "auth-page__tab auth-page__tab--active" : "auth-page__tab"
              }
              onClick={() => setMode("login")}
            >
              {t("auth.logIn")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={
                mode === "signup" ? "auth-page__tab auth-page__tab--active" : "auth-page__tab"
              }
              onClick={() => setMode("signup")}
            >
              {t("auth.signUp")}
            </button>
          </div>
          <img
          className={`auth-page__mascot auth-page__mascot--side ${mode} mascot--${variant}`}
          src="/mascots/cool.png"
          alt=""
          aria-hidden
        />

          {googleClientId ? (
            <div ref={googleButtonRef} className="auth-page__google" />
          ) : (
            <p className="auth-page__hint">{t("auth.googleUnavailable")}</p>
          )}

          <div className="auth-page__separator">{t("auth.or")}</div>

          <form className="auth-page__form" onSubmit={handlePasswordSubmit}>
            {mode === "signup" && (
              <label className="auth-page__field">
                <span>{t("auth.userName")}</span>
                <input
                  value={userName}
                  onChange={(event) => setUserName(event.target.value)}
                  type="text"
                  required
                />
              </label>
            )}
                    
            <label className="auth-page__field">
              <span>{t("auth.email")}</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </label>
            <TextInput
              type="password"
              label={t("auth.password")}
              value={password}
              onChange={setPassword}
              minLength={8}
              required
              disabled={isLoading}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              showPasswordLabel={t("auth.showPassword")}
              hidePasswordLabel={t("auth.hidePassword")}
            />
            <Button type="submit" style="primary" disabled={isLoading}>
              {isLoading
                ? t("auth.loading")
                : mode === "signup"
                  ? t("auth.signUp")
                  : t("auth.logIn")}
            </Button>
          </form>

          <div className="auth-page__link-row auth-page__link-row--start">
            <Button
              type="button"
              style="borderless"
              onClick={() => {
                setView("forgot");
                setResetTokenFromUrl(false);
              }}
              disabled={isLoading}
            >
              {t("auth.forgotPassword")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2>{t("auth.passwordRecoveryTitle")}</h2>
          {!isResetMode ? (
            <form className="auth-page__form" onSubmit={handleForgotSubmit}>
              <label className="auth-page__field">
                <span>{t("auth.email")}</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                />
              </label>
              <Button type="submit" style="primary" disabled={isLoading}>
                {isLoading ? t("auth.loading") : t("auth.requestReset")}
              </Button>
            </form>
          ) : (
            <form className="auth-page__form" onSubmit={handleResetSubmit}>
              {!resetTokenFromUrl && (
                <label className="auth-page__field">
                  <span>{t("auth.resetToken")}</span>
                  <input
                    value={resetToken}
                    onChange={(event) => setResetToken(event.target.value)}
                    type="text"
                    required
                  />
                </label>
              )}
              <label className="auth-page__field">
                <span>{t("auth.newPassword")}</span>
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  minLength={8}
                  required
                />
              </label>
              <Button type="submit" style="primary" disabled={isLoading}>
                {isLoading ? t("auth.loading") : t("auth.resetPassword")}
              </Button>
            </form>
          )}

          <Button
            type="button"
            style="secondary"
            onClick={() => {
              setView("auth");
              setIsResetMode(false);
              setResetTokenFromUrl(false);
              setResetToken("");
              setNewPassword("");
            }}
            disabled={isLoading}
          >
            {t("auth.backToLogin")}
          </Button>
        </>
      )}

      {message ? (
        <p className="auth-page__error" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
