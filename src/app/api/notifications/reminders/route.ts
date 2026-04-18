import { NextResponse } from 'next/server'
import { createAppSessionId } from '@/lib/app-events'
import { insertAppEventRecord } from '@/lib/app-events-server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createNotificationDelivery,
  deleteNotificationDelivery,
  getNotificationDeliveryByKey,
  getNotificationOpenedUrl,
  listItemNotificationDeliveries,
} from '@/lib/notifications/deliveries'
import {
  getBrazilDateTimeParts,
  sendPushMessageToUser,
  type NotificationPreferences,
} from '@/lib/notifications/push'
import {
  buildUsefulPendingItemsState,
  getTodayInBrazil,
  getOpenAccountUrgencyStatus,
} from '@/lib/pending-state'
import type { NotificationType } from '@/lib/notification-readiness'

type ReminderPreferenceRow = NotificationPreferences & {
  user_id: string
}

type PendingReminderEntry = {
  id: string
  created_at: string
  processing_status: string | null
  review_status: string | null
}

type OpenReminderEntry = {
  id: string
  entry_type: 'sale_due' | 'expense_due'
  review_status: string | null
  settlement_status: string | null
  due_on: string | null
}

async function listPendingReviews(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const { data, error } = await supabase
    .from('financial_entries')
    .select('id, created_at, processing_status, review_status')
    .eq('user_id', userId)
    .eq('review_status', 'pending')
    .in('processing_status', ['ready', 'failed'])

  if (error) {
    throw new Error(error.message)
  }

  return (data as PendingReminderEntry[] | null) ?? []
}

async function listOpenAccounts(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  entryType: 'sale_due' | 'expense_due'
) {
  const { data, error } = await supabase
    .from('financial_entries')
    .select('id, entry_type, review_status, settlement_status, due_on')
    .eq('user_id', userId)
    .eq('review_status', 'confirmed')
    .eq('entry_type', entryType)
    .eq('settlement_status', 'open')
    .not('due_on', 'is', null)
    .order('due_on', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data as OpenReminderEntry[] | null) ?? []
}

function createReminderBody(input: {
  notificationType: NotificationType
  count?: number
}) {
  switch (input.notificationType) {
    case 'pending_review':
      return input.count === 1
        ? 'Você deixou 1 lançamento para revisar'
        : `Você tem ${input.count ?? 0} lançamentos para revisar`
    case 'receivable_due':
      return 'Hoje vence um valor que você tem para receber'
    case 'receivable_overdue':
      return 'Você tem valor vencido para acompanhar'
    case 'payable_due':
      return 'Hoje vence uma conta para pagar'
    case 'payable_overdue':
      return 'Você tem conta vencida no Prumo'
    default:
      return 'Prumo'
  }
}

function createReminderEventName(notificationType: NotificationType) {
  switch (notificationType) {
    case 'pending_review':
      return 'notification_sent_pending_review'
    case 'receivable_due':
      return 'notification_sent_receivable_due'
    case 'receivable_overdue':
      return 'notification_sent_receivable_overdue'
    case 'payable_due':
      return 'notification_sent_payable_due'
    case 'payable_overdue':
      return 'notification_sent_payable_overdue'
    default:
      return null
  }
}

async function recordNotificationSentEvent(input: {
  userId: string
  eventName: ReturnType<typeof createReminderEventName>
  notificationType: NotificationType
  count?: number
  itemType?: string
  itemStatus?: string
  itemId?: string
  deliveryId: string
}) {
  if (!input.eventName) {
    return
  }

  await insertAppEventRecord({
    user_id: input.userId,
    session_id: createAppSessionId(),
    event_name: input.eventName,
    properties: {
      source_screen: 'notifications',
      notification_type: input.notificationType,
      item_type: input.itemType ?? null,
      item_status: input.itemStatus ?? null,
      count: input.count ?? null,
      entry_id: input.itemId ?? null,
      delivery_id: input.deliveryId,
    },
  })
}

function getDaysBetween(dateA: string, dateB: string) {
  const a = Date.parse(`${dateA}T00:00:00.000Z`)
  const b = Date.parse(`${dateB}T00:00:00.000Z`)
  return Math.floor((a - b) / (1000 * 60 * 60 * 24))
}

