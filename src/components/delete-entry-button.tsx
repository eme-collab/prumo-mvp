'use client'

import { useFormStatus } from 'react-dom'

type DeleteEntryButtonProps = {
  confirmMessage?: string
}

function TrashIcon() {
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
      <path d="M4.5 6.5h11" />
      <path d="M8 3.5h4" />
      <path d="M6.5 6.5v8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-8" />
      <path d="M8.5 9.5v3.5" />
      <path d="M11.5 9.5v3.5" />
    </svg>
  )
}

export default function DeleteEntryButton({
  confirmMessage = 'Excluir esta movimentação? Essa ação não pode ser desfeita.',
}: DeleteEntryButtonProps) {
  const { pending } = useFormStatus()

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (pending) {
      return
    }

    if (!window.confirm(confirmMessage)) {
      return
    }

    event.currentTarget.form?.requestSubmit()
  }

  return (
    <button
      type="button"
      aria-label="Excluir movimentação"
      title="Excluir movimentação"
      disabled={pending}
      onClick={handleClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <TrashIcon />
      )}
    </button>
  )
}
