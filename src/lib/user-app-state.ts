import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const FIRST_CAPTURE_LOCAL_COOKIE = 'prumo_first_capture_local'
export const FIRST_CAPTURE_DEBUG_FAIL_COOKIE =
  'prumo_first_capture_debug_fail'

type CookieStore = Awaited<ReturnType<typeof cookies>>

type FirstCaptureCookieOptions = {
  httpOnly: true
  path: '/'
  sameSite: 'lax'
  secure: boolean
}

type FirstCaptureRemoteState = {
  hasCompletedFirstCapture: boolean
  hasPersistedRow: boolean
  errorMessage: string | null
}

type FirstCaptureResolvedState = FirstCaptureRemoteState & {
  hasRemoteCompletedFirstCapture: boolean
  hasLocalMirror: boolean
}

type FinalizeFirstCaptureUnlockResult = {
  shouldRedirectToUnlockedPanel: boolean
  shouldShowFirstCaptureFeedback: boolean
  persistedRemotely: boolean
  usedLocalMirror: boolean
}

const FIRST_CAPTURE_LOCAL_COOKIE_OPTIONS: FirstCaptureCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
}

export function isFirstCaptureValidationModeEnabled() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.PRUMO_ENABLE_FIRST_CAPTURE_DEBUG === 'true'
  )
}

function hasLocalFirstCaptureMirror(cookieStore: CookieStore) {
  return cookieStore.get(FIRST_CAPTURE_LOCAL_COOKIE)?.value === 'true'
}

export function isFirstCapturePersistFailureSimulationEnabled(
  cookieStore: CookieStore
) {
  return cookieStore.get(FIRST_CAPTURE_DEBUG_FAIL_COOKIE)?.value === 'true'
}

export function isVoiceEntryEligibleForFirstCaptureUnlock(
  source: string | null | undefined
) {
  return source === 'voice'
}

export async function getRemoteFirstCaptureState(
  supabase: SupabaseClient,
  userId: string
): Promise<FirstCaptureRemoteState> {
  const { data, error } = await supabase
    .from('user_app_state')
    .select('has_completed_first_capture')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return {
      hasCompletedFirstCapture: false,
      hasPersistedRow: false,
      errorMessage: error.message,
    }
  }

  return {
    hasCompletedFirstCapture: data?.has_completed_first_capture === true,
    hasPersistedRow: data !== null,
    errorMessage: null,
  }
}

export async function resolveFirstCaptureState(input: {
  supabase: SupabaseClient
  userId: string
  cookieStore?: CookieStore
}): Promise<FirstCaptureResolvedState> {
  const cookieStore = input.cookieStore ?? (await cookies())
  const remoteState = await getRemoteFirstCaptureState(input.supabase, input.userId)
  const hasLocalMirror = hasLocalFirstCaptureMirror(cookieStore)

  return {
    hasCompletedFirstCapture:
      remoteState.hasCompletedFirstCapture || hasLocalMirror,
    hasRemoteCompletedFirstCapture: remoteState.hasCompletedFirstCapture,
    hasPersistedRow: remoteState.hasPersistedRow,
    hasLocalMirror,
    errorMessage: remoteState.errorMessage,
  }
}

export async function setRemoteFirstCaptureState(
  supabase: SupabaseClient,
  userId: string,
  hasCompletedFirstCapture: boolean
) {
  const { error } = await supabase.from('user_app_state').upsert(
    {
      user_id: userId,
      has_completed_first_capture: hasCompletedFirstCapture,
    },
    {
      onConflict: 'user_id',
    }
  )

  return {
    persistedRemotely: !error,
    errorMessage: error?.message ?? null,
  }
}

export async function markFirstCaptureCompleted(input: {
  supabase: SupabaseClient
  userId: string
  cookieStore?: CookieStore
}) {
  if (
    input.cookieStore &&
    isFirstCapturePersistFailureSimulationEnabled(input.cookieStore)
  ) {
    return {
      persistedRemotely: false,
      errorMessage:
        'Persistência remota simulada como indisponível para validação.',
    }
  }

  return setRemoteFirstCaptureState(input.supabase, input.userId, true)
}

export function setFirstCaptureLocalMirror(cookieStore: CookieStore) {
  cookieStore.set({
    name: FIRST_CAPTURE_LOCAL_COOKIE,
    value: 'true',
    ...FIRST_CAPTURE_LOCAL_COOKIE_OPTIONS,
  })
}

export function clearFirstCaptureLocalMirror(
  cookieStore: CookieStore,
  options?: { swallowWriteError?: boolean }
) {
  try {
    cookieStore.set({
      name: FIRST_CAPTURE_LOCAL_COOKIE,
      value: '',
      maxAge: 0,
      ...FIRST_CAPTURE_LOCAL_COOKIE_OPTIONS,
    })
    return true
  } catch (error) {
    if (!options?.swallowWriteError) {
      throw error
    }

    return false
  }
}

