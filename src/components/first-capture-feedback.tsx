'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  GLOBAL_TOAST_QUERY_KEYS,
  removeToastQueryParams,
} from '@/lib/global-toast'
import { ui } from '@/lib/ui'

const FIRST_CAPTURE_FEEDBACK_DURATION_MS = 6000
const FIRST_CAPTURE_FEEDBACK_SESSION_KEY = 'prumo-first-capture-feedback'

function getFeedbackStorageKey(entryId: string | null) {
  return `${FIRST_CAPTURE_FEEDBACK_SESSION_KEY}:${entryId ?? 'unknown'}`
}

export default function FirstCaptureFeedback({
  active,
  entryId,
}: {
  active: boolean
  entryId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isVisible, setIsVisible] = useState(false)

  const cleanHref = useMemo(() => {
    const nextSearchParams = removeToastQueryParams(
      new URLSearchParams(searchParams.toString())
    )
    const nextSearch = nextSearchParams.toString()

    return nextSearch ? `${pathname}?${nextSearch}` : pathname
  }, [pathname, searchParams])

  useEffect(() => {
    if (!active) {
      return
    }

    const storageKey = getFeedbackStorageKey(entryId)
    const hasSeenFeedback =
      window.sessionStorage.getItem(storageKey) === '1'

    if (!hasSeenFeedback) {
      window.sessionStorage.setItem(storageKey, '1')
    }

    const showTimeout = hasSeenFeedback
      ? null
      : window.setTimeout(() => {
          setIsVisible(true)
        }, 0)

    const cleanTimeout = window.setTimeout(() => {
      router.replace(cleanHref, { scroll: false })
    }, 120)

    return () => {
      if (showTimeout !== null) {
        window.clearTimeout(showTimeout)
      }
      window.clearTimeout(cleanTimeout)
    }
  }, [active, cleanHref, entryId, router])

  useEffect(() => {
    if (!isVisible) {
      return
    }

    const timeout = window.setTimeout(() => {
      setIsVisible(false)
    }, FIRST_CAPTURE_FEEDBACK_DURATION_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [isVisible])

  useEffect(() => {
    const toastKind = searchParams.get(GLOBAL_TOAST_QUERY_KEYS.kind)

    if (toastKind !== 'first_capture_confirmed') {
      return
    }

    const timeout = window.setTimeout(() => {
      router.replace(cleanHref, { scroll: false })
    }, 120)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [cleanHref, router, searchParams])

  if (!isVisible) {
    return null
  }

  return (
    <div className={ui.card.success}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-green-900">
            Pronto. Ficou salvo.
          </p>
          <p className="mt-1 text-sm text-green-800">
            Agora você não precisa lembrar disso depois.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-green-200 bg-white text-green-700 transition hover:bg-green-50"
          aria-label="Fechar aviso"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  )
}
