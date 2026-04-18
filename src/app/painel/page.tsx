import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import AppEventViewTracker from '@/components/app-event-view-tracker'
import AppShellHeader from '@/components/app-shell-header'
import AudioCaptureCard from '@/components/audio-capture-card'
import ContextFocusTarget from '@/components/context-focus-target'
import DashboardCollapsibleCard from '@/components/dashboard-collapsible-card'
import DeleteEntryButton from '@/components/delete-entry-button'
import FirstCaptureCookieCleaner from '@/components/first-capture-cookie-cleaner'
import FirstCaptureFeedback from '@/components/first-capture-feedback'
import FirstCaptureValidationPanel from '@/components/first-capture-validation-panel'
import InstallAppCard from '@/components/install-app-card'
import NotificationSoftPrompt from '@/components/notification-soft-prompt'
import QuickConfirmPendingButton from '@/components/quick-confirm-pending-button'
import {
  getEntryTypeLabel,
  getOpenAccountUrgencyMeta,
  getUrgencyBadgeClass,
} from '@/lib/financial-entry-labels'
import { formatCurrency } from '@/lib/month-period'
import {
  buildOpenAccountState,
  buildPendingReviewState,
  buildUsefulPendingItemsState,
  matchesUrgencyFilter,
  normalizeFocusStatusFilter,
  OPEN_ACCOUNT_SELECT,
  PENDING_REVIEW_SELECT,
} from '@/lib/pending-state'
import { createClient } from '@/lib/supabase/server'
import { ui } from '@/lib/ui'
import {
  isFirstCapturePersistFailureSimulationEnabled,
  isFirstCaptureValidationModeEnabled,
  retryPersistFirstCaptureFromLocalMirror,
} from '@/lib/user-app-state'
import {
  quickDeleteOpenAccountEntry,
  quickDiscardPendingEntry,
  quickConfirmPendingEntry,
  quickSettleOpenAccount,
} from './actions'

const ZEN_ROTATING_HINTS = [
  'Recebi 250 do cliente João hoje',
  'Comprei 84 reais de material',
  'Cliente Marcos paga em 15 dias',
  'Paguei 60 reais de combustível',
  'Cliente Ana me deve 300 até sexta',
]

function ReviewIcon() {
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
      <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  )
}

function SettleIcon() {
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
      <path d="M3 6.5h14" />
      <path d="M5.5 4.5h9a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 14.5 15.5h-9A1.5 1.5 0 0 1 4 14V6a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="m7.5 10 1.5 1.5 3.5-3.5" />
    </svg>
  )
}

function ActionIconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={ui.button.icon}
      aria-label={label}
      title={label}
    >
      {children}
    </Link>
  )
}

function formatOptionalCurrency(amount: number | null | undefined) {
  return amount !== null && amount !== undefined ? formatCurrency(amount) : '-'
}

function getPendingPrimaryText(entry: {
  description: string | null
  transcript: string | null
  audio_path: string | null
  source: string | null
}) {
  if (entry.description) {
    return entry.description
  }

  if (entry.transcript) {
    return entry.transcript
  }

  if (entry.audio_path) {
    return entry.source === 'manual'
      ? 'Lançamento manual pendente'
      : 'Áudio pendente de revisão'
  }

  return 'Lançamento pendente'
}

function getPendingMetaLines(entry: {
  entry_type: string | null
  amount: number | null
  occurred_on: string | null
  source: string | null
}) {
  return [
    `Tipo: ${getEntryTypeLabel(entry.entry_type)}`,
    `Valor: ${formatOptionalCurrency(entry.amount)}`,
    `Data: ${entry.occurred_on ?? '-'}`,
    `Origem: ${entry.source === 'manual' ? 'Manual' : 'Voz'}`,
  ]
}

function getPendingCardClass(
  readyCount: number,
  failedCount: number,
  processingCount: number
) {
  if (failedCount > 0) {
    return 'rounded-2xl border border-red-200 bg-red-50/40 p-4 shadow-sm md:p-5'
  }

  if (readyCount > 0) {
    return 'rounded-2xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm md:p-5'
  }

  if (processingCount > 0) {
    return 'rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm md:p-5'
  }

  return ui.card.compact
}

