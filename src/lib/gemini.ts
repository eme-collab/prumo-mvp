import { GoogleGenAI } from '@google/genai'

export const gemini = new GoogleGenAI({})

export type GeminiModelCandidate = {
  model: string
  isFallback: boolean
}

function readPositiveIntEnv(name: string, fallback: number) {
  const rawValue = process.env[name]

  if (!rawValue) {
    return fallback
  }

  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback
  }

  return Math.floor(parsedValue)
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export function getGeminiModelCandidates(): GeminiModelCandidate[] {
  const primaryModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
  const fallbackModel = process.env.GEMINI_MODEL_FALLBACK || primaryModel

  return uniqueNonEmpty([primaryModel, fallbackModel]).map((model, index) => ({
    model,
    isFallback: index > 0,
  }))
}

export function getGeminiRetryDelayMs() {
  return readPositiveIntEnv('GEMINI_RETRY_DELAY_MS', 1500)
}

export function getGeminiTimeoutMs() {
  return readPositiveIntEnv('GEMINI_TIMEOUT_MS', 30000)
}

export function getGeminiMaxAttemptsPerModel() {
  return readPositiveIntEnv('GEMINI_MAX_ATTEMPTS_PER_MODEL', 2)
}
