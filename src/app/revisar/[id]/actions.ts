'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  buildToastHref,
  type GlobalToastKind,
  type GlobalToastUndo,
} from '@/lib/global-toast'
import { sanitizeResumoReturnTo } from '@/lib/resumo-navigation'
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

function getEditSettlementFields(input: {
  entryType: string | null
  currentSettlementStatus: string | null
  settledOn: string | null
  settledAmount: number | null
}) {
  if (input.entryType === 'sale_due' || input.entryType === 'expense_due') {
    if (input.currentSettlementStatus === 'settled') {
      return {
        settlement_status: 'settled' as const,
        settled_on: input.settledOn,
        settled_amount: input.settledAmount,
      }
    }

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

async function redirectToNextPendingOrPanel(input: {
  currentId: string
  toastKind: GlobalToastKind
  undo?: GlobalToastUndo
  entryId?: string
}) {
  const nextId = await getNextPendingEntryId(input.currentId)

  if (nextId) {
    redirect(
      buildToastHref(`/revisar/${nextId}`, {
        kind: input.toastKind,
        undo: input.undo,
        entryId: input.entryId,
      })
    )
  }

  redirect(
    buildToastHref('/painel', {
      kind: input.toastKind,
      undo: input.undo,
      entryId: input.entryId,
    })
  )
}

function buildReviewEditErrorHref(input: {
  id: string
  returnTo: string
  error: string
}) {
  return `/revisar/${input.id}?mode=edit&returnTo=${encodeURIComponent(
    input.returnTo
  )}&error=${input.error}`
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
    await redirectToNextPendingOrPanel({
      currentId: id,
      toastKind: 'entry_discarded',
      undo: 'undo_review_discard',
      entryId: id,
    })
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
    revalidatePath(`/liquidar/${id}`)
    await redirectToNextPendingOrPanel({
      currentId: id,
      toastKind: 'entry_confirmed',
      undo: 'undo_review_confirm',
      entryId: id,
    })
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
  await redirectToNextPendingOrPanel({
    currentId: id,
    toastKind: 'entry_saved',
  })
}

export async function submitEntryEdit(formData: FormData) {
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

  const transcript = getNullableString(formData, 'transcript')
  const entryType = getNullableString(formData, 'entry_type')
  const description = getNullableString(formData, 'description')
  const counterpartyName = getNullableString(formData, 'counterparty_name')
  const amount = getNullableNumber(formData, 'amount')
  const occurredOn = getNullableString(formData, 'occurred_on')
  const dueOn = getNullableString(formData, 'due_on')
  const settledOn = getNullableString(formData, 'settled_on')
  const settledAmount = getNullableNumber(formData, 'settled_amount')

  const { data: entry, error: entryError } = await supabase
    .from('financial_entries')
    .select('id, user_id, review_status, settlement_status')
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry || entry.user_id !== user.id || entry.review_status !== 'confirmed') {
    redirect(returnTo)
  }

  if (!entryType) {
    redirect(
      buildReviewEditErrorHref({
        id,
        returnTo,
        error: 'missing_type',
      })
    )
  }

  if (amount === null) {
    redirect(
      buildReviewEditErrorHref({
        id,
        returnTo,
        error: 'missing_amount',
      })
    )
  }

  if (
    entry.settlement_status === 'settled' &&
    (entryType === 'sale_due' || entryType === 'expense_due')
  ) {
    if (!settledOn) {
      redirect(
        buildReviewEditErrorHref({
          id,
          returnTo,
          error: 'missing_settled_on',
        })
      )
    }

    if (settledAmount === null) {
      redirect(
        buildReviewEditErrorHref({
          id,
          returnTo,
          error: 'missing_settled_amount',
        })
      )
    }
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
      ...getEditSettlementFields({
        entryType,
        currentSettlementStatus: entry.settlement_status,
        settledOn,
        settledAmount,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('review_status', 'confirmed')

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/painel')
  revalidatePath('/resumo')
  revalidatePath(`/revisar/${id}`)
  revalidatePath(`/liquidar/${id}`)

  redirect(
    buildToastHref(returnTo, {
      kind: 'entry_updated',
    })
  )
}
