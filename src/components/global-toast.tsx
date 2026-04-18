'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { undoToastAction } from '@/app/toast-actions'
import {
  getGlobalToastFromSearchParams,
  removeToastQueryParams,
} from '@/lib/global-toast'

const TOAST_DURATION_MS = 5000
const TOAST_EXIT_MS = 180

type ToastData = NonNullable<
  ReturnType<typeof getGlobalToastFromSearchParams>
>

function getToastToneClasses(tone: ToastData['tone']) {
  switch (tone) {
    case 'success':
      return {
        border: 'border-green-200',
        dot: 'bg-green-500',
        shadow: 'shadow-green-100/80',
        action: 'text-green-700 hover:text-green-800',
        actionSurface: 'border-green-100 bg-green-50/70',
      }
    case 'warning':
      return {
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        shadow: 'shadow-amber-100/80',
        action: 'text-amber-800 hover:text-amber-900',
        actionSurface: 'border-amber-100 bg-amber-50/80',
      }
    default:
      return {
        border: 'border-sky-200',
        dot: 'bg-sky-500',
        shadow: 'shadow-sky-100/80',
        action: 'text-sky-700 hover:text-sky-800',
        actionSurface: 'border-sky-100 bg-sky-50/70',
      }
  }
}

function ToastCard({
  pathname,
  search,
  toast,
}: {
  pathname: string
  search: string
  toast: ToastData
}) {
  const router = useRouter()
  const [isLeaving, setIsLeaving] = useState(false)
  const [isPending, startTransition] = useTransition()
  const tone = getToastToneClasses(toast.tone)

  const cleanHref = useMemo(() => {
    const nextSearchParams = removeToastQueryParams(
      new URLSearchParams(search)
    )
    const nextSearch = nextSearchParams.toString()

    return nextSearch ? `${pathname}?${nextSearch}` : pathname
  }, [pathname, search])

  useEffect(() => {
    if (isPending) {
      return
    }

    const timeout = window.setTimeout(() => {
      setIsLeaving(true)

      window.setTimeout(() => {
        router.replace(cleanHref, { scroll: false })
      }, TOAST_EXIT_MS)
    }, TOAST_DURATION_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [cleanHref, isPending, router])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-area-top)+0.75rem)] z-50 flex justify-center px-4">
      <div
        className={`pointer-events-auto w-full max-w-md rounded-3xl border bg-white/95 px-5 py-4 shadow-lg backdrop-blur transition duration-200 ${tone.border} ${tone.shadow} ${
          isLeaving ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${tone.dot}`} />

          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium leading-6 text-neutral-950">
              {toast.message}
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar toast"
            onClick={() => {
              setIsLeaving(true)

              window.setTimeout(() => {
                router.replace(cleanHref, { scroll: false })
              }, TOAST_EXIT_MS)
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </button>
        </div>

        {toast.undo && toast.entryId && toast.undoLabel && (
          <div className={`mt-4 border-t pt-3 ${tone.actionSurface}`}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                const undo = toast.undo
                const entryId = toast.entryId
                if (!undo || !entryId) return

                startTransition(async () => {
                  const result = await undoToastAction({
                    undo,
                    entryId,
                  })

                  router.push(result.redirectTo, { scroll: false })
                })
              }}
              className={`flex w-full items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${tone.action}`}
            >
              {isPending ? 'Desfazendo...' : toast.undoLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GlobalToast() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const toast = getGlobalToastFromSearchParams(searchParams)

  if (!toast || toast.kind === 'first_capture_confirmed') {
    return null
  }

  return (
    <ToastCard
      key={`${toast.kind}:${toast.entryId ?? ''}`}
      pathname={pathname}
      search={search}
      toast={toast}
    />
  )
}
