export const financialEntryStructuredSchema = {
  type: 'object',
  propertyOrdering: [
    'transcript',
    'entry_type',
    'description',
    'counterparty_name',
    'amount',
    'occurred_on',
    'due_on',
  ],
  properties: {
    transcript: {
      type: 'string',
      nullable: true,
      description: 'Transcrição integral do áudio em português do Brasil.',
    },
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
        'Tipo do lançamento. Use null se não houver segurança suficiente.',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Descrição curta e útil para o histórico.',
    },
    counterparty_name: {
      type: 'string',
      nullable: true,
      description: 'Nome da contraparte, se houver nome claro.',
    },
    amount: {
      type: 'number',
      nullable: true,
      description: 'Valor principal do lançamento.',
    },
    occurred_on: {
      type: 'string',
      nullable: true,
      description: 'Data do fato no formato YYYY-MM-DD.',
    },
    due_on: {
      type: 'string',
      nullable: true,
      description: 'Data futura de vencimento no formato YYYY-MM-DD.',
    },
  },
  required: [
    'transcript',
    'entry_type',
    'description',
    'counterparty_name',
    'amount',
    'occurred_on',
    'due_on',
  ],
} as const