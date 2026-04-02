import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const supabase = createClient();
  
  // LINHA CORRIGIDA AQUI
  const {  user  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { moduleId, moduleName, priceInCents } = await req.json();
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_{
          currency: "brl",
          product_{ name: `EngCalc Pro - Módulo ${moduleName}` },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      customer_email: user.email,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?checkout=cancel`,
      meta{
        userId: user.id,
        moduleId: moduleId,
      },
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error("Stripe Session Error:", error);
    return NextResponse.json({ error: "Erro ao criar sessão de pagamento." }, { status: 500 });
  }
}