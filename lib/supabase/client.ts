import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from './env'

export function createClient() {
  const { url, anonKey } = getSupabaseEnv()

  if (!url || !anonKey) {
    throw new Error(
      'Supabase environment variables are missing. Configure SUPABASE_URL and SUPABASE_ANON_KEY, or their NEXT_PUBLIC_* equivalents.'
    )
  }

  return createBrowserClient(
    url,
    anonKey
  )
}
