import { NextResponse } from 'next/server'
import {
  getHttpStatusForGeminiProcessingError,
  processFinancialEntryWithGemini,
} from '@/lib/ai/process-financial-entry'
import { convertAudioBufferToWav } from '@/lib/audio/convert-to-wav'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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

async function markEntryAsFailed(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  entryId: string,
  message: string
) {
  await supabase
    .from('financial_entries')
    .update({
      processing_status: 'failed',
      processing_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
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
      return NextResponse.json(
        { error: 'Lançamento não encontrado.' },
        { status: 404 }
      )
    }

    if (!entry.audio_path) {
      return NextResponse.json(
        { error: 'Este lançamento não possui áudio.' },
        { status: 400 }
      )
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

    await supabase
      .from('financial_entries')
      .update({
        processing_status: 'parsing',
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    const processingResult = await processFinancialEntryWithGemini({
      base64Audio: wavBuffer.toString('base64'),
    })

    if (!processingResult.ok) {
      await markEntryAsFailed(supabase, id, processingResult.userMessage)

      return NextResponse.json(
        {
          error: processingResult.userMessage,
          errorKind: processingResult.errorKind,
        },
        {
          status: getHttpStatusForGeminiProcessingError(
            processingResult.errorKind
          ),
        }
      )
    }

    const { error: updateError } = await supabase
      .from('financial_entries')
      .update({
        transcript: processingResult.parsed.transcript,
        entry_type: processingResult.parsed.entry_type,
        description: processingResult.parsed.description,
        counterparty_name: processingResult.parsed.counterparty_name,
        amount: processingResult.parsed.amount,
        occurred_on: processingResult.parsed.occurred_on,
        due_on: processingResult.parsed.due_on,
        processing_status: 'ready',
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      const persistenceFailureMessage =
        'Falha ao salvar o resultado do processamento. Tente reprocessar ou revise manualmente.'

      await markEntryAsFailed(supabase, id, persistenceFailureMessage)

      return NextResponse.json(
        { error: persistenceFailureMessage },
        { status: 500 }
      )
    }

    console.info('Financial entry processing persisted', {
      entryId: id,
      model: processingResult.meta.model,
      fallbackTriggered: processingResult.meta.fallbackTriggered,
      errorKind: null,
      result: 'ready',
    })

    return NextResponse.json({
      success: true,
      parsed: processingResult.parsed,
      meta: {
        model: processingResult.meta.model,
        fallbackTriggered: processingResult.meta.fallbackTriggered,
      },
    })
  } catch (error) {
    console.error('Erro na rota de processamento unificado:', error)

    const friendlyMessage =
      'Falha ao processar o áudio. Tente reprocessar ou revise manualmente.'

    if (supabase && entryId) {
      await markEntryAsFailed(supabase, entryId, friendlyMessage)
    }

    return NextResponse.json({ error: friendlyMessage }, { status: 500 })
  }
}
