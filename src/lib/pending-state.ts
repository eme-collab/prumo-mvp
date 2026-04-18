import type { EntryType, ProcessingStatus } from '@/types/financial-entry'

export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo'

export const PENDING_REVIEW_SELECT =
  'id, source, transcript, audio_path, occurred_on, created_at, entry_type, amount, description, processing_status, processing_error, review_status'

export const OPEN_ACCOUNT_SELECT =
  'id, description, counterparty_name, amount, due_on, settlement_status, entry_type, review_status'

export const PENDING_REVIEW_PROCESSING_STATUSES = [
  'uploaded',
  'transcribing',
  'parsing',
] as const satisfies readonly ProcessingStatus[]

export const PENDING_REVIEW_ACTIONABLE_STATUSES = [
  'ready',
  'failed',
] as const satisfies readonly ProcessingStatus[]
export const PENDING_REVIEW_REMINDER_DELAY_MINUTES = 15

export const OPEN_ACCOUNT_ENTRY_TYPES = [
  'sale_due',
  'expense_due',
] as const satisfies readonly EntryType[]

export type PendingUrgencyStatus = 'normal' | 'due_today' | 'overdue'
export type PendingItemType = 'pending_review' | 'receivable' | 'payable'
export type PendingReviewBucket = 'ready' | 'failed' | 'processing'
export type FocusStatusFilter = PendingUrgencyStatus

export type PendingReviewEntryLike = {
  id: string
  source?: string | null
  transcript?: string | null
  audio_path?: string | null
  occurred_on?: string | null
  created_at: string
  entry_type?: string | null
  amount?: number | null
  description?: string | null
  processing_status: string | null
  processing_error?: string | null
  review_status: string | null
}

export type OpenAccountEntryLike = {
  id: string
  description?: string | null
  counterparty_name?: string | null
  amount?: number | null
  due_on: string | null
  settlement_status: string | null
  entry_type: string | null
  review_status: string | null
}

export type PendingReviewState<TEntry extends PendingReviewEntryLike> = {
  allEntries: TEntry[]
  readyEntries: TEntry[]
  failedEntries: TEntry[]
  processingEntries: TEntry[]
  totalCount: number
  readyCount: number
  failedCount: number
  processingCount: number
  actionableCount: number
  nextReadyEntry: TEntry | null
}

export type OpenAccountWithUrgency<TEntry extends OpenAccountEntryLike> = TEntry & {
  item_type: Extract<PendingItemType, 'receivable' | 'payable'>
  urgency_status: PendingUrgencyStatus
}

export type OpenAccountState<TEntry extends OpenAccountEntryLike> = {
  allEntries: Array<OpenAccountWithUrgency<TEntry>>
  receivableEntries: Array<OpenAccountWithUrgency<TEntry>>
  payableEntries: Array<OpenAccountWithUrgency<TEntry>>
  totalCount: number
  receivableCount: number
  payableCount: number
  dueTodayCount: number
  overdueCount: number
  highestUrgency: PendingUrgencyStatus | null
  nextEntry: OpenAccountWithUrgency<TEntry> | null
}

export type UsefulPendingItemsState = {
  pendingReviewEntries: PendingReviewEntryLike[]
  receivableDueTodayEntries: OpenAccountEntryLike[]
  receivableOverdueEntries: OpenAccountEntryLike[]
  payableDueTodayEntries: OpenAccountEntryLike[]
  payableOverdueEntries: OpenAccountEntryLike[]
}

