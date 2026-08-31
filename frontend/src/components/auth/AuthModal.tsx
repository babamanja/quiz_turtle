import { useTranslation } from "react-i18next";

import { useLockBody } from "../../hooks/useLockBody";
import AuthPanel, { type AuthMode } from "./AuthPanel";

type AuthModalProps = {
  open: boolean;
  initialMode: AuthMode;
  onClose: () => void;
  onAuthSuccess?: (session: import("../../types").AuthSession) => void | Promise<void>;
  redirectOnSuccess?: boolean;
};

export default function AuthModal({
  open,
  initialMode,
  onClose,
  onAuthSuccess,
  redirectOnSuccess = true,
}: AuthModalProps) {
  const { t } = useTranslation();
  useLockBody(open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="auth-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label={t("auth.modalClose")}
        onClick={onClose}
      />
      <div className="auth-modal__dialog" role="dialog" aria-modal="true" aria-label={t("auth.title")}>
        <button type="button" className="auth-modal__close" onClick={onClose} aria-label={t("auth.modalClose")}>
          ×
        </button>
        <div className="auth-modal__body">
          <AuthPanel
            variant="modal"
            initialMode={initialMode}
            titleHeading="h2"
            onAuthSuccess={onAuthSuccess}
            redirectOnSuccess={redirectOnSuccess}
          />
        </div>
      </div>
    </div>
  );
}
