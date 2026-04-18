'use client'

import type { NotificationPreferencesState } from '@/lib/notification-readiness'
import {
  NOTIFICATION_SOFT_PROMPT_DISMISS_MS,
  type NotificationType,
} from '@/lib/notification-readiness'

export type NotificationPermissionState =
  | NotificationPermission
  | 'unsupported'

export type NotificationApiState = {
  preferences: NotificationPreferencesState
  publicVapidKey: string
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesState = {
  push_enabled: false,
  pending_enabled: true,
  payables_enabled: true,
  receivables_enabled: true,
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; ++index) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}

function getSoftPromptDismissStorageKey(userId: string) {
  return `prumo_notification_soft_prompt_dismissed_until:${userId}`
}

export function isNotificationSupportedInBrowser() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function getBrowserNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupportedInBrowser()) {
    return 'unsupported'
  }

  return Notification.permission
}

export async function getNotificationRegistration() {
  return navigator.serviceWorker.ready
}

export async function getCurrentPushSubscription() {
  if (!isNotificationSupportedInBrowser()) {
    return null
  }

  const registration = await getNotificationRegistration()
  return registration.pushManager.getSubscription()
}

export function isSubscriptionCurrentlyValid(subscription: PushSubscription | null) {
  if (!subscription) {
    return false
  }

  const expirationTime = subscription.expirationTime

  if (expirationTime === null) {
    return true
  }

  return expirationTime > Date.now()
}

export async function fetchNotificationApiState(): Promise<NotificationApiState> {
  const response = await fetch('/api/notifications/preferences', {
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    preferences?: NotificationPreferencesState
    publicVapidKey?: string
  }

  if (!response.ok) {
    throw new Error(
      payload.error || 'Falha ao carregar preferências de notificação.'
    )
  }

  return {
    preferences: payload.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
    publicVapidKey: payload.publicVapidKey ?? '',
  }
}

export async function saveNotificationPreferences(
  nextPreferences: NotificationPreferencesState
) {
  const response = await fetch('/api/notifications/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(nextPreferences),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    preferences?: NotificationPreferencesState
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao salvar preferências.')
  }

  return payload.preferences ?? nextPreferences
}

export async function savePushSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/notifications/subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription.toJSON()),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
    }

    throw new Error(payload.error || 'Falha ao salvar subscription.')
  }
}

export async function deletePushSubscription(endpoint: string) {
  const response = await fetch('/api/notifications/subscription', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint,
    }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
    }

    throw new Error(payload.error || 'Falha ao remover subscription.')
  }
}

export async function ensurePushSubscription(publicVapidKey: string) {
  if (!publicVapidKey) {
    throw new Error('Chave pública VAPID ausente.')
  }

  const registration = await getNotificationRegistration()
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription || !isSubscriptionCurrentlyValid(subscription)) {
    if (subscription) {
      await subscription.unsubscribe().catch(() => undefined)
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
    })
  }

  await savePushSubscription(subscription)
  return subscription
}

export async function requestPermissionAndSubscribe(publicVapidKey: string) {
  const nextPermission = await Notification.requestPermission()

  if (nextPermission !== 'granted') {
    return {
      permission: nextPermission,
      subscription: null,
    }
  }

  const subscription = await ensurePushSubscription(publicVapidKey)

  return {
    permission: nextPermission,
    subscription,
  }
}

export async function disablePushNotificationsForCurrentBrowser() {
  const subscription = await getCurrentPushSubscription()

  if (subscription) {
    await deletePushSubscription(subscription.endpoint)
    await subscription.unsubscribe()
  }
}

export async function sendNotificationTest() {
  const response = await fetch('/api/notifications/test', {
    method: 'POST',
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao enviar notificação de teste.')
  }
}

export async function markNotificationOpened(input: {
  deliveryId: string
  notificationType: NotificationType
  sourceScreen: string
}) {
  const response = await fetch('/api/notifications/opened', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      delivery_id: input.deliveryId,
      notification_type: input.notificationType,
      source_screen: input.sourceScreen,
    }),
    keepalive: true,
    credentials: 'include',
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
    }

    throw new Error(payload.error || 'Falha ao registrar abertura da notificação.')
  }
}

export function getSoftPromptDismissedUntil(userId: string) {
  const rawValue = window.localStorage.getItem(
    getSoftPromptDismissStorageKey(userId)
  )
  const parsedValue = rawValue ? Number(rawValue) : 0

  if (!parsedValue || Number.isNaN(parsedValue)) {
    return 0
  }

  return parsedValue
}

export function dismissNotificationSoftPrompt(userId: string) {
  const dismissedUntil = Date.now() + NOTIFICATION_SOFT_PROMPT_DISMISS_MS

  window.localStorage.setItem(
    getSoftPromptDismissStorageKey(userId),
    String(dismissedUntil)
  )

  return dismissedUntil
}

export function isNotificationSoftPromptDismissed(userId: string) {
  const dismissedUntil = getSoftPromptDismissedUntil(userId)
  return dismissedUntil > Date.now()
}
