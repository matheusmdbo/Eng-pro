'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect('/?error=Credenciais inválidas')
  }

  return redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = createClient()
const origin = (await headers()).get('origin');
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  // ESTA É A PARTE CORRIGIDA
  const options = {
    emailRedirectTo: `${origin}/auth/callback`,
    
      name: name,
    
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options,
  })

  if (error) {
    console.log(error)
    return redirect('/?error=Não foi possível autenticar o usuário')
  }

  return redirect('/?message=Verifique seu email para continuar')
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return redirect('/')
}