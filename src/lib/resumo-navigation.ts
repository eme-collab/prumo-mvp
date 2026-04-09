export function buildResumoHref(month?: string) {
  return month ? `/resumo?month=${month}` : '/resumo'
}

export function sanitizeResumoReturnTo(
  rawValue: string | null | undefined
) {
  if (!rawValue) {
    return '/resumo'
  }

  if (rawValue === '/resumo' || rawValue.startsWith('/resumo?')) {
    return rawValue
  }

  return '/resumo'
}

export function buildResumoEditHref(input: {
  entryId: string
  returnTo: string
}) {
  return `/revisar/${input.entryId}?mode=edit&returnTo=${encodeURIComponent(
    input.returnTo
  )}`
}
