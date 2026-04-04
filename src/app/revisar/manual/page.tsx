import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border p-6">
          <Link href="/painel" className="text-sm underline">
            Voltar para o painel
          </Link>

          <h1 className="mt-4 text-2xl font-semibold">
            Novo lançamento manual
          </h1>

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

        <div className="rounded-2xl border p-6">
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
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
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
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
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
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
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
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
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
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
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
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                name="intent"
                value="confirm"
                className="rounded-xl border px-4 py-3 text-sm font-medium"
              >
                Salvar e confirmar
              </button>

              <button
                type="submit"
                name="intent"
                value="pending"
                className="rounded-xl border px-4 py-3 text-sm font-medium"
              >
                Salvar como pendente
              </button>

              <Link
                href="/painel"
                className="rounded-xl border px-4 py-3 text-sm font-medium"
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