import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReprocessEntryButton from '@/components/reprocess-entry-button'
import { submitReview } from './actions'
import { ui } from '@/lib/ui'

function getErrorMessage(error?: string) {
  switch (error) {
    case 'missing_type':
      return 'Selecione o tipo de lançamento antes de confirmar.'
    case 'missing_amount':
      return 'Informe o valor antes de confirmar.'
    default:
      return ''
  }
}

function getNoticeMessage(notice?: string) {
  switch (notice) {
    case 'saved':
      return 'Rascunho salvo com sucesso.'
    case 'confirmed_next':
      return 'Lançamento anterior confirmado. Este é o próximo pendente.'
    case 'discarded_next':
      return 'Lançamento anterior descartado. Este é o próximo pendente.'
    default:
      return ''
  }
}

function getProcessingMessage(processingStatus?: string) {
  switch (processingStatus) {
    case 'uploaded':
      return 'O áudio foi enviado e o processamento ainda vai começar.'
    case 'transcribing':
      return 'A transcrição está em andamento.'
    case 'parsing':
      return 'A interpretação do lançamento está em andamento.'
    case 'failed':
      return 'O processamento automático falhou. Você pode tentar novamente ou revisar manualmente ouvindo o áudio.'
    default:
      return ''
  }
}

export default async function RevisarEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const { error, notice } = await searchParams

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
      'id, source, audio_path, review_status, processing_status, processing_error, entry_type, description, counterparty_name, amount, occurred_on, due_on, transcript, created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (entryError) {
    throw new Error(entryError.message)
  }

  if (!entry) {
    notFound()
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

  const errorMessage = getErrorMessage(error)
  const noticeMessage = getNoticeMessage(notice)
  const processingMessage = getProcessingMessage(entry.processing_status)

  return (
    <main className={ui.page.shell}>
      <div className={ui.page.containerNarrow}>
        <div className={ui.card.base}>
          <Link href="/painel" className="text-sm underline">
            Voltar para o painel
          </Link>

          <h1 className={`mt-4 ${ui.text.pageTitle}`}>Revisar lançamento</h1>
          <p className={`mt-2 ${ui.text.muted}`}>
            Revise este lançamento. Se o processamento automático falhar, você ainda pode ouvir o áudio e preencher os campos manualmente.
          </p>
        </div>

        {noticeMessage && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              {noticeMessage}
            </p>
          </div>
        )}

        {processingMessage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              {processingMessage}
            </p>
          </div>
        )}

        {entry.processing_status === 'failed' && entry.processing_error && (
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
            <h2 className="text-lg font-semibold">Áudio do lançamento</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Ouça novamente o áudio para revisar ou preencher os campos manualmente.
            </p>

            <div className="mt-4">
              <audio controls src={signedAudioUrl} className="w-full" />
            </div>
          </div>
        )}

        <div className={`mb-4 ${ui.card.muted}`}>
          <div className="mb-4 rounded-xl border p-4">
            <p className="text-sm text-neutral-600">
              Origem: <strong>{entry.source}</strong>
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Status de revisão: <strong>{entry.review_status}</strong>
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Status de processamento: <strong>{entry.processing_status ?? 'ready'}</strong>
            </p>
          </div>

          <form action={submitReview} className="space-y-4">
            <input type="hidden" name="id" value={entry.id} />

            <div>
              <label
                htmlFor="transcript"
                className="mb-2 block text-sm font-medium"
              >
                Transcrição
              </label>
              <textarea
                id="transcript"
                name="transcript"
                defaultValue={entry.transcript ?? ''}
                rows={5}
                className={ui.input.textarea}
                placeholder="Opcional. Se o processamento falhar, você pode deixar em branco e preencher os campos manualmente."
              />
            </div>

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
                  defaultValue={entry.due_on ?? ''}
                  className={ui.input.text}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                name="intent"
                value="save"
                className="rounded-xl border px-4 py-3 text-sm font-medium"
              >
                Salvar rascunho
              </button>

              <button
                type="submit"
                name="intent"
                value="confirm"
                className="rounded-xl border px-4 py-3 text-sm font-medium"
              >
                Confirmar lançamento
              </button>

              <button
                type="submit"
                name="intent"
                value="discard"
                className="rounded-xl border px-4 py-3 text-sm font-medium"
              >
                Descartar
              </button>
            </div>
          </form>
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