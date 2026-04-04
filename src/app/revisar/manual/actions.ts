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

export async function createManualEntry(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const intent = getString(formData, 'intent')

  const entryType = getNullableString(formData, 'entry_type')
  const description = getNullableString(formData, 'description')
  const counterpartyName = getNullableString(formData, 'counterparty_name')
  const amount = getNullableNumber(formData, 'amount')
  const occurredOn = getNullableString(formData, 'occurred_on')
  const dueOn = getNullableString(formData, 'due_on')

  if (intent === 'confirm') {
    if (!entryType) {
      redirect('/revisar/manual?error=missing_type')
    }

    if (amount === null) {
      redirect('/revisar/manual?error=missing_amount')
    }

    const { error } = await supabase.from('financial_entries').insert({
      user_id: user.id,
      source: 'manual',
      review_status: 'confirmed',
      processing_status: 'ready',
      processing_error: null,
      transcript: null,
      audio_path: null,
      entry_type: entryType,
      description,
      counterparty_name: counterpartyName,
      amount,
      occurred_on: occurredOn,
      due_on: dueOn,
      ...getSettlementFieldsForEntryType(entryType),
    })

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/painel')
    revalidatePath('/resumo')
    redirect('/painel?notice=manual_confirmed')
  }

  if (intent === 'pending') {
    const { error } = await supabase.from('financial_entries').insert({
      user_id: user.id,
      source: 'manual',
      review_status: 'pending',
      processing_status: 'ready',
      processing_error: null,
      transcript: null,
      audio_path: null,
      entry_type: entryType,
      description,
      counterparty_name: counterpartyName,
      amount,
      occurred_on: occurredOn,
      due_on: dueOn,
      ...getSettlementFieldsForEntryType(entryType),
    })

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/painel')
    revalidatePath('/resumo')
    redirect('/painel?notice=manual_pending')
  }

  redirect('/painel')
}