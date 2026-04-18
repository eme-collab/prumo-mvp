import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AppShellHeader from '@/components/app-shell-header'
import { getNotificationUsefulItemsState } from '@/lib/notification-menu-state'
import { createClient } from '@/lib/supabase/server'
import { ui } from '@/lib/ui'
import { resolveFirstCaptureState } from '@/lib/user-app-state'
import { createManualEntry } from './actions'

function getErrorMessage(error?: string) {
  switch (error) {
    case 'missing_type':
      return 'Selecione o tipo de lançamento antes de salvar e confirmar.'
    case 'missing_amount':
      return 'Informe o valor antes de salvar e confirmar.'
    default:
      return ''
  }
}

export default async function RevisarManualPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const errorMessage = getErrorMessage(error)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const cookieStore = await cookies()
  const firstCaptureState = await resolveFirstCaptureState({
    supabase,
    userId: user.id,
    cookieStore,
  })
  const usefulItems = await getNotificationUsefulItemsState(supabase, user.id)

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className={ui.page.shell}>
      <div className={ui.page.containerNarrow}>
        <AppShellHeader
          userId={user.id}
          hasCompletedFirstCapture={firstCaptureState.hasCompletedFirstCapture}
          isZenMode={!firstCaptureState.hasCompletedFirstCapture}
          usefulItems={usefulItems}
          actionHref="/painel"
          actionLabel="Painel"
        />

        <div className={ui.card.base}>
          <h1 className="text-2xl font-semibold">Novo lançamento manual</h1>

          <p className="mt-2 text-sm text-neutral-600">
            Preencha os dados diretamente. O botão principal salva e confirma o
            lançamento. Salvar como pendente é opcional.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className={ui.card.base}>
          <form action={createManualEntry} className="space-y-4">
            <div>
              <label
                htmlFor="entry_type"
                className="mb-2 block text-sm font-medium"
              >
                Tipo de lançamento
              </label>
              <select
                id="entry_type"
                name="entry_type"
                defaultValue=""
                className={ui.input.select}
              >
                <option value="">Selecione</option>
                <option value="sale_received">Venda recebida</option>
                <option value="sale_due">Venda a receber</option>
                <option value="expense_paid">Despesa paga</option>
                <option value="expense_due">Despesa a pagar</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium"
              >
                Descrição
              </label>
              <input
                id="description"
                name="description"
                type="text"
                className={ui.input.text}
                placeholder="Ex.: Serviço de instalação"
              />
            </div>

            <div>
              <label
                htmlFor="counterparty_name"
                className="mb-2 block text-sm font-medium"
              >
                Cliente / fornecedor
              </label>
              <input
                id="counterparty_name"
                name="counterparty_name"
                type="text"
                className={ui.input.text}
                placeholder="Ex.: João"
              />
            </div>

            <div>
              <label
                htmlFor="amount"
                className="mb-2 block text-sm font-medium"
              >
                Valor
              </label>
              <input
                id="amount"
                name="amount"
                type="text"
                className={ui.input.text}
                placeholder="Ex.: 250.00"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="occurred_on"
                  className="mb-2 block text-sm font-medium"
                >
                  Data do fato
                </label>
                <input
                  id="occurred_on"
                  name="occurred_on"
                  type="date"
                  defaultValue={today}
                  className={ui.input.text}
                />
              </div>

              <div>
                <label
                  htmlFor="due_on"
                  className="mb-2 block text-sm font-medium"
                >
                  Data de vencimento
                </label>
                <input
                  id="due_on"
                  name="due_on"
                  type="date"
                  className={ui.input.text}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                name="intent"
                value="confirm"
                className={ui.button.primary}
              >
                Salvar e confirmar
              </button>

              <button
                type="submit"
                name="intent"
                value="pending"
                className={ui.button.secondary}
              >
                Salvar como pendente
              </button>

              <Link
                href="/painel"
                className={ui.button.secondary}
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
