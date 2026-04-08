'use client'

import { useEffect, useRef, useState } from 'react'
import { ui } from '@/lib/ui'

type InfoButtonProps = {
  label: string
  content: string
}

export default function InfoButton({ label, content }: InfoButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen((current) => !current)
        }}
        className={ui.button.icon}
      >
        <span aria-hidden="true">i</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-10 z-20 w-64 rounded-2xl border border-neutral-200 bg-white p-3 text-left text-xs leading-5 text-neutral-600 shadow-lg"
        >
          {content}
        </div>
      )}
    </div>
  )
}
