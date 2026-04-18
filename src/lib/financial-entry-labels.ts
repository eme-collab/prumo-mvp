export {
  compareOpenAccountsByUrgency,
  getOpenAccountUrgencyMeta,
} from '@/lib/pending-state'

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
