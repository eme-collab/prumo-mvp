'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

type QuickConfirmPendingButtonProps = {
  idleLabel?: string
  armedLabel?: string
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 10 4 4 8-8" />
    </svg>
  )
}

export default function QuickConfirmPendingButton({
  idleLabel = 'Confirmar direto',
  armedLabel = 'Toque de novo para confirmar',
}: QuickConfirmPendingButtonProps) {
  const { pending } = useFormStatus()
  const [isArmed, setIsArmed] = useState(false)

  useEffect(() => {
    if (!isArmed) {
      return
    }

    const timeout = window.setTimeout(() => {
      setIsArmed(false)
    }, 2200)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [isArmed])

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (pending) {
      return
    }

    if (!isArmed) {
      setIsArmed(true)
      return
    }

    setIsArmed(false)
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <button
      type="button"
      aria-label={isArmed ? armedLabel : idleLabel}
      title={isArmed ? armedLabel : idleLabel}
      disabled={pending}
      onClick={handleClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
        isArmed
          ? 'border-green-300 bg-green-50 text-green-700'
          : 'border-neutral-200 bg-white text-neutral-500 hover:border-green-200 hover:bg-green-50 hover:text-green-700'
      }`}
    >
      {pending ? (
        <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <CheckIcon />
      )}
    </button>
  )
}
