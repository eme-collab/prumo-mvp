'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  entryId: string
}

export default function ParseEntryButton({ entryId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleParse() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/parse-entry/${entryId}`, {
        method: 'POST',
      })

      const rawText = await response.text()

      let payload: { error?: string } = {}

      if (rawText) {
        try {
          payload = JSON.parse(rawText)
        } catch {
          throw new Error(
            `Resposta não veio em JSON. Status ${response.status}. Corpo: ${rawText.slice(0, 300)}`
          )
        }
      }

      if (!response.ok) {
        throw new Error(payload.error || `Falha ao interpretar. Status ${response.status}.`)
      }

      router.refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao interpretar o lançamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleParse}
        disabled={loading}
        className="rounded-lg border px-3 py-2 text-xs font-medium"
      >
        {loading ? 'Interpretando...' : 'Interpretar lançamento'}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}