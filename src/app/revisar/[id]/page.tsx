import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import AppEventViewTracker from '@/components/app-event-view-tracker'
import FinancialEntryForm from '@/components/financial-entry-form'
import { createClient } from '@/lib/supabase/server'
import ReprocessEntryButton from '@/components/reprocess-entry-button'
import { sanitizeResumoReturnTo } from '@/lib/resumo-navigation'
import { resolveFirstCaptureState } from '@/lib/user-app-state'
import { submitEntryEdit, submitReview } from './actions'
import { ui } from '@/lib/ui'

function getErrorMessage(error?: string) {
  return function resolve(entryType: string | null | undefined) {
    switch (error) {
      case 'missing_type':
        return 'Escolha o tipo antes de confirmar.'
      case 'missing_amount':
        return 'Informe o valor antes de confirmar.'
      case 'missing_settled_on':
        return entryType === 'sale_due'
          ? 'Informe a data do recebimento.'
          : 'Informe a data do pagamento.'
      case 'missing_settled_amount':
        return entryType === 'sale_due'
          ? 'Informe o valor recebido.'
          : 'Informe o valor pago.'
      default:
        return ''
    }
  }
}

function getProcessingMessage(processingStatus?: string) {
  switch (processingStatus) {
    case 'uploaded':
      return 'Áudio enviado. O processamento vai começar.'
    case 'transcribing':
      return 'Transcrição em andamento.'
    case 'parsing':
      return 'Interpretação em andamento.'
    case 'failed':
      return 'O processamento falhou. Você ainda pode revisar pelo áudio.'
    default:
      return ''
  }
}

function getSourceLabel(source: string | null | undefined) {
  return source === 'manual' ? 'Manual' : 'Voz'
}

function getReviewStatusLabel(reviewStatus: string | null | undefined) {
  switch (reviewStatus) {
    case 'pending':
      return 'Pendente'
    case 'confirmed':
      return 'Confirmado'
    case 'discarded':
      return 'Descartado'
    default:
      return '-'
  }
}

function getProcessingStatusLabel(processingStatus: string | null | undefined) {
  switch (processingStatus) {
    case 'uploaded':
      return 'Áudio enviado'
    case 'transcribing':
      return 'Transcrevendo'
    case 'parsing':
      return 'Interpretando'
    case 'failed':
      return 'Falha no processamento'
    case 'ready':
      return 'Pronto para revisar'
    default:
      return 'Pronto para revisar'
  }
}

export default async function RevisarEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; mode?: string; returnTo?: string }>
}) {
  const { id } = await params
  const { error, mode, returnTo } = await searchParams

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: entry, error: entryError } = await supabase
    .from('financial_entries')
    .select(
      'id, source, audio_path, review_status, processing_status, processing_error, entry_type, description, counterparty_name, amount, occurred_on, due_on, transcript, created_at, settlement_status, settled_on, settled_amount'
    )
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry) {
    notFound()
  }

  const safeReturnTo = sanitizeResumoReturnTo(returnTo)
  const isEditMode = mode === 'edit'
  const cookieStore = await cookies()
  const firstCaptureState = await resolveFirstCaptureState({
    supabase,
    userId: user.id,
    cookieStore,
  })
  const shouldTrackFirstReviewView =
    !isEditMode &&
    entry.source === 'voice' &&
    entry.review_status === 'pending' &&
    !firstCaptureState.hasCompletedFirstCapture

  if (isEditMode && entry.review_status !== 'confirmed') {
    redirect(`/revisar/${id}`)
  }

  let signedAudioUrl: string | null = null

  if (entry.audio_path) {
    const { data, error: signedUrlError } = await supabase.storage
      .from('voice-notes')
      .createSignedUrl(entry.audio_path, 3600)

    if (!signedUrlError && data?.signedUrl) {
      signedAudioUrl = data.signedUrl
    }
  }

  const resolveErrorMessage = getErrorMessage(error)
  const processingMessage = getProcessingMessage(entry.processing_status)
  const errorMessage = resolveErrorMessage(entry.entry_type)
  const title = isEditMode ? 'Editar movimentação' : 'Revisar lançamento'
  const introMessage = isEditMode
    ? 'Ajuste os dados desta movimentação confirmada.'
    : 'Confira os dados. Se precisar, ajuste antes de confirmar.'
  const backHref = isEditMode ? safeReturnTo : '/painel'
  const backLabel = isEditMode ? 'Voltar para o resumo' : 'Voltar para o painel'
  const formAction = isEditMode ? submitEntryEdit : submitReview
  const showSettlementFields =
    isEditMode &&
    entry.settlement_status === 'settled' &&
    (entry.entry_type === 'sale_due' || entry.entry_type === 'expense_due')

  return (
    <main className={ui.page.shell}>
      <AppEventViewTracker
        eventName="first_review_viewed"
        enabled={shouldTrackFirstReviewView}
        onceKey={`first_review_viewed:${user.id}`}
        properties={{
          source_screen: 'revisar',
          entry_id: entry.id,
          has_completed_first_capture: false,
        }}
      />

      <div className={ui.page.containerNarrow}>
        <div className={ui.card.base}>
          <Link href={backHref} className="text-sm underline">
            {backLabel}
          </Link>

          <h1 className={`mt-4 ${ui.text.pageTitle}`}>{title}</h1>
          <p className={`mt-2 ${ui.text.muted}`}>
            {introMessage}
          </p>
        </div>

        {!isEditMode && processingMessage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              {processingMessage}
            </p>
          </div>
        )}

        {!isEditMode &&
          entry.processing_status === 'failed' &&
          entry.processing_error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
            <p className="text-sm font-medium text-red-700">
              Erro de processamento
            </p>
            <p className="text-sm text-red-600">
              {entry.processing_error}
            </p>

            <ReprocessEntryButton entryId={entry.id} />
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {signedAudioUrl && (
          <div className={ui.card.base}>
            <h2 className="text-lg font-semibold">Áudio original</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Ouça de novo se precisar revisar ou completar os dados.
            </p>

            <div className="mt-4">
              <audio controls src={signedAudioUrl} className="w-full" />
            </div>
          </div>
        )}

        <div className={`mb-4 ${ui.card.muted}`}>
          <div className="mb-4 rounded-xl border p-4">
            <p className="text-sm text-neutral-600">
              Origem: <strong>{getSourceLabel(entry.source)}</strong>
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Status da revisão:{' '}
              <strong>{getReviewStatusLabel(entry.review_status)}</strong>
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Status do processamento:{' '}
              <strong>{getProcessingStatusLabel(entry.processing_status)}</strong>
            </p>
          </div>

          <FinancialEntryForm
            action={formAction}
            entry={entry}
            mode={isEditMode ? 'edit' : 'review'}
            cancelHref={backHref}
            returnTo={isEditMode ? safeReturnTo : undefined}
            showSettlementFields={showSettlementFields}
          />
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Informações do lançamento</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Criado em: {entry.created_at}
          </p>
        </div>
      </div>
    </main>
  )
}
