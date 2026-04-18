'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { markNotificationOpened } from '@/lib/notifications/client'
import { isNotificationType } from '@/lib/notification-readiness'

function resolveSourceScreen(pathname: string) {
  if (pathname.startsWith('/revisar')) {
    return 'revisar'
  }

  if (pathname.startsWith('/liquidar')) {
    return 'liquidar'
  }

  if (pathname.startsWith('/resumo')) {
    return 'resumo'
  }

  return 'painel'
}

export default function NotificationOpenTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const deliveryId = searchParams.get('notification_delivery')
  const notificationType = searchParams.get('notification_type')

  useEffect(() => {
    if (!deliveryId || !isNotificationType(notificationType)) {
      return
    }

    const onceKey = `prumo_notification_opened:${deliveryId}`

    if (window.sessionStorage.getItem(onceKey) === 'true') {
      return
    }

    window.sessionStorage.setItem(onceKey, 'true')

    void markNotificationOpened({
      deliveryId,
      notificationType,
      sourceScreen: resolveSourceScreen(pathname),
    }).catch((error) => {
      console.error(error)
      window.sessionStorage.removeItem(onceKey)
    })
  }, [deliveryId, notificationType, pathname])

  return null
}
