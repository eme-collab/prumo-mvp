'use client'

import { useEffect, useRef, useTransition } from 'react'
import { clearFirstCaptureLocalMirrorAction } from '@/app/painel/actions'

export default function FirstCaptureCookieCleaner() {
  const hasStartedRef = useRef(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (hasStartedRef.current) {
      return
    }

    hasStartedRef.current = true

    startTransition(async () => {
      await clearFirstCaptureLocalMirrorAction()
    })
  }, [startTransition])

  return null
}