export function setFirstCapturePersistFailureSimulation(cookieStore: CookieStore) {
  cookieStore.set({
    name: FIRST_CAPTURE_DEBUG_FAIL_COOKIE,
    value: 'true',
    ...FIRST_CAPTURE_LOCAL_COOKIE_OPTIONS,
  })
}

export function clearFirstCapturePersistFailureSimulation(
  cookieStore: CookieStore,
  options?: { swallowWriteError?: boolean }
) {
  try {
    cookieStore.set({
      name: FIRST_CAPTURE_DEBUG_FAIL_COOKIE,
      value: '',
      maxAge: 0,
      ...FIRST_CAPTURE_LOCAL_COOKIE_OPTIONS,
    })
    return true
  } catch (error) {
    if (!options?.swallowWriteError) {
      throw error
    }

    return false
  }
}

export async function retryPersistFirstCaptureFromLocalMirror(input: {
  supabase: SupabaseClient
  userId: string
  cookieStore?: CookieStore
}) {
  const cookieStore = input.cookieStore ?? (await cookies())
  const resolvedState = await resolveFirstCaptureState({
    supabase: input.supabase,
    userId: input.userId,
    cookieStore,
  })

  if (resolvedState.hasRemoteCompletedFirstCapture) {
    const clearedLocalMirror = resolvedState.hasLocalMirror
      ? clearFirstCaptureLocalMirror(cookieStore, { swallowWriteError: true })
      : false

    return {
      ...resolvedState,
      hasLocalMirror:
        resolvedState.hasLocalMirror && !clearedLocalMirror,
      persistedFromLocalMirror: false,
      clearedLocalMirror,
      persistErrorMessage: null,
    }
  }

  if (!resolvedState.hasLocalMirror) {
    return {
      ...resolvedState,
      persistedFromLocalMirror: false,
      clearedLocalMirror: false,
      persistErrorMessage: null,
    }
  }

  const persistResult = await markFirstCaptureCompleted({
    supabase: input.supabase,
    userId: input.userId,
    cookieStore,
  })

  if (!persistResult.persistedRemotely) {
    return {
      ...resolvedState,
      persistedFromLocalMirror: false,
      clearedLocalMirror: false,
      persistErrorMessage: persistResult.errorMessage,
    }
  }

  const clearedLocalMirror = clearFirstCaptureLocalMirror(cookieStore, {
    swallowWriteError: true,
  })

  return {
    hasCompletedFirstCapture: true,
    hasRemoteCompletedFirstCapture: true,
    hasPersistedRow: true,
    hasLocalMirror: !clearedLocalMirror,
    errorMessage: null,
    persistedFromLocalMirror: true,
    clearedLocalMirror,
    persistErrorMessage: null,
  }
}

export async function finalizeFirstCaptureUnlock(input: {
  supabase: SupabaseClient
  userId: string
  source: string | null | undefined
  cookieStore?: CookieStore
}): Promise<FinalizeFirstCaptureUnlockResult> {
  if (!isVoiceEntryEligibleForFirstCaptureUnlock(input.source)) {
    return {
      shouldRedirectToUnlockedPanel: false,
      shouldShowFirstCaptureFeedback: false,
      persistedRemotely: false,
      usedLocalMirror: false,
    }
  }

  const cookieStore = input.cookieStore ?? (await cookies())
  const firstCaptureState = await resolveFirstCaptureState({
    supabase: input.supabase,
    userId: input.userId,
    cookieStore,
  })

  if (firstCaptureState.hasCompletedFirstCapture) {
    return {
      shouldRedirectToUnlockedPanel: false,
      shouldShowFirstCaptureFeedback: false,
      persistedRemotely: firstCaptureState.hasRemoteCompletedFirstCapture,
      usedLocalMirror: firstCaptureState.hasLocalMirror,
    }
  }

  const persistResult = await markFirstCaptureCompleted({
    supabase: input.supabase,
    userId: input.userId,
    cookieStore,
  })

  if (persistResult.persistedRemotely) {
    clearFirstCaptureLocalMirror(cookieStore, {
      swallowWriteError: true,
    })

    return {
      shouldRedirectToUnlockedPanel: true,
      shouldShowFirstCaptureFeedback: true,
      persistedRemotely: true,
      usedLocalMirror: false,
    }
  }

  setFirstCaptureLocalMirror(cookieStore)

  return {
    shouldRedirectToUnlockedPanel: true,
    shouldShowFirstCaptureFeedback: true,
    persistedRemotely: false,
    usedLocalMirror: true,
  }
}