async function sendPendingReviewReminder(
  supabase: ReturnType<typeof createAdminClient>,
  preference: ReminderPreferenceRow,
  today: string
) {
  const pendingEntries = await listPendingReviews(supabase, preference.user_id)
  const usefulState = buildUsefulPendingItemsState({
    pendingEntries,
    openAccountEntries: [],
  })
  const pendingCount = usefulState.pendingReviewEntries.length

  if (pendingCount === 0) {
    return null
  }

  const deliveryKey = `pending_review:${preference.user_id}:${today}`
  const existingDelivery = await getNotificationDeliveryByKey(supabase, deliveryKey)

  if (existingDelivery) {
    return null
  }

  const firstEntry = usefulState.pendingReviewEntries[0] ?? null
  const baseUrl =
    pendingCount === 1 && firstEntry
      ? `/revisar/${firstEntry.id}`
      : '/painel?focus=pending_review'
  const delivery = await createNotificationDelivery(supabase, {
    userId: preference.user_id,
    notificationType: 'pending_review',
    itemType: 'pending_review',
    itemId: pendingCount === 1 ? firstEntry?.id ?? null : null,
    deliveryScope: 'aggregate_pending_review',
    deliveryKey,
    payload: {
      count: pendingCount,
    },
  })

  const result = await sendPushMessageToUser(
    supabase,
    preference.user_id,
    {
      title: 'Prumo',
      body: createReminderBody({
        notificationType: 'pending_review',
        count: pendingCount,
      }),
      url: getNotificationOpenedUrl({
        baseUrl,
        deliveryId: delivery.id,
        notificationType: 'pending_review',
      }),
      tag: 'prumo-pending-review',
      notificationType: 'pending_review',
      itemType: 'pending_review',
      deliveryId: delivery.id,
    },
    { markReminderSent: true }
  )

  if (result.sentCount === 0) {
    await deleteNotificationDelivery(supabase, delivery.id)
    return null
  }

  await recordNotificationSentEvent({
    userId: preference.user_id,
    eventName: createReminderEventName('pending_review'),
    notificationType: 'pending_review',
    count: pendingCount,
    itemType: 'pending_review',
    deliveryId: delivery.id,
  })

  return { deliveryId: delivery.id, type: 'pending_review' as const }
}

async function sendOpenAccountReminder(
  supabase: ReturnType<typeof createAdminClient>,
  preference: ReminderPreferenceRow,
  entry: OpenReminderEntry,
  notificationType: NotificationType,
  itemType: 'receivable' | 'payable',
  itemStatus: 'due_today' | 'overdue',
  today: string
) {
  const deliveryKey = `${notificationType}:${entry.id}:${today}`

  const existingDelivery = await getNotificationDeliveryByKey(supabase, deliveryKey)

  if (existingDelivery) {
    return null
  }

  if (itemStatus === 'overdue') {
    const previousOverdueDeliveries = await listItemNotificationDeliveries(supabase, {
      userId: preference.user_id,
      notificationType,
      itemId: entry.id,
    })

    if (previousOverdueDeliveries.length >= 3) {
      return null
    }

    const lastOverdueDelivery = previousOverdueDeliveries[0] ?? null

    if (lastOverdueDelivery) {
      const daysSinceLastDelivery = getDaysBetween(
        today,
        lastOverdueDelivery.sent_at.slice(0, 10)
      )

      if (daysSinceLastDelivery < 3) {
        return null
      }
    } else {
      const daysOverdue = getDaysBetween(today, entry.due_on ?? today)

      if (daysOverdue < 1) {
        return null
      }
    }
  }

  const delivery = await createNotificationDelivery(supabase, {
    userId: preference.user_id,
    notificationType,
    itemType,
    itemId: entry.id,
    deliveryScope: 'item',
    deliveryKey,
    payload: {
      due_on: entry.due_on,
      item_status: itemStatus,
    },
  })

  const result = await sendPushMessageToUser(
    supabase,
    preference.user_id,
    {
      title: 'Prumo',
      body: createReminderBody({
        notificationType,
      }),
      url: getNotificationOpenedUrl({
        baseUrl: `/liquidar/${entry.id}`,
        deliveryId: delivery.id,
        notificationType,
      }),
      tag: `prumo-${notificationType}`,
      notificationType,
      itemType,
      itemStatus,
      itemId: entry.id,
      deliveryId: delivery.id,
    },
    { markReminderSent: true }
  )

  if (result.sentCount === 0) {
    await deleteNotificationDelivery(supabase, delivery.id)
    return null
  }

  await recordNotificationSentEvent({
    userId: preference.user_id,
    eventName: createReminderEventName(notificationType),
    notificationType,
    itemType,
    itemStatus,
    itemId: entry.id,
    deliveryId: delivery.id,
  })

  return { deliveryId: delivery.id, type: notificationType }
}

