export type EntryType =
  | 'sale_received'
  | 'sale_due'
  | 'expense_paid'
  | 'expense_due'

export type ReviewStatus = 'pending' | 'confirmed' | 'discarded'

export type ProcessingStatus =
  | 'uploaded'
  | 'transcribing'
  | 'parsing'
  | 'ready'
  | 'failed'

export type SettlementStatus = 'open' | 'settled'

export type FinancialEntry = {
  id: string
  user_id: string
  source: 'voice' | 'manual'
  review_status: ReviewStatus
  processing_status: ProcessingStatus
  processing_error: string | null
  entry_type: EntryType | null
  description: string | null
  counterparty_name: string | null
  amount: number | null
  occurred_on: string | null
  due_on: string | null
  settlement_status: SettlementStatus | null
  settled_on: string | null
  settled_amount: number | null
  transcript: string | null
  audio_path: string | null
  created_at: string
  updated_at: string
}