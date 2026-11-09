import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Faq } from './components/Faq'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { BenefitsSection } from './sections/BenefitsSection'
import { CtaSection } from './sections/CtaSection'
import { HeroSection } from './sections/HeroSection'
import { PricingSection } from './sections/PricingSection'
import { ProductHowItWorksSection } from './sections/ProductHowItWorksSection'
import AuthModal from '../../components/auth/AuthModal'
import type { AuthMode } from '../../components/auth/AuthPanel'
import type { AuthSession } from '../../types'
import { homePathForUser } from '../../paths'
import LegalDocumentModal from '../legal/LegalDocumentModal'
import { LEGAL_QUERY_KEY, parseLegalDocumentId } from '../legal/legalQuery'

export function LandingPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const legalDocumentId = parseLegalDocumentId(searchParams.get(LEGAL_QUERY_KEY))

  const [authModal, setAuthModal] = useState<{ open: boolean; mode: AuthMode }>({
    open: false,
    mode: 'login',
  })

  const closeLegalModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(LEGAL_QUERY_KEY)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const openAuthModal = useCallback((mode: AuthMode) => {
    setAuthModal({ open: true, mode })
  }, [])

  const closeAuthModal = useCallback(() => {
    setAuthModal((state) => ({ ...state, open: false }))
  }, [])

  const handleLandingAuthSuccess = useCallback(
    async (session: AuthSession) => {
      closeAuthModal()
      navigate(homePathForUser(session.user), { replace: true })
    },
    [closeAuthModal, navigate],
  )

  return (
    <div className="landing">
      <Header onOpenAuth={(mode) => openAuthModal(mode)} />
      <main className="landing__main">
        <HeroSection
          onRequireSignup={() => openAuthModal('signup')}
          onRequireLoginToContinue={() => openAuthModal('login')}
        />
        <BenefitsSection />
        <ProductHowItWorksSection />
        <CtaSection onGetStarted={() => openAuthModal('signup')} />
        <PricingSection />
        <Faq />
      </main>
      <Footer />
      <AuthModal
        open={authModal.open}
        initialMode={authModal.mode}
        onClose={closeAuthModal}
        onAuthSuccess={handleLandingAuthSuccess}
        redirectOnSuccess={false}
      />
      {legalDocumentId ? (
        <LegalDocumentModal documentId={legalDocumentId} onClose={closeLegalModal} />
      ) : null}
    </div>
  )
}
