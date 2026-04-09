import { financialEntryStructuredSchema } from '@/lib/ai/financial-entry-structured-schema'
import {
  gemini,
  getGeminiMaxAttemptsPerModel,
  getGeminiModelCandidates,
  getGeminiRetryDelayMs,
  getGeminiTimeoutMs,
} from '@/lib/gemini'
import type { EntryType } from '@/types/financial-entry'

const ALLOWED_ENTRY_TYPES = new Set<EntryType>([
  'sale_received',
  'sale_due',
  'expense_paid',
  'expense_due',
])

const REQUIRED_FIELDS = [
  'transcript',
  'entry_type',
  'description',
  'counterparty_name',
  'amount',
  'occurred_on',
  'due_on',
] as const

export type GeminiProcessingErrorKind =
  | 'quota_exceeded'
  | 'rate_limit'
  | 'timeout'
  | 'temporary_unavailable'
  | 'invalid_response'
  | 'unexpected'

export type ParsedFinancialEntryFromGemini = {
  transcript: string | null
  entry_type: EntryType | null
  description: string | null
  counterparty_name: string | null
  amount: number | null
  occurred_on: string | null
  due_on: string | null
}

export type GeminiProcessingAttempt = {
  model: string
  attempt: number
  kind: GeminiProcessingErrorKind
  message: string
}

type GeminiProcessingMeta = {
  model: string | null
  fallbackTriggered: boolean
  attempts: number
  errors: GeminiProcessingAttempt[]
}

export type ProcessFinancialEntrySuccess = {
  ok: true
  parsed: ParsedFinancialEntryFromGemini
  rawText: string
  meta: GeminiProcessingMeta & {
    model: string
  }
}

export type ProcessFinancialEntryFailure = {
  ok: false
  errorKind: GeminiProcessingErrorKind
  userMessage: string
  rawMessage: string
  meta: GeminiProcessingMeta
}

export type ProcessFinancialEntryResult =
  | ProcessFinancialEntrySuccess
  | ProcessFinancialEntryFailure

class GeminiInvalidResponseError extends Error {}

class GeminiTimeoutError extends Error {}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getTodayInSaoPaulo() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(new Date())
}