export function getTodayInBrazil(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function normalizeFocusStatusFilter(
  value: string | null | undefined
): FocusStatusFilter | null {
  if (value === 'normal' || value === 'due_today' || value === 'overdue') {
    return value
  }

  return null
}

export function isPendingReview(
  reviewStatus: string | null | undefined
) {
  return reviewStatus === 'pending'
}

export function getPendingReviewBucket(
  processingStatus: string | null | undefined
): PendingReviewBucket {
  if (processingStatus === 'failed') {
    return 'failed'
  }

  if (processingStatus === 'ready') {
    return 'ready'
  }

  return 'processing'
}

export function isPendingReviewActionable(
  processingStatus: string | null | undefined
) {
  return PENDING_REVIEW_ACTIONABLE_STATUSES.includes(
    (processingStatus ?? 'uploaded') as (typeof PENDING_REVIEW_ACTIONABLE_STATUSES)[number]
  )
}

export function buildPendingReviewState<TEntry extends PendingReviewEntryLike>(
  entries: TEntry[]
): PendingReviewState<TEntry> {
  const allEntries = entries.filter((entry) => isPendingReview(entry.review_status))
  const readyEntries = allEntries.filter(
    (entry) => getPendingReviewBucket(entry.processing_status) === 'ready'
  )
  const failedEntries = allEntries.filter(
    (entry) => getPendingReviewBucket(entry.processing_status) === 'failed'
  )
  const processingEntries = allEntries.filter(
    (entry) => getPendingReviewBucket(entry.processing_status) === 'processing'
  )
  const nextReadyEntry =
    [...readyEntries].sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ??
    null

  return {
    allEntries,
    readyEntries,
    failedEntries,
    processingEntries,
    totalCount: allEntries.length,
    readyCount: readyEntries.length,
    failedCount: failedEntries.length,
    processingCount: processingEntries.length,
    actionableCount: readyEntries.length + failedEntries.length,
    nextReadyEntry,
  }
}

export function isPendingReviewReminderEligible(
  entry: PendingReviewEntryLike,
  now = new Date()
) {
  if (!isPendingReview(entry.review_status)) {
    return false
  }

  if (!isPendingReviewActionable(entry.processing_status)) {
    return false
  }

  const createdAtMs = Date.parse(entry.created_at)

  if (Number.isNaN(createdAtMs)) {
    return false
  }

  return (
    now.getTime() - createdAtMs >=
    PENDING_REVIEW_REMINDER_DELAY_MINUTES * 60 * 1000
  )
}

export function getOpenAccountItemType(
  entryType: string | null | undefined
): Extract<PendingItemType, 'receivable' | 'payable'> | null {
  if (entryType === 'sale_due') {
    return 'receivable'
  }

  if (entryType === 'expense_due') {
    return 'payable'
  }

  return null
}

export function isOpenAccount(
  entryType: string | null | undefined,
  reviewStatus: string | null | undefined,
  settlementStatus: string | null | undefined
) {
  return (
    reviewStatus === 'confirmed' &&
    settlementStatus === 'open' &&
    (entryType === 'sale_due' || entryType === 'expense_due')
  )
}

export function getOpenAccountUrgencyStatus(
  dueOn: string | null | undefined,
  today = getTodayInBrazil()
): PendingUrgencyStatus {
  if (!dueOn) {
    return 'normal'
  }

  if (dueOn < today) {
    return 'overdue'
  }

  if (dueOn === today) {
    return 'due_today'
  }

  return 'normal'
}

export function getOpenAccountUrgencyMeta(
  dueOn: string | null | undefined,
  today = getTodayInBrazil()
) {
  const status = getOpenAccountUrgencyStatus(dueOn, today)

  if (!dueOn) {
    return {
      status,
      label: 'Sem vencimento',
      tone: 'neutral' as const,
      rank: 3,
    }
  }

  if (status === 'overdue') {
    return {
      status,
      label: 'Vencida',
      tone: 'danger' as const,
      rank: 0,
    }
  }

  if (status === 'due_today') {
    return {
      status,
      label: 'Vence hoje',
      tone: 'warning' as const,
      rank: 1,
    }
  }

  return {
    status,
    label: 'Em aberto',
    tone: 'neutral' as const,
    rank: 2,
  }
}

export function compareOpenAccountsByUrgency<T extends { due_on: string | null }>(
  a: T,
  b: T
) {
  const metaA = getOpenAccountUrgencyMeta(a.due_on)
  const metaB = getOpenAccountUrgencyMeta(b.due_on)

  if (metaA.rank !== metaB.rank) {
    return metaA.rank - metaB.rank
  }

  const dueA = a.due_on ?? '9999-12-31'
  const dueB = b.due_on ?? '9999-12-31'

  return dueA.localeCompare(dueB)
}

export function matchesUrgencyFilter(
  dueOn: string | null | undefined,
  filter: FocusStatusFilter | null,
  today = getTodayInBrazil()
) {
  if (!filter) {
    return true
  }

  return getOpenAccountUrgencyStatus(dueOn, today) === filter
}

export function buildOpenAccountState<TEntry extends OpenAccountEntryLike>(
  entries: TEntry[],
  today = getTodayInBrazil()
): OpenAccountState<TEntry> {
  const allEntries = entries
    .filter((entry) =>
      isOpenAccount(entry.entry_type, entry.review_status, entry.settlement_status)
    )
    .map((entry) => {
      const itemType = getOpenAccountItemType(entry.entry_type)

      if (!itemType) {
        return null
      }

      return {
        ...entry,
        item_type: itemType,
        urgency_status: getOpenAccountUrgencyStatus(entry.due_on, today),
      }
    })
    .filter((entry) => entry !== null)
    .sort(compareOpenAccountsByUrgency) as Array<OpenAccountWithUrgency<TEntry>>

  const receivableEntries = allEntries.filter(
    (entry) => entry.item_type === 'receivable'
  )
  const payableEntries = allEntries.filter((entry) => entry.item_type === 'payable')
  const overdueCount = allEntries.filter(
    (entry) => entry.urgency_status === 'overdue'
  ).length
  const dueTodayCount = allEntries.filter(
    (entry) => entry.urgency_status === 'due_today'
  ).length

  const highestUrgency = overdueCount > 0
    ? 'overdue'
    : dueTodayCount > 0
      ? 'due_today'
      : allEntries.length > 0
        ? 'normal'
        : null

  return {
    allEntries,
    receivableEntries,
    payableEntries,
    totalCount: allEntries.length,
    receivableCount: receivableEntries.length,
    payableCount: payableEntries.length,
    dueTodayCount,
    overdueCount,
    highestUrgency,
    nextEntry: allEntries[0] ?? null,
  }
}

export function buildUsefulPendingItemsState(input: {
  pendingEntries: PendingReviewEntryLike[]
  openAccountEntries: OpenAccountEntryLike[]
  today?: string
  now?: Date
}): UsefulPendingItemsState {
  const today = input.today ?? getTodayInBrazil(input.now)
  const pendingReviewEntries = input.pendingEntries.filter((entry) =>
    isPendingReviewReminderEligible(entry, input.now)
  )

  const openEntries = input.openAccountEntries.filter((entry) =>
    isOpenAccount(entry.entry_type, entry.review_status, entry.settlement_status)
  )

  return {
    pendingReviewEntries,
    receivableDueTodayEntries: openEntries.filter(
      (entry) =>
        getOpenAccountItemType(entry.entry_type) === 'receivable' &&
        getOpenAccountUrgencyStatus(entry.due_on, today) === 'due_today'
    ),
    receivableOverdueEntries: openEntries.filter(
      (entry) =>
        getOpenAccountItemType(entry.entry_type) === 'receivable' &&
        getOpenAccountUrgencyStatus(entry.due_on, today) === 'overdue'
    ),
    payableDueTodayEntries: openEntries.filter(
      (entry) =>
        getOpenAccountItemType(entry.entry_type) === 'payable' &&
        getOpenAccountUrgencyStatus(entry.due_on, today) === 'due_today'
    ),
    payableOverdueEntries: openEntries.filter(
      (entry) =>
        getOpenAccountItemType(entry.entry_type) === 'payable' &&
        getOpenAccountUrgencyStatus(entry.due_on, today) === 'overdue'
    ),
  }
}
