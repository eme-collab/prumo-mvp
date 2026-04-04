'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ui } from '@/lib/ui'

type Props = {
  entryId: string
}

export default function ReprocessEntryButton({ entryId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleReprocess() {
    try {
      setLoading(true)
      setMessage(null)
      setError(null)

      const response = await fetch(`/api/process-entry/${entryId}`, {
        method: 'POST',
      })

      const raw = await response.text()
      let payload: { error?: string } = {}

      if (raw) {
        try {
          payload = JSON.parse(raw)
        } catch {
          throw new Error(
            `Falha ao ler a resposta do reprocessamento. Status ${response.status}.`
          )
        }
      }

      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao reprocessar o lançamento.')
      }

      setMessage('Reprocessamento concluído. A tela será atualizada.')
      router.refresh()
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : 'Falha ao reprocessar o lançamento.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleReprocess}
        disabled={loading}
        className={ui.button.secondary}
      >
        {loading ? 'Reprocessando...' : 'Tentar novamente'}
      </button>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}