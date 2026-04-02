import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div>
      {user ? <p>Olá, {profile?.name}</p> : <p>Não logado</p>}
    </div>
  )
}