import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PRIVACY_POLICY_PATH, REFUND_POLICY_PATH, TERMS_OF_SERVICE_PATH } from '../../../paths'

export function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  const footerLinks = [
    { label: t('landing.footer.about'), href: '#about' },
    { label: t('landing.footer.support'), href: '#contact' },
    { label: t('landing.footer.privacy'), href: PRIVACY_POLICY_PATH, isRoute: true },
    { label: t('landing.footer.terms'), href: TERMS_OF_SERVICE_PATH, isRoute: true },
  ]

  return (
    <footer className="lt-footer" id="contact">
      <div className="lt-footer__inner">
        <div className="lt-footer__top">
          <a className="lt-footer__brand" href="#top">
            <img src="/landing/logo-icon.png" alt="" width={28} height={28} />
            <span>{t('landing.nav.brand')}</span>
          </a>
          <nav className="lt-footer__links" aria-label="Footer">
            {footerLinks.map((link) => (
              <span key={link.label}>
                {link.isRoute ? (
                  <Link to={link.href}>{link.label}</Link>
                ) : (
                  <a href={link.href}>{link.label}</a>
                )}
              </span>
            ))}
          </nav>
          <div className="lt-footer__social" aria-label={t('landing.footer.socialAria')}>
            <a href="#" aria-label="Instagram" className="lt-footer__social-link">
              IG
            </a>
            <a href="#" aria-label="X (Twitter)" className="lt-footer__social-link">
              X
            </a>
            <a href="#" aria-label="Telegram" className="lt-footer__social-link">
              TG
            </a>
          </div>
        </div>
        <p className="lt-footer__copy">
          {t('landing.footer.copyright', { year })}
          {' · '}
          <Link to={REFUND_POLICY_PATH}>{t('landing.footer.refund')}</Link>
        </p>
      </div>
    </footer>
  )
}
