'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { trackAppEventServer } from '@/lib/app-events-server'
import { buildToastHref } from '@/lib/global-toast'
import {
  getOpenAccountItemType,
  getOpenAccountUrgencyStatus,
  isOpenAccount,
} from '@/lib/pending-state'
import { sanitizeResumoReturnTo } from '@/lib/resumo-navigation'
import { createClient } from '@/lib/supabase/server'

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function deleteResumoEntry(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const id = getString(formData, 'id')
  const returnTo = sanitizeResumoReturnTo(getString(formData, 'return_to'))

  if (!id) {
    redirect(returnTo)
  }

  const { data: entry, error: entryError } = await supabase
    .from('financial_entries')
    .select(
      'id, user_id, review_status, audio_path, entry_type, settlement_status, due_on'
    )
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry || entry.user_id !== user.id || entry.review_status !== 'confirmed') {
    redirect(returnTo)
  }

  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', id)
    .eq('review_status', 'confirmed')

  if (error) {
    throw new Error(error.message)
  }

  if (isOpenAccount(entry.entry_type, entry.review_status, entry.settlement_status)) {
    const itemType = getOpenAccountItemType(entry.entry_type)

    if (itemType) {
      await trackAppEventServer({
        eventName:
          itemType === 'receivable'
            ? 'receivable_marked_resolved'
            : 'payable_marked_resolved',
        userId: user.id,
        properties: {
          source_screen: 'resumo',
          item_type: itemType,
          item_status: getOpenAccountUrgencyStatus(entry.due_on),
          count: 1,
          resolution: 'deleted',
          entry_id: id,
          has_completed_first_capture: true,
        },
      })
    }
  }

  if (entry.audio_path) {
    const { error: storageError } = await supabase.storage
      .from('voice-notes')
      .remove([entry.audio_path])

    if (storageError) {
      console.error('Falha ao remover audio excluido:', storageError.message)
    }
  }

  revalidatePath('/painel')
  revalidatePath('/resumo')
  revalidatePath(`/revisar/${id}`)
  revalidatePath(`/liquidar/${id}`)

  redirect(
    buildToastHref(returnTo, {
      kind: 'entry_deleted',
    })
  )
}
