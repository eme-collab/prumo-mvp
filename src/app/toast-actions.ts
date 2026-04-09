'use server'

import { revalidatePath } from 'next/cache'
import { buildToastHref, type GlobalToastUndo } from '@/lib/global-toast'
import { createClient } from '@/lib/supabase/server'

export async function undoToastAction(input: {
  undo: GlobalToastUndo
  entryId: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { redirectTo: '/login' }
  }

  const { data: entry, error: entryError } = await supabase
    .from('financial_entries')
    .select('id, review_status, user_id')
    .eq('id', input.entryId)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry || entry.user_id !== user.id) {
    return { redirectTo: '/painel' }
  }

  const expectedReviewStatus =
    input.undo === 'undo_review_confirm' ? 'confirmed' : 'discarded'

  if (input.undo === 'undo_settlement_confirm') {
    const { data: settlementEntry, error: settlementEntryError } = await supabase
      .from('financial_entries')
      .select('id, entry_type, review_status, settlement_status, user_id')
      .eq('id', input.entryId)
      .maybeSingle()

    if (settlementEntryError) {
      throw new Error(settlementEntryError.message)
    }

    if (
      !settlementEntry ||
      settlementEntry.user_id !== user.id ||
      settlementEntry.review_status !== 'confirmed' ||
      settlementEntry.settlement_status !== 'settled' ||
      (settlementEntry.entry_type !== 'sale_due' &&
        settlementEntry.entry_type !== 'expense_due')
    ) {
      return { redirectTo: '/painel' }
    }

    const { error: updateSettlementError } = await supabase
      .from('financial_entries')
      .update({
        settlement_status: 'open',
        settled_on: null,
        settled_amount: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.entryId)
      .eq('settlement_status', 'settled')

    if (updateSettlementError) {
      throw new Error(updateSettlementError.message)
    }

    revalidatePath('/painel')
    revalidatePath('/resumo')
    revalidatePath(`/revisar/${input.entryId}`)
    revalidatePath(`/liquidar/${input.entryId}`)

    return {
      redirectTo: buildToastHref('/painel', {
        kind: 'settlement_reopened',
      }),
    }
  }

  if (entry.review_status !== expectedReviewStatus) {
    return { redirectTo: '/painel' }
  }

  const { error: updateError } = await supabase
    .from('financial_entries')
    .update({
      review_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.entryId)
    .eq('review_status', expectedReviewStatus)

  if (updateError) {
    throw new Error(updateError.message)
  }

  revalidatePath('/painel')
  revalidatePath('/resumo')
  revalidatePath(`/revisar/${input.entryId}`)
  revalidatePath(`/liquidar/${input.entryId}`)

  return {
    redirectTo: buildToastHref(`/revisar/${input.entryId}`, {
      kind: 'entry_reopened',
    }),
  }
}
