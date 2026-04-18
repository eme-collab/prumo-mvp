'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { signOut } from '@/app/app-shell-actions'
import {
  computeNotificationReadiness,
  type NotificationPreferencesState,
  type NotificationUsefulItemsState,
} from '@/lib/notification-readiness'
import {
  fetchNotificationApiState,
  getBrowserNotificationPermission,
  getCurrentPushSubscription,
  isNotificationSupportedInBrowser,
  isSubscriptionCurrentlyValid,
} from '@/lib/notifications/client'
import { ui } from '@/lib/ui'

const EMPTY_NOTIFICATION_PREFERENCES: NotificationPreferencesState = {
  push_enabled: false,
  pending_enabled: true,
  payables_enabled: true,
  receivables_enabled: true,
}

function KebabIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="currentColor"
    >
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="10" cy="15.5" r="1.5" />
    </svg>
  )
}

export default function AppShellMenu({
  userId,
  hasCompletedFirstCapture,
  isZenMode,
  usefulItems,
}: {
  userId: string
  hasCompletedFirstCapture: boolean
  isZenMode: boolean
  usefulItems: NotificationUsefulItemsState
}) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [permission, setPermission] = useState(getBrowserNotificationPermission())
  const [preferences, setPreferences] = useState<NotificationPreferencesState>(
    EMPTY_NOTIFICATION_PREFERENCES
  )
  const [hasSubscription, setHasSubscription] = useState(false)
  const [hasValidSubscription, setHasValidSubscription] = useState(false)

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const isSupported = isNotificationSupportedInBrowser()
        const nextPermission = getBrowserNotificationPermission()

        if (!isSupported) {
          if (active) {
            setPermission('unsupported')
          }

          return
        }

        const [apiState, subscription] = await Promise.all([
          fetchNotificationApiState(),
          getCurrentPushSubscription(),
        ])

        if (!active) {
          return
        }

        setPermission(nextPermission)
        setPreferences(apiState.preferences)
        setHasSubscription(Boolean(subscription))
        setHasValidSubscription(isSubscriptionCurrentlyValid(subscription))
      } catch {
        if (!active) {
          return
        }

        setPermission(getBrowserNotificationPermission())
      }
    })()

    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const readiness = useMemo(
    () =>
      computeNotificationReadiness({
        hasCompletedFirstCapture,
        isZenMode,
        browser: {
          isSupported: isNotificationSupportedInBrowser(),
          permission,
          hasSubscription,
          hasValidSubscription,
        },
        preferences,
        usefulItems,
        isSoftPromptDismissed: false,
      }),
    [
      hasCompletedFirstCapture,
      hasSubscription,
      hasValidSubscription,
      isZenMode,
      permission,
      preferences,
      usefulItems,
    ]
  )

  const needsNotificationActivation =
    readiness.has_useful_pending_items &&
    !readiness.is_notifications_effectively_enabled &&
    permission === 'granted' &&
    hasValidSubscription &&
    !preferences.push_enabled

  const showNotificationAttention =
    readiness.has_useful_pending_items &&
    !readiness.is_notifications_effectively_enabled &&
    (
      readiness.can_show_soft_prompt ||
      readiness.needs_browser_settings_help ||
      readiness.needs_resubscribe ||
      needsNotificationActivation
    )

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900 active:scale-[0.99]"
      >
        <KebabIcon />
        {showNotificationAttention && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-40 w-56 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg shadow-neutral-200/70">
          <Link
            href="/notificacoes"
            onClick={() => setIsOpen(false)}
            className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition ${
              showNotificationAttention
                ? 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                : 'text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <span>Notificações</span>
            {showNotificationAttention && (
              <span className={ui.badge.warning}>Pendente</span>
            )}
          </Link>

          <form action={signOut} className="mt-1">
            <button
              type="submit"
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <span>Sair</span>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
