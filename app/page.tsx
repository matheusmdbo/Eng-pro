import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { redirect } from 'next/navigation'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>
}) {
  const { configured } = getSupabaseEnv()

  if (!configured) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#060a10', color: '#c9d1d9' }}>
        <div style={{ maxWidth: 720, padding: 24, border: '1px solid #21262d', borderRadius: 12, background: '#0d1117' }}>
          <h1 style={{ marginTop: 0, marginBottom: 12, fontSize: 28 }}>Configuracao pendente do ambiente</h1>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            O deploy esta ativo, mas as variaveis do Supabase nao foram encontradas.
            Configure na Vercel `SUPABASE_URL` e `SUPABASE_ANON_KEY`, ou use
            `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        </div>
      </main>
    )
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params = await searchParams

  async function loginAction(formData: FormData) {
    'use server'
    const supabase = createClient()
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) redirect(`/?error=${encodeURIComponent(error.message)}`)
    redirect('/')
  }

  async function signupAction(formData: FormData) {
    'use server'
    const supabase = createClient()
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) redirect(`/?error=${encodeURIComponent(error.message)}`)
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        name,
        modules: [],
        created_at: new Date().toISOString(),
      })
    }
    redirect('/')
  }

  async function logoutAction() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/')
  }

  if (!user) {
    return <LoginPage loginAction={loginAction} signupAction={signupAction} error={params.error} />
  }

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    const name = user.user_metadata?.name ?? user.email ?? ''
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      name,
      modules: [],
      created_at: user.created_at,
    })
    profile = { id: user.id, email: user.email, name, modules: [], created_at: user.created_at }
  }

  return <Dashboard user={profile} logoutAction={logoutAction} checkoutStatus={params.status} />
}
