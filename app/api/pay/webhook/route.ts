import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
  const supabaseAdmin = createClient()

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
}