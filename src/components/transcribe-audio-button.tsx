'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  entryId: string
}

export default function TranscribeAudioButton({ entryId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTranscribe() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/transcribe/${entryId}`, {
        method: 'POST',
      })

      const rawText = await response.text()

      let payload: { error?: string; transcript?: string } = {}

      if (rawText) {
        try {
          payload = JSON.parse(rawText)
        } catch {
          throw new Error(`Resposta não veio em JSON. Status ${response.status}. Corpo: ${rawText.slice(0, 300)}`)
        }
      }

      if (!response.ok) {
        throw new Error(payload.error || `Falha ao transcrever. Status ${response.status}.`)
      }

      router.refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao transcrever o áudio.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleTranscribe}
        disabled={loading}
        className="rounded-lg border px-3 py-2 text-xs font-medium"
      >
        {loading ? 'Transcrevendo...' : 'Transcrever áudio'}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}