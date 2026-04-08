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
