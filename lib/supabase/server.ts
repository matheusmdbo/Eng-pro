import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from './env'

export function createClient() {
  const { url, anonKey } = getSupabaseEnv()

  if (!url || !anonKey) {
    throw new Error(
      'Supabase environment variables are missing. Configure SUPABASE_URL and SUPABASE_ANON_KEY, or their NEXT_PUBLIC_* equivalents.'
    )
  }

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        async get(name: string) {
          return (await cookies()).get(name)?.value
        },

        async set(name: string, value: string, options?: CookieOptions) {
          try {
            const cookieStore = await cookies()
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            console.error(error)
          }
        },

        async remove(name: string, options?: CookieOptions) {
          try {
            const cookieStore = await cookies()
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            console.error(error)
          }
        },
      },
    }
  )
}
