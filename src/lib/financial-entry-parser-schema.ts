import { z } from 'zod'

export const financialEntryParseSchema = z.object({
  entry_type: z
    .enum(['sale_received', 'sale_due', 'expense_paid', 'expense_due'])
    .nullable(),

  description: z.string().nullable(),

  counterparty_name: z.string().nullable(),

  amount: z.number().nullable(),

  occurred_on: z.string().nullable(),

  due_on: z.string().nullable(),
})

export type FinancialEntryParseResult = z.infer<
  typeof financialEntryParseSchema
>

export const financialEntryParseJsonSchema = {
  type: 'object',
  propertyOrdering: [
    'entry_type',
    'description',
    'counterparty_name',
    'amount',
    'occurred_on',
    'due_on',
  ],
  properties: {
    entry_type: {
      type: 'string',
      nullable: true,
      enum: [
        'sale_received',
        'sale_due',
        'expense_paid',
        'expense_due',
      ],
      description:
        'Tipo do lançamento. Use null se não houver confiança suficiente.',
    },
    description: {
      type: 'string',
      nullable: true,
      description:
        'Descrição curta e objetiva do lançamento. Ex.: Serviço de instalação.',
    },
    counterparty_name: {
      type: 'string',
      nullable: true,
      description:
        'Nome do cliente, fornecedor ou outra contraparte, se houver.',
    },
    amount: {
      type: 'number',
      nullable: true,
      description:
        'Valor principal do lançamento em número decimal. Ex.: 250 ou 110.21.',
    },
    occurred_on: {
      type: 'string',
      nullable: true,
      description:
        'Data do fato no formato YYYY-MM-DD. Use null se não for possível inferir com segurança.',
    },
    due_on: {
      type: 'string',
      nullable: true,
      description:
        'Data futura de recebimento ou pagamento no formato YYYY-MM-DD. Use null se não existir prazo.',
    },
  },
  required: [
    'entry_type',
    'description',
    'counterparty_name',
    'amount',
    'occurred_on',
    'due_on',
  ],
} as const