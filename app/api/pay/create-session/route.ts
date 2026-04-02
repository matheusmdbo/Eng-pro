import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export async function POST(req: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
    const supabase = createClient()

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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?status=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?status=cancel`,
    })

    return new Response(JSON.stringify({ url: session.url }), { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}