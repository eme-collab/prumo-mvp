'use client'

import { useEffect, useMemo, useState } from 'react'
import { ui } from '@/lib/ui'

const DISMISS_KEY = 'prumo-install-card-dismissed-at'
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type InstallAppCardProps = {
  title?: string
  subtitle?: string
  installLabel?: string
  presentation?: 'card' | 'inline'
  requirePrompt?: boolean
  showDismissAction?: boolean
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

function isAppleMobile() {
  if (typeof window === 'undefined') return false

  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
}

function isSupportedAppleInstallBrowser() {
  if (typeof window === 'undefined') return false

  const userAgent = window.navigator.userAgent
  const isSafari =
    /Safari/.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser/.test(userAgent)
  const isSecureContextForInstall =
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname.endsWith('.local')

  return isAppleMobile() && isSafari && isSecureContextForInstall
}

function wasDismissedRecently() {
  if (typeof window === 'undefined') return false

  const rawValue = window.localStorage.getItem(DISMISS_KEY)

  if (!rawValue) {
    return false
  }

  const dismissedAt = Number(rawValue)

  if (Number.isNaN(dismissedAt)) {
    window.localStorage.removeItem(DISMISS_KEY)
    return false
  }

  const isStillHidden = Date.now() - dismissedAt < DISMISS_TTL_MS

  if (!isStillHidden) {
    window.localStorage.removeItem(DISMISS_KEY)
  }

  return isStillHidden
}

export default function InstallAppCard({
  title = 'Instalar app',
  subtitle = 'Abra o Prumo como app no celular.',
  installLabel = 'Instalar',
  presentation = 'card',
  requirePrompt = false,
  showDismissAction = true,
}: InstallAppCardProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(true)
  const [isAppleInstallSupported, setIsAppleInstallSupported] = useState(false)
  const [isHidden, setIsHidden] = useState(true)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    setIsStandalone(isStandaloneMode())
    setIsAppleInstallSupported(isSupportedAppleInstallBrowser())
    setIsHidden(wasDismissedRecently())

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    function handleAppInstalled() {
      setDeferredPrompt(null)
      setIsStandalone(true)
      setIsHidden(true)
      window.localStorage.removeItem(DISMISS_KEY)
    }

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt as EventListener
    )
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt as EventListener
      )
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const shouldShow = useMemo(() => {
    if (isStandalone || isHidden) {
      return false
    }

    if (requirePrompt) {
      return Boolean(deferredPrompt)
    }

    return Boolean(deferredPrompt) || isAppleInstallSupported
  }, [
    deferredPrompt,
    isAppleInstallSupported,
    isHidden,
    isStandalone,
    requirePrompt,
  ])

  function dismissCard() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setIsHidden(true)
  }

  async function handleInstallClick() {
    if (!deferredPrompt) {
      return
    }

    try {
      setIsInstalling(true)
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice

      if (choice.outcome === 'accepted') {
        setIsHidden(true)
      }
    } finally {
      setDeferredPrompt(null)
      setIsInstalling(false)
    }
  }

  if (!shouldShow) {
    return null
  }

  const isInline = presentation === 'inline'
  const containerClassName = isInline ? 'border-t border-neutral-200 pt-4' : ui.card.muted

  return (
    <div className={containerClassName}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={isInline ? 'text-sm font-semibold text-neutral-900' : ui.text.sectionTitle}>
            {title}
          </h2>
          <p className={`mt-1 ${isInline ? ui.text.muted : ui.text.subtle}`}>
            {subtitle}
          </p>
        </div>

        {showDismissAction && (
          <button
            type="button"
            onClick={dismissCard}
            className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50"
            aria-label="Dispensar instrução de instalação"
          >
            Agora não
          </button>
        )}
      </div>

      {deferredPrompt ? (
        <div className={`mt-4 flex flex-wrap gap-3 ${isInline ? '' : ''}`}>
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className={isInline ? `w-full ${ui.button.secondary}` : ui.button.neutral}
          >
            {isInstalling ? 'Abrindo...' : installLabel}
          </button>

          {showDismissAction && (
            <button
              type="button"
              onClick={dismissCard}
              className={ui.button.neutral}
            >
              Depois
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white px-3 py-3">
          <p className={ui.text.body}>
            No iPhone ou iPad, use Compartilhar e depois Adicionar à Tela de
            Início.
          </p>
        </div>
      )}
    </div>
  )
}
