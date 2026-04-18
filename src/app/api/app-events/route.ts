import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isAppEventName,
  sanitizeAppEventProperties,
  type AppEventProperties,
} from '@/lib/app-events'
import { insertAppEventRecord } from '@/lib/app-events-server'

type AppEventRouteBody = {
  event_name?: string
  session_id?: string
  properties?: AppEventProperties
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AppEventRouteBody | null

  if (!body || !body.event_name || !isAppEventName(body.event_name)) {
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 })
  }

  if (!body.session_id || typeof body.session_id !== 'string') {
    return NextResponse.json({ error: 'session_id inválido.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const success = await insertAppEventRecord({
    user_id: user?.id ?? null,
    session_id: body.session_id,
    event_name: body.event_name,
    properties: sanitizeAppEventProperties(body.properties),
  })

  if (!success) {
    return NextResponse.json(
      { error: 'Não foi possível registrar o evento.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
