import { NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import { gemini } from '@/lib/gemini'
import {
  financialEntryParseSchema,
  financialEntryParseJsonSchema,
} from '@/lib/financial-entry-parser-schema'

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

function normalizeParsedPayload(raw: unknown) {
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error('O Gemini retornou um array vazio.')
    }

    return raw[0]
  }

  return raw
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
      .select(
        'id, user_id, transcript, review_status, entry_type, description, counterparty_name, amount, occurred_on, due_on'
      )
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

    if (!entry.transcript) {
      return NextResponse.json(
        { error: 'Este lançamento ainda não possui transcrição.' },
        { status: 400 }
      )
    }

    await supabase
      .from('financial_entries')
      .update({
        processing_status: 'parsing',
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    const today = getTodayInSaoPaulo()

    const prompt = `
Você é um extrator de lançamentos financeiros para microempreendedores do Brasil.

Hoje é ${today}.

Sua tarefa é analisar a transcrição abaixo e devolver UM ÚNICO OBJETO JSON válido no formato exigido.

Não devolva lista.
Não devolva array.
Não devolva mais de um item.
Não envolva a resposta em colchetes.

Contexto do produto:
- Existem apenas 4 tipos possíveis de lançamento:
  1. sale_received = venda recebida
  2. sale_due = venda a receber
  3. expense_paid = despesa paga
  4. expense_due = despesa a pagar

Regras:
- Use apenas a transcrição fornecida.
- Se não houver segurança suficiente, devolva null no campo.
- amount deve ser um número.
- occurred_on e due_on devem estar em YYYY-MM-DD quando houver confiança suficiente.
- due_on só deve existir quando houver prazo futuro.
- Se o texto indicar que algo já foi pago ou recebido, prefira occurred_on.
- Se o texto indicar que algo será pago ou recebido depois, prefira due_on.
- description deve ser curta, clara e útil para o histórico.
- counterparty_name deve ser preenchido apenas se houver nome claro.
- Não invente dados.

Transcrição:
${entry.transcript}
`.trim()

    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: financialEntryParseJsonSchema,
      },
    })

    const rawText = response.text?.trim()

    if (!rawText) {
      return NextResponse.json(
        { error: 'O Gemini não retornou conteúdo na interpretação.' },
        { status: 500 }
      )
    }

    let parsedJson: unknown

    try {
      parsedJson = JSON.parse(rawText)
    } catch {
      return NextResponse.json(
        {
          error: `O Gemini retornou JSON inválido: ${rawText.slice(0, 500)}`,
        },
        { status: 500 }
      )
    }

    const normalized = normalizeParsedPayload(parsedJson)
    const parsed = financialEntryParseSchema.parse(normalized)

    const { error: updateError } = await supabase
      .from('financial_entries')
      .update({
        entry_type: parsed.entry_type ?? entry.entry_type,
        description: parsed.description ?? entry.description,
        counterparty_name:
          parsed.counterparty_name ?? entry.counterparty_name,
        amount: parsed.amount ?? entry.amount,
        occurred_on: parsed.occurred_on ?? entry.occurred_on,
        due_on: parsed.due_on ?? entry.due_on,
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
      parsed,
    })
  } catch (error) {
    console.error('Erro na rota de interpretação:', error)

    if (supabase && entryId) {
      await supabase
        .from('financial_entries')
        .update({
          processing_status: 'failed',
          processing_error:
            error instanceof Error
              ? error.message
              : 'Erro interno na interpretação.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId)
    }

    const message =
      error instanceof Error ? error.message : 'Erro interno na interpretação.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}