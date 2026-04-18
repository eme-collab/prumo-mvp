import type { PendingItemType, PendingUrgencyStatus } from '@/lib/pending-state'

export const APP_EVENT_NAMES = [
  'login_started',
  'login_completed',
  'zen_mode_viewed',
  'first_record_started',
  'first_record_completed',
  'first_review_viewed',
  'first_record_confirmed',
  'zen_mode_completed',
  'record_started',
  'record_completed',
  'record_confirmed',
  'opened_pending_review_card',
  'opened_open_accounts_card',
  'viewed_summary_page',
  'pending_review_resolved',
  'receivable_marked_resolved',
  'payable_marked_resolved',
  'notification_soft_prompt_viewed',
  'notification_permission_requested',
  'notification_permission_accepted',
  'notification_permission_denied',
  'notification_test_sent',
  'notification_sent_pending_review',
  'notification_sent_receivable_due',
  'notification_sent_receivable_overdue',
  'notification_sent_payable_due',
  'notification_sent_payable_overdue',
  'notification_opened',
] as const

export type AppEventName = (typeof APP_EVENT_NAMES)[number]

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonPrimitive[]

export type AppEventProperties = {
  source_screen?:
    | 'login'
    | 'painel'
    | 'revisar'
    | 'revisar_manual'
    | 'resumo'
    | 'liquidar'
    | 'notifications'
    | 'auth_callback'
  item_type?: PendingItemType
  item_status?: PendingUrgencyStatus
  notification_type?:
    | 'test'
    | 'pending_review'
    | 'receivable_due'
    | 'receivable_overdue'
    | 'payable_due'
    | 'payable_overdue'
  notification_permission_status?:
    | 'default'
    | 'granted'
    | 'denied'
    | 'unsupported'
  delivery_id?: string
  count?: number
  entry_id?: string
  focus?: string
  month?: string
  resolution?: 'confirmed' | 'discarded' | 'settled' | 'edited' | 'deleted'
  has_completed_first_capture?: boolean
  is_first_session?: boolean
  is_pwa_installed?: boolean
  [key: string]: JsonValue | undefined
}

export type AppEventInsert = {
  user_id: string | null
  session_id: string
  event_name: AppEventName
  properties: Record<string, JsonValue>
}

export const APP_EVENT_ROUTE = '/api/app-events'
export const APP_EVENT_SESSION_COOKIE = 'prumo_app_session'
export const APP_EVENT_FIRST_SESSION_COOKIE = 'prumo_app_first_session_seen'

export function isAppEventName(value: string): value is AppEventName {
  return APP_EVENT_NAMES.includes(value as AppEventName)
}

export function createAppSessionId() {
  return crypto.randomUUID()
}

export function sanitizeAppEventProperties(
  properties?: AppEventProperties
): Record<string, JsonValue> {
  if (!properties) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  ) as Record<string, JsonValue>
}

export function serializeAppEvent(input: {
  eventName: AppEventName
  sessionId: string
  properties?: AppEventProperties
}) {
  return JSON.stringify({
    event_name: input.eventName,
    session_id: input.sessionId,
    properties: sanitizeAppEventProperties(input.properties),
  })
}

export function isPwaInstalledInBrowser() {
  if (typeof window === 'undefined') {
    return undefined
  }

  const standaloneMatch = window.matchMedia?.('(display-mode: standalone)').matches
  const iosStandalone =
    typeof navigator !== 'undefined' &&
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  return Boolean(standaloneMatch || iosStandalone)
}