function buildFinancialEntryPrompt(today: string) {
  return `
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStructuredPayload(raw: unknown) {
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new GeminiInvalidResponseError('O Gemini retornou um array vazio.')
    }

    if (raw.length > 1) {
      throw new GeminiInvalidResponseError(
        'O Gemini retornou mais de um objeto estruturado.'
      )
    }

    return normalizeStructuredPayload(raw[0])
  }

  if (!isRecord(raw)) {
    throw new GeminiInvalidResponseError(
      'O Gemini nao retornou um objeto JSON valido.'
    )
  }

  return raw
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function sanitizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sanitizeEntryType(value: unknown) {
  return typeof value === 'string' && ALLOWED_ENTRY_TYPES.has(value as EntryType)
    ? (value as EntryType)
    : null
}

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validateNullableStringField(payload: Record<string, unknown>, key: string) {
  const value = payload[key]

  if (value === null) {
    return
  }

  if (typeof value !== 'string') {
    throw new GeminiInvalidResponseError(
      `Campo ${key} invalido no schema retornado pelo Gemini.`
    )
  }
}

function validateNullableDateField(payload: Record<string, unknown>, key: string) {
  validateNullableStringField(payload, key)

  const value = payload[key]

  if (typeof value === 'string' && !isValidDateString(value)) {
    throw new GeminiInvalidResponseError(
      `Campo ${key} com formato de data invalido no schema retornado pelo Gemini.`
    )
  }
}

function validateStructuredPayload(payload: Record<string, unknown>) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in payload)) {
      throw new GeminiInvalidResponseError(
        `Campo obrigatorio ausente no JSON do Gemini: ${field}.`
      )
    }
  }

  validateNullableStringField(payload, 'transcript')
  validateNullableStringField(payload, 'description')
  validateNullableStringField(payload, 'counterparty_name')
  validateNullableDateField(payload, 'occurred_on')
  validateNullableDateField(payload, 'due_on')

  const entryType = payload.entry_type

  if (
    entryType !== null &&
    (typeof entryType !== 'string' ||
      !ALLOWED_ENTRY_TYPES.has(entryType as EntryType))
  ) {
    throw new GeminiInvalidResponseError(
      'Campo entry_type invalido no schema retornado pelo Gemini.'
    )
  }

  const amount = payload.amount

  if (
    amount !== null &&
    (typeof amount !== 'number' || !Number.isFinite(amount))
  ) {
    throw new GeminiInvalidResponseError(
      'Campo amount invalido no schema retornado pelo Gemini.'
    )
  }
}

function parseGeminiFinancialEntry(rawText: string): ParsedFinancialEntryFromGemini {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(rawText)
  } catch {
    throw new GeminiInvalidResponseError(
      'O Gemini retornou JSON invalido para o processamento.'
    )
  }

  const normalized = normalizeStructuredPayload(parsedJson)
  validateStructuredPayload(normalized)

  return {
    transcript: sanitizeString(normalized.transcript),
    entry_type: sanitizeEntryType(normalized.entry_type),
    description: sanitizeString(normalized.description),
    counterparty_name: sanitizeString(normalized.counterparty_name),
    amount: sanitizeNumber(normalized.amount),
    occurred_on: sanitizeString(normalized.occurred_on),
    due_on: sanitizeString(normalized.due_on),
  }
}

function classifyGeminiError(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : 'Erro desconhecido no Gemini.'

  if (error instanceof GeminiInvalidResponseError) {
    return {
      kind: 'invalid_response' as const,
      rawMessage,
    }
  }

  if (error instanceof GeminiTimeoutError) {
    return {
      kind: 'timeout' as const,
      rawMessage,
    }
  }

  const normalized = rawMessage.toLowerCase()

  if (
    normalized.includes('resource_exhausted') ||
    normalized.includes('quota') ||
    normalized.includes('insufficient_quota')
  ) {
    return {
      kind: 'quota_exceeded' as const,
      rawMessage,
    }
  }

  if (
    normalized.includes('"code":429') ||
    normalized.includes('status: 429') ||
    normalized.includes('http 429') ||
    normalized.includes('too many requests') ||
    normalized.includes('rate limit')
  ) {
    return {
      kind: 'rate_limit' as const,
      rawMessage,
    }
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('deadline exceeded') ||
    normalized.includes('abort')
  ) {
    return {
      kind: 'timeout' as const,
      rawMessage,
    }
  }

  if (
    normalized.includes('"code":503') ||
    normalized.includes('"code":502') ||
    normalized.includes('service unavailable') ||
    normalized.includes('unavailable') ||
    normalized.includes('temporarily overloaded') ||
    normalized.includes('high demand') ||
    normalized.includes('overloaded')
  ) {
    return {
      kind: 'temporary_unavailable' as const,
      rawMessage,
    }
  }

  return {
    kind: 'unexpected' as const,
    rawMessage,
  }
}

function getFriendlyMessage(kind: GeminiProcessingErrorKind) {
  switch (kind) {
    case 'quota_exceeded':
      return 'Quota de IA excedida. Revise manualmente ou tente novamente mais tarde.'
    case 'rate_limit':
      return 'Muitas solicitacoes para a IA no momento. Tente reprocessar em instantes ou revise manualmente.'
    case 'timeout':
      return 'A IA demorou demais para responder. Tente reprocessar ou revise manualmente ouvindo o audio.'
    case 'temporary_unavailable':
      return 'Servico de IA temporariamente indisponivel. Tente reprocessar ou revise manualmente ouvindo o audio.'
    case 'invalid_response':
      return 'A IA retornou uma resposta invalida. Tente reprocessar ou revise manualmente.'
    case 'unexpected':
    default:
      return 'Erro interno no processamento por IA. Tente novamente ou revise manualmente.'
  }
}

export function getHttpStatusForGeminiProcessingError(
  kind: GeminiProcessingErrorKind
) {
  switch (kind) {
    case 'quota_exceeded':
    case 'rate_limit':
      return 429
    case 'timeout':
    case 'temporary_unavailable':
      return 503
    case 'invalid_response':
      return 502
    case 'unexpected':
    default:
      return 500
  }
}

function shouldRetrySameModel(
  kind: GeminiProcessingErrorKind,
  attempt: number,
  maxAttemptsPerModel: number
) {
  if (attempt >= maxAttemptsPerModel) {
    return false
  }

  return (
    kind === 'rate_limit' ||
    kind === 'timeout' ||
    kind === 'temporary_unavailable'
  )
}

function shouldTryNextModel(kind: GeminiProcessingErrorKind, hasNextModel: boolean) {
  if (!hasNextModel) {
    return false
  }

  return kind !== 'unexpected'
}

function buildFailureResult(
  errors: GeminiProcessingAttempt[]
): ProcessFinancialEntryFailure {
  const lastError = errors[errors.length - 1]
  const usedModels = new Set(errors.map((item) => item.model))
  const errorKind = lastError?.kind ?? 'unexpected'
  const rawMessage =
    lastError?.message ?? 'Erro inesperado ao processar o audio com Gemini.'

  return {
    ok: false,
    errorKind,
    userMessage: getFriendlyMessage(errorKind),
    rawMessage,
    meta: {
      model: lastError?.model ?? null,
      fallbackTriggered: usedModels.size > 1,
      attempts: errors.length,
      errors,
    },
  }
}

async function callGeminiModel(model: string, base64Audio: string, prompt: string) {
  const timeoutMs = getGeminiTimeoutMs()
  let timeoutHandle: NodeJS.Timeout | undefined

  try {
    return await Promise.race([
      gemini.models.generateContent({
        model,
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
      }),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new GeminiTimeoutError(
              `Gemini timeout apos ${timeoutMs}ms no modelo ${model}.`
            )
          )
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

export async function processFinancialEntryWithGemini(options: {
  base64Audio: string
}): Promise<ProcessFinancialEntryResult> {
  const prompt = buildFinancialEntryPrompt(getTodayInSaoPaulo())
  const candidates = getGeminiModelCandidates()
  const retryDelayMs = getGeminiRetryDelayMs()
  const maxAttemptsPerModel = getGeminiMaxAttemptsPerModel()
  const errors: GeminiProcessingAttempt[] = []

  for (const [modelIndex, candidate] of candidates.entries()) {
    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      try {
        const response = await callGeminiModel(
          candidate.model,
          options.base64Audio,
          prompt
        )

        const rawText = response.text?.trim()

        if (!rawText) {
          throw new GeminiInvalidResponseError(
            'O Gemini nao retornou conteudo no processamento.'
          )
        }

        const parsed = parseGeminiFinancialEntry(rawText)
        const meta = {
          model: candidate.model,
          fallbackTriggered: candidate.isFallback,
          attempts: errors.length + 1,
          errors,
        }

        console.info('Gemini processing finished', {
          model: candidate.model,
          fallbackTriggered: meta.fallbackTriggered,
          errorKind: null,
          result: 'success',
        })

        return {
          ok: true,
          parsed,
          rawText,
          meta,
        }
      } catch (error) {
        const classifiedError = classifyGeminiError(error)
        const attemptError = {
          model: candidate.model,
          attempt,
          kind: classifiedError.kind,
          message: classifiedError.rawMessage,
        } satisfies GeminiProcessingAttempt

        errors.push(attemptError)

        console.warn('Gemini attempt failed', {
          model: candidate.model,
          fallbackTriggered: candidate.isFallback,
          errorKind: classifiedError.kind,
          attempt,
          result: 'retrying_or_fallback',
        })

        if (
          shouldRetrySameModel(
            classifiedError.kind,
            attempt,
            maxAttemptsPerModel
          )
        ) {
          await sleep(retryDelayMs)
          continue
        }

        const hasNextModel = modelIndex < candidates.length - 1

        if (!shouldTryNextModel(classifiedError.kind, hasNextModel)) {
          const failure = buildFailureResult(errors)

          console.error('Gemini processing failed', {
            model: failure.meta.model,
            fallbackTriggered: failure.meta.fallbackTriggered,
            errorKind: failure.errorKind,
            result: 'failed',
          })

          return failure
        }

        break
      }
    }
  }

  const failure = buildFailureResult(errors)

  console.error('Gemini processing failed', {
    model: failure.meta.model,
    fallbackTriggered: failure.meta.fallbackTriggered,
    errorKind: failure.errorKind,
    result: 'failed',
  })

  return failure
}
