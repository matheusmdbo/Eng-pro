import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function signup(formData: FormData) {
  const supabase = createClient()

  const origin = (await headers()).get('origin') || undefined
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: origin,
    },
  })

  if (error) throw error

  return data
}