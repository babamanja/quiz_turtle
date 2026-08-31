import { useTranslation } from 'react-i18next'

import { trackUiCtaClick } from '../../../analytics'
import Button from '../../../components/UI/Button/Button'
import ButtonLink from '../../../components/UI/Button/ButtonLink'
import { isAuthenticatedUser, useSession } from '../../../hooks/useSession'
import { homePathForRole } from '../../../paths'

type CtaSectionProps = {
  onGetStarted: () => void
}

function PhoneMockup({ variant }: { variant: 'dashboard' | 'review' }) {
  if (variant === 'review') {
    return (
      <div className="lt-phone-mockup lt-phone-mockup--review" aria-hidden>
        <div className="lt-phone-mockup__screen">
          <p className="lt-phone-mockup__label">Review</p>
          <p className="lt-phone-mockup__question">perro</p>
          <ul className="lt-phone-mockup__options">
            <li>dog</li>
            <li>cat</li>
            <li>bird</li>
            <li>fish</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="lt-phone-mockup lt-phone-mockup--dashboard" aria-hidden>
      <div className="lt-phone-mockup__screen">
        <div className="lt-phone-mockup__header">
          <span className="lt-phone-mockup__avatar" />
          <span>Today</span>
        </div>
        <div className="lt-phone-mockup__progress">
          <span style={{ width: '72%' }} />
        </div>
        <div className="lt-phone-mockup__stats">
          <div>
            <strong>24</strong>
            <span>words</span>
          </div>
          <div>
            <strong>8</strong>
            <span>due</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CtaSection({ onGetStarted }: CtaSectionProps) {
  const { t } = useTranslation()
  const { user, token } = useSession()
  const isLoggedIn = isAuthenticatedUser(user?.role, token)
  const appPath = homePathForRole(user?.role)

  return (
    <section className="lt-cta" id="about" aria-labelledby="cta-section-title">
      <div className="lt-cta__grid">
        <div className="lt-cta__copy">
          <div className="lt-section__head">
            <h2 className="lt-heading--h2" id="cta-section-title">
              {t('landing.ctaSection.title')}
            </h2>
            <p className="lt-lead">{t('landing.ctaSection.subtitle')}</p>
          </div>
          <p>
            {isLoggedIn ? (
              <ButtonLink
                to={appPath}
                className="lt-cta__btn"
                data-cta-id="landing_cta_go_to_app"
                onClick={() => trackUiCtaClick('landing_cta_go_to_app')}
              >
                {t('landing.ctaSection.buttonLoggedIn')}
              </ButtonLink>
            ) : (
              <Button
                className="lt-cta__btn"
                data-cta-id="landing_cta_get_started"
                onClick={() => {
                  trackUiCtaClick('landing_cta_get_started')
                  onGetStarted()
                }}
              >
                {t('landing.ctaSection.button')}
              </Button>
            )}
          </p>
          <p className="lt-hint">
            {isLoggedIn
              ? t('landing.ctaSection.buttonHintLoggedIn')
              : t('landing.ctaSection.buttonHint')}
          </p>
        </div>
        <div className="lt-cta__phones" aria-hidden>
          <PhoneMockup variant="dashboard" />
          <PhoneMockup variant="review" />
        </div>
      </div>
    </section>
  )
}
