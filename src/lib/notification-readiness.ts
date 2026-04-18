import type { NotificationPermissionState } from '@/lib/notifications/client'

export type NotificationType =
  | 'test'
  | 'pending_review'
  | 'receivable_due'
  | 'receivable_overdue'
  | 'payable_due'
  | 'payable_overdue'

export type NotificationPreferencesState = {
  push_enabled: boolean
  pending_enabled: boolean
  payables_enabled: boolean
  receivables_enabled: boolean
}

export type NotificationUsefulItemsState = {
  pendingReviewCount: number
  receivableDueTodayCount: number
  receivableOverdueCount: number
  payableDueTodayCount: number
  payableOverdueCount: number
}

export type NotificationBrowserState = {
  isSupported: boolean
  permission: NotificationPermissionState
  hasSubscription: boolean
  hasValidSubscription: boolean
}

export type NotificationReadinessInput = {
  hasCompletedFirstCapture: boolean
  isZenMode: boolean
  browser: NotificationBrowserState
  preferences: NotificationPreferencesState
  usefulItems: NotificationUsefulItemsState
  isSoftPromptDismissed: boolean
  allowFallbackPrompt?: boolean
}

export type NotificationReadinessState = {
  has_useful_pending_items: boolean
  can_show_soft_prompt: boolean
  can_request_permission_now: boolean
  can_send_test_notification: boolean
  is_notifications_effectively_enabled: boolean
  needs_browser_settings_help: boolean
  needs_resubscribe: boolean
}

export const NOTIFICATION_SOFT_PROMPT_DISMISS_MS = 1000 * 60 * 60 * 24 * 7
export const NOTIFICATION_TYPES: ReadonlyArray<NotificationType> = [
  'test',
  'pending_review',
  'receivable_due',
  'receivable_overdue',
  'payable_due',
  'payable_overdue',
]

export function isNotificationType(
  value: string | null | undefined
): value is NotificationType {
  if (!value) {
    return false
  }

  return NOTIFICATION_TYPES.includes(value as NotificationType)
}

export function createEmptyUsefulItemsState(): NotificationUsefulItemsState {
  return {
    pendingReviewCount: 0,
    receivableDueTodayCount: 0,
    receivableOverdueCount: 0,
    payableDueTodayCount: 0,
    payableOverdueCount: 0,
  }
}

export function hasUsefulPendingItems(usefulItems: NotificationUsefulItemsState) {
  return (
    usefulItems.pendingReviewCount > 0 ||
    usefulItems.receivableDueTodayCount > 0 ||
    usefulItems.receivableOverdueCount > 0 ||
    usefulItems.payableDueTodayCount > 0 ||
    usefulItems.payableOverdueCount > 0
  )
}

export function computeNotificationReadiness(
  input: NotificationReadinessInput
): NotificationReadinessState {
  const hasUsefulItems = hasUsefulPendingItems(input.usefulItems)
  const canAskByTiming =
    !input.isZenMode &&
    input.hasCompletedFirstCapture &&
    (hasUsefulItems || Boolean(input.allowFallbackPrompt))

  const canRequestPermissionNow =
    canAskByTiming &&
    input.browser.isSupported &&
    input.browser.permission === 'default'

  const needsBrowserSettingsHelp =
    canAskByTiming &&
    input.browser.isSupported &&
    input.browser.permission === 'denied'

  const needsResubscribe =
    input.browser.isSupported &&
    input.browser.permission === 'granted' &&
    !input.browser.hasValidSubscription

  const isEffectivelyEnabled =
    input.browser.isSupported &&
    input.browser.permission === 'granted' &&
    input.browser.hasValidSubscription &&
    input.preferences.push_enabled

  return {
    has_useful_pending_items: hasUsefulItems,
    can_show_soft_prompt:
      canAskByTiming &&
      !input.isSoftPromptDismissed &&
      !isEffectivelyEnabled &&
      (input.browser.permission === 'default' || needsResubscribe),
    can_request_permission_now: canRequestPermissionNow,
    can_send_test_notification: isEffectivelyEnabled,
    is_notifications_effectively_enabled: isEffectivelyEnabled,
    needs_browser_settings_help: needsBrowserSettingsHelp,
    needs_resubscribe: needsResubscribe,
  }
}
