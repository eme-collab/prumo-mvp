'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

async function getNextPendingEntryId(currentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('financial_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('review_status', 'pending')
    .neq('id', currentId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data?.id ?? null
}

export async function submitReview(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const id = getString(formData, 'id')
  const intent = getString(formData, 'intent')

  if (!id) {
    redirect('/painel')
  }

  const transcript = getNullableString(formData, 'transcript')
  const entryType = getNullableString(formData, 'entry_type')
  const description = getNullableString(formData, 'description')
  const counterpartyName = getNullableString(formData, 'counterparty_name')
  const amount = getNullableNumber(formData, 'amount')
  const occurredOn = getNullableString(formData, 'occurred_on')
  const dueOn = getNullableString(formData, 'due_on')

  if (intent === 'discard') {
    const { error } = await supabase
      .from('financial_entries')
      .update({
        review_status: 'discarded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('review_status', 'pending')

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/painel')
    revalidatePath('/resumo')

    const nextId = await getNextPendingEntryId(id)

    if (nextId) {
      redirect(`/revisar/${nextId}?notice=discarded_next`)
    }

    redirect('/painel?notice=discarded_done')
  }

  if (intent === 'confirm') {
    if (!entryType) {
      redirect(`/revisar/${id}?error=missing_type`)
    }

    if (amount === null) {
      redirect(`/revisar/${id}?error=missing_amount`)
    }

    const { error } = await supabase
      .from('financial_entries')
      .update({
        transcript,
        entry_type: entryType,
        description,
        counterparty_name: counterpartyName,
        amount,
        occurred_on: occurredOn,
        due_on: dueOn,
        ...getSettlementFieldsForEntryType(entryType),
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

    const nextId = await getNextPendingEntryId(id)

    if (nextId) {
      redirect(`/revisar/${nextId}?notice=confirmed_next`)
    }

    redirect('/painel?notice=confirmed_done')
  }

  const { error } = await supabase
    .from('financial_entries')
    .update({
      transcript,
      entry_type: entryType,
      description,
      counterparty_name: counterpartyName,
      amount,
      occurred_on: occurredOn,
      due_on: dueOn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('review_status', 'pending')

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/painel')
  revalidatePath(`/revisar/${id}`)
  redirect(`/revisar/${id}?notice=saved`)
}