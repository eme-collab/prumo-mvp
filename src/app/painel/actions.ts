'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function createCapture(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const transcript = getString(formData, 'transcript')
  const occurredOn = getString(formData, 'occurred_on')

  if (!transcript) {
    redirect('/painel')
  }

  const { error } = await supabase.from('financial_entries').insert({
    user_id: user.id,
    source: 'voice',
    review_status: 'pending',
    processing_status: 'ready',
    processing_error: null,
    transcript,
    occurred_on: occurredOn || null,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/painel')
  redirect('/painel')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}