function padMonth(value: number) {
  return String(value).padStart(2, '0')
}

function toIsoDateUTC(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function getMonthPeriod(monthParam?: string) {
  const now = new Date()

  let year = now.getUTCFullYear()
  let month = now.getUTCMonth() + 1

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [rawYear, rawMonth] = monthParam.split('-')
    const parsedYear = Number(rawYear)
    const parsedMonth = Number(rawMonth)

    if (
      Number.isInteger(parsedYear) &&
      Number.isInteger(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12
    ) {
      year = parsedYear
      month = parsedMonth
    }
  }

  const start = new Date(Date.UTC(year, month - 1, 1))
  const next = new Date(Date.UTC(year, month, 1))
  const prev = new Date(Date.UTC(year, month - 2, 1))

  const monthValue = `${year}-${padMonth(month)}`
  const prevMonthValue = `${prev.getUTCFullYear()}-${padMonth(prev.getUTCMonth() + 1)}`
  const nextMonthValue = `${next.getUTCFullYear()}-${padMonth(next.getUTCMonth() + 1)}`

  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(start)

  return {
    monthValue,
    prevMonthValue,
    nextMonthValue,
    label,
    startDate: toIsoDateUTC(start),
    nextDate: toIsoDateUTC(next),
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}