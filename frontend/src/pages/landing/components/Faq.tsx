import { useTranslation } from 'react-i18next'

type FaqItem = {
  question: string
  answer: string
}

export function Faq() {
  const { t } = useTranslation()
  const items = t('landing.faq.items', { returnObjects: true }) as FaqItem[]

  return (
    <section className="lt-section lt-faq" id="faq" aria-labelledby="faq-title">
      <div className="lt-section__head">
        <h2 className="lt-heading--h2" id="faq-title">
          {t('landing.faq.title')}
        </h2>
      </div>
      <dl>
        {items.map((item) => (
          <div className="lt-faq__row" key={item.question}>
            <dt>{item.question}</dt>
            <dd>{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
