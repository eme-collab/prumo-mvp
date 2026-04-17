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
        className={`pointer-events-auto w-full max-w-md rounded-2xl border border-sky-200 bg-white/95 px-4 py-3 shadow-lg shadow-sky-100/80 backdrop-blur transition duration-200 ${
          isLeaving ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-900">
              {toast.message}
            </p>

            {toast.undo && toast.entryId && toast.undoLabel && (
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
                className="mt-2 text-sm font-medium text-sky-700 transition hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? 'Desfazendo...' : toast.undoLabel}
              </button>
            )}
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
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
