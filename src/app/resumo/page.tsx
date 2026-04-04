import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatCurrency, getMonthPeriod } from '@/lib/month-period'
import { createClient } from '@/lib/supabase/server'
import { ui } from '@/lib/ui'

type CashEntry = {
  id: string
  description: string | null
  amount: number | null
  occurred_on: string | null
}

type SettledDueEntry = {
  id: string
  description: string | null
  amount: number | null
  settled_amount: number | null
  settled_on: string | null
}

type OpenDueEntry = {
  id: string
  description: string | null
  counterparty_name: string | null
  amount: number | null
  due_on: string | null
}

function sumAmounts(entries: Array<{ amount: number | null }> | null | undefined) {
  if (!entries) return 0

  return entries.reduce((total, entry) => {
    return total + (entry.amount ?? 0)
  }, 0)
}

function sumSettledAmounts(
  entries:
    | Array<{ settled_amount: number | null; amount: number | null }>
    | null
    | undefined
) {
  if (!entries) return 0

  return entries.reduce((total, entry) => {
    return total + (entry.settled_amount ?? entry.amount ?? 0)
  }, 0)
}

export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const period = getMonthPeriod(month)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [
    receivedCashResult,
    receivedSettledResult,
    paidCashResult,
    paidSettledResult,
    receivableOpenResult,
    payableOpenResult,
  ] = await Promise.all([
    supabase
      .from('financial_entries')
      .select('id, description, amount, occurred_on')
      .eq('review_status', 'confirmed')
      .eq('entry_type', 'sale_received')
      .gte('occurred_on', period.startDate)
      .lt('occurred_on', period.nextDate)
      .order('occurred_on', { ascending: false }),

    supabase
      .from('financial_entries')
      .select('id, description, amount, settled_amount, settled_on')
      .eq('review_status', 'confirmed')
      .eq('entry_type', 'sale_due')
      .eq('settlement_status', 'settled')
      .gte('settled_on', period.startDate)
      .lt('settled_on', period.nextDate)
      .order('settled_on', { ascending: false }),

    supabase
      .from('financial_entries')
      .select('id, description, amount, occurred_on')
      .eq('review_status', 'confirmed')
      .eq('entry_type', 'expense_paid')
      .gte('occurred_on', period.startDate)
      .lt('occurred_on', period.nextDate)
      .order('occurred_on', { ascending: false }),

    supabase
      .from('financial_entries')
      .select('id, description, amount, settled_amount, settled_on')
      .eq('review_status', 'confirmed')
      .eq('entry_type', 'expense_due')
      .eq('settlement_status', 'settled')
      .gte('settled_on', period.startDate)
      .lt('settled_on', period.nextDate)
      .order('settled_on', { ascending: false }),

    supabase
      .from('financial_entries')
      .select('id, description, counterparty_name, amount, due_on')
      .eq('review_status', 'confirmed')
      .eq('entry_type', 'sale_due')
      .eq('settlement_status', 'open')
      .gte('due_on', period.startDate)
      .lt('due_on', period.nextDate)
      .order('due_on', { ascending: false }),

    supabase
      .from('financial_entries')
      .select('id, description, counterparty_name, amount, due_on')
      .eq('review_status', 'confirmed')
      .eq('entry_type', 'expense_due')
      .eq('settlement_status', 'open')
      .gte('due_on', period.startDate)
      .lt('due_on', period.nextDate)
      .order('due_on', { ascending: false }),
  ])

  const firstError =
    receivedCashResult.error ||
    receivedSettledResult.error ||
    paidCashResult.error ||
    paidSettledResult.error ||
    receivableOpenResult.error ||
    payableOpenResult.error

  if (firstError) {
    throw new Error(firstError.message)
  }

  const receivedCashEntries = (receivedCashResult.data ?? []) as CashEntry[]
  const receivedSettledEntries = (receivedSettledResult.data ?? []) as SettledDueEntry[]
  const paidCashEntries = (paidCashResult.data ?? []) as CashEntry[]
  const paidSettledEntries = (paidSettledResult.data ?? []) as SettledDueEntry[]
  const receivableOpenEntries = (receivableOpenResult.data ?? []) as OpenDueEntry[]
  const payableOpenEntries = (payableOpenResult.data ?? []) as OpenDueEntry[]

  const receivedTotal =
    sumAmounts(receivedCashEntries) + sumSettledAmounts(receivedSettledEntries)

  const paidTotal =
    sumAmounts(paidCashEntries) + sumSettledAmounts(paidSettledEntries)

  const receivableTotal = sumAmounts(receivableOpenEntries)
  const payableTotal = sumAmounts(payableOpenEntries)
  const confirmedBalance = receivedTotal - paidTotal

  const receivedEntries = [
    ...receivedCashEntries.map((entry) => ({
      id: `cash-${entry.id}`,
      description: entry.description,
      amount: entry.amount ?? 0,
      date: entry.occurred_on,
      label: 'Recebido à vista',
    })),
    ...receivedSettledEntries.map((entry) => ({
      id: `settled-${entry.id}`,
      description: entry.description,
      amount: entry.settled_amount ?? entry.amount ?? 0,
      date: entry.settled_on,
      label: 'Conta a receber liquidada',
    })),
  ]

  const paidEntries = [
    ...paidCashEntries.map((entry) => ({
      id: `cash-${entry.id}`,
      description: entry.description,
      amount: entry.amount ?? 0,
      date: entry.occurred_on,
      label: 'Pago à vista',
    })),
    ...paidSettledEntries.map((entry) => ({
      id: `settled-${entry.id}`,
      description: entry.description,
      amount: entry.settled_amount ?? entry.amount ?? 0,
      date: entry.settled_on,
      label: 'Conta a pagar liquidada',
    })),
  ]

  return (
    <main className={ui.page.shell}>
      <div className={ui.page.container}>
        <div className={ui.card.base}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link href="/painel" className="text-sm underline">
                Voltar para o painel
              </Link>

              <h1 className={`mt-4 ${ui.text.pageTitle}`}>Resumo financeiro</h1>

              <p className={`mt-2 ${ui.text.muted}`}>
                Resumo mensal baseado em lançamentos confirmados e liquidações
                realizadas.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/resumo?month=${period.prevMonthValue}`}
                className={ui.button.secondary}
              >
                Mês anterior
              </Link>

              <div className={ui.badge.primary}>{period.label}</div>

              <Link
                href={`/resumo?month=${period.nextMonthValue}`}
                className={ui.button.secondary}
              >
                Próximo mês
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <div className={ui.card.success}>
            <p className={ui.text.muted}>Recebido</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatCurrency(receivedTotal)}
            </p>
          </div>

          <div className={ui.card.base}>
            <p className={ui.text.muted}>Pago</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatCurrency(paidTotal)}
            </p>
          </div>

          <div className={ui.card.primary}>
            <p className={ui.text.muted}>A receber</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatCurrency(receivableTotal)}
            </p>
          </div>

          <div className={ui.card.warning}>
            <p className={ui.text.muted}>A pagar</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatCurrency(payableTotal)}
            </p>
          </div>

          <div className={ui.card.base}>
            <p className={ui.text.muted}>Saldo confirmado</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatCurrency(confirmedBalance)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className={ui.card.base}>
            <h2 className={ui.text.sectionTitle}>Recebimentos do mês</h2>

            {receivedEntries.length === 0 ? (
              <p className={`mt-4 ${ui.text.muted}`}>
                Nenhum recebimento neste mês.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {receivedEntries.map((entry) => (
                  <li key={entry.id} className={ui.card.muted}>
                    <p className={ui.text.strong}>
                      {entry.description ?? 'Sem descrição'}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>Tipo: {entry.label}</p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Valor: {formatCurrency(entry.amount)}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Data: {entry.date ?? '-'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={ui.card.base}>
            <h2 className={ui.text.sectionTitle}>Pagamentos do mês</h2>

            {paidEntries.length === 0 ? (
              <p className={`mt-4 ${ui.text.muted}`}>
                Nenhum pagamento neste mês.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {paidEntries.map((entry) => (
                  <li key={entry.id} className={ui.card.muted}>
                    <p className={ui.text.strong}>
                      {entry.description ?? 'Sem descrição'}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>Tipo: {entry.label}</p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Valor: {formatCurrency(entry.amount)}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Data: {entry.date ?? '-'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={ui.card.base}>
            <h2 className={ui.text.sectionTitle}>Contas a receber em aberto</h2>

            {receivableOpenEntries.length === 0 ? (
              <p className={`mt-4 ${ui.text.muted}`}>
                Nenhuma conta a receber em aberto neste mês.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {receivableOpenEntries.map((entry) => (
                  <li key={entry.id} className={ui.card.muted}>
                    <p className={ui.text.strong}>
                      {entry.description ?? 'Sem descrição'}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Contraparte: {entry.counterparty_name ?? '-'}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Valor: {formatCurrency(entry.amount ?? 0)}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Vencimento: {entry.due_on ?? '-'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={ui.card.base}>
            <h2 className={ui.text.sectionTitle}>Contas a pagar em aberto</h2>

            {payableOpenEntries.length === 0 ? (
              <p className={`mt-4 ${ui.text.muted}`}>
                Nenhuma conta a pagar em aberto neste mês.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {payableOpenEntries.map((entry) => (
                  <li key={entry.id} className={ui.card.muted}>
                    <p className={ui.text.strong}>
                      {entry.description ?? 'Sem descrição'}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Contraparte: {entry.counterparty_name ?? '-'}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Valor: {formatCurrency(entry.amount ?? 0)}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Vencimento: {entry.due_on ?? '-'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}