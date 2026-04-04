import { NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import { gemini } from '@/lib/gemini'
import { convertAudioBufferToWav } from '@/lib/audio/convert-to-wav'
import { financialEntryStructuredSchema } from '@/lib/ai/financial-entry-structured-schema'

export const runtime = 'nodejs'

function getTodayInSaoPaulo() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(new Date())
}

function normalizeStructuredPayload(raw: unknown) {
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error('O Gemini retornou um array vazio.')
    }
    return raw[0]
  }
  return raw
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function sanitizeNumber(value: unknown) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null
}

function sanitizeEntryType(value: unknown) {
  const allowed = new Set([
    'sale_received',
    'sale_due',
    'expense_paid',
    'expense_due',
  ])

  return typeof value === 'string' && allowed.has(value) ? value : null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getExtensionFromMimeType(mimeType?: string | null) {
  const normalized = (mimeType || '').toLowerCase().trim()

  if (normalized.startsWith('audio/webm')) return 'webm'
  if (normalized.startsWith('audio/ogg')) return 'ogg'
  if (normalized.startsWith('audio/aac')) return 'aac'
  if (normalized.startsWith('audio/x-aac')) return 'aac'
  if (normalized.startsWith('audio/wav')) return 'wav'
  if (normalized.startsWith('audio/x-wav')) return 'wav'
  if (normalized.startsWith('audio/mp3')) return 'mp3'
  if (normalized.startsWith('audio/mpeg')) return 'mp3'
  if (normalized.startsWith('audio/mp4')) return 'm4a'
  if (normalized.startsWith('audio/m4a')) return 'm4a'
  if (normalized.startsWith('audio/flac')) return 'flac'
  if (normalized.startsWith('audio/aiff')) return 'aiff'

  return null
}

function detectAudioExtensionFromBuffer(buffer: Buffer) {
  if (buffer.length < 12) return null

  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'webm'
  }

  if (buffer.toString('ascii', 0, 4) === 'OggS') return 'ogg'

  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return 'wav'
  }

  if (buffer.toString('ascii', 4, 8) === 'ftyp') return 'm4a'
  if (buffer.toString('ascii', 0, 4) === 'fLaC') return 'flac'
  if (buffer.toString('ascii', 0, 3) === 'ID3') return 'mp3'

  return null
}

function getExtensionFromPath(filePath: string) {
  return filePath.split('.').pop()?.toLowerCase() || null
}

async function downloadAudioBufferWithRetry(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string
) {
  let lastError: string | null = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: audioBlob, error } = await supabase.storage
      .from('voice-notes')
      .download(path)

    if (error || !audioBlob) {
      lastError = error?.message || 'Falha ao baixar o áudio.'
      await sleep(300)
      continue
    }

    const arrayBuffer = await audioBlob.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    if (inputBuffer.length < 128) {
      lastError = `Áudio baixado parece incompleto (${inputBuffer.length} bytes).`
      await sleep(300)
      continue
    }

    return { audioBlob, inputBuffer }
  }

  throw new Error(lastError || 'Falha ao baixar o áudio após múltiplas tentativas.')
}

function isTemporaryUnavailableError(message: string) {
  const normalized = message.toLowerCase()

  return (
    normalized.includes('"code":503') ||
    normalized.includes('503') ||
    normalized.includes('unavailable') ||
    normalized.includes('high demand') ||
    normalized.includes('temporarily overloaded')
  )
}

