import Link from 'next/link'
import { redirect } from 'next/navigation'
import DeleteEntryButton from '@/components/delete-entry-button'
import NotificationPreferencesCard from '@/components/notification-preferences-card'
import { deleteResumoEntry } from '@/app/resumo/actions'
import { buildResumoEditHref, buildResumoHref } from '@/lib/resumo-navigation'
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

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 13.5 13 4a2.12 2.12 0 1 1 3 3l-9.5 9.5-3.5.5Z" />
      <path d="m11.5 5.5 3 3" />
    </svg>
  )
}

function EditEntryLink({
  entryId,
  returnTo,
}: {
  entryId: string
  returnTo: string
}) {
  return (
    <Link
      href={buildResumoEditHref({ entryId, returnTo })}
      className={ui.button.icon}
      aria-label="Editar movimentação"
      title="Editar movimentação"
    >
      <PencilIcon />
    </Link>
  )
}

function EntryActionButtons({
  entryId,
  returnTo,
}: {
  entryId: string
  returnTo: string
}) {
  return (
    <div className="flex items-center gap-2">
      <EditEntryLink entryId={entryId} returnTo={returnTo} />

      <form action={deleteResumoEntry}>
        <input type="hidden" name="id" value={entryId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <DeleteEntryButton />
      </form>
    </div>
  )
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

function getSectionCount(entries: Array<unknown>) {
  return entries.length
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
  const resumoReturnTo = buildResumoHref(period.monthValue)

  const receivedEntries = [
    ...receivedCashEntries.map((entry) => ({
      key: `cash-${entry.id}`,
      entryId: entry.id,
      description: entry.description,
      amount: entry.amount ?? 0,
      date: entry.occurred_on,
      label: 'Recebido à vista',
    })),
    ...receivedSettledEntries.map((entry) => ({
      key: `settled-${entry.id}`,
      entryId: entry.id,
      description: entry.description,
      amount: entry.settled_amount ?? entry.amount ?? 0,
      date: entry.settled_on,
      label: 'Conta a receber liquidada',
    })),
  ]

  const paidEntries = [
    ...paidCashEntries.map((entry) => ({
      key: `cash-${entry.id}`,
      entryId: entry.id,
      description: entry.description,
      amount: entry.amount ?? 0,
      date: entry.occurred_on,
      label: 'Pago à vista',
    })),
    ...paidSettledEntries.map((entry) => ({
      key: `settled-${entry.id}`,
      entryId: entry.id,
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
          <details className={ui.card.base}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className={ui.text.sectionTitle}>Recebimentos do mês</h2>
                  <p className={`mt-1 ${ui.text.muted}`}>
                    Entradas confirmadas e liquidações recebidas no período.
                  </p>
                </div>

                <span className={ui.badge.primary}>
                  {getSectionCount(receivedEntries)}
                </span>
              </div>
            </summary>

            {receivedEntries.length === 0 ? (
              <p className={`mt-4 ${ui.text.muted}`}>
                Nenhum recebimento neste mês.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {receivedEntries.map((entry) => (
                  <li key={entry.key} className={ui.card.muted}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={ui.text.strong}>
                          {entry.description ?? 'Sem descrição'}
                        </p>
                        <p className={`mt-1 ${ui.text.subtle}`}>
                          Tipo: {entry.label}
                        </p>
                        <p className={`mt-1 ${ui.text.subtle}`}>
                          Valor: {formatCurrency(entry.amount)}
                        </p>
                        <p className={`mt-1 ${ui.text.subtle}`}>
                          Data: {entry.date ?? '-'}
                        </p>
                      </div>

                      <EntryActionButtons
                        entryId={entry.entryId}
                        returnTo={resumoReturnTo}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </details>

          <details className={ui.card.base}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className={ui.text.sectionTitle}>Pagamentos do mês</h2>
                  <p className={`mt-1 ${ui.text.muted}`}>
                    Saídas confirmadas e liquidações pagas no período.
                  </p>
                </div>

                <span className={ui.badge.neutral}>
                  {getSectionCount(paidEntries)}
                </span>
              </div>
            </summary>

            {paidEntries.length === 0 ? (
              <p className={`mt-4 ${ui.text.muted}`}>
                Nenhum pagamento neste mês.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {paidEntries.map((entry) => (
                  <li key={entry.key} className={ui.card.muted}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={ui.text.strong}>
                          {entry.description ?? 'Sem descrição'}
                        </p>
                        <p className={`mt-1 ${ui.text.subtle}`}>
                          Tipo: {entry.label}
                        </p>
                        <p className={`mt-1 ${ui.text.subtle}`}>
                          Valor: {formatCurrency(entry.amount)}
                        </p>
                        <p className={`mt-1 ${ui.text.subtle}`}>
                          Data: {entry.date ?? '-'}
                        </p>
                      </div>

                      <EntryActionButtons
                        entryId={entry.entryId}
                        returnTo={resumoReturnTo}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </details>

          <details className={ui.card.base}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className={ui.text.sectionTitle}>
                    Contas a receber em aberto
                  </h2>
                  <p className={`mt-1 ${ui.text.muted}`}>
                    Valores ainda não liquidados com vencimento no mês.
                  </p>
                </div>

                <span className={ui.badge.primary}>
                  {getSectionCount(receivableOpenEntries)}
                </span>
              </div>
            </summary>

            {receivableOpenEntries.length === 0 ? (
              <p className={`mt-4 ${ui.text.muted}`}>
                Nenhuma conta a receber em aberto neste mês.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {receivableOpenEntries.map((entry) => (
                  <li key={entry.id} className={ui.card.muted}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
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
                      </div>

                      <EntryActionButtons
                        entryId={entry.id}
                        returnTo={resumoReturnTo}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </details>

          <details className={ui.card.base}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className={ui.text.sectionTitle}>
                    Contas a pagar em aberto
                  </h2>
                  <p className={`mt-1 ${ui.text.muted}`}>
                    Contas ainda não liquidadas com vencimento no mês.
                  </p>
                </div>

                <span className={ui.badge.warning}>
                  {getSectionCount(payableOpenEntries)}
                </span>
              </div>
            </summary>

            {payableOpenEntries.length === 0 ? (
              <p className={`mt-4 ${ui.text.muted}`}>
                Nenhuma conta a pagar em aberto neste mês.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {payableOpenEntries.map((entry) => (
                  <li key={entry.id} className={ui.card.muted}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
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
                      </div>

                      <EntryActionButtons
                        entryId={entry.id}
                        returnTo={resumoReturnTo}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </div>

        <div className="pt-2">
          <NotificationPreferencesCard />
        </div>
      </div>
    </main>
  )
}
