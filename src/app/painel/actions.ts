'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { buildToastHref } from '@/lib/global-toast'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getSettlementFieldsForEntryType(entryType: string | null) {
  if (entryType === 'sale_due' || entryType === 'expense_due') {
    return {
      settlement_status: 'open' as const,
      settled_on: null,
      settled_amount: null,
    }
  }

  return {
    settlement_status: null,
    settled_on: null,
    settled_amount: null,
  }
}

function getTodayInSaoPaulo() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(new Date())
}

function canQuickConfirmEntry(entry: {
  review_status: string | null
  processing_status: string | null
  source: string | null
  transcript: string | null
  entry_type: string | null
  amount: number | null
}) {
  return (
    entry.review_status === 'pending' &&
    entry.processing_status === 'ready' &&
    entry.source === 'voice' &&
    !!entry.transcript &&
    !!entry.entry_type &&
    entry.amount !== null
  )
}

export async function quickConfirmPendingEntry(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const id = getString(formData, 'id')

  if (!id) {
    redirect('/painel')
  }

  const { data: entry, error: entryError } = await supabase
    .from('financial_entries')
    .select(
      'id, user_id, source, review_status, processing_status, transcript, entry_type, amount'
    )
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry || entry.user_id !== user.id || !canQuickConfirmEntry(entry)) {
    redirect('/painel')
  }

  const { error } = await supabase
    .from('financial_entries')
    .update({
      ...getSettlementFieldsForEntryType(entry.entry_type),
      review_status: 'confirmed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('review_status', 'pending')

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/painel')
  revalidatePath('/resumo')
  revalidatePath(`/revisar/${id}`)
  revalidatePath(`/liquidar/${id}`)

  redirect(
    buildToastHref('/painel', {
      kind: 'entry_confirmed',
      undo: 'undo_review_confirm',
      entryId: id,
    })
  )
}

function canQuickSettleEntry(entry: {
  review_status: string | null
  settlement_status: string | null
  entry_type: string | null
  amount: number | null
}) {
  return (
    entry.review_status === 'confirmed' &&
    entry.settlement_status === 'open' &&
    (entry.entry_type === 'sale_due' || entry.entry_type === 'expense_due') &&
    entry.amount !== null
  )
}

export async function quickSettleOpenAccount(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const id = getString(formData, 'id')

  if (!id) {
    redirect('/painel')
  }

  const { data: entry, error: entryError } = await supabase
    .from('financial_entries')
    .select('id, user_id, review_status, settlement_status, entry_type, amount')
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry || entry.user_id !== user.id || !canQuickSettleEntry(entry)) {
    redirect('/painel')
  }

  const today = getTodayInSaoPaulo()

  const { error } = await supabase
    .from('financial_entries')
    .update({
      settlement_status: 'settled',
      settled_on: today,
      settled_amount: entry.amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('settlement_status', 'open')

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/painel')
  revalidatePath('/resumo')
  revalidatePath(`/revisar/${id}`)
  revalidatePath(`/liquidar/${id}`)

  redirect(
    buildToastHref('/painel', {
      kind: entry.entry_type === 'sale_due' ? 'receipt_confirmed' : 'payment_confirmed',
      undo: 'undo_settlement_confirm',
      entryId: id,
    })
  )
}
