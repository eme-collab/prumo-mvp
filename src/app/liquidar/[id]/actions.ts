'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key)
  return value ? value : null
}

function getNullableNumber(formData: FormData, key: string) {
  const raw = getString(formData, key).replace(',', '.')
  if (!raw) return null

  const parsed = Number(raw)

  if (Number.isNaN(parsed)) {
    return null
  }

  return parsed
}

export async function settleEntry(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const id = getString(formData, 'id')
  const description = getNullableString(formData, 'description')
  const counterpartyName = getNullableString(formData, 'counterparty_name')
  const amount = getNullableNumber(formData, 'amount')
  const dueOn = getNullableString(formData, 'due_on')
  const settledOn = getNullableString(formData, 'settled_on')
  const settledAmount = getNullableNumber(formData, 'settled_amount')

  if (!id) {
    redirect('/painel')
  }

  if (!settledOn) {
    redirect(`/liquidar/${id}?error=missing_settled_on`)
  }

  if (settledAmount === null) {
    redirect(`/liquidar/${id}?error=missing_settled_amount`)
  }

  const { data: entry, error: entryError } = await supabase
    .from('financial_entries')
    .select('id, user_id, entry_type, review_status')
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry || entry.user_id !== user.id) {
    redirect('/painel')
  }

  if (
    entry.review_status !== 'confirmed' ||
    (entry.entry_type !== 'sale_due' && entry.entry_type !== 'expense_due')
  ) {
    redirect('/painel')
  }

  const { error } = await supabase
    .from('financial_entries')
    .update({
      description,
      counterparty_name: counterpartyName,
      amount,
      due_on: dueOn,
      settlement_status: 'settled',
      settled_on: settledOn,
      settled_amount: settledAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/painel')
  revalidatePath('/resumo')
  revalidatePath(`/liquidar/${id}`)

  redirect('/painel?notice=settled_done')
}