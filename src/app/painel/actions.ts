'use server'

import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { buildToastHref } from '@/lib/global-toast'
import { trackAppEventServer } from '@/lib/app-events-server'
import {
  getOpenAccountItemType,
  getOpenAccountUrgencyStatus,
  getTodayInBrazil,
  isOpenAccount,
} from '@/lib/pending-state'
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

async function revalidateEntrySurfaces(entryId: string) {
  revalidatePath('/painel')
  revalidatePath('/resumo')
  revalidatePath(`/revisar/${entryId}`)
  revalidatePath(`/liquidar/${entryId}`)
}

export async function quickDiscardPendingEntry(formData: FormData) {
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
    redirect('/painel?focus=pending_review')
  }

  const { data: entry, error: entryError } = await supabase
    .from('financial_entries')
    .select('id, user_id, review_status')
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry || entry.user_id !== user.id || entry.review_status !== 'pending') {
    redirect('/painel?focus=pending_review')
  }

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

  await trackAppEventServer({
    eventName: 'pending_review_resolved',
    userId: user.id,
    cookieStore,
    properties: {
      source_screen: 'painel',
      item_type: 'pending_review',
      count: 1,
      resolution: 'discarded',
      entry_id: id,
      has_completed_first_capture: true,
    },
  })

  await revalidateEntrySurfaces(id)

  redirect(
    buildToastHref('/painel?focus=pending_review', {
      kind: 'entry_discarded',
      undo: 'undo_review_discard',
      entryId: id,
    })
  )
}

export async function quickDeleteOpenAccountEntry(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const id = getString(formData, 'id')

  if (!id) {
    redirect('/painel?focus=open_accounts')
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

  if (
    !entry ||
    entry.user_id !== user.id ||
    !isOpenAccount(entry.entry_type, entry.review_status, entry.settlement_status)
  ) {
    redirect('/painel?focus=open_accounts')
  }

  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', id)
    .eq('review_status', 'confirmed')

  if (error) {
    throw new Error(error.message)
  }

  const itemType = getOpenAccountItemType(entry.entry_type)

  if (itemType) {
    await trackAppEventServer({
      eventName:
        itemType === 'receivable'
          ? 'receivable_marked_resolved'
          : 'payable_marked_resolved',
      userId: user.id,
      properties: {
        source_screen: 'painel',
        item_type: itemType,
        item_status: getOpenAccountUrgencyStatus(entry.due_on),
        count: 1,
        resolution: 'deleted',
        entry_id: id,
        has_completed_first_capture: true,
      },
    })
  }

  if (entry.audio_path) {
    const { error: storageError } = await supabase.storage
      .from('voice-notes')
      .remove([entry.audio_path])

    if (storageError) {
      console.error('Falha ao remover audio excluido:', storageError.message)
    }
  }

  await revalidateEntrySurfaces(id)

  redirect(
    buildToastHref('/painel?focus=open_accounts', {
      kind: 'entry_deleted',
      entryId: id,
    })
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

  await trackAppEventServer({
    eventName: 'pending_review_resolved',
    userId: user.id,
    cookieStore,
    properties: {
      source_screen: 'painel',
      item_type: 'pending_review',
      count: 1,
      resolution: 'confirmed',
      has_completed_first_capture: true,
      entry_id: id,
    },
  })

  const firstCaptureUnlock = await finalizeFirstCaptureUnlock({
    supabase,
    userId: user.id,
    source: entry.source,
    cookieStore,
  })

  if (entry.source === 'voice') {
    if (firstCaptureUnlock.shouldRedirectToUnlockedPanel) {
      await trackAppEventServer({
        eventName: 'first_record_confirmed',
        userId: user.id,
        cookieStore,
        properties: {
          source_screen: 'painel',
          has_completed_first_capture: true,
          entry_id: id,
        },
      })
      await trackAppEventServer({
        eventName: 'zen_mode_completed',
        userId: user.id,
        cookieStore,
        properties: {
          source_screen: 'painel',
          has_completed_first_capture: true,
          entry_id: id,
        },
      })
    } else {
      await trackAppEventServer({
        eventName: 'record_confirmed',
        userId: user.id,
        cookieStore,
        properties: {
          source_screen: 'painel',
          has_completed_first_capture: true,
          entry_id: id,
        },
      })
    }
  }

  await revalidateEntrySurfaces(id)

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
    .select(
      'id, user_id, review_status, settlement_status, entry_type, amount, due_on'
    )
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry || entry.user_id !== user.id || !canQuickSettleEntry(entry)) {
    redirect('/painel')
  }

  const today = getTodayInBrazil()

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

  const itemType = getOpenAccountItemType(entry.entry_type)

  if (itemType) {
    await trackAppEventServer({
      eventName:
        itemType === 'receivable'
          ? 'receivable_marked_resolved'
          : 'payable_marked_resolved',
      userId: user.id,
      properties: {
        source_screen: 'painel',
        item_type: itemType,
        item_status: getOpenAccountUrgencyStatus(entry.due_on),
        count: 1,
        resolution: 'settled',
        entry_id: id,
        has_completed_first_capture: true,
      },
    })
  }

  await revalidateEntrySurfaces(id)

  redirect(
    buildToastHref('/painel', {
      kind: entry.entry_type === 'sale_due' ? 'receipt_confirmed' : 'payment_confirmed',
      undo: 'undo_settlement_confirm',
      entryId: id,
    })
  )
}
