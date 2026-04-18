import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { trackAppEventServer } from '@/lib/app-events-server'
import { createClient } from '@/lib/supabase/server'
import { resolveFirstCaptureState } from '@/lib/user-app-state'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  let next = searchParams.get('next') ?? '/painel'

  if (!next.startsWith('/')) {
    next = '/painel'
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const cookieStore = await cookies()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const firstCaptureState = await resolveFirstCaptureState({
          supabase,
          userId: user.id,
          cookieStore,
        })

        await trackAppEventServer({
          eventName: 'login_completed',
          userId: user.id,
          cookieStore,
          properties: {
            source_screen: 'auth_callback',
            has_completed_first_capture:
              firstCaptureState.hasCompletedFirstCapture,
          },
        })
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_callback`)
}
