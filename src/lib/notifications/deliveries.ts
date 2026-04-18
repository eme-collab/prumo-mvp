import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationType } from '@/lib/notification-readiness'
import { buildFocusUrl } from '@/lib/notifications/push'

type NotificationDeliveryRow = {
  id: string
  user_id: string
  notification_type: NotificationType
  item_type: string | null
  item_id: string | null
  delivery_scope: string
  delivery_key: string
  sent_at: string
  opened_at: string | null
}

export async function createNotificationDelivery(
  supabase: SupabaseClient,
  input: {
    userId: string
    notificationType: NotificationType
    itemType?: string | null
    itemId?: string | null
    deliveryScope: string
    deliveryKey: string
    payload?: Record<string, unknown>
  }
) {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .insert({
      user_id: input.userId,
      notification_type: input.notificationType,
      item_type: input.itemType ?? null,
      item_id: input.itemId ?? null,
      delivery_scope: input.deliveryScope,
      delivery_key: input.deliveryKey,
      payload: input.payload ?? {},
    })
    .select('id, user_id, notification_type, item_type, item_id, delivery_scope, delivery_key, sent_at, opened_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao registrar entrega da notificação.')
  }

  return data as NotificationDeliveryRow
}

export async function deleteNotificationDelivery(
  supabase: SupabaseClient,
  deliveryId: string
) {
  const { error } = await supabase
    .from('notification_deliveries')
    .delete()
    .eq('id', deliveryId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function markNotificationDeliveryOpened(
  supabase: SupabaseClient,
  input: {
    deliveryId: string
    userId: string
  }
) {
  const openedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('notification_deliveries')
    .update({
      opened_at: openedAt,
    })
    .eq('id', input.deliveryId)
    .eq('user_id', input.userId)
    .is('opened_at', null)
    .select('id, opened_at')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return {
    openedNow: Boolean(data),
    openedAt: data?.opened_at ?? null,
  }
}

export async function getNotificationDeliveryByKey(
  supabase: SupabaseClient,
  deliveryKey: string
) {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .select(
      'id, user_id, notification_type, item_type, item_id, delivery_scope, delivery_key, sent_at, opened_at'
    )
    .eq('delivery_key', deliveryKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as NotificationDeliveryRow | null) ?? null
}

export async function getNotificationDeliveryById(
  supabase: SupabaseClient,
  input: {
    deliveryId: string
    userId: string
  }
) {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .select(
      'id, user_id, notification_type, item_type, item_id, delivery_scope, delivery_key, sent_at, opened_at'
    )
    .eq('id', input.deliveryId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as NotificationDeliveryRow | null) ?? null
}

export async function listItemNotificationDeliveries(
  supabase: SupabaseClient,
  input: {
    userId: string
    notificationType: NotificationType
    itemId: string
  }
) {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .select(
      'id, user_id, notification_type, item_type, item_id, delivery_scope, delivery_key, sent_at, opened_at'
    )
    .eq('user_id', input.userId)
    .eq('notification_type', input.notificationType)
    .eq('item_id', input.itemId)
    .order('sent_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data as NotificationDeliveryRow[] | null) ?? []
}

export function getNotificationOpenedUrl(input: {
  baseUrl: string
  deliveryId: string
  notificationType: NotificationType
}) {
  return buildFocusUrl(input.baseUrl, {
    notificationDeliveryId: input.deliveryId,
    notificationType: input.notificationType,
  })
}
