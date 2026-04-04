import Link from 'next/link'
import { redirect } from 'next/navigation'
import AudioCaptureCard from '@/components/audio-capture-card'
import {
  compareOpenAccountsByUrgency,
  getEntryTypeLabel,
  getOpenAccountUrgencyMeta,
  getSettlementStatusLabel,
  getUrgencyBadgeClass,
} from '@/lib/financial-entry-labels'
import { formatCurrency } from '@/lib/month-period'
import { createClient } from '@/lib/supabase/server'
import { ui } from '@/lib/ui'
import { signOut } from './actions'

function getPanelNoticeMessage(notice?: string) {
  switch (notice) {
    case 'confirmed_done':
      return 'Lançamento confirmado com sucesso. Não há mais pendentes no momento.'
    case 'discarded_done':
      return 'Lançamento descartado com sucesso. Não há mais pendentes no momento.'
    case 'manual_confirmed':
      return 'Lançamento manual salvo e confirmado com sucesso.'
    case 'manual_pending':
      return 'Lançamento manual salvo como pendente com sucesso.'
    case 'settled_done':
      return 'Liquidação registrada com sucesso.'
    default:
      return ''
  }
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

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const { notice } = await searchParams
  const noticeMessage = getPanelNoticeMessage(notice)

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

  const { data: confirmed, error: confirmedError } = await supabase
    .from('financial_entries')
    .select(
      'id, description, entry_type, amount, occurred_on, created_at, settlement_status'
    )
    .eq('review_status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(10)

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
  const confirmedCount = confirmed?.length ?? 0

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

  return (
    <main className={ui.page.shell}>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className={ui.card.base}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className={ui.text.pageTitle}>Painel</h1>
              <p className={`mt-2 ${ui.text.muted}`}>
                Usuário autenticado: {user.email}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/resumo" className={ui.button.secondary}>
                Ver resumo
              </Link>

              <form action={signOut}>
                <button className={ui.button.secondary}>Sair</button>
              </form>
            </div>
          </div>
        </div>

        {noticeMessage && (
          <div className={ui.card.success}>
            <p className="text-sm font-medium text-green-800">
              {noticeMessage}
            </p>
          </div>
        )}

        <AudioCaptureCard />

        <div className={ui.card.base}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className={ui.text.sectionTitle}>Lançamento manual</h2>
              <p className={`mt-1 ${ui.text.muted}`}>
                Use esta opção para preencher um lançamento diretamente, sem
                áudio.
              </p>
            </div>

            <Link href="/revisar/manual" className={ui.button.secondary}>
              Novo lançamento manual
            </Link>
          </div>
        </div>

        <details className={ui.card.base}>
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className={ui.text.sectionTitle}>Lançamentos pendentes</h2>
                <p className={`mt-1 ${ui.text.muted}`}>
                  Registros aguardando processamento, revisão ou confirmação.
                </p>
              </div>

              <span className={ui.badge.primary}>{pendingCount}</span>
            </div>
          </summary>

          <div className="mt-6 space-y-6">
            {pendingError && (
              <p className="text-sm text-red-600">
                Erro ao carregar pendentes: {pendingError.message}
              </p>
            )}

            {!pendingError && pendingCount === 0 && (
              <p className={ui.text.muted}>Nenhum lançamento pendente.</p>
            )}

            {!pendingError && processingEntries.length > 0 && (
              <div>
                <h3 className={ui.text.label}>Processando</h3>
                <ul className="mt-3 space-y-3">
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
                        Origem: {entry.source === 'manual' ? 'Manual' : 'Voz'}
                      </p>

                      <p className={`mt-1 ${ui.text.subtle}`}>
                        Status: {getProcessingLabel(entry.processing_status)}
                      </p>

                      <p className={`mt-1 ${ui.text.subtle}`}>
                        Data: {entry.occurred_on ?? '-'}
                      </p>

                      <Link
                        href={`/revisar/${entry.id}`}
                        className={`mt-3 ${ui.button.neutral}`}
                      >
                        Abrir revisão
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!pendingError && readyEntries.length > 0 && (
              <div>
                <h3 className={ui.text.label}>Prontos para revisar</h3>
                <ul className="mt-3 space-y-3">
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
                        Origem: {entry.source === 'manual' ? 'Manual' : 'Voz'}
                      </p>

                      <p className={`mt-1 ${ui.text.subtle}`}>
                        Data: {entry.occurred_on ?? '-'}
                      </p>

                      {(entry.entry_type ||
                        entry.amount !== null ||
                        entry.description) && (
                        <div className={`mt-3 ${ui.card.inner}`}>
                          <p className={ui.text.subtle}>
                            Tipo: {getEntryTypeLabel(entry.entry_type)}
                          </p>
                          <p className={`mt-1 ${ui.text.subtle}`}>
                            Valor:{' '}
                            {entry.amount !== null
                              ? formatCurrency(entry.amount)
                              : '-'}
                          </p>
                          <p className={`mt-1 ${ui.text.subtle}`}>
                            Descrição: {entry.description ?? '-'}
                          </p>
                        </div>
                      )}

                      <Link
                        href={`/revisar/${entry.id}`}
                        className={`mt-3 ${ui.button.neutral}`}
                      >
                        Revisar lançamento
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!pendingError && failedEntries.length > 0 && (
              <div>
                <h3 className={ui.text.label}>Falharam</h3>
                <ul className="mt-3 space-y-3">
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
                        Origem: {entry.source === 'manual' ? 'Manual' : 'Voz'}
                      </p>

                      <p className="mt-1 text-xs text-red-600">
                        Erro: {entry.processing_error ?? 'Erro desconhecido'}
                      </p>

                      <Link
                        href={`/revisar/${entry.id}`}
                        className={`mt-3 ${ui.button.neutral}`}
                      >
                        Revisar lançamento
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>

        <details className={ui.card.base}>
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className={ui.text.sectionTitle}>Contas em aberto</h2>
                <p className={`mt-1 ${ui.text.muted}`}>
                  Contas a pagar e a receber já confirmadas, aguardando
                  liquidação.
                </p>
              </div>

              <span className={ui.badge.warning}>{openAccountsCount}</span>
            </div>
          </summary>

          <div className="mt-6 space-y-6">
            {!openReceivablesError &&
              !openPayablesError &&
              overdueOpenAccountsCount > 0 && (
                <div className={ui.card.danger}>
                  <p className="text-sm font-medium text-red-700">
                    Há {overdueOpenAccountsCount} conta(s) vencida(s) exigindo
                    ação.
                  </p>
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
                <p className={ui.text.muted}>Nenhuma conta em aberto.</p>
              )}

            {!openReceivablesError && sortedOpenReceivables.length > 0 && (
              <div>
                <h3 className={ui.text.label}>A receber</h3>
                <ul className="mt-3 space-y-3">
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
                              Contraparte: {entry.counterparty_name ?? '-'}
                            </p>
                            <p className={`mt-1 ${ui.text.subtle}`}>
                              Valor: {formatCurrency(entry.amount ?? 0)}
                            </p>
                            <p className={`mt-1 ${ui.text.subtle}`}>
                              Vencimento: {entry.due_on ?? '-'}
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
                          Registrar liquidação
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {!openPayablesError && sortedOpenPayables.length > 0 && (
              <div>
                <h3 className={ui.text.label}>A pagar</h3>
                <ul className="mt-3 space-y-3">
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
                              Contraparte: {entry.counterparty_name ?? '-'}
                            </p>
                            <p className={`mt-1 ${ui.text.subtle}`}>
                              Valor: {formatCurrency(entry.amount ?? 0)}
                            </p>
                            <p className={`mt-1 ${ui.text.subtle}`}>
                              Vencimento: {entry.due_on ?? '-'}
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
                          Registrar liquidação
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </details>

        <details className={ui.card.base}>
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className={ui.text.sectionTitle}>
                  Lançamentos confirmados
                </h2>
                <p className={`mt-1 ${ui.text.muted}`}>
                  Últimos lançamentos já confirmados.
                </p>
              </div>

              <span className={ui.badge.neutral}>{confirmedCount}</span>
            </div>
          </summary>

          <div className="mt-6">
            {confirmedError && (
              <p className="text-sm text-red-600">
                Erro ao carregar confirmados: {confirmedError.message}
              </p>
            )}

            {!confirmedError && (!confirmed || confirmed.length === 0) && (
              <p className={ui.text.muted}>
                Nenhum lançamento confirmado ainda.
              </p>
            )}

            {!confirmedError && confirmed && confirmed.length > 0 && (
              <ul className="space-y-3">
                {confirmed.map((entry) => (
                  <li key={entry.id} className={ui.card.muted}>
                    <p className={ui.text.strong}>
                      {entry.description ?? 'Sem descrição'}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Tipo: {getEntryTypeLabel(entry.entry_type)} | Valor:{' '}
                      {entry.amount !== null
                        ? formatCurrency(entry.amount)
                        : '-'}
                    </p>
                    <p className={`mt-1 ${ui.text.subtle}`}>
                      Data: {entry.occurred_on ?? '-'}
                    </p>
                    {entry.settlement_status && (
                      <p className={`mt-1 ${ui.text.subtle}`}>
                        Situação:{' '}
                        {getSettlementStatusLabel(entry.settlement_status)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>
    </main>
  )
}