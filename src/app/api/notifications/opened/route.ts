import { NextResponse } from 'next/server'
import { createAppSessionId, isAppEventName } from '@/lib/app-events'
import { insertAppEventRecord } from '@/lib/app-events-server'
import {
  getNotificationDeliveryById,
  markNotificationDeliveryOpened,
} from '@/lib/notifications/deliveries'
import { isNotificationType, type NotificationType } from '@/lib/notification-readiness'
import { createClient } from '@/lib/supabase/server'

type OpenedBody = {
  delivery_id?: string
  notification_type?: NotificationType
  source_screen?: string
}

const NOTIFICATION_OPEN_EVENT = 'notification_opened'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as OpenedBody

  if (!body.delivery_id || !isNotificationType(body.notification_type)) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const delivery = await getNotificationDeliveryById(supabase, {
    deliveryId: body.delivery_id,
    userId: user.id,
  })

  if (!delivery) {
    return NextResponse.json({ error: 'Entrega não encontrada.' }, { status: 404 })
  }

  const { openedNow, openedAt } = await markNotificationDeliveryOpened(supabase, {
    deliveryId: body.delivery_id,
    userId: user.id,
  })

  if (openedNow && isAppEventName(NOTIFICATION_OPEN_EVENT)) {
    await insertAppEventRecord({
      user_id: user.id,
      session_id: createAppSessionId(),
      event_name: NOTIFICATION_OPEN_EVENT,
      properties: {
        notification_type: delivery.notification_type,
        source_screen: body.source_screen ?? 'painel',
        delivery_id: body.delivery_id,
        item_type: delivery.item_type,
        entry_id: delivery.item_id,
      },
    })
  }

  return NextResponse.json({
    success: true,
    openedNow,
    openedAt: openedAt ?? delivery.opened_at,
    notificationType: delivery.notification_type,
  })
}
