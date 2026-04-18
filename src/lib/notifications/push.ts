import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationType } from '@/lib/notification-readiness'
import webpush from 'web-push'

export type NotificationPreferences = {
  push_enabled: boolean
  pending_enabled: boolean
  payables_enabled: boolean
  receivables_enabled: boolean
  last_pending_reminded_on: string | null
  last_payables_reminded_on: string | null
  last_receivables_reminded_on: string | null
}

export type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  expiration_time: number | null
  enabled: boolean
}

export type PushMessage = {
  title: string
  body: string
  url: string
  tag: string
  notificationType?: NotificationType
  itemType?: string
  itemStatus?: string
  itemId?: string
  deliveryId?: string
}

export const defaultNotificationPreferences: NotificationPreferences = {
  push_enabled: false,
  pending_enabled: true,
  payables_enabled: true,
  receivables_enabled: true,
  last_pending_reminded_on: null,
  last_payables_reminded_on: null,
  last_receivables_reminded_on: null,
}

let webPushConfigured = false

function ensureWebPushConfigured() {
  if (webPushConfigured) {
    return
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const contactEmail = process.env.WEB_PUSH_CONTACT_EMAIL

  if (!publicKey || !privateKey || !contactEmail) {
    throw new Error(
      'Variáveis NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e WEB_PUSH_CONTACT_EMAIL são obrigatórias para push notifications.'
    )
  }

  webpush.setVapidDetails(`mailto:${contactEmail}`, publicKey, privateKey)
  webPushConfigured = true
}

export function getTodayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function getBrazilDateTimeParts(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((accumulator, part) => {
      if (part.type !== 'literal') {
        accumulator[part.type] = part.value
      }

      return accumulator
    }, {})
}

export function getTomorrowInSaoPaulo() {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + 1)

  return getTodayInSaoPaulo(now)
}

export function buildFocusUrl(
  href: string,
  options?: {
    notificationDeliveryId?: string
    notificationType?: NotificationType
  }
) {
  const [pathname, rawSearch = ''] = href.split('?')
  const searchParams = new URLSearchParams(rawSearch)

  if (options?.notificationDeliveryId) {
    searchParams.set('notification_delivery', options.notificationDeliveryId)
  }

  if (options?.notificationType) {
    searchParams.set('notification_type', options.notificationType)
  }

  const nextSearch = searchParams.toString()
  return nextSearch ? `${pathname}?${nextSearch}` : pathname
}

function getPushSubscriptionPayload(subscription: PushSubscriptionRow) {
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expiration_time,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  }
}

export async function sendPushMessageToUser(
  supabase: SupabaseClient,
  userId: string,
  message: PushMessage,
  metadata?: {
    markTestSent?: boolean
    markReminderSent?: boolean
  }
) {
  ensureWebPushConfigured()

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, expiration_time, enabled')
    .eq('user_id', userId)
    .eq('enabled', true)

  if (error) {
    throw new Error(error.message)
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sentCount: 0 }
  }

  const deliveredIds: string[] = []
  const expiredIds: string[] = []

  await Promise.all(
    (subscriptions as PushSubscriptionRow[]).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          getPushSubscriptionPayload(subscription),
          JSON.stringify({
            title: message.title,
            body: message.body,
            url: message.url,
            tag: message.tag,
            notificationType: message.notificationType,
            itemType: message.itemType,
            itemStatus: message.itemStatus,
            itemId: message.itemId,
            deliveryId: message.deliveryId,
          })
        )

        deliveredIds.push(subscription.id)
      } catch (error) {
        const statusCode =
          typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          typeof error.statusCode === 'number'
            ? error.statusCode
            : null

        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(subscription.id)
          return
        }

        console.error('Falha ao enviar push notification:', error)
      }
    })
  )

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }

  if (deliveredIds.length > 0) {
    const updates: Record<string, string> = {
      updated_at: new Date().toISOString(),
    }

    if (metadata?.markTestSent) {
      updates.last_test_sent_at = new Date().toISOString()
    }

    if (metadata?.markReminderSent) {
      updates.last_reminder_sent_at = new Date().toISOString()
    }

    await supabase
      .from('push_subscriptions')
      .update(updates)
      .in('id', deliveredIds)
  }

  return { sentCount: deliveredIds.length }
}
