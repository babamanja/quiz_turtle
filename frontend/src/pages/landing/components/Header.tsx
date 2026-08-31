import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { logOut } from '../../../api/auth'
import { trackUiCtaClick } from '../../../analytics'
import type { AuthMode } from '../../../components/auth/AuthPanel'
import Button from '../../../components/UI/Button/Button'
import ButtonLink from '../../../components/UI/Button/ButtonLink'
import { MEDIA_MOBILE } from '../../../constants/breakpoints'
import { isAuthenticatedUser, useSession } from '../../../hooks/useSession'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { homePathForRole } from '../../../paths'
import { clearStoredSession } from '../../../userStorage'
import '../../landing/landing.scss'

type HeaderProps = {
  onOpenAuth: (mode: AuthMode) => void
}

function displayName(userName: string | undefined, email: string | undefined): string {
  const trimmedName = userName?.trim()
  if (trimmedName) {
    return trimmedName
  }
  const trimmedEmail = email?.trim()
  if (trimmedEmail) {
    return trimmedEmail.split('@')[0] ?? trimmedEmail
  }
  return ''
}

export function Header({ onOpenAuth }: HeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, token } = useSession()
  const isLoggedIn = isAuthenticatedUser(user?.role, token) && !user?.isGuest
  const appPath = homePathForRole(user?.role)
  const menuId = useId()
  const userMenuId = useId()
  const isNarrow = useMediaQuery(MEDIA_MOBILE)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isNarrow) {
      setMenuOpen(false)
    }
  }, [isNarrow])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    if (!userMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target
      if (target instanceof Node && userMenuRef.current?.contains(target)) {
        return
      }
      setUserMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [userMenuOpen])

  const closeMenu = () => setMenuOpen(false)
  const closeUserMenu = () => setUserMenuOpen(false)

  async function handleLogOut() {
    closeUserMenu()
    closeMenu()
    try {
      await logOut()
    } catch {
      // Clear local session even if the API call fails.
    }
    clearStoredSession()
    navigate('/', { replace: true })
  }

  const linkTabIndex =
    isNarrow && !menuOpen ? ({ tabIndex: -1 as const } as const) : {}

  const menuLinks = [
    { href: '#how-it-works', text: t('landing.nav.howItWorks') },
    { href: '#features', text: t('landing.nav.features') },
    { href: '#pricing', text: t('landing.nav.pricing') },
    { href: '#about', text: t('landing.nav.about') },
  ]

  const userLabel = displayName(user?.userName, user?.email)
  const dashboardLabel =
    (user?.role ?? '').toLowerCase() === 'admin'
      ? t('nav.adminDashboard')
      : t('nav.dashboard')

  return (
    <header className="lt-header">
      <div className="lt-header__inner">
        <a className="lt-logo" href="#top" onClick={closeMenu}>
          <img className="lt-logo__icon" src="/landing/logo-icon.png" alt="" width={28} height={28} />
          <span>{t('landing.nav.brand')}</span>
        </a>
        <nav
          id={menuId}
          className={`lt-nav${menuOpen ? ' lt-nav--open' : ''}`}
          aria-label={t('landing.nav.primaryNavAria')}
          aria-hidden={isNarrow ? !menuOpen : false}
        >
          {menuLinks.map(({ href, text }) => (
            <a
              key={href}
              className="lt-nav__link"
              href={href}
              onClick={closeMenu}
            >
              {text}
            </a>
          ))}
          {!isLoggedIn ? (
            <Button
              style="primary"
              className="lt-header__cta lt-header__cta--menu"
              data-cta-id="landing_header_signup_menu"
              onClick={() => {
                trackUiCtaClick('landing_header_signup_menu')
                onOpenAuth('signup')
                closeMenu()
              }}
              {...linkTabIndex}
            >
              {t('landing.nav.cta')}
            </Button>
          ) : null}
        </nav>
        <div
          className={`lt-header__auth${isLoggedIn ? ' lt-header__auth--logged-in' : ''}`}
          ref={isLoggedIn ? userMenuRef : undefined}
        >
          {isLoggedIn ? (
            <>
              {userLabel ? (
                <span className="lt-header__user" title={user?.email}>
                  {userLabel}
                </span>
              ) : null}
              <div className="lt-header__user-menu">
                <button
                  type="button"
                  className={`lt-header__user-burger${userMenuOpen ? ' lt-header__user-burger--open' : ''}`}
                  aria-expanded={userMenuOpen}
                  aria-controls={userMenuId}
                  aria-haspopup="menu"
                  aria-label={
                    userMenuOpen
                      ? t('landing.nav.userMenuClose')
                      : t('landing.nav.userMenuOpen')
                  }
                  onClick={() => setUserMenuOpen((open) => !open)}
                >
                  <span className="lt-header__burger-lines" aria-hidden>
                    <span className="lt-header__burger-line" />
                    <span className="lt-header__burger-line" />
                    <span className="lt-header__burger-line" />
                  </span>
                </button>
                {userMenuOpen ? (
                  <div
                    id={userMenuId}
                    className="lt-header__user-dropdown"
                    role="menu"
                  >
                    <ButtonLink
                      to={appPath}
                      className="lt-header__user-dropdown-link"
                      role="menuitem"
                      data-cta-id="landing_header_dashboard"
                      onClick={() => {
                        trackUiCtaClick('landing_header_go_to_app')
                        closeUserMenu()
                      }}
                    >
                      {dashboardLabel}
                    </ButtonLink>
                    <button
                      type="button"
                      className="lt-header__user-dropdown-action"
                      role="menuitem"
                      onClick={handleLogOut}
                    >
                      {t('nav.logOut')}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <Button
              style="primary"
              className="lt-header__cta"
              data-cta-id="landing_header_signup"
              onClick={() => {
                trackUiCtaClick('landing_header_signup')
                onOpenAuth('signup')
              }}
            >
              {t('landing.nav.cta')}
            </Button>
          )}
        </div>
        <button
          type="button"
          className={`lt-header__burger${menuOpen ? ' lt-header__burger--open' : ''}`}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? t('landing.nav.menuClose') : t('landing.nav.menuOpen')}
          onClick={() => {
            closeUserMenu()
            setMenuOpen((open) => !open)
          }}
        >
          <span className="lt-header__burger-lines" aria-hidden>
            <span className="lt-header__burger-line" />
            <span className="lt-header__burger-line" />
            <span className="lt-header__burger-line" />
          </span>
        </button>
      </div>
      {menuOpen && isNarrow ? (
        <button
          type="button"
          className="lt-header__backdrop"
          aria-label={t('landing.nav.menuClose')}
          onClick={closeMenu}
        />
      ) : null}
    </header>
  )
}