function getOpenAccountsCardClass(
  openAccountsCount: number,
  highestUrgency: 'normal' | 'due_today' | 'overdue' | null
) {
  if (highestUrgency === 'overdue') {
    return 'rounded-2xl border border-red-200 bg-red-50/40 p-4 shadow-sm md:p-5'
  }

  if (highestUrgency === 'due_today') {
    return 'rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm md:p-5'
  }

  return ui.card.compact
}

function getProcessingLabel(processingStatus: string | null | undefined) {
  switch (processingStatus) {
    case 'uploaded':
      return 'Áudio enviado'
    case 'transcribing':
      return 'Transcrevendo'
    case 'parsing':
      return 'Interpretando'
    case 'ready':
      return 'Pronto para revisão'
    case 'failed':
      return 'Falha no processamento'
    default:
      return '-'
  }
}

function getPendingActionLabel(processingStatus: string | null | undefined) {
  if (processingStatus === 'failed') {
    return 'Revisar pelo áudio'
  }

  return 'Revisar lançamento'
}

function canQuickConfirmPendingEntry(entry: {
  source: string | null | undefined
  processing_status: string | null | undefined
  transcript: string | null | undefined
  entry_type: string | null | undefined
  amount: number | null | undefined
}) {
  return (
    entry.source === 'voice' &&
    entry.processing_status === 'ready' &&
    !!entry.transcript &&
    !!entry.entry_type &&
    entry.amount !== null
  )
}

function getOpenAccountReviewLabel(itemType: 'receivable' | 'payable') {
  if (itemType === 'receivable') {
    return 'Revisar recebimento'
  }

  return 'Revisar pagamento'
}

function canQuickSettleOpenAccount(entry: {
  settlement_status: string | null | undefined
  entry_type: string | null | undefined
  amount: number | null | undefined
}) {
  return (
    entry.settlement_status === 'open' &&
    (entry.entry_type === 'sale_due' || entry.entry_type === 'expense_due') &&
    entry.amount !== null
  )
}

function getOpenAccountQuickActionLabel(itemType: 'receivable' | 'payable') {
  if (itemType === 'receivable') {
    return 'Revisar próximo recebimento'
  }

  return 'Revisar próximo pagamento'
}

function getPendingBadgeClass(
  readyCount: number,
  failedCount: number,
  processingCount: number
) {
  if (failedCount > 0) {
    return ui.badge.danger
  }

  if (readyCount > 0) {
    return ui.badge.primary
  }

  if (processingCount > 0) {
    return ui.badge.warning
  }

  return ui.badge.neutral
}

function getOpenAccountsBadgeClass(
  openAccountsCount: number,
  highestUrgency: 'normal' | 'due_today' | 'overdue' | null
) {
  if (highestUrgency === 'overdue') {
    return ui.badge.danger
  }

  if (highestUrgency === 'due_today' || openAccountsCount > 0) {
    return ui.badge.warning
  }

  return ui.badge.neutral
}

