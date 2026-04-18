'use client'

import { useEffect } from 'react'

export default function ContextFocusTarget({
  targetId,
}: {
  targetId: string | null
}) {
  useEffect(() => {
    if (!targetId) {
      return
    }

    const handle = window.requestAnimationFrame(() => {
      const element = document.getElementById(targetId)

      if (!element) {
        return
      }

      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })

    return () => {
      window.cancelAnimationFrame(handle)
    }
  }, [targetId])

  return null
}
