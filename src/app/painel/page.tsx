import Link from 'next/link'
import { redirect } from 'next/navigation'
import AudioCaptureCard from '@/components/audio-capture-card'
import DashboardCollapsibleCard from '@/components/dashboard-collapsible-card'
import InstallAppCard from '@/components/install-app-card'
import {
  compareOpenAccountsByUrgency,
  getEntryTypeLabel,
  getOpenAccountUrgencyMeta,
  getUrgencyBadgeClass,
} from '@/lib/financial-entry-labels'
import { formatCurrency } from '@/lib/month-period'
import { createClient } from '@/lib/supabase/server'
import { ui } from '@/lib/ui'
import { signOut } from './actions'

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
  overdueOpenAccountsCount: number
) {
  if (overdueOpenAccountsCount > 0) {
    return 'rounded-2xl border border-red-200 bg-red-50/40 p-4 shadow-sm md:p-5'
  }

  if (openAccountsCount > 0) {
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
  if (processingStatus === 'uploaded' || processingStatus === 'transcribing' || processingStatus === 'parsing') {
    return 'Ver andamento'
  }

  return 'Revisar lançamento'
}

function getOpenAccountReviewLabel(entryType: 'sale_due' | 'expense_due') {
  if (entryType === 'sale_due') {
    return 'Revisar recebimento'
  }

  return 'Revisar pagamento'
}

function getOpenAccountQuickActionLabel(entryType: 'sale_due' | 'expense_due') {
  if (entryType === 'sale_due') {
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
  overdueOpenAccountsCount: number
) {
  if (overdueOpenAccountsCount > 0) {
    return ui.badge.danger
  }

  if (openAccountsCount > 0) {
    return ui.badge.warning
  }

  return ui.badge.neutral
}

export default async function PainelPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: pending, error: pendingError } = await supabase
    .from('financial_entries')
    .select(
      'id, source, transcript, audio_path, occurred_on, created_at, entry_type, amount, description, processing_status, processing_error'
    )
    .eq('review_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: openReceivables, error: openReceivablesError } = await supabase
    .from('financial_entries')
    .select(
      'id, description, counterparty_name, amount, due_on, settlement_status'
    )
    .eq('review_status', 'confirmed')
    .eq('entry_type', 'sale_due')
    .eq('settlement_status', 'open')
    .order('due_on', { ascending: true })
    .limit(20)

  const { data: openPayables, error: openPayablesError } = await supabase
    .from('financial_entries')
    .select(
      'id, description, counterparty_name, amount, due_on, settlement_status'
    )
    .eq('review_status', 'confirmed')
    .eq('entry_type', 'expense_due')
    .eq('settlement_status', 'open')
    .order('due_on', { ascending: true })
    .limit(20)

  const pendingCount = pending?.length ?? 0

  const processingEntries =
    pending?.filter((entry) =>
      ['uploaded', 'transcribing', 'parsing'].includes(
        entry.processing_status ?? ''
      )
    ) ?? []

  const readyEntries =
    pending?.filter((entry) => entry.processing_status === 'ready') ?? []

  const failedEntries =
    pending?.filter((entry) => entry.processing_status === 'failed') ?? []
  const readyCount = readyEntries.length
  const processingCount = processingEntries.length
  const failedCount = failedEntries.length
  const nextReadyEntry =
    [...readyEntries].sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ??
    null

  const openReceivablesCount = openReceivables?.length ?? 0
  const openPayablesCount = openPayables?.length ?? 0
  const openAccountsCount = openReceivablesCount + openPayablesCount

  const sortedOpenReceivables = [...(openReceivables ?? [])].sort(
    compareOpenAccountsByUrgency
  )

  const sortedOpenPayables = [...(openPayables ?? [])].sort(
    compareOpenAccountsByUrgency
  )

  const overdueOpenAccountsCount = [
    ...sortedOpenReceivables,
    ...sortedOpenPayables,
  ].filter((entry) => getOpenAccountUrgencyMeta(entry.due_on).rank === 0).length

  const nextOpenAccount =
    [
      ...(sortedOpenReceivables ?? []).map((entry) => ({
        ...entry,
        entry_type: 'sale_due' as const,
      })),
      ...(sortedOpenPayables ?? []).map((entry) => ({
        ...entry,
        entry_type: 'expense_due' as const,
      })),
    ].sort(compareOpenAccountsByUrgency)[0] ?? null

  return (
    <main className={ui.page.shell}>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className={ui.card.base}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className={ui.text.sectionTitle}>Prumo</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/resumo"
                className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.99]"
              >
                Resumo
              </Link>

              <form action={signOut}>
                <button className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.99]">
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>

        <AudioCaptureCard />

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
          title="Revisões pendentes"
          description="Lançamentos por voz aguardando conferência."
          badge={pendingCount}
          badgeClassName={getPendingBadgeClass(
            readyCount,
            failedCount,
            processingCount
          )}
          infoLabel="Mais informações sobre revisões pendentes"
          infoContent="Aqui ficam os lançamentos que ainda precisam ser conferidos antes de entrar no resumo financeiro."
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
                      <p className={ui.text.body}>
                        {entry.transcript
                          ? entry.transcript
                          : entry.audio_path
                            ? 'Áudio processado e pronto para revisão.'
                            : 'Lançamento manual pronto para revisão.'}
                      </p>

                      <p className={`mt-2 ${ui.text.subtle}`}>
                        {entry.source === 'manual' ? 'Manual' : 'Voz'} •{' '}
                        {entry.occurred_on ?? 'Sem data'}
                      </p>

                      {(entry.entry_type ||
                        entry.amount !== null ||
                        entry.description) && (
                        <div className={`mt-3 ${ui.card.inner}`}>
                          <p className={ui.text.subtle}>
                            {getEntryTypeLabel(entry.entry_type)} •{' '}
                            {entry.amount !== null
                              ? formatCurrency(entry.amount)
                              : '-'}
                          </p>
                          {entry.description && (
                            <p className={`mt-1 ${ui.text.subtle}`}>
                              {entry.description}
                            </p>
                          )}
                        </div>
                      )}

                      <Link
                        href={`/revisar/${entry.id}`}
                        className={`mt-3 ${ui.button.neutral}`}
                      >
                        {getPendingActionLabel(entry.processing_status)}
                      </Link>
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
                      <p className={ui.text.body}>
                        {entry.transcript
                          ? entry.transcript
                          : entry.audio_path
                            ? 'Falha no processamento automático.'
                            : 'Sem transcrição'}
                      </p>

                      <p className={`mt-2 ${ui.text.subtle}`}>
                        {entry.source === 'manual' ? 'Manual' : 'Voz'}
                      </p>

                      <p className="mt-1 text-xs text-red-600">
                        {entry.processing_error ?? 'Erro desconhecido'}
                      </p>

                      <Link
                        href={`/revisar/${entry.id}`}
                        className={`mt-3 ${ui.button.neutral}`}
                      >
                        {getPendingActionLabel(entry.processing_status)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!pendingError && processingEntries.length > 0 && (
              <div>
                <h3 className={`${ui.text.label} mb-3`}>Processando</h3>
                <ul className="space-y-3">
                  {processingEntries.map((entry) => (
                    <li key={entry.id} className={ui.card.muted}>
                      <p className={ui.text.body}>
                        {entry.transcript
                          ? entry.transcript
                          : entry.audio_path
                            ? 'Áudio enviado para processamento.'
                            : 'Sem transcrição'}
                      </p>

                      <p className={`mt-2 ${ui.text.subtle}`}>
                        {entry.source === 'manual' ? 'Manual' : 'Voz'} •{' '}
                        {getProcessingLabel(entry.processing_status)}
                      </p>

                      <Link
                        href={`/revisar/${entry.id}`}
                        className={`mt-3 ${ui.button.neutral}`}
                      >
                        {getPendingActionLabel(entry.processing_status)}
                      </Link>
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
            overdueOpenAccountsCount
          )}
          title="Contas em aberto"
          description="Valores a receber e a pagar, vencidos ou ainda no prazo."
          badge={openAccountsCount}
          badgeClassName={getOpenAccountsBadgeClass(
            openAccountsCount,
            overdueOpenAccountsCount
          )}
          infoLabel="Mais informações sobre contas em aberto"
          infoContent="Aqui ficam os valores a receber e a pagar que já foram confirmados, mas ainda não foram liquidados."
        >
          <div className="space-y-6">
            {nextOpenAccount && (
              <div className="flex justify-end">
                <Link
                  href={`/liquidar/${nextOpenAccount.id}`}
                  className={ui.button.neutral}
                >
                  {getOpenAccountQuickActionLabel(nextOpenAccount.entry_type)}
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

            {!openReceivablesError && sortedOpenReceivables.length > 0 && (
              <div>
                <h3 className={`${ui.text.label} mb-3`}>Receber</h3>
                <ul className="space-y-3">
                  {sortedOpenReceivables.map((entry) => {
                    const urgency = getOpenAccountUrgencyMeta(entry.due_on)

                    return (
                      <li key={entry.id} className={ui.card.muted}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={ui.text.strong}>
                              {entry.description ?? 'Sem descrição'}
                            </p>
                            <p className={`mt-1 ${ui.text.subtle}`}>
                              {entry.counterparty_name ?? 'Sem nome'} •{' '}
                              {formatCurrency(entry.amount ?? 0)}
                            </p>
                            <p className={`mt-1 ${ui.text.subtle}`}>
                              {entry.due_on ? `Vence ${entry.due_on}` : 'Sem vencimento'}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${getUrgencyBadgeClass(
                              urgency.tone
                            )}`}
                          >
                            {urgency.label}
                          </span>
                        </div>

                        <Link
                          href={`/liquidar/${entry.id}`}
                          className={`mt-3 ${ui.button.neutral}`}
                        >
                          {getOpenAccountReviewLabel('sale_due')}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {!openPayablesError && sortedOpenPayables.length > 0 && (
              <div>
                <h3 className={`${ui.text.label} mb-3`}>Pagar</h3>
                <ul className="space-y-3">
                  {sortedOpenPayables.map((entry) => {
                    const urgency = getOpenAccountUrgencyMeta(entry.due_on)

                    return (
                      <li key={entry.id} className={ui.card.muted}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={ui.text.strong}>
                              {entry.description ?? 'Sem descrição'}
                            </p>
                            <p className={`mt-1 ${ui.text.subtle}`}>
                              {entry.counterparty_name ?? 'Sem nome'} •{' '}
                              {formatCurrency(entry.amount ?? 0)}
                            </p>
                            <p className={`mt-1 ${ui.text.subtle}`}>
                              {entry.due_on ? `Vence ${entry.due_on}` : 'Sem vencimento'}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${getUrgencyBadgeClass(
                              urgency.tone
                            )}`}
                          >
                            {urgency.label}
                          </span>
                        </div>

                        <Link
                          href={`/liquidar/${entry.id}`}
                          className={`mt-3 ${ui.button.neutral}`}
                        >
                          {getOpenAccountReviewLabel('expense_due')}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </DashboardCollapsibleCard>

        <InstallAppCard />
      </div>
    </main>
  )
}
