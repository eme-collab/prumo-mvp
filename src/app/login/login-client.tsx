'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ui } from '@/lib/ui'

function getUrlErrorMessage(urlError: string | null) {
  switch (urlError) {
    case 'oauth_callback':
      return 'Não foi possível concluir a entrada. Tente novamente com Google.'
    default:
      return urlError ? 'Não foi possível entrar. Tente novamente com Google.' : ''
  }
}

export default function LoginClient() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const urlError = searchParams.get('error')
  const urlErrorMessage = getUrlErrorMessage(urlError)

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')

    const origin = window.location.origin

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=/painel`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }



  return (
    <main className={ui.page.authShell}>
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Entrar no Prumo</h1>
        <p className={`mt-2 ${ui.text.muted}`}>
          Use sua conta Google para abrir o painel.
        </p>

        {urlErrorMessage && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {urlErrorMessage}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className={`mt-6 w-full ${ui.button.primary}`}
        >
          {loading ? 'Entrando...' : 'Entrar com Google'}
        </button>

        <p className={`mt-3 text-center ${ui.text.subtle}`}>
          Acesso simples e direto.
        </p>
      </div>
    </main>
  )
}
