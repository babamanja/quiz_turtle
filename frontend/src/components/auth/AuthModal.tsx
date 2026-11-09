import { useTranslation } from "react-i18next";

import { useLockBody } from "../../hooks/useLockBody";
import "../UI/style.scss";
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
    <section
      className="modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="modal__content" role="dialog" aria-modal="true" aria-label={t("auth.title")}>
        <button type="button" className="modal__close" onClick={onClose} aria-label={t("auth.modalClose")}>
          ×
        </button>
        <AuthPanel
          variant="modal"
          initialMode={initialMode}
          titleHeading="h2"
          onAuthSuccess={onAuthSuccess}
          redirectOnSuccess={redirectOnSuccess}
        />
      </section>
    </section>
  );
}
