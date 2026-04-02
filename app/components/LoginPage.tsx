"use client"
import { useState } from "react";
import { Inp, C, sty } from "./ui-elements"; // Vamos criar este arquivo

export default function LoginPage({ loginAction, signupAction, error }: { loginAction: any, signupAction: any, error?: string }) {
  const [lm, setLm] = useState<"login" | "register">("login");

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 30% 20%,#0d1117,#060a10 70%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono',monospace", color: C.text }}>
      <div style={{ width: "360px", textAlign: "center" }}>
        <div style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "3px", background: "linear-gradient(135deg,#58a6ff,#79c0ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "4px" }}>ENGCALC PRO</div>
        <div style={{ fontSize: "9px", color: C.muted, letterSpacing: "4px", marginBottom: "28px" }}>ENGINEERING CALCULATIONS PLATFORM</div>
        
        <form style={{ ...sty.card, textAlign: "left" }}>
          <div style={{ display: "flex", marginBottom: "14px", borderRadius: "4px", overflow: "hidden", border: `1px solid ${C.border}` }}>
            {(["login", "register"] as const).map(m => <div key={m} onClick={() => setLm(m)} style={{ flex: 1, textAlign: 'center', padding: "8px", background: lm === m ? C.accentDim : "transparent", border: "none", color: lm === m ? C.accent : C.dim, cursor: "pointer", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "inherit" }}>{m === "login" ? "Entrar" : "Cadastrar"}</div>)}
          </div>
          
          {lm === "register" && <Inp label="Nome completo" name="name" type="text" />}
          <Inp label="E-mail" name="email" type="email" />
          <Inp label="Senha" name="password" type="password" />
          
          {error && <div style={{ color: C.danger, fontSize: "10px", marginBottom: "6px", padding: "6px", background: C.danger + "10", borderRadius: "3px" }}>{decodeURIComponent(error)}</div>}
          
          <button formAction={lm === 'login' ? loginAction : signupAction} style={{ ...sty.btn("p"), width: "100%", padding: "10px", marginTop: "6px" }}>
            {lm === "login" ? "ACESSAR" : "CRIAR CONTA"}
          </button>
        </form>

        <div style={{ fontSize: "8px", color: C.muted, marginTop: "16px", lineHeight: "1.8" }}>Cálculos validados · EN 1991-4 · CEMA 7th</div>
      </div>
    </div>
  );
}