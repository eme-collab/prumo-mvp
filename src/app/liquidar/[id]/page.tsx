import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  getEntryTypeLabel,
  getSettlementStatusLabel,
} from '@/lib/financial-entry-labels'
import { formatCurrency } from '@/lib/month-period'
import { createClient } from '@/lib/supabase/server'
import { ui } from '@/lib/ui'
import { settleEntry } from './actions'

function getErrorMessage(error?: string) {
  return function resolve(entryType: string | null) {
    switch (error) {
      case 'missing_settled_on':
        return entryType === 'sale_due'
          ? 'Informe a data do recebimento.'
          : 'Informe a data do pagamento.'
      case 'missing_settled_amount':
        return entryType === 'sale_due'
          ? 'Informe o valor recebido.'
          : 'Informe o valor pago.'
      default:
        return ''
    }
  }
}

function getTitle(entryType: string | null) {
  if (entryType === 'sale_due') {
    return 'Registrar recebimento'
  }

  if (entryType === 'expense_due') {
    return 'Registrar pagamento'
  }

  return 'Registrar baixa'
}

function getSubmitLabel(entryType: string | null) {
  if (entryType === 'sale_due') {
    return 'Confirmar recebimento'
  }

  if (entryType === 'expense_due') {
    return 'Confirmar pagamento'
  }

  return 'Confirmar'
}

function getIntroMessage(entryType: string | null) {
  if (entryType === 'sale_due') {
    return 'Confira os dados antes de confirmar o recebimento desta conta.'
  }

  if (entryType === 'expense_due') {
    return 'Confira os dados antes de confirmar o pagamento desta conta.'
  }

  return 'Confira os dados antes de concluir esta conta.'
}

function getSettlementDateLabel(entryType: string | null) {
  if (entryType === 'sale_due') {
    return 'Data do recebimento'
  }

  if (entryType === 'expense_due') {
    return 'Data do pagamento'
  }

  return 'Data'
}

function getSettlementAmountLabel(entryType: string | null) {
  if (entryType === 'sale_due') {
    return 'Valor recebido'
  }

  if (entryType === 'expense_due') {
    return 'Valor pago'
  }

  return 'Valor final'
}

export default async function LiquidarEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const resolveErrorMessage = getErrorMessage(error)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: entry, error: entryError } = await supabase
    .from('financial_entries')
    .select(
      'id, user_id, entry_type, review_status, description, counterparty_name, amount, due_on, settlement_status, settled_on, settled_amount, created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry) {
    notFound()
  }

  if (
    entry.user_id !== user.id ||
    entry.review_status !== 'confirmed' ||
    (entry.entry_type !== 'sale_due' && entry.entry_type !== 'expense_due')
  ) {
    redirect('/painel')
  }

  const errorMessage = resolveErrorMessage(entry.entry_type)

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className={ui.page.shell}>
      <div className={ui.page.containerNarrow}>
        <div className={ui.card.base}>
          <Link href="/painel" className="text-sm underline">
            Voltar para o painel
          </Link>

          <h1 className={`mt-4 ${ui.text.pageTitle}`}>
            {getTitle(entry.entry_type)}
          </h1>

          <p className={`mt-2 ${ui.text.muted}`}>
            {getIntroMessage(entry.entry_type)}
          </p>
        </div>

        {errorMessage && (
          <div className={ui.card.danger}>
            <p className="text-sm font-medium text-red-700">{errorMessage}</p>
          </div>
        )}

        <div className={ui.card.base}>
          <div className={`mb-4 ${ui.card.muted}`}>
            <p className={ui.text.body}>
              Tipo do lançamento:{' '}
              <strong>{getEntryTypeLabel(entry.entry_type)}</strong>
            </p>
            <p className={`mt-1 ${ui.text.body}`}>
              Situação atual:{' '}
              <strong>
                {getSettlementStatusLabel(entry.settlement_status ?? 'open')}
              </strong>
            </p>
            <p className={`mt-1 ${ui.text.body}`}>
              Valor previsto:{' '}
              <strong>{formatCurrency(entry.amount ?? 0)}</strong>
            </p>
          </div>

          <form action={settleEntry} className="space-y-4">
            <input type="hidden" name="id" value={entry.id} />

            <div>
              <label htmlFor="description" className={ui.text.label}>
                Descrição
              </label>
              <input
                id="description"
                name="description"
                type="text"
                defaultValue={entry.description ?? ''}
                className={ui.input.text}
                placeholder="Ex.: Serviço de instalação"
              />
            </div>

            <div>
              <label htmlFor="counterparty_name" className={ui.text.label}>
                Cliente / fornecedor
              </label>
              <input
                id="counterparty_name"
                name="counterparty_name"
                type="text"
                defaultValue={entry.counterparty_name ?? ''}
                className={ui.input.text}
                placeholder="Ex.: João"
              />
            </div>

            <div>
              <label htmlFor="amount" className={ui.text.label}>
                Valor previsto
              </label>
              <input
                id="amount"
                name="amount"
                type="text"
                defaultValue={entry.amount?.toString() ?? ''}
                className={ui.input.text}
                placeholder="Ex.: 250.00"
              />
            </div>

            <div>
              <label htmlFor="due_on" className={ui.text.label}>
                Vencimento
              </label>
              <input
                id="due_on"
                name="due_on"
                type="date"
                defaultValue={entry.due_on ?? ''}
                className={ui.input.text}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="settled_on" className={ui.text.label}>
                  {getSettlementDateLabel(entry.entry_type)}
                </label>
                <input
                  id="settled_on"
                  name="settled_on"
                  type="date"
                  defaultValue={entry.settled_on ?? today}
                  className={ui.input.text}
                />
              </div>

              <div>
                <label htmlFor="settled_amount" className={ui.text.label}>
                  {getSettlementAmountLabel(entry.entry_type)}
                </label>
                <input
                  id="settled_amount"
                  name="settled_amount"
                  type="text"
                  defaultValue={
                    entry.settled_amount?.toString() ??
                    entry.amount?.toString() ??
                    ''
                  }
                  className={ui.input.text}
                  placeholder="Ex.: 250.00"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button type="submit" className={ui.button.primary}>
                {getSubmitLabel(entry.entry_type)}
              </button>

              <Link href="/painel" className={ui.button.secondary}>
                Cancelar
              </Link>
            </div>
          </form>
        </div>

        <div className={ui.card.base}>
          <h2 className={ui.text.sectionTitle}>Informações do lançamento</h2>
          <p className={`mt-2 ${ui.text.muted}`}>
            Criado em: {entry.created_at}
          </p>
        </div>
      </div>
    </main>
  )
}
