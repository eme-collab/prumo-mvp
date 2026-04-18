'use client'

import { useEffect, useMemo, useState } from 'react'
import { trackAppEventClient } from '@/lib/app-events-client'
import {
  computeNotificationReadiness,
  createEmptyUsefulItemsState,
  type NotificationPreferencesState,
  type NotificationUsefulItemsState,
} from '@/lib/notification-readiness'
import {
  dismissNotificationSoftPrompt,
  ensurePushSubscription,
  fetchNotificationApiState,
  getBrowserNotificationPermission,
  getCurrentPushSubscription,
  isNotificationSoftPromptDismissed,
  isNotificationSupportedInBrowser,
  isSubscriptionCurrentlyValid,
  requestPermissionAndSubscribe,
  saveNotificationPreferences,
} from '@/lib/notifications/client'
import { ui } from '@/lib/ui'

const EMPTY_PREFERENCES: NotificationPreferencesState = {
  push_enabled: false,
  pending_enabled: true,
  payables_enabled: true,
  receivables_enabled: true,
}

export default function NotificationSoftPrompt({
  userId,
  hasCompletedFirstCapture,
  usefulItems = createEmptyUsefulItemsState(),
}: {
  userId: string
  hasCompletedFirstCapture: boolean
  usefulItems?: NotificationUsefulItemsState
}) {
  const [preferences, setPreferences] =
    useState<NotificationPreferencesState>(EMPTY_PREFERENCES)
  const [publicVapidKey, setPublicVapidKey] = useState('')
  const [permission, setPermission] = useState(getBrowserNotificationPermission())
  const [hasSubscription, setHasSubscription] = useState(false)
  const [hasValidSubscription, setHasValidSubscription] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const supported = isNotificationSupportedInBrowser()
        const dismissed = isNotificationSoftPromptDismissed(userId)
        const nextPermission = getBrowserNotificationPermission()

        if (!supported) {
          if (active) {
            setPermission('unsupported')
            setIsDismissed(dismissed)
            setIsReady(true)
          }

          return
        }

        const apiState = await fetchNotificationApiState()
        const subscription = await getCurrentPushSubscription()
        const hasCurrentSubscription = Boolean(subscription)
        const hasCurrentValidSubscription = isSubscriptionCurrentlyValid(subscription)

        if (
          nextPermission === 'granted' &&
          apiState.publicVapidKey &&
          !hasCurrentValidSubscription
        ) {
          const resubscribed = await ensurePushSubscription(apiState.publicVapidKey)

          if (active) {
            setHasSubscription(Boolean(resubscribed))
            setHasValidSubscription(isSubscriptionCurrentlyValid(resubscribed))
          }
        } else if (active) {
          setHasSubscription(hasCurrentSubscription)
          setHasValidSubscription(hasCurrentValidSubscription)
        }

        if (active) {
          setPreferences(apiState.preferences)
          setPublicVapidKey(apiState.publicVapidKey)
          setPermission(nextPermission)
          setIsDismissed(dismissed)
          setIsReady(true)
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Falha ao carregar lembretes.'
          )
          setIsReady(true)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [userId])

  const readiness = useMemo(
    () =>
      computeNotificationReadiness({
        hasCompletedFirstCapture,
        isZenMode: false,
        browser: {
          isSupported: isNotificationSupportedInBrowser(),
          permission,
          hasSubscription,
          hasValidSubscription,
        },
        preferences,
        usefulItems,
        isSoftPromptDismissed: isDismissed,
      }),
    [
      hasCompletedFirstCapture,
      permission,
      hasSubscription,
      hasValidSubscription,
      preferences,
      usefulItems,
      isDismissed,
    ]
  )

  useEffect(() => {
    if (!isReady || !readiness.can_show_soft_prompt) {
      return
    }

    void trackAppEventClient({
      eventName: 'notification_soft_prompt_viewed',
      onceKey: `notification_soft_prompt_viewed:${userId}`,
      properties: {
        source_screen: 'painel',
        has_completed_first_capture: hasCompletedFirstCapture,
      },
    })
  }, [hasCompletedFirstCapture, isReady, readiness.can_show_soft_prompt, userId])

  async function handleActivate() {
    try {
      setIsSubmitting(true)
      setError('')
      setMessage('')

      if (!publicVapidKey) {
        throw new Error('Chave pública VAPID ausente.')
      }

      if (permission === 'denied') {
        setError(
          'As notificações estão bloqueadas neste navegador. Ajuste a permissão no navegador ou no sistema para voltar a ativar.'
        )
        return
      }

      const result =
        permission === 'granted'
          ? {
              permission,
              subscription: await ensurePushSubscription(publicVapidKey),
            }
          : await (async () => {
              await trackAppEventClient({
                eventName: 'notification_permission_requested',
                properties: {
                  source_screen: 'painel',
                  notification_permission_status: permission,
                  has_completed_first_capture: hasCompletedFirstCapture,
                },
              })

              return requestPermissionAndSubscribe(publicVapidKey)
            })()

      setPermission(result.permission)
      setHasSubscription(Boolean(result.subscription))
      setHasValidSubscription(isSubscriptionCurrentlyValid(result.subscription))

      if (permission !== 'granted' && result.permission !== 'granted') {
        await trackAppEventClient({
          eventName: 'notification_permission_denied',
          properties: {
            source_screen: 'painel',
            notification_permission_status: result.permission,
            has_completed_first_capture: hasCompletedFirstCapture,
          },
        })
        setError(
          result.permission === 'denied'
            ? 'As notificações ficaram bloqueadas. Ajuste a permissão no navegador ou no sistema para voltar a ativar.'
            : 'Permissão de notificação não concedida neste dispositivo.'
        )
        return
      }

      const nextPreferences = await saveNotificationPreferences({
        ...preferences,
        push_enabled: true,
      })

      setPreferences(nextPreferences)
      setIsDismissed(true)
      setMessage('Lembretes ativados neste dispositivo.')

      if (permission !== 'granted') {
        await trackAppEventClient({
          eventName: 'notification_permission_accepted',
          properties: {
            source_screen: 'painel',
            notification_permission_status: result.permission,
            has_completed_first_capture: hasCompletedFirstCapture,
          },
        })
      }
    } catch (activateError) {
      setError(
        activateError instanceof Error
          ? activateError.message
          : 'Falha ao ativar lembretes.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDismiss() {
    dismissNotificationSoftPrompt(userId)
    setIsDismissed(true)
    setMessage('')
  }

  if (!isReady || !readiness.can_show_soft_prompt) {
    return null
  }

  return (
    <div className={ui.card.base}>
      <h2 className={ui.text.sectionTitle}>
        Quer que o Prumo te avise quando tiver cobrança, conta vencendo ou lançamento pendente?
      </h2>

      {error && (
        <div className={`mt-4 ${ui.card.danger}`}>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {message && (
        <div className={`mt-4 ${ui.card.success}`}>
          <p className="text-sm text-green-800">{message}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleActivate}
          disabled={isSubmitting}
          className={ui.button.primary}
        >
          {isSubmitting ? 'Ativando...' : 'Ativar lembretes'}
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          disabled={isSubmitting}
          className={ui.button.secondary}
        >
          Agora não
        </button>
      </div>
    </div>
  )
}
