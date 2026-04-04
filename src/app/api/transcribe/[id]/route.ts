import { NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import { gemini } from '@/lib/gemini'
import { convertAudioBufferToWav } from '@/lib/audio/convert-to-wav'

export const runtime = 'nodejs'

function getExtensionFromPath(filePath: string) {
  return filePath.split('.').pop()?.toLowerCase() || 'webm'
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

    const { data: audioBlob, error: downloadError } = await supabase.storage
      .from('voice-notes')
      .download(entry.audio_path)

    if (downloadError || !audioBlob) {
      return NextResponse.json(
        { error: downloadError?.message || 'Falha ao baixar o áudio.' },
        { status: 500 }
      )
    }

    const inputArrayBuffer = await audioBlob.arrayBuffer()
    const inputBuffer = Buffer.from(inputArrayBuffer)
    const inputExtension = getExtensionFromPath(entry.audio_path)

    const wavBuffer = await convertAudioBufferToWav(inputBuffer, inputExtension)
    const base64Audio = wavBuffer.toString('base64')

    const prompt = `
Transcreva integralmente a fala deste áudio em português do Brasil.

Regras:
- retorne apenas a transcrição;
- não explique nada;
- não resuma;
- preserve números, valores, datas e nomes do jeito mais natural possível;
- se algum trecho estiver incompreensível, use [inaudível].
`.trim()

    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: base64Audio,
          },
        },
      ],
    })

    const transcriptText = response.text?.trim() || null

    const { error: updateError } = await supabase
      .from('financial_entries')
      .update({
        transcript: transcriptText,
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      transcript: transcriptText,
    })
  } catch (error) {
    console.error('Erro na rota de transcrição Gemini:', error)

    if (supabase && entryId) {
      await supabase
        .from('financial_entries')
        .update({
          processing_status: 'failed',
          processing_error:
            error instanceof Error
              ? error.message
              : 'Erro interno na transcrição.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId)
    }

    const message =
      error instanceof Error ? error.message : 'Erro interno na transcrição.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}