import { NextResponse } from 'next/server'
import { createAppSessionId } from '@/lib/app-events'
import { insertAppEventRecord } from '@/lib/app-events-server'
import {
  createNotificationDelivery,
  deleteNotificationDelivery,
  getNotificationOpenedUrl,
} from '@/lib/notifications/deliveries'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushMessageToUser } from '@/lib/notifications/push'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const delivery = await createNotificationDelivery(admin, {
    userId: user.id,
    notificationType: 'test',
    deliveryScope: 'test',
    deliveryKey: `test:${user.id}:${Date.now()}`,
    payload: {
      source: 'manual_test',
    },
  })

  const { sentCount } = await sendPushMessageToUser(
    admin,
    user.id,
    {
      title: 'Prumo',
      body: 'Notificações ativas. Quando houver ação útil, o Prumo vai te chamar de volta.',
      url: getNotificationOpenedUrl({
        baseUrl: '/resumo',
        deliveryId: delivery.id,
        notificationType: 'test',
      }),
      tag: 'prumo-test',
      notificationType: 'test',
      deliveryId: delivery.id,
    },
    {
      markTestSent: true,
    }
  )

  if (sentCount === 0) {
    await deleteNotificationDelivery(admin, delivery.id)
    return NextResponse.json(
      { error: 'Nenhuma subscription ativa encontrada para este usuário.' },
      { status: 400 }
    )
  }

  await insertAppEventRecord({
    user_id: user.id,
    session_id: createAppSessionId(),
    event_name: 'notification_test_sent',
    properties: {
      source_screen: 'notifications',
      notification_type: 'test',
      delivery_id: delivery.id,
    },
  })

  return NextResponse.json({ success: true, sentCount })
}
