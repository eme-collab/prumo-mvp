'use client'

import { useEffect } from 'react'
import { trackAppEventClient } from '@/lib/app-events-client'
import type { AppEventName, AppEventProperties } from '@/lib/app-events'

export default function AppEventViewTracker({
  eventName,
  properties,
  onceKey,
  enabled = true,
}: {
  eventName: AppEventName
  properties?: AppEventProperties
  onceKey?: string
  enabled?: boolean
}) {
  const serializedProperties = JSON.stringify(properties ?? {})

  useEffect(() => {
    if (!enabled) {
      return
    }

    void trackAppEventClient({
      eventName,
      properties: JSON.parse(serializedProperties) as AppEventProperties,
      onceKey,
    })
  }, [enabled, eventName, onceKey, serializedProperties])

  return null
}
