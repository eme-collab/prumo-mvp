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
  disablePushNotificationsForCurrentBrowser,
  ensurePushSubscription,
  fetchNotificationApiState,
  getBrowserNotificationPermission,
  getCurrentPushSubscription,
  isNotificationSupportedInBrowser,
  isSubscriptionCurrentlyValid,
  requestPermissionAndSubscribe,
  saveNotificationPreferences,
  sendNotificationTest,
} from '@/lib/notifications/client'
import { ui } from '@/lib/ui'

const defaultPreferences: NotificationPreferencesState = {
  push_enabled: false,
  pending_enabled: true,
  payables_enabled: true,
  receivables_enabled: true,
}

function getPermissionLabel(permission: string) {
  switch (permission) {
    case 'granted':
      return 'Permissão concedida'
    case 'denied':
      return 'Bloqueadas no navegador'
    case 'unsupported':
      return 'Sem suporte'
    default:
      return 'Ainda não autorizadas'
  }
}

export default function NotificationPreferencesCard({
  usefulItems = createEmptyUsefulItemsState(),
  hasCompletedFirstCapture = true,
}: {
  usefulItems?: NotificationUsefulItemsState
  hasCompletedFirstCapture?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [permission, setPermission] = useState(getBrowserNotificationPermission())
  const [publicVapidKey, setPublicVapidKey] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [hasValidSubscription, setHasValidSubscription] = useState(false)
  const [preferences, setPreferences] =
    useState<NotificationPreferencesState>(defaultPreferences)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true)
        setError('')

        const isSupported = isNotificationSupportedInBrowser()

        setPermission(getBrowserNotificationPermission())

        if (!isSupported) {
          return
        }

        const apiState = await fetchNotificationApiState()
        setPreferences(apiState.preferences ?? defaultPreferences)
        setPublicVapidKey(apiState.publicVapidKey ?? '')

        const subscription = await getCurrentPushSubscription()
        setIsSubscribed(Boolean(subscription))
        setHasValidSubscription(isSubscriptionCurrentlyValid(subscription))

        if (
          getBrowserNotificationPermission() === 'granted' &&
          apiState.publicVapidKey &&
          !isSubscriptionCurrentlyValid(subscription)
        ) {
          const refreshedSubscription = await ensurePushSubscription(
            apiState.publicVapidKey
          )
          setIsSubscribed(Boolean(refreshedSubscription))
          setHasValidSubscription(
            isSubscriptionCurrentlyValid(refreshedSubscription)
          )
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Falha ao carregar notificações.'
        )
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const readiness = useMemo(
    () =>
      computeNotificationReadiness({
        hasCompletedFirstCapture,
        isZenMode: false,
        browser: {
          isSupported: isNotificationSupportedInBrowser(),
          permission,
          hasSubscription: isSubscribed,
          hasValidSubscription,
        },
        preferences,
        usefulItems,
        isSoftPromptDismissed: false,
        allowFallbackPrompt: true,
      }),
    [
      hasCompletedFirstCapture,
      hasValidSubscription,
      isSubscribed,
      permission,
      preferences,
      usefulItems,
    ]
  )
  const canAttemptEnable =
    Boolean(publicVapidKey) && !readiness.needs_browser_settings_help

  async function persistPreferences(nextPreferences: NotificationPreferencesState) {
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const persistedPreferences =
        await saveNotificationPreferences(nextPreferences)

      setPreferences(persistedPreferences)
      setMessage('Preferências de notificação salvas.')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Falha ao salvar preferências.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleEnableNotifications() {
    if (!isNotificationSupportedInBrowser() || !publicVapidKey) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setMessage('')

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
                  source_screen: 'resumo',
                  notification_permission_status: permission,
                  has_completed_first_capture: hasCompletedFirstCapture,
                },
              })

              return requestPermissionAndSubscribe(publicVapidKey)
            })()

      setPermission(result.permission)
      setIsSubscribed(Boolean(result.subscription))
      setHasValidSubscription(isSubscriptionCurrentlyValid(result.subscription))

      if (permission !== 'granted' && result.permission !== 'granted') {
        await trackAppEventClient({
          eventName: 'notification_permission_denied',
          properties: {
            source_screen: 'resumo',
            notification_permission_status: result.permission,
            has_completed_first_capture: hasCompletedFirstCapture,
          },
        })

        throw new Error(
          result.permission === 'denied'
            ? 'As notificações ficaram bloqueadas. Ajuste a permissão no navegador ou no sistema para voltar a ativar.'
            : 'Permissão de notificação não concedida neste dispositivo.'
        )
      }

      if (permission !== 'granted') {
        await trackAppEventClient({
          eventName: 'notification_permission_accepted',
          properties: {
            source_screen: 'resumo',
            notification_permission_status: result.permission,
            has_completed_first_capture: hasCompletedFirstCapture,
          },
        })
      }

      await persistPreferences({
        ...preferences,
        push_enabled: true,
      })
    } catch (enableError) {
      setError(
        enableError instanceof Error
          ? enableError.message
          : 'Falha ao ativar notificações.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDisableNotifications() {
    try {
      setSaving(true)
      setError('')
      setMessage('')

      await disablePushNotificationsForCurrentBrowser()

      setIsSubscribed(false)
      setHasValidSubscription(false)

      await persistPreferences({
        ...preferences,
        push_enabled: false,
      })
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : 'Falha ao desativar notificações.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleTestPush() {
    try {
      setTesting(true)
      setError('')
      setMessage('')

      await sendNotificationTest()

      setMessage('Notificação de teste enviada para este usuário.')
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : 'Falha ao enviar notificação de teste.'
      )
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className={ui.card.base}>
        <h2 className={ui.text.sectionTitle}>Notificações úteis</h2>
        <p className={`mt-2 ${ui.text.muted}`}>Carregando preferências...</p>
      </div>
    )
  }

  if (!isNotificationSupportedInBrowser()) {
    return (
      <div className={ui.card.base}>
        <h2 className={ui.text.sectionTitle}>Notificações úteis</h2>
        <p className={`mt-2 ${ui.text.muted}`}>
          Este navegador não suporta notificações push neste contexto.
        </p>
      </div>
    )
  }

  return (
    <div className={ui.card.base}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className={ui.text.sectionTitle}>Notificações úteis</h2>
          <p className={`mt-2 ${ui.text.muted}`}>
            Ative lembretes só para ações que valem a pena: revisar pendentes,
            pagar contas e acompanhar recebimentos.
          </p>
        </div>

        <span className={ui.badge.neutral}>{getPermissionLabel(permission)}</span>
      </div>

      {readiness.needs_browser_settings_help && (
        <div className={`mt-4 ${ui.card.warning}`}>
          <p className="text-sm text-amber-800">
            As notificações estão bloqueadas. Ajuste a permissão no navegador ou
            no sistema para voltar a receber lembretes.
          </p>
        </div>
      )}

      {readiness.needs_resubscribe && !readiness.needs_browser_settings_help && (
        <div className={`mt-4 ${ui.card.warning}`}>
          <p className="text-sm text-amber-800">
            A permissão existe, mas este navegador ainda não ficou pronto para
            receber push. Toque para ativar de novo neste dispositivo.
          </p>
        </div>
      )}

      {!publicVapidKey && (
        <div className={`mt-4 ${ui.card.warning}`}>
          <p className="text-sm text-amber-800">
            Falta configurar a chave pública VAPID para habilitar push
            notifications.
          </p>
        </div>
      )}

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

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={preferences.pending_enabled}
            disabled={!readiness.is_notifications_effectively_enabled || saving}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                pending_enabled: event.target.checked,
              }))
            }
          />
          <span className={ui.text.body}>Lançamentos pendentes para revisar</span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={preferences.payables_enabled}
            disabled={!readiness.is_notifications_effectively_enabled || saving}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                payables_enabled: event.target.checked,
              }))
            }
          />
          <span className={ui.text.body}>Contas a pagar vencendo ou vencidas</span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={preferences.receivables_enabled}
            disabled={!readiness.is_notifications_effectively_enabled || saving}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                receivables_enabled: event.target.checked,
              }))
            }
          />
          <span className={ui.text.body}>Valores a receber para acompanhar</span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {!readiness.is_notifications_effectively_enabled ? (
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={saving || !canAttemptEnable}
            className={ui.button.primary}
          >
            {saving
              ? 'Ativando...'
              : readiness.needs_browser_settings_help
                ? 'Bloqueado no navegador'
                : 'Ativar lembretes'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void persistPreferences(preferences)}
              disabled={saving}
              className={ui.button.secondary}
            >
              {saving ? 'Salvando...' : 'Salvar preferências'}
            </button>

            <button
              type="button"
              onClick={handleTestPush}
              disabled={testing || !readiness.can_send_test_notification}
              className={ui.button.secondary}
            >
              {testing ? 'Enviando teste...' : 'Enviar notificação de teste'}
            </button>

            <button
              type="button"
              onClick={handleDisableNotifications}
              disabled={saving}
              className={ui.button.secondary}
            >
              Desativar neste usuário
            </button>
          </>
        )}
      </div>
    </div>
  )
}
