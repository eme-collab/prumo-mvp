import Link from 'next/link'
import { ui } from '@/lib/ui'

type EntryFormValues = {
  id: string
  transcript: string | null
  entry_type: string | null
  description: string | null
  counterparty_name: string | null
  amount: number | null
  occurred_on: string | null
  due_on: string | null
  settled_on?: string | null
  settled_amount?: number | null
}

type FinancialEntryFormProps = {
  action: (formData: FormData) => void | Promise<void>
  entry: EntryFormValues
  mode: 'review' | 'edit'
  cancelHref: string
  returnTo?: string
  showSettlementFields?: boolean
}

function getSettlementDateLabel(entryType: string | null | undefined) {
  if (entryType === 'sale_due') {
    return 'Data do recebimento'
  }

  if (entryType === 'expense_due') {
    return 'Data do pagamento'
  }

  return 'Data'
}

function getSettlementAmountLabel(entryType: string | null | undefined) {
  if (entryType === 'sale_due') {
    return 'Valor recebido'
  }

  if (entryType === 'expense_due') {
    return 'Valor pago'
  }

  return 'Valor final'
}

export default function FinancialEntryForm({
  action,
  entry,
  mode,
  cancelHref,
  returnTo,
  showSettlementFields = false,
}: FinancialEntryFormProps) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={entry.id} />
      {mode === 'edit' && returnTo && (
        <input type="hidden" name="return_to" value={returnTo} />
      )}

      <div>
        <label htmlFor="transcript" className="mb-2 block text-sm font-medium">
          Transcrição
        </label>
        <textarea
          id="transcript"
          name="transcript"
          defaultValue={entry.transcript ?? ''}
          rows={5}
          className={ui.input.textarea}
          placeholder="Opcional. Se precisar, ajuste a transcrição para deixar o histórico mais claro."
        />
      </div>

      <div>
        <label htmlFor="entry_type" className="mb-2 block text-sm font-medium">
          Tipo de lançamento
        </label>
        <select
          id="entry_type"
          name="entry_type"
          defaultValue={entry.entry_type ?? ''}
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
        <label htmlFor="description" className="mb-2 block text-sm font-medium">
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
          defaultValue={entry.counterparty_name ?? ''}
          className={ui.input.text}
          placeholder="Ex.: João"
        />
      </div>

      <div>
        <label htmlFor="amount" className="mb-2 block text-sm font-medium">
          Valor
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
            defaultValue={entry.occurred_on ?? ''}
            className={ui.input.text}
          />
        </div>

        <div>
          <label htmlFor="due_on" className="mb-2 block text-sm font-medium">
            Data de vencimento
          </label>
          <input
            id="due_on"
            name="due_on"
            type="date"
            defaultValue={entry.due_on ?? ''}
            className={ui.input.text}
          />
        </div>
      </div>

      {showSettlementFields && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="settled_on"
              className="mb-2 block text-sm font-medium"
            >
              {getSettlementDateLabel(entry.entry_type)}
            </label>
            <input
              id="settled_on"
              name="settled_on"
              type="date"
              defaultValue={entry.settled_on ?? ''}
              className={ui.input.text}
            />
          </div>

          <div>
            <label
              htmlFor="settled_amount"
              className="mb-2 block text-sm font-medium"
            >
              {getSettlementAmountLabel(entry.entry_type)}
            </label>
            <input
              id="settled_amount"
              name="settled_amount"
              type="text"
              defaultValue={entry.settled_amount?.toString() ?? ''}
              className={ui.input.text}
              placeholder="Ex.: 250.00"
            />
          </div>
        </div>
      )}

      {mode === 'review' ? (
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            name="intent"
            value="save"
            className={ui.button.secondary}
          >
            Salvar para depois
          </button>

          <button
            type="submit"
            name="intent"
            value="confirm"
            className={ui.button.primary}
          >
            Confirmar lançamento
          </button>

          <button
            type="submit"
            name="intent"
            value="discard"
            className={ui.button.danger}
          >
            Descartar lançamento
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" className={ui.button.primary}>
            Salvar alterações
          </button>

          <Link href={cancelHref} className={ui.button.secondary}>
            Cancelar
          </Link>
        </div>
      )}
    </form>
  )
}
