import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PREMIUM_USD_MONTHLY } from '@language-turtle/shared'

type PlanCopy = {
  name: string
  period: string
  features: string[]
  badge?: string
}

type Plan = PlanCopy & {
  price: string
}

export function PricingSection() {
  const { t } = useTranslation()

  const plans = useMemo((): Plan[] => {
    const basic = t('landing.pricing.basic', { returnObjects: true }) as PlanCopy
    const premium = t('landing.pricing.premium', { returnObjects: true }) as PlanCopy

    return [
      {
        ...basic,
        price: t('mySubscription.plans.basic.price'),
      },
      {
        ...premium,
        price: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
          PREMIUM_USD_MONTHLY,
        ),
        badge: premium.badge,
      },
    ]
  }, [t])

  return (
    <section className="lt-section" id="pricing" aria-labelledby="pricing-title">
      <div className="lt-section__head">
        <h2 className="lt-heading--h2" id="pricing-title">
          {t('landing.pricing.title')}
        </h2>
        <p className="lt-lead">{t('landing.pricing.subtitle')}</p>
      </div>
      <ul className="lt-pricing-grid">
        {plans.map((plan) => (
          <li key={plan.name}>
            <article
              className={
                plan.badge ? 'lt-pricing-card lt-pricing-card--featured' : 'lt-pricing-card'
              }
            >
              {plan.badge ? <p className="lt-tag">{plan.badge}</p> : null}
              <h3 className="lt-heading--h3">{plan.name}</h3>
              <p>
                <span className="lt-price">{plan.price}</span>{' '}
                <span className="lt-price-period">{plan.period}</span>
              </p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
