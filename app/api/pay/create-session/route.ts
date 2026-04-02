import { createClient } from '@/lib/supabase/server'
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
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel`,
  })

  return new Response(JSON.stringify({ url: session.url }), { status: 200 })
}