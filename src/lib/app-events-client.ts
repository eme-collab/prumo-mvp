'use client'

import {
  APP_EVENT_FIRST_SESSION_COOKIE,
  APP_EVENT_ROUTE,
  APP_EVENT_SESSION_COOKIE,
  type AppEventName,
  type AppEventProperties,
  createAppSessionId,
  isPwaInstalledInBrowser,
  serializeAppEvent,
} from '@/lib/app-events'

type ClientTrackingContext = {
  sessionId: string
  isFirstSession: boolean
}

function readCookie(name: string) {
  if (typeof document === 'undefined') {
    return null
  }

  return (
    document.cookie
      .split('; ')
      .find((item) => item.startsWith(`${name}=`))
      ?.split('=')
      .slice(1)
      .join('=') ?? null
  )
}

function writeCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof document === 'undefined') {
    return
  }

  const base = [`${name}=${value}`, 'path=/', 'SameSite=Lax']

  if (window.location.protocol === 'https:') {
    base.push('Secure')
  }

  if (typeof maxAgeSeconds === 'number') {
    base.push(`Max-Age=${maxAgeSeconds}`)
  }

  document.cookie = base.join('; ')
}

function getOnceStorageKey(onceKey: string) {
  return `prumo_app_event_once:${onceKey}`
}

function ensureClientTrackingContext(): ClientTrackingContext {
  const existingSessionId = readCookie(APP_EVENT_SESSION_COOKIE)
  const sessionId = existingSessionId || createAppSessionId()

  if (!existingSessionId) {
    writeCookie(APP_EVENT_SESSION_COOKIE, sessionId)
  }

  const hasSeenFirstSession = readCookie(APP_EVENT_FIRST_SESSION_COOKIE) === 'true'

  if (!hasSeenFirstSession) {
    writeCookie(APP_EVENT_FIRST_SESSION_COOKIE, 'true', 60 * 60 * 24 * 365)
  }

  return {
    sessionId,
    isFirstSession: !hasSeenFirstSession,
  }
}

export async function trackAppEventClient(input: {
  eventName: AppEventName
  properties?: AppEventProperties
  onceKey?: string
}) {
  const onceStorageKey = input.onceKey ? getOnceStorageKey(input.onceKey) : null

  if (onceStorageKey && window.sessionStorage.getItem(onceStorageKey) === 'true') {
    return false
  }

  if (onceStorageKey) {
    window.sessionStorage.setItem(onceStorageKey, 'true')
  }

  const trackingContext = ensureClientTrackingContext()
  const payload = serializeAppEvent({
    eventName: input.eventName,
    sessionId: trackingContext.sessionId,
    properties: {
      is_first_session: trackingContext.isFirstSession,
      is_pwa_installed: isPwaInstalledInBrowser(),
      ...input.properties,
    },
  })

  try {
    const response = await fetch(APP_EVENT_ROUTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
      keepalive: true,
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Falha ao registrar evento ${input.eventName}.`)
    }

    return true
  } catch (error) {
    if (onceStorageKey) {
      window.sessionStorage.removeItem(onceStorageKey)
    }

    console.error(error)
    return false
  }
}