export async function POST(request: Request) {
  const cronSecret = process.env.NOTIFICATIONS_CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const providedSecret =
    request.headers.get('x-cron-secret') ||
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = getTodayInBrazil()
  const timeParts = getBrazilDateTimeParts()
  const currentHour = Number(timeParts.hour ?? '0')
  const isPreferredMorningWindow = currentHour >= 8 && currentHour < 10

  const { data: preferences, error } = await supabase
    .from('notification_preferences')
    .select(
      'user_id, push_enabled, pending_enabled, payables_enabled, receivables_enabled, last_pending_reminded_on, last_payables_reminded_on, last_receivables_reminded_on'
    )
    .eq('push_enabled', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sent: Array<{ user_id: string; type: string; delivery_id: string }> = []

  for (const preference of (preferences ?? []) as ReminderPreferenceRow[]) {
    const updates: Record<string, string> = {}

    if (
      preference.pending_enabled &&
      preference.last_pending_reminded_on !== today
    ) {
      const pendingResult = await sendPendingReviewReminder(
        supabase,
        preference,
        today
      )

      if (pendingResult) {
        updates.last_pending_reminded_on = today
        sent.push({
          user_id: preference.user_id,
          type: pendingResult.type,
          delivery_id: pendingResult.deliveryId,
        })
      }
    }

    const receivableEntries = preference.receivables_enabled
      ? await listOpenAccounts(supabase, preference.user_id, 'sale_due')
      : []
    const payableEntries = preference.payables_enabled
      ? await listOpenAccounts(supabase, preference.user_id, 'expense_due')
      : []

    if (preference.receivables_enabled) {
      for (const entry of receivableEntries) {
        const itemStatus = getOpenAccountUrgencyStatus(entry.due_on, today)

        if (itemStatus === 'normal') {
          continue
        }

        if (itemStatus === 'due_today' && !isPreferredMorningWindow) {
          continue
        }

        const result = await sendOpenAccountReminder(
          supabase,
          preference,
          entry,
          itemStatus === 'due_today' ? 'receivable_due' : 'receivable_overdue',
          'receivable',
          itemStatus,
          today
        )

        if (result) {
          updates.last_receivables_reminded_on = today
          sent.push({
            user_id: preference.user_id,
            type: result.type,
            delivery_id: result.deliveryId,
          })
        }
      }
    }

    if (preference.payables_enabled) {
      for (const entry of payableEntries) {
        const itemStatus = getOpenAccountUrgencyStatus(entry.due_on, today)

        if (itemStatus === 'normal') {
          continue
        }

        if (itemStatus === 'due_today' && !isPreferredMorningWindow) {
          continue
        }

        const result = await sendOpenAccountReminder(
          supabase,
          preference,
          entry,
          itemStatus === 'due_today' ? 'payable_due' : 'payable_overdue',
          'payable',
          itemStatus,
          today
        )

        if (result) {
          updates.last_payables_reminded_on = today
          sent.push({
            user_id: preference.user_id,
            type: result.type,
            delivery_id: result.deliveryId,
          })
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('notification_preferences')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', preference.user_id)
    }
  }

  return NextResponse.json({
    success: true,
    processedUsers: preferences?.length ?? 0,
    sent,
  })
}
