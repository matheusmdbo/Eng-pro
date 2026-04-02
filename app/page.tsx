import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>
}) {
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) redirect(`/?error=${encodeURIComponent(error.message)}`)
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <Dashboard user={profile} logoutAction={logoutAction} checkoutStatus={params.status} />
}