async function callGeminiWithRetryAndFallback(
  base64Audio: string,
  prompt: string
) {
  const primaryModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
  const fallbackModel = process.env.GEMINI_MODEL_FALLBACK || primaryModel
  const retryDelayMs = Number(process.env.GEMINI_RETRY_DELAY_MS || '20000')

  const models = [primaryModel, fallbackModel]
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const modelName = models[attempt] || primaryModel

    try {
      return await gemini.models.generateContent({
        model: modelName,
        contents: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: base64Audio,
            },
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: financialEntryStructuredSchema,
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido no Gemini.'

      lastError = error instanceof Error ? error : new Error(message)

      const shouldRetry =
        attempt === 0 && isTemporaryUnavailableError(message)

      if (!shouldRetry) {
        throw lastError
      }

      await sleep(retryDelayMs)
    }
  }

  throw lastError ?? new Error('Falha ao chamar o Gemini.')
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let entryId: string | null = null
  let supabase:
    | Awaited<ReturnType<typeof createSupabaseServerClient>>
    | null = null

  try {
    const { id } = await context.params
    entryId = id

    supabase = await createSupabaseServerClient()
    

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { data: entry, error: entryError } = await supabase
      .from('financial_entries')
      .select('id, user_id, audio_path, transcript')
      .eq('id', id)
      .maybeSingle()

    if (entryError) {
      return NextResponse.json({ error: entryError.message }, { status: 500 })
    }

    if (!entry || entry.user_id !== user.id) {
      return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 })
    }

    if (!entry.audio_path) {
      return NextResponse.json({ error: 'Este lançamento não possui áudio.' }, { status: 400 })
    }

    await supabase
      .from('financial_entries')
      .update({
        processing_status: 'transcribing',
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    const { audioBlob, inputBuffer } = await downloadAudioBufferWithRetry(
      supabase,
      entry.audio_path
    )

    const detectedExtension =
      detectAudioExtensionFromBuffer(inputBuffer) ||
      getExtensionFromMimeType(audioBlob.type) ||
      getExtensionFromPath(entry.audio_path) ||
      'webm'

    const wavBuffer = await convertAudioBufferToWav(
      inputBuffer,
      detectedExtension
    )

    const base64Audio = wavBuffer.toString('base64')
    const today = getTodayInSaoPaulo()

    const prompt = `
Você é um extrator financeiro para microempreendedores do Brasil.

Hoje é ${today}.

Sua tarefa é ouvir o áudio e devolver UM ÚNICO OBJETO JSON válido com:
- transcript
- entry_type
- description
- counterparty_name
- amount
- occurred_on
- due_on

Regras:
- Retorne apenas JSON válido.
- Não use array.
- Não inclua explicações.
- transcript deve conter a transcrição integral do áudio em português do Brasil.
- Existem apenas 4 tipos possíveis de lançamento:
  1. sale_received = venda recebida
  2. sale_due = venda a receber
  3. expense_paid = despesa paga
  4. expense_due = despesa a pagar
- Use null quando não houver segurança suficiente.
- amount deve ser número.
- occurred_on e due_on devem estar em YYYY-MM-DD quando houver confiança suficiente.
- due_on só deve existir se houver prazo futuro.
- Não invente dados.
- description deve ser curta e útil.
`.trim()

    const response = await callGeminiWithRetryAndFallback(base64Audio, prompt)

    const rawText = response.text?.trim()

    if (!rawText) {
      return NextResponse.json(
        { error: 'O Gemini não retornou conteúdo no processamento.' },
        { status: 500 }
      )
    }

    let parsedJson: unknown

    try {
      parsedJson = JSON.parse(rawText)
    } catch {
      return NextResponse.json(
        { error: `O Gemini retornou JSON inválido: ${rawText.slice(0, 500)}` },
        { status: 500 }
      )
    }

    const normalized = normalizeStructuredPayload(parsedJson)

    const transcript = sanitizeString(
      (normalized as Record<string, unknown>).transcript
    )
    const entryType = sanitizeEntryType(
      (normalized as Record<string, unknown>).entry_type
    )
    const description = sanitizeString(
      (normalized as Record<string, unknown>).description
    )
    const counterpartyName = sanitizeString(
      (normalized as Record<string, unknown>).counterparty_name
    )
    const amount = sanitizeNumber(
      (normalized as Record<string, unknown>).amount
    )
    const occurredOn = sanitizeString(
      (normalized as Record<string, unknown>).occurred_on
    )
    const dueOn = sanitizeString(
      (normalized as Record<string, unknown>).due_on
    )

    const { error: updateError } = await supabase
      .from('financial_entries')
      .update({
        transcript,
        entry_type: entryType,
        description,
        counterparty_name: counterpartyName,
        amount,
        occurred_on: occurredOn,
        due_on: dueOn,
        processing_status: 'ready',
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      parsed: {
        transcript,
        entry_type: entryType,
        description,
        counterparty_name: counterpartyName,
        amount,
        occurred_on: occurredOn,
        due_on: dueOn,
      },
    })
  } catch (error) {
    console.error('Erro na rota de processamento unificado:', error)

    const rawMessage =
      error instanceof Error ? error.message : 'Erro interno no processamento.'

    const friendlyMessage = isTemporaryUnavailableError(rawMessage)
      ? 'Serviço de IA temporariamente indisponível. Tente reprocessar ou revise manualmente ouvindo o áudio.'
      : rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')
        ? 'Quota de IA excedida. Revise manualmente ou tente novamente mais tarde.'
        : rawMessage

    if (supabase && entryId) {
      await supabase
        .from('financial_entries')
        .update({
          processing_status: 'failed',
          processing_error: friendlyMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId)
    }

    return NextResponse.json({ error: friendlyMessage }, { status: 500 })
  }
}