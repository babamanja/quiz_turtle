import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

type BenefitItem = {
  title: string
  description: string
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

const BENEFIT_ICONS = [
  <Icon key="leaf">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </Icon>,
  <Icon key="brain">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
  </Icon>,
  <Icon key="target">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </Icon>,
  <Icon key="chart">
    <path d="M3 3v18h18" />
    <path d="M7 16v-5" />
    <path d="M12 16V8" />
    <path d="M17 16v-9" />
  </Icon>,
]

export function BenefitsSection() {
  const { t } = useTranslation()
  const items = t('landing.benefits.items', {
    returnObjects: true,
  }) as BenefitItem[]

  return (
    <section className="lt-section lt-benefits" id="features" aria-labelledby="benefits-title">
      <div className="lt-section__head lt-section__head--center">
        <h2 className="lt-heading--h2" id="benefits-title">
          {t('landing.benefits.title')}
        </h2>
        <p className="lt-lead">{t('landing.benefits.subtitle')}</p>
      </div>
      <ul className="lt-features-grid">
        {items.map((item, index) => (
          <li key={item.title}>
            <article className="lt-feature-card">
              <span className="lt-feature-card__icon" aria-hidden>
                {BENEFIT_ICONS[index] ?? BENEFIT_ICONS[0]}
              </span>
              <h3 className="lt-heading--h3">{item.title}</h3>
              <p>{item.description}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
