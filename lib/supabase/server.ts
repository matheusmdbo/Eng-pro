import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // GET cookie
        async get(name: string) {
          const cookieStore = await cookies();
          return cookieStore.get(name)?.value;
        },

        // SET cookie
        async set(name: string, value: string, options?: CookieOptions) {
          try {
            const cookieStore = await cookies();
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Ignorar se chamado de Server Component
            console.error(error);
          }
        },

        // REMOVE cookie
        async remove(name: string, options?: CookieOptions) {
          try {
            const cookieStore = await cookies();
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Ignorar se chamado de Server Component
            console.error(error);
          }
        },
      },
    }
  )
}
