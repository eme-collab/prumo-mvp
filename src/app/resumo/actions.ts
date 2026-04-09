'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { buildToastHref } from '@/lib/global-toast'
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
    .select('id, user_id, review_status, audio_path')
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
