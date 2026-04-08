'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ui } from '@/lib/ui'

const ROTATING_HINTS = [
  'Exemplo: Recebi 250 reais do cliente João hoje.',
  'Exemplo: Vendi 300 reais para Maria e ela vai pagar em 15 dias.',
  'Exemplo: Paguei 110 reais e 20 centavos de internet hoje.',
  'Exemplo: Tenho uma conta de energia de 420 reais para pagar no dia 10.',
  'Exemplo: Comprei 36 reais e 80 centavos na quitanda pra pagar dia 5 do mês que vem.',
]

function MicrophoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  )
}

function pickSupportedMimeType() {
  const candidates = [
    'audio/ogg',
    'audio/ogg;codecs=opus',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/webm',
  ]

  if (typeof MediaRecorder === 'undefined') {
    return undefined
  }

  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }

  return undefined
}

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('aac')) return 'aac'
  return 'webm'
}

function formatRecordingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function AudioCaptureCard() {
  const router = useRouter()

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStartedAtRef = useRef<number | null>(null)
  const recordingIntervalRef = useRef<number | null>(null)
  const rotatingHintIntervalRef = useRef<number | null>(null)

  const [isRecording, setIsRecording] = useState(false)
  const [isSubmittingCapture, setIsSubmittingCapture] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [queueMessage, setQueueMessage] = useState<string | null>(null)
  const [lastEntryId, setLastEntryId] = useState<string | null>(null)
  const [rotatingHintIndex, setRotatingHintIndex] = useState(0)

  function stopCurrentStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  function stopRecordingTimer() {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

    recordingStartedAtRef.current = null
    setRecordingSeconds(0)
  }

  function startRecordingTimer() {
    stopRecordingTimer()

    recordingStartedAtRef.current = Date.now()
    setRecordingSeconds(0)

    recordingIntervalRef.current = window.setInterval(() => {
      if (!recordingStartedAtRef.current) return

      const elapsedMs = Date.now() - recordingStartedAtRef.current
      setRecordingSeconds(Math.floor(elapsedMs / 1000))
    }, 1000)
  }

  function stopRotatingHints() {
    if (rotatingHintIntervalRef.current !== null) {
      window.clearInterval(rotatingHintIntervalRef.current)
      rotatingHintIntervalRef.current = null
    }
  }

  useEffect(() => {
    rotatingHintIntervalRef.current = window.setInterval(() => {
      setRotatingHintIndex((current) => (current + 1) % ROTATING_HINTS.length)
    }, 3500)

    return () => {
      stopCurrentStream()
      stopRecordingTimer()
      stopRotatingHints()
    }
  }, [])

  async function runBackgroundProcessing(entryId: string) {
    try {
      const processResponse = await fetch(`/api/process-entry/${entryId}`, {
        method: 'POST',
      })

      const processRaw = await processResponse.text()
      let processPayload: { error?: string } = {}

      if (processRaw) {
        try {
          processPayload = JSON.parse(processRaw)
        } catch {
          throw new Error(
            `Falha ao ler a resposta do processamento. Status ${processResponse.status}.`
          )
        }
      }

      if (!processResponse.ok) {
        throw new Error(
          processPayload.error || 'Falha ao processar o lançamento.'
        )
      }

      router.refresh()
    } catch (processingError) {
      console.error('Erro no processamento em segundo plano:', processingError)
      router.refresh()
    }
  }

  async function queueAudioBlob(audioBlob: Blob) {
    try {
      setIsSubmittingCapture(true)
      setError(null)
      setQueueMessage(null)
      setLastEntryId(null)

      const supabase = createClient()

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      const mimeType = audioBlob.type || 'audio/webm'
      const extension = getExtensionFromMimeType(mimeType)
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(path, audioBlob, {
          contentType: mimeType,
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const occurredOn = new Date().toISOString().slice(0, 10)

      const { data: insertedEntry, error: insertError } = await supabase
        .from('financial_entries')
        .insert({
          user_id: user.id,
          source: 'voice',
          review_status: 'pending',
          processing_status: 'uploaded',
          processing_error: null,
          audio_path: path,
          occurred_on: occurredOn,
          transcript: null,
        })
        .select('id')
        .single()

      if (insertError || !insertedEntry) {
        throw new Error(insertError?.message || 'Falha ao criar lançamento.')
      }

      setLastEntryId(insertedEntry.id)
      setQueueMessage('Áudio enviado.')

      router.refresh()

      void runBackgroundProcessing(insertedEntry.id)
    } catch (submitError) {
      console.error(submitError)
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Falha ao enviar o áudio para processamento.'
      )
    } finally {
      setIsSubmittingCapture(false)
    }
  }

  async function startRecording() {
    try {
      setError(null)
      setQueueMessage(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          'Seu navegador não suporta captura de microfone neste contexto.'
        )
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = pickSupportedMimeType()

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        try {
          const finalMimeType = recorder.mimeType || mimeType || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type: finalMimeType })

          stopCurrentStream()
          stopRecordingTimer()
          setIsRecording(false)

          if (blob.size === 0) {
            throw new Error('O áudio gravado ficou vazio.')
          }

          await queueAudioBlob(blob)
        } catch (stopError) {
          console.error(stopError)
          stopRecordingTimer()
          setIsRecording(false)
          setError(
            stopError instanceof Error
              ? stopError.message
              : 'Falha ao finalizar a gravação.'
          )
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      startRecordingTimer()
      setIsRecording(true)
    } catch (startError) {
      console.error(startError)
      stopCurrentStream()
      stopRecordingTimer()
      setIsRecording(false)
      setError('Não foi possível acessar o microfone.')
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current

    if (!recorder) return
    if (recorder.state !== 'recording') return

    recorder.stop()
  }

  function handleMainButtonClick() {
    if (isSubmittingCapture) return

    if (isRecording) {
      stopRecording()
      return
    }

    void startRecording()
  }

  function getMainButtonLabel() {
    if (isSubmittingCapture) return 'Enviando áudio...'
    if (isRecording) return 'Parar gravação'
    return 'Gravar lançamento'
  }

  function getSupportText() {
    if (isSubmittingCapture) {
      return 'Seu áudio está sendo enviado para processamento.'
    }

    if (isRecording) {
      return 'Toque novamente para encerrar o áudio.'
    }

    return 'Fale um lançamento por vez.'
  }

  return (
    <div className={ui.card.primaryCompact}>
      <div>
        <h2 className={ui.text.cardTitle}>Gravar lançamento</h2>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-sky-200/80 bg-white/80 px-4 py-3">
        <div className="flex h-14 items-center">
          <p
            key={rotatingHintIndex}
            aria-live="polite"
            className="text-sm leading-5 text-sky-800 transition-opacity duration-300"
          >
            {ROTATING_HINTS[rotatingHintIndex]}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleMainButtonClick}
          disabled={isSubmittingCapture}
          className={`flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-semibold transition ${
            isSubmittingCapture
              ? 'cursor-not-allowed bg-sky-400 text-white opacity-70'
              : isRecording
                ? 'bg-sky-700 text-white hover:bg-sky-800 active:scale-[0.99]'
                : 'bg-sky-600 text-white hover:bg-sky-700 active:scale-[0.99]'
          }`}
        >
          {isSubmittingCapture && (
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}

          {!isSubmittingCapture && <MicrophoneIcon />}

          <span>{getMainButtonLabel()}</span>

          {isRecording && (
            <span className="rounded-full border border-white/30 px-2 py-1 text-sm font-medium">
              {formatRecordingTime(recordingSeconds)}
            </span>
          )}
        </button>

        <p className={`mt-2 ${ui.text.helper}`}>{getSupportText()}</p>
      </div>

      {queueMessage && (
        <div className={`mt-4 ${ui.card.success}`}>
          <p className="text-sm font-medium">{queueMessage}</p>

          <div className="mt-3 flex flex-wrap gap-3">
            {lastEntryId && (
              <Link href={`/revisar/${lastEntryId}`} className={ui.button.secondary}>
                Revisar
              </Link>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className={`mt-4 ${ui.card.danger}`}>
          <p className="text-sm font-medium text-red-700">
            Falha no envio ou processamento
          </p>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
