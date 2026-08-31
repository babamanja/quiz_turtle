import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

type ProductStep = {
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

const STEP_ICONS = [
  <Icon key="phone">
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </Icon>,
  <Icon key="brain">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
  </Icon>,
  <Icon key="seedling">
    <path d="M7 20h10" />
    <path d="M12 20V10" />
    <path d="M12 10C8 6 4 7 4 7s1 6 8 6" />
    <path d="M12 10c4-4 8-3 8-3s-1 6-8 6" />
  </Icon>,
  <Icon key="trophy">
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" />
    <path d="M17 7h2a2 2 0 1 1 0 4h-2" />
    <path d="M7 7H5a2 2 0 1 0 0 4h2" />
  </Icon>,
]

export function ProductHowItWorksSection() {
  const { t } = useTranslation()
  const steps = t('landing.product.steps', {
    returnObjects: true,
  }) as ProductStep[]

  return (
    <section className="lt-section lt-how" id="how-it-works" aria-labelledby="product-title">
      <div className="lt-section__head lt-section__head--center">
        <h2 className="lt-heading--h2" id="product-title">
          {t('landing.product.title')}
        </h2>
        <p className="lt-lead">{t('landing.product.subtitle')}</p>
      </div>
      <ol className="lt-how__steps">
        {steps.map((step, index) => (
          <li key={step.title} className="lt-how__step">
            <article aria-labelledby={`product-step-${index + 1}-title`}>
              <span className="lt-how__step-icon" aria-hidden>
                {STEP_ICONS[index] ?? STEP_ICONS[0]}
              </span>
              <span className="lt-how__step-num">{index + 1}</span>
              <h3 className="lt-heading--h3" id={`product-step-${index + 1}-title`}>
                {step.title}
              </h3>
              <p>{step.description}</p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}
