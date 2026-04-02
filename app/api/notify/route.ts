// app/api/notify/route.ts
// ============================================================
// API Route para notificar o owner sobre novos cadastros
// Funciona com Vercel + Resend (ou nodemailer, SendGrid, etc.)
// ============================================================
//
// SETUP:
// 1. npm install resend
// 2. Crie uma conta em https://resend.com (grátis até 3.000 e-mails/mês)
// 3. Adicione a env var RESEND_API_KEY no painel Vercel:
//    Settings > Environment Variables > RESEND_API_KEY = re_xxxxxx
// 4. Adicione OWNER_EMAIL = seu-email@dominio.com
//
// ALTERNATIVA sem Resend: use nodemailer com Gmail SMTP
// ou SendGrid, Mailgun, etc.

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, ownerEmail, user } = body;

    if (type !== "new_registration") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      // Se não tem API key configurada, apenas loga no console do servidor
      console.log(`[ENGCALC PRO] Novo cadastro: ${user.name} (${user.email}) em ${user.createdAt}`);
      return NextResponse.json({ ok: true, method: "console_only" });
    }

    // Envia e-mail via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ENGCALC PRO <noreply@engcalcpro.com>", // Altere para seu domínio verificado no Resend
        to: [process.env.OWNER_EMAIL || ownerEmail],
        subject: `🆕 Novo cadastro: ${user.name}`,
        html: `
          <div style="font-family: monospace; background: #0d1117; color: #c9d1d9; padding: 24px; border-radius: 8px;">
            <h2 style="color: #58a6ff; margin-top: 0;">ENGCALC PRO — Novo Cadastro</h2>
            <table style="border-collapse: collapse; width: 100%;">
              <tr>
                <td style="padding: 8px; color: #8b949e; border-bottom: 1px solid #21262d;">Nome</td>
                <td style="padding: 8px; border-bottom: 1px solid #21262d; font-weight: bold;">${user.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; color: #8b949e; border-bottom: 1px solid #21262d;">E-mail</td>
                <td style="padding: 8px; border-bottom: 1px solid #21262d;">${user.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; color: #8b949e; border-bottom: 1px solid #21262d;">Data</td>
                <td style="padding: 8px; border-bottom: 1px solid #21262d;">${new Date(user.createdAt).toLocaleString("pt-BR")}</td>
              </tr>
            </table>
            <p style="margin-top: 16px; font-size: 12px; color: #484f58;">
              Este e-mail foi enviado automaticamente pela plataforma ENGCALC PRO.
            </p>
          </div>
        `,
      }),
    });

    const emailData = await emailResponse.json();
    return NextResponse.json({ ok: true, emailId: emailData.id });
  } catch (error) {
    console.error("[ENGCALC PRO] Erro ao notificar:", error);
    return NextResponse.json({ error: "Failed to notify" }, { status: 500 });
  }
}
