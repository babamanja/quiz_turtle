import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { restoreDeletedAccount } from "../api/auth";
import type { AccountDeletedLocationState } from "../authNavigationTypes";
import Button from "../components/UI/Button/Button";
import TextInput from "../components/UI/TextInput";
import { homePathForUser } from "../paths";
import { setStoredSession } from "../userStorage";

import "./style.scss";

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

export default function AccountDeletedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const state = (location.state ?? {}) as AccountDeletedLocationState;
  const [email, setEmail] = useState(state.prefilledEmail ?? "");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

  useEffect(() => {
    if (state.prefilledEmail) {
      setEmail(state.prefilledEmail);
    }
  }, [state.prefilledEmail]);

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
            setMessage(t("accountDeleted.googleMissingCredential"));
            return;
          }
          setIsLoading(true);
          setMessage(null);
          try {
            const session = await restoreDeletedAccount({ idToken: response.credential });
            setStoredSession({ token: session.token, user: session.user });
            navigate(homePathForUser(session.user), { replace: true });
          } catch (error) {
            setMessage(error instanceof Error ? error.message : t("accountDeleted.restoreFailed"));
          } finally {
            setIsLoading(false);
          }
        },
      });
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
      });
    });
  }, [googleClientId, navigate, t]);

  async function handlePasswordRestore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const session = await restoreDeletedAccount({ email, password });
      setStoredSession({ token: session.token, user: session.user });
      navigate(homePathForUser(session.user), { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("accountDeleted.restoreFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-page__card">
        <h1 className="auth-page__title">{t("accountDeleted.title")}</h1>
        <p className="auth-page__subtitle">{t("accountDeleted.description")}</p>
        {message ? (
          <p className="auth-page__error" role="alert">
            {message}
          </p>
        ) : null}

        {googleClientId ? (
          <section className="auth-page__section">
            <h2 className="auth-page__section-title">{t("accountDeleted.googleSectionTitle")}</h2>
            <div ref={googleButtonRef} className="auth-page__google" />
          </section>
        ) : (
          <p className="auth-page__hint">{t("auth.googleUnavailable")}</p>
        )}

        <section className="auth-page__section">
          <h2 className="auth-page__section-title">{t("accountDeleted.passwordSectionTitle")}</h2>
          <form className="auth-page__form" onSubmit={handlePasswordRestore}>
            <label className="auth-page__field" htmlFor="account-deleted-email">
              <span>{t("auth.email")}</span>
              <input
                id="account-deleted-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <TextInput
              id="account-deleted-password"
              type="password"
              label={t("auth.password")}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
              disabled={isLoading}
              showPasswordLabel={t("auth.showPassword")}
              hidePasswordLabel={t("auth.hidePassword")}
            />
            <Button type="submit" style="primary" disabled={isLoading}>
              {isLoading ? t("auth.loading") : t("accountDeleted.restoreCta")}
            </Button>
          </form>
        </section>

        <p className="auth-page__footer">
          <Link to="/">{t("accountDeleted.backToAuth")}</Link>
        </p>
      </div>
    </section>
  );
}
