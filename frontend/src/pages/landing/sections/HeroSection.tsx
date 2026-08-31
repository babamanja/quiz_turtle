import { useTranslation } from 'react-i18next'

import { trackUiCtaClick } from '../../../analytics'
import Button from '../../../components/UI/Button/Button'

type HeroSectionProps = {
  onRequireSignup: () => void
  onRequireLoginToContinue: () => void
}

export function HeroSection({ onRequireSignup }: HeroSectionProps) {
  const { t } = useTranslation()

  return (
    <section className="lt-section lt-hero" id="top" aria-labelledby="hero-title">
      <div className="lt-hero__decor" aria-hidden />
      <div className="lt-hero__grid">
        <div className="lt-hero__copy">
          <div className="lt-section__head">
            <h1 className="lt-heading--h1" id="hero-title">
              {t('landing.hero.title')}
            </h1>
            <p className="lt-lead">{t('landing.hero.subtitle')}</p>
          </div>
          <div className="lt-hero__actions">
            <Button
              className="lt-hero__cta-btn"
              data-cta-id="landing_hero_get_started"
              onClick={() => {
                trackUiCtaClick('landing_hero_get_started')
                onRequireSignup()
              }}
            >
              {t('landing.hero.cta')}
            </Button>
            {/* <p className="lt-hero__cta-hint">{t('landing.hero.ctaHint')}</p> */}
          </div>
          {/* <div className="lt-hero__stores" aria-label={t('landing.hero.storeComingSoon')}>
            <span className="lt-store-badge lt-store-badge--apple" title={t('landing.hero.storeComingSoon')}>
              {t('landing.hero.storeAppStore')}
            </span>
            <span className="lt-store-badge lt-store-badge--google" title={t('landing.hero.storeComingSoon')}>
              {t('landing.hero.storeGooglePlay')}
            </span>
          </div> */}
          {/* <button
            type="button"
            className="lt-hero__login-link"
            onClick={onRequireLoginToContinue}
          >
            {t('auth.logIn')}
          </button> */}
        </div>
        <div
          className="lt-hero__visual"
          role="group"
          aria-label={t('landing.hero.visualAriaLabel')}
        >
          <img
            className="lt-hero__mascot"
            src="/landing/mascot-hero.png"
            alt={t('landing.hero.imageAlt')}
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
    </section>
  )
}
