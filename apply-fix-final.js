const fs = require('fs');
const path = require('path');

const files = [
  {
    file: 'lib/supabase/server.ts',
    content: `import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
}`
  },
  {
    file: 'app/auth/actions.ts',
    content: `import { createClient } from '@/lib/supabase/server'
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
}`
  },
  {
    file: 'app/page.tsx',
    content: `import { createClient } from '@/lib/supabase/server'

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
}`
  },
  {
    file: 'app/api/pay/create-session/route.ts',
    content: `import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' })
const supabase = createClient()

export async function POST(req: Request) {
  const { moduleId, moduleName, priceInCents } = await req.json()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: moduleName },
        unit_amount: priceInCents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    metadata: { moduleId, userId: user.id },
    success_url: \`\${process.env.NEXT_PUBLIC_BASE_URL}/success\`,
    cancel_url: \`\${process.env.NEXT_PUBLIC_BASE_URL}/cancel\`,
  })

  return new Response(JSON.stringify({ url: session.url }), { status: 200 })
}`
  },
  {
    file: 'app/api/pay/webhook/route.ts',
    content: `import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' })
const supabaseAdmin = createClient()

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('stripe-signature') as string

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return new Response('Webhook signature mismatch', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId as string
    const moduleId = session.metadata?.moduleId as string

    const { data, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('modules')
      .eq('id', userId)
      .single()

    if (profileError) throw new Error(profileError.message)

    const currentModules = data?.modules || []
    const updatedModules = [...new Set([...currentModules, moduleId])]

    await supabaseAdmin
      .from('profiles')
      .update({ modules: updatedModules })
      .eq('id', userId)
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}`
  }
];

files.forEach(({ file, content }) => {
  const filePath = path.join(process.cwd(), file);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated: ${file}`);
});

console.log('\n🎉 All patch files applied! Run "npm run build" now.');