function getSearchParamValue(value?: string | string[]) {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value[0]
  }

  return null
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const resolvedSearchParams = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const firstCaptureState = await retryPersistFirstCaptureFromLocalMirror({
    supabase,
    userId: user.id,
    cookieStore,
  })
  const isFirstCaptureValidationMode = isFirstCaptureValidationModeEnabled()
  const isZenMode = !firstCaptureState.hasCompletedFirstCapture
  const toastKind = getSearchParamValue(resolvedSearchParams.toast)
  const showFirstCaptureBanner =
    !isZenMode && toastKind === 'first_capture_confirmed'
  const firstCaptureFeedbackEntryId = getSearchParamValue(
    resolvedSearchParams.toastEntryId
  )
  const shouldCleanLocalFirstCaptureMirror =
    firstCaptureState.hasRemoteCompletedFirstCapture &&
    firstCaptureState.hasLocalMirror
  const isPersistFailureSimulationEnabled =
    isFirstCaptureValidationMode &&
    isFirstCapturePersistFailureSimulationEnabled(cookieStore)
  const canDeleteRemoteUserAppStateRow =
    isFirstCaptureValidationMode &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const focus = getSearchParamValue(resolvedSearchParams.focus)
  const statusFilter = normalizeFocusStatusFilter(
    getSearchParamValue(resolvedSearchParams.status)
  )
  const isPendingReviewFocused = focus === 'pending_review'
  const isOpenAccountsFocused = focus === 'open_accounts'

  let pending: Array<{
    id: string
    source: string | null
    transcript: string | null
    audio_path: string | null
    occurred_on: string | null
    created_at: string
    entry_type: string | null
    amount: number | null
    description: string | null
    processing_status: string | null
    processing_error: string | null
    review_status: 'pending'
  }> = []
  let openReceivables: Array<{
    id: string
    description: string | null
    counterparty_name: string | null
    amount: number | null
    due_on: string | null
    settlement_status: string | null
    entry_type: 'sale_due'
    review_status: 'confirmed'
  }> = []
  let openPayables: Array<{
    id: string
    description: string | null
    counterparty_name: string | null
    amount: number | null
    due_on: string | null
    settlement_status: string | null
    entry_type: 'expense_due'
    review_status: 'confirmed'
  }> = []
  let pendingError: { message: string } | null = null
  let openReceivablesError: { message: string } | null = null
  let openPayablesError: { message: string } | null = null

  if (!isZenMode) {
    const [
      pendingResult,
      openReceivablesResult,
      openPayablesResult,
    ] = await Promise.all([
      supabase
        .from('financial_entries')
        .select(PENDING_REVIEW_SELECT)
        .eq('review_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('financial_entries')
        .select(OPEN_ACCOUNT_SELECT)
        .eq('review_status', 'confirmed')
        .eq('entry_type', 'sale_due')
        .eq('settlement_status', 'open')
        .order('due_on', { ascending: true })
        .limit(20),

      supabase
        .from('financial_entries')
        .select(OPEN_ACCOUNT_SELECT)
        .eq('review_status', 'confirmed')
        .eq('entry_type', 'expense_due')
        .eq('settlement_status', 'open')
        .order('due_on', { ascending: true })
        .limit(20),
    ])

    pending = pendingResult.data ?? []
    openReceivables = openReceivablesResult.data ?? []
    openPayables = openPayablesResult.data ?? []
    pendingError = pendingResult.error
    openReceivablesError = openReceivablesResult.error
    openPayablesError = openPayablesResult.error
  }

  const pendingState = buildPendingReviewState(pending)
  const openAccountState = buildOpenAccountState([
    ...openReceivables,
    ...openPayables,
  ])
  const pendingCount = pendingState.totalCount
  const readyEntries = pendingState.readyEntries
  const readyCount = pendingState.readyCount
  const failedEntries = pendingState.failedEntries
  const failedCount = pendingState.failedCount
  const processingEntries = pendingState.processingEntries
  const processingCount = pendingState.processingCount
  const nextReadyEntry = pendingState.nextReadyEntry
  const openReceivablesCount = openAccountState.receivableCount
  const openPayablesCount = openAccountState.payableCount
  const openAccountsCount = openAccountState.totalCount
  const overdueOpenAccountsCount = openAccountState.overdueCount
  const dueTodayOpenAccountsCount = openAccountState.dueTodayCount
  const nextOpenAccount = openAccountState.nextEntry
  const usefulPendingItems = buildUsefulPendingItemsState({
    pendingEntries: pending,
    openAccountEntries: [...openReceivables, ...openPayables],
  })
  const highlightedOpenEntryIds = new Set(
    isOpenAccountsFocused && statusFilter
      ? openAccountState.allEntries
          .filter((entry) => matchesUrgencyFilter(entry.due_on, statusFilter))
          .map((entry) => entry.id)
      : []
  )
  const contextTargetId = isPendingReviewFocused
    ? 'pendentes'
    : isOpenAccountsFocused
      ? highlightedOpenEntryIds.size > 0
        ? `open-account-${Array.from(highlightedOpenEntryIds)[0]}`
        : 'contas-em-aberto'
      : null

  return (
    <main className={ui.page.shell} data-prumo-mode={isZenMode ? 'zen' : 'default'}>
      <ContextFocusTarget targetId={contextTargetId} />
      <AppEventViewTracker
        eventName="zen_mode_viewed"
        enabled={isZenMode}
        onceKey={`zen_mode_viewed:${user.id}`}
        properties={{
          source_screen: 'painel',
          has_completed_first_capture: false,
        }}
      />

      {shouldCleanLocalFirstCaptureMirror && <FirstCaptureCookieCleaner />}

      <div className={isZenMode ? ui.page.containerZen : 'mx-auto max-w-4xl space-y-4'}>
        <AppShellHeader
          userId={user.id}
          hasCompletedFirstCapture={firstCaptureState.hasCompletedFirstCapture}
          isZenMode={isZenMode}
          usefulItems={{
            pendingReviewCount: usefulPendingItems.pendingReviewEntries.length,
            receivableDueTodayCount:
              usefulPendingItems.receivableDueTodayEntries.length,
            receivableOverdueCount:
              usefulPendingItems.receivableOverdueEntries.length,
            payableDueTodayCount:
              usefulPendingItems.payableDueTodayEntries.length,
            payableOverdueCount:
              usefulPendingItems.payableOverdueEntries.length,
          }}
          actionHref={!isZenMode ? '/resumo' : null}
          actionLabel={!isZenMode ? 'Resumo' : null}
        />

        <AudioCaptureCard
          mode={isZenMode ? 'zen' : 'default'}
          hasCompletedFirstCapture={firstCaptureState.hasCompletedFirstCapture}
          rotatingHints={isZenMode ? ZEN_ROTATING_HINTS : undefined}
          primarySupportText={
            isZenMode ? 'Toque no botão e fale o que aconteceu.' : undefined
          }
          secondarySupportText={
            isZenMode
              ? 'Gasto, recebimento ou cobrança. O importante é não deixar pra depois.'
              : undefined
          }
        />

        {!isZenMode && (
          <>
            <InstallAppCard />

            <NotificationSoftPrompt
              userId={user.id}
              hasCompletedFirstCapture={firstCaptureState.hasCompletedFirstCapture}
              usefulItems={{
                pendingReviewCount: usefulPendingItems.pendingReviewEntries.length,
                receivableDueTodayCount:
                  usefulPendingItems.receivableDueTodayEntries.length,
                receivableOverdueCount:
                  usefulPendingItems.receivableOverdueEntries.length,
                payableDueTodayCount:
                  usefulPendingItems.payableDueTodayEntries.length,
                payableOverdueCount:
                  usefulPendingItems.payableOverdueEntries.length,
              }}
            />

            <FirstCaptureFeedback
              active={showFirstCaptureBanner}
              entryId={firstCaptureFeedbackEntryId}
            />

            <Link
              href="/revisar/manual"
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-white active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm">✍️</span>
                <span>Manual</span>
              </div>

              <span className="text-neutral-400">›</span>
            </Link>

            <DashboardCollapsibleCard
              id="pendentes"
              className={getPendingCardClass(readyCount, failedCount, processingCount)}
              title="Pendentes de revisão"
              description="Revise o que você gravou e deixou para depois."
              badge={pendingCount}
              badgeClassName={getPendingBadgeClass(
                readyCount,
                failedCount,
                processingCount
              )}
              infoLabel="Mais informações sobre revisões pendentes"
              infoContent="Aqui ficam os lançamentos que ainda precisam ser conferidos antes de entrar no resumo financeiro."
              defaultExpanded={isPendingReviewFocused}
              highlighted={isPendingReviewFocused}
              trackOpenEvent={{
                eventName: 'opened_pending_review_card',
                properties: {
                  source_screen: 'painel',
                  item_type: 'pending_review',
                  count: pendingState.actionableCount,
                  has_completed_first_capture: true,
                },
              }}
            >
              <div className="space-y-6">
                {nextReadyEntry && (
                  <div className="flex justify-end">
                    <Link
                      href={`/revisar/${nextReadyEntry.id}`}
                      className={ui.button.neutral}
                    >
                      Revisar próximo
                    </Link>
                  </div>
                )}

                {!pendingError && pendingCount > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {readyCount > 0 && (
                      <span className={ui.badge.primary}>
                        {readyCount} para revisar
                      </span>
                    )}
                    {failedCount > 0 && (
                      <span className={ui.badge.danger}>{failedCount} com falha</span>
                    )}
                    {processingCount > 0 && (
                      <span className={ui.badge.warning}>
                        {processingCount} processando
                      </span>
                    )}
                  </div>
                )}

                {pendingError && (
                  <p className="text-sm text-red-600">
                    Erro ao carregar pendentes: {pendingError.message}
                  </p>
                )}

                {!pendingError && pendingCount === 0 && (
                  <p className={ui.text.muted}>✅ Nenhum pendente agora.</p>
                )}

                {!pendingError && readyEntries.length > 0 && (
                  <div>
                    <h3 className={`${ui.text.label} mb-3`}>Prontos para revisar</h3>
                    <ul className="space-y-3">
                      {readyEntries.map((entry) => (
                        <li key={entry.id} className={ui.card.muted}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className={ui.text.strong}>
                                {getPendingPrimaryText(entry)}
                              </p>

                              <div className="mt-2 space-y-1">
                                {getPendingMetaLines(entry).map((line) => (
                                  <p key={line} className={ui.text.subtle}>
                                    {line}
                                  </p>
                                ))}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2 self-start">
                              <ActionIconLink
                                href={`/revisar/${entry.id}`}
                                label={getPendingActionLabel(entry.processing_status)}
                              >
                                <ReviewIcon />
                              </ActionIconLink>

                              {canQuickConfirmPendingEntry(entry) && (
                                <form action={quickConfirmPendingEntry}>
                                  <input type="hidden" name="id" value={entry.id} />
                                  <QuickConfirmPendingButton />
                                </form>
                              )}

                              <form action={quickDiscardPendingEntry}>
                                <input type="hidden" name="id" value={entry.id} />
                                <DeleteEntryButton
                                  label="Descartar lançamento pendente"
                                  title="Descartar lançamento pendente"
                                  confirmMessage="Descartar este lançamento pendente?"
                                />
                              </form>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!pendingError && failedEntries.length > 0 && (
                  <div>
                    <h3 className={`${ui.text.label} mb-3 text-red-700`}>Falha</h3>
                    <ul className="space-y-3">
                      {failedEntries.map((entry) => (
                        <li key={entry.id} className={ui.card.muted}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className={ui.text.strong}>
                                {getPendingPrimaryText(entry)}
                              </p>

                              <div className="mt-2 space-y-1">
                                {getPendingMetaLines(entry).map((line) => (
                                  <p key={line} className={ui.text.subtle}>
                                    {line}
                                  </p>
                                ))}
                              </div>

                              <p className="mt-2 text-xs text-red-600">
                                {entry.processing_error ?? 'Erro desconhecido'}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2 self-start">
                              <ActionIconLink
                                href={`/revisar/${entry.id}`}
                                label={getPendingActionLabel(entry.processing_status)}
                              >
                                <ReviewIcon />
                              </ActionIconLink>

                              <form action={quickDiscardPendingEntry}>
                                <input type="hidden" name="id" value={entry.id} />
                                <DeleteEntryButton
                                  label="Descartar lançamento pendente"
                                  title="Descartar lançamento pendente"
                                  confirmMessage="Descartar este lançamento pendente?"
                                />
                              </form>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!pendingError && processingEntries.length > 0 && (
                  <div>
                    <h3 className={`${ui.text.label} mb-3`}>Processando</h3>
                    <div className={`mb-3 ${ui.card.inner}`}>
                      <p className={ui.text.body}>
                        Seus áudios ainda estão sendo processados.
                      </p>
                      <p className={`mt-1 ${ui.text.subtle}`}>
                        Você pode gravar o próximo. Quando ficarem prontos, eles
                        entram em pendentes para revisão.
                      </p>
                    </div>
                    <ul className="space-y-3">
                      {processingEntries.map((entry) => (
                        <li key={entry.id} className={ui.card.muted}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className={ui.text.strong}>
                                {getPendingPrimaryText(entry)}
                              </p>

                              <div className="mt-2 space-y-1">
                                {getPendingMetaLines(entry).map((line) => (
                                  <p key={line} className={ui.text.subtle}>
                                    {line}
                                  </p>
                                ))}
                                <p className={ui.text.subtle}>
                                  Status: {getProcessingLabel(entry.processing_status)}
                                </p>
                              </div>
                            </div>

                            <form action={quickDiscardPendingEntry}>
                              <input type="hidden" name="id" value={entry.id} />
                              <DeleteEntryButton
                                label="Descartar lançamento pendente"
                                title="Descartar lançamento pendente"
                                confirmMessage="Descartar este lançamento pendente?"
                              />
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </DashboardCollapsibleCard>

            <DashboardCollapsibleCard
              id="contas-em-aberto"
              className={getOpenAccountsCardClass(
                openAccountsCount,
                openAccountState.highestUrgency
              )}
              title="Contas em aberto"
              description="Veja o que vence hoje, venceu ou ainda está pendente."
              badge={openAccountsCount}
              badgeClassName={getOpenAccountsBadgeClass(
                openAccountsCount,
                openAccountState.highestUrgency
              )}
              infoLabel="Mais informações sobre contas em aberto"
              infoContent="Aqui ficam os valores a receber e a pagar que já foram confirmados, mas ainda não foram liquidados."
              defaultExpanded={isOpenAccountsFocused}
              highlighted={isOpenAccountsFocused}
              trackOpenEvent={{
                eventName: 'opened_open_accounts_card',
                properties: {
                  source_screen: 'painel',
                  count: openAccountsCount,
                  item_status: openAccountState.highestUrgency ?? undefined,
                  has_completed_first_capture: true,
                },
              }}
            >
              <div className="space-y-6">
                {nextOpenAccount && (
                  <div className="flex justify-end">
                    <Link
                      href={`/liquidar/${nextOpenAccount.id}`}
                      className={ui.button.neutral}
                    >
                      {getOpenAccountQuickActionLabel(nextOpenAccount.item_type)}
                    </Link>
                  </div>
                )}

                {!openReceivablesError &&
                  !openPayablesError &&
                  openAccountsCount > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {overdueOpenAccountsCount > 0 && (
                      <span className={ui.badge.danger}>
                        {overdueOpenAccountsCount} vencida
                        {overdueOpenAccountsCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {dueTodayOpenAccountsCount > 0 && (
                      <span className={ui.badge.warning}>
                        {dueTodayOpenAccountsCount} vence hoje
                      </span>
                    )}
                    {openReceivablesCount > 0 && (
                      <span className={ui.badge.primary}>
                        {openReceivablesCount} a receber
                      </span>
                    )}
                    {openPayablesCount > 0 && (
                      <span className={ui.badge.warning}>
                        {openPayablesCount} a pagar
                      </span>
                    )}
                  </div>
                )}

                {(openReceivablesError || openPayablesError) && (
                  <p className="text-sm text-red-600">
                    Erro ao carregar contas em aberto:{' '}
                    {openReceivablesError?.message || openPayablesError?.message}
                  </p>
                )}

                {!openReceivablesError &&
                  !openPayablesError &&
                  openAccountsCount === 0 && (
                    <p className={ui.text.muted}>✅ Nenhuma conta em aberto.</p>
                  )}

                {!openReceivablesError && openAccountState.receivableEntries.length > 0 && (
                  <div>
                    <h3 className={`${ui.text.label} mb-3`}>Receber</h3>
                    <ul className="space-y-3">
                      {openAccountState.receivableEntries.map((entry) => {
                        const urgency = getOpenAccountUrgencyMeta(entry.due_on)

                        return (
                          <li
                            id={`open-account-${entry.id}`}
                            key={entry.id}
                            className={`${ui.card.muted} ${
                              highlightedOpenEntryIds.has(entry.id)
                                ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-neutral-50'
                                : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className={ui.text.strong}>
                                  {entry.description ?? 'Sem descrição'}
                                </p>

                                <div className="mt-2 space-y-1">
                                  <p className={ui.text.subtle}>
                                    Tipo: {getEntryTypeLabel(entry.entry_type)}
                                  </p>
                                  <p className={ui.text.subtle}>
                                    Valor: {formatOptionalCurrency(entry.amount)}
                                  </p>
                                  <p className={ui.text.subtle}>
                                    Vencimento: {entry.due_on ?? '-'}
                                  </p>
                                  <p className={ui.text.subtle}>
                                    Contraparte: {entry.counterparty_name ?? '-'}
                                  </p>
                                </div>

                                <div className="mt-2">
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-medium ${getUrgencyBadgeClass(
                                      urgency.tone
                                    )}`}
                                  >
                                    {urgency.label}
                                  </span>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2 self-start">
                                <ActionIconLink
                                  href={`/liquidar/${entry.id}`}
                                  label={getOpenAccountReviewLabel('receivable')}
                                >
                                  <SettleIcon />
                                </ActionIconLink>

                                {canQuickSettleOpenAccount({
                                  ...entry,
                                  entry_type: 'sale_due',
                                }) && (
                                  <form action={quickSettleOpenAccount}>
                                    <input type="hidden" name="id" value={entry.id} />
                                    <QuickConfirmPendingButton
                                      idleLabel="Confirmar recebimento"
                                      armedLabel="Toque de novo para confirmar recebimento"
                                    />
                                  </form>
                                )}

                                <form action={quickDeleteOpenAccountEntry}>
                                  <input type="hidden" name="id" value={entry.id} />
                                  <DeleteEntryButton
                                    label="Excluir conta a receber"
                                    title="Excluir conta a receber"
                                  />
                                </form>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {!openPayablesError && openAccountState.payableEntries.length > 0 && (
                  <div>
                    <h3 className={`${ui.text.label} mb-3`}>Pagar</h3>
                    <ul className="space-y-3">
                      {openAccountState.payableEntries.map((entry) => {
                        const urgency = getOpenAccountUrgencyMeta(entry.due_on)

                        return (
                          <li
                            id={`open-account-${entry.id}`}
                            key={entry.id}
                            className={`${ui.card.muted} ${
                              highlightedOpenEntryIds.has(entry.id)
                                ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-neutral-50'
                                : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className={ui.text.strong}>
                                  {entry.description ?? 'Sem descrição'}
                                </p>

                                <div className="mt-2 space-y-1">
                                  <p className={ui.text.subtle}>
                                    Tipo: {getEntryTypeLabel(entry.entry_type)}
                                  </p>
                                  <p className={ui.text.subtle}>
                                    Valor: {formatOptionalCurrency(entry.amount)}
                                  </p>
                                  <p className={ui.text.subtle}>
                                    Vencimento: {entry.due_on ?? '-'}
                                  </p>
                                  <p className={ui.text.subtle}>
                                    Contraparte: {entry.counterparty_name ?? '-'}
                                  </p>
                                </div>

                                <div className="mt-2">
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-medium ${getUrgencyBadgeClass(
                                      urgency.tone
                                    )}`}
                                  >
                                    {urgency.label}
                                  </span>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2 self-start">
                                <ActionIconLink
                                  href={`/liquidar/${entry.id}`}
                                  label={getOpenAccountReviewLabel('payable')}
                                >
                                  <SettleIcon />
                                </ActionIconLink>

                                {canQuickSettleOpenAccount({
                                  ...entry,
                                  entry_type: 'expense_due',
                                }) && (
                                  <form action={quickSettleOpenAccount}>
                                    <input type="hidden" name="id" value={entry.id} />
                                    <QuickConfirmPendingButton
                                      idleLabel="Confirmar pagamento"
                                      armedLabel="Toque de novo para confirmar pagamento"
                                    />
                                  </form>
                                )}

                                <form action={quickDeleteOpenAccountEntry}>
                                  <input type="hidden" name="id" value={entry.id} />
                                  <DeleteEntryButton
                                    label="Excluir conta a pagar"
                                    title="Excluir conta a pagar"
                                  />
                                </form>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </DashboardCollapsibleCard>
          </>
        )}

        {isFirstCaptureValidationMode && (
          <FirstCaptureValidationPanel
            effectiveMode={isZenMode ? 'zen' : 'default'}
            hasPersistedRow={firstCaptureState.hasPersistedRow}
            hasRemoteCompletedFirstCapture={
              firstCaptureState.hasRemoteCompletedFirstCapture
            }
            hasLocalMirror={firstCaptureState.hasLocalMirror}
            remoteErrorMessage={firstCaptureState.errorMessage}
            persistErrorMessage={firstCaptureState.persistErrorMessage}
            isPersistFailureSimulationEnabled={
              isPersistFailureSimulationEnabled
            }
            canDeleteRemoteRow={canDeleteRemoteUserAppStateRow}
          />
        )}
      </div>
    </main>
  )
}
