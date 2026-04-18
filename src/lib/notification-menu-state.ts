import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildUsefulPendingItemsState,
  OPEN_ACCOUNT_SELECT,
  PENDING_REVIEW_SELECT,
} from '@/lib/pending-state'
import type { NotificationUsefulItemsState } from '@/lib/notification-readiness'

export async function getNotificationUsefulItemsState(
  supabase: SupabaseClient,
  userId: string
): Promise<NotificationUsefulItemsState> {
  const [pendingResult, openAccountsResult] = await Promise.all([
    supabase
      .from('financial_entries')
      .select(PENDING_REVIEW_SELECT)
      .eq('user_id', userId)
      .eq('review_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('financial_entries')
      .select(OPEN_ACCOUNT_SELECT)
      .eq('user_id', userId)
      .eq('review_status', 'confirmed')
      .eq('settlement_status', 'open')
      .in('entry_type', ['sale_due', 'expense_due'])
      .order('due_on', { ascending: true })
      .limit(100),
  ])

  if (pendingResult.error) {
    throw new Error(pendingResult.error.message)
  }

  if (openAccountsResult.error) {
    throw new Error(openAccountsResult.error.message)
  }

  const usefulItems = buildUsefulPendingItemsState({
    pendingEntries: pendingResult.data ?? [],
    openAccountEntries: openAccountsResult.data ?? [],
  })

  return {
    pendingReviewCount: usefulItems.pendingReviewEntries.length,
    receivableDueTodayCount: usefulItems.receivableDueTodayEntries.length,
    receivableOverdueCount: usefulItems.receivableOverdueEntries.length,
    payableDueTodayCount: usefulItems.payableDueTodayEntries.length,
    payableOverdueCount: usefulItems.payableOverdueEntries.length,
  }
}
