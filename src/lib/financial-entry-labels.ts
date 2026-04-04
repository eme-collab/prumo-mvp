export function getEntryTypeLabel(entryType: string | null | undefined) {
  switch (entryType) {
    case 'sale_received':
      return 'Venda recebida'
    case 'sale_due':
      return 'Venda a receber'
    case 'expense_paid':
      return 'Despesa paga'
    case 'expense_due':
      return 'Despesa a pagar'
    default:
      return '-'
  }
}

export function getSettlementStatusLabel(
  settlementStatus: string | null | undefined
) {
  switch (settlementStatus) {
    case 'open':
      return 'Em aberto'
    case 'settled':
      return 'Liquidada'
    default:
      return '-'
  }
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

export function getOpenAccountUrgencyMeta(dueOn: string | null | undefined) {
  if (!dueOn) {
    return {
      label: 'Sem vencimento',
      tone: 'neutral' as const,
      rank: 3,
    }
  }

  const today = getTodayInSaoPaulo()

  if (dueOn < today) {
    return {
      label: 'Vencida',
      tone: 'danger' as const,
      rank: 0,
    }
  }

  if (dueOn === today) {
    return {
      label: 'Vence hoje',
      tone: 'warning' as const,
      rank: 1,
    }
  }

  return {
    label: 'Em aberto',
    tone: 'neutral' as const,
    rank: 2,
  }
}

export function getUrgencyBadgeClass(
  tone: 'danger' | 'warning' | 'neutral'
) {
  switch (tone) {
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-neutral-200 bg-neutral-50 text-neutral-700'
  }
}

export function compareOpenAccountsByUrgency<
  T extends { due_on: string | null }
>(a: T, b: T) {
  const metaA = getOpenAccountUrgencyMeta(a.due_on)
  const metaB = getOpenAccountUrgencyMeta(b.due_on)

  if (metaA.rank !== metaB.rank) {
    return metaA.rank - metaB.rank
  }

  const dueA = a.due_on ?? '9999-12-31'
  const dueB = b.due_on ?? '9999-12-31'

  return dueA.localeCompare(dueB)
}