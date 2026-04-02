import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Importante: Usar o cliente com a chave de serviço para ter permissões de admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, moduleId } = session.metadata || {};

    if (!userId || !moduleId) {
      return NextResponse.json({ error: "Metadata ausente." }, { status: 400 });
    }

    try {
      // 1. Pega os módulos atuais do usuário
      const { profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('modules')
        .eq('id', userId)
        .single();
      
      if (profileError) throw profileError;

      // 2. Adiciona o novo módulo (evitando duplicatas)
      const currentModules = profile.modules || [];
      const updatedModules = [...new Set([...currentModules, moduleId])];

      // 3. Atualiza o perfil do usuário com a nova lista de módulos
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ modules: updatedModules })
        .eq('id', userId);

      if (updateError) throw updateError;
      
    } catch (error) {
        console.error("Erro ao processar webhook do Supabase:", error);
        return NextResponse.json({ error: "Erro interno ao atualizar dados." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}