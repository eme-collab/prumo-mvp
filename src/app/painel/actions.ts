'use server'

import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { buildToastHref } from '@/lib/global-toast'
import { createClient } from '@/lib/supabase/server'
import {
  clearFirstCapturePersistFailureSimulation,
  clearFirstCaptureLocalMirror,
  finalizeFirstCaptureUnlock,
  isFirstCaptureValidationModeEnabled,
  setFirstCapturePersistFailureSimulation,
  setRemoteFirstCaptureState,
} from '@/lib/user-app-state'
import type { FirstCaptureValidationActionState } from './first-capture-validation-state'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function clearFirstCaptureLocalMirrorAction() {
  const cookieStore = await cookies()

  clearFirstCaptureLocalMirror(cookieStore, {
    swallowWriteError: true,
  })
}

function buildFirstCaptureValidationActionState(
  status: FirstCaptureValidationActionState['status'],
  message: string
): FirstCaptureValidationActionState {
  return {
    status,
    message,
    refreshToken: Date.now(),
  }
}

function createFirstCaptureDebugAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function runFirstCaptureValidationAction(
  _previousState: FirstCaptureValidationActionState,
  formData: FormData
): Promise<FirstCaptureValidationActionState> {
  if (!isFirstCaptureValidationModeEnabled()) {
    return buildFirstCaptureValidationActionState(
      'error',
      'Modo de validação desativado neste ambiente.'
    )
  }

  const supabase = await createClient()
  const cookieStore = await cookies()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return buildFirstCaptureValidationActionState(
      'error',
      'Sessão expirada. Entre novamente para validar.'
    )
  }

  const intent = getString(formData, 'intent')

  switch (intent) {
    case 'remote_true': {
      const result = await setRemoteFirstCaptureState(supabase, user.id, true)

      if (!result.persistedRemotely) {
        return buildFirstCaptureValidationActionState(
          'error',
          result.errorMessage ?? 'Não foi possível marcar a flag remota como true.'
        )
      }

      clearFirstCaptureLocalMirror(cookieStore, {
        swallowWriteError: true,
      })
      revalidatePath('/painel')

      return buildFirstCaptureValidationActionState(
        'success',
        'Flag remota marcada como true e espelho local limpo.'
      )
    }

    case 'remote_false': {
      const result = await setRemoteFirstCaptureState(supabase, user.id, false)

      if (!result.persistedRemotely) {
        return buildFirstCaptureValidationActionState(
          'error',
          result.errorMessage ?? 'Não foi possível marcar a flag remota como false.'
        )
      }

      clearFirstCaptureLocalMirror(cookieStore, {
        swallowWriteError: true,
      })
      revalidatePath('/painel')

      return buildFirstCaptureValidationActionState(
        'success',
        'Flag remota marcada como false e espelho local limpo.'
      )
    }

    case 'remote_absent': {
      const adminClient = createFirstCaptureDebugAdminClient()

      if (!adminClient) {
        return buildFirstCaptureValidationActionState(
          'error',
          'Remoção da linha indisponível sem SUPABASE_SERVICE_ROLE_KEY no ambiente local.'
        )
      }

      const { error } = await adminClient
        .from('user_app_state')
        .delete()
        .eq('user_id', user.id)

      if (error) {
        return buildFirstCaptureValidationActionState(
          'error',
          error.message
        )
      }

      clearFirstCaptureLocalMirror(cookieStore, {
        swallowWriteError: true,
      })
      revalidatePath('/painel')

      return buildFirstCaptureValidationActionState(
        'success',
        'Linha de user_app_state removida para o usuário atual e espelho local limpo.'
      )
    }

    case 'clear_local_cookie': {
      clearFirstCaptureLocalMirror(cookieStore, {
        swallowWriteError: true,
      })
      revalidatePath('/painel')

      return buildFirstCaptureValidationActionState(
        'success',
        'Espelho local do primeiro desbloqueio limpo.'
      )
    }

    case 'simulate_fail_on': {
      setFirstCapturePersistFailureSimulation(cookieStore)
      revalidatePath('/painel')

      return buildFirstCaptureValidationActionState(
        'success',
        'Simulação de falha remota ativada para a persistência da flag.'
      )
    }

    case 'simulate_fail_off': {
      clearFirstCapturePersistFailureSimulation(cookieStore, {
        swallowWriteError: true,
      })
      revalidatePath('/painel')

      return buildFirstCaptureValidationActionState(
        'success',
        'Simulação de falha remota desativada.'
      )
    }

    default:
      return buildFirstCaptureValidationActionState(
        'error',
        'Ação de validação não reconhecida.'
      )
  }
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
  const cookieStore = await cookies()

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

  const firstCaptureUnlock = await finalizeFirstCaptureUnlock({
    supabase,
    userId: user.id,
    source: entry.source,
    cookieStore,
  })

  revalidatePath('/painel')
  revalidatePath('/resumo')
  revalidatePath(`/revisar/${id}`)
  revalidatePath(`/liquidar/${id}`)

  if (firstCaptureUnlock.shouldRedirectToUnlockedPanel) {
    redirect(
      buildToastHref('/painel', {
        kind: 'first_capture_confirmed',
        entryId: id,
      })
    )
  }

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
