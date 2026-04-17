'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import {
  INITIAL_FIRST_CAPTURE_VALIDATION_ACTION_STATE,
  runFirstCaptureValidationAction,
} from '@/app/painel/actions'

function getBooleanLabel(value: boolean) {
  return value ? 'Sim' : 'Nao'
}

function ValidationActionButton({
  intent,
  label,
  tone = 'default',
}: {
  intent: string
  label: string
  tone?: 'default' | 'danger'
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      {pending ? 'Executando...' : label}
    </button>
  )
}

export default function FirstCaptureValidationPanel({
  effectiveMode,
  hasPersistedRow,
  hasRemoteCompletedFirstCapture,
  hasLocalMirror,
  remoteErrorMessage,
  persistErrorMessage,
  isPersistFailureSimulationEnabled,
  canDeleteRemoteRow,
}: {
  effectiveMode: 'zen' | 'default'
  hasPersistedRow: boolean
  hasRemoteCompletedFirstCapture: boolean
  hasLocalMirror: boolean
  remoteErrorMessage: string | null
  persistErrorMessage: string | null
  isPersistFailureSimulationEnabled: boolean
  canDeleteRemoteRow: boolean
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(
    runFirstCaptureValidationAction,
    INITIAL_FIRST_CAPTURE_VALIDATION_ACTION_STATE
  )

  useEffect(() => {
    if (state.refreshToken === 0) {
      return
    }

    router.refresh()
  }, [router, state.refreshToken])

  return (
    <details className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">
        Validacao Etapa 1 - Modo Zen
      </summary>

      <div className="mt-4 space-y-4">
        <div className="grid gap-2 text-xs text-neutral-600 sm:grid-cols-2">
          <p>
            <span className="font-medium text-neutral-800">Painel efetivo:</span>{' '}
            {effectiveMode === 'zen' ? 'Zen' : 'Normal'}
          </p>
          <p>
            <span className="font-medium text-neutral-800">Linha remota:</span>{' '}
            {hasPersistedRow ? 'Presente' : 'Ausente'}
          </p>
          <p>
            <span className="font-medium text-neutral-800">Flag remota true:</span>{' '}
            {getBooleanLabel(hasRemoteCompletedFirstCapture)}
          </p>
          <p>
            <span className="font-medium text-neutral-800">Cookie local:</span>{' '}
            {getBooleanLabel(hasLocalMirror)}
          </p>
          <p>
            <span className="font-medium text-neutral-800">
              Falha remota simulada:
            </span>{' '}
            {getBooleanLabel(isPersistFailureSimulationEnabled)}
          </p>
        </div>

        {(remoteErrorMessage || persistErrorMessage) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p>{remoteErrorMessage ?? persistErrorMessage}</p>
          </div>
        )}

        <form action={formAction} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <ValidationActionButton
              intent="remote_false"
              label="Flag remota false"
            />
            <ValidationActionButton
              intent="remote_true"
              label="Flag remota true"
            />
            {canDeleteRemoteRow && (
              <ValidationActionButton
                intent="remote_absent"
                label="Remover linha remota"
                tone="danger"
              />
            )}
            <ValidationActionButton
              intent="clear_local_cookie"
              label="Limpar cookie local"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <ValidationActionButton
              intent="simulate_fail_on"
              label="Ativar falha remota"
              tone="danger"
            />
            <ValidationActionButton
              intent="simulate_fail_off"
              label="Desativar falha remota"
            />
          </div>
        </form>

        {!canDeleteRemoteRow && (
          <p className="text-xs text-neutral-500">
            Remocao real da linha exige `SUPABASE_SERVICE_ROLE_KEY` no ambiente
            local. Sem ela, use `Flag remota false` + `Limpar cookie local` como
            equivalente funcional para o gate.
          </p>
        )}

        {state.message && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              state.status === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {state.message}
          </div>
        )}
      </div>
    </details>
  )
}
