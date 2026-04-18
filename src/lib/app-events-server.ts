import 'server-only'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  APP_EVENT_FIRST_SESSION_COOKIE,
  APP_EVENT_SESSION_COOKIE,
  type AppEventInsert,
  type AppEventName,
  type AppEventProperties,
  createAppSessionId,
  sanitizeAppEventProperties,
} from '@/lib/app-events'

type CookieStore = Awaited<ReturnType<typeof cookies>>

type TrackingContext = {
  sessionId: string
  isFirstSession: boolean
}

function getCookieOptions() {
  return {
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

function ensureServerTrackingContext(cookieStore: CookieStore): TrackingContext {
  const existingSessionId = cookieStore.get(APP_EVENT_SESSION_COOKIE)?.value
  const sessionId = existingSessionId || createAppSessionId()

  if (!existingSessionId) {
    cookieStore.set({
      name: APP_EVENT_SESSION_COOKIE,
      value: sessionId,
      ...getCookieOptions(),
    })
  }

  const hasSeenFirstSession = Boolean(
    cookieStore.get(APP_EVENT_FIRST_SESSION_COOKIE)?.value
  )

  if (!hasSeenFirstSession) {
    cookieStore.set({
      name: APP_EVENT_FIRST_SESSION_COOKIE,
      value: 'true',
      maxAge: 60 * 60 * 24 * 365,
      ...getCookieOptions(),
    })
  }

  return {
    sessionId,
    isFirstSession: !hasSeenFirstSession,
  }
}

export async function insertAppEventRecord(input: AppEventInsert) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('app_events').insert(input)

    if (error) {
      throw new Error(error.message)
    }

    return true
  } catch (error) {
    console.error('Falha ao registrar app event:', error)
    return false
  }
}

export async function trackAppEventServer(input: {
  eventName: AppEventName
  userId?: string | null
  properties?: AppEventProperties
  cookieStore?: CookieStore
}) {
  const cookieStore = input.cookieStore ?? (await cookies())
  const trackingContext = ensureServerTrackingContext(cookieStore)

  return insertAppEventRecord({
    user_id: input.userId ?? null,
    session_id: trackingContext.sessionId,
    event_name: input.eventName,
    properties: sanitizeAppEventProperties({
      is_first_session: trackingContext.isFirstSession,
      ...input.properties,
    }),
  })
}
