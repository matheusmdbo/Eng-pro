"use client";
// ============================================================
// PAINEL PRINCIPAL (CLIENT COMPONENT)
// ============================================================
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Inp, Sel, Res, Badge, Tabs, SavedCalcs, Scene3D, C, sty, MODULES } from "./ui-elements";

const UI = { Inp, Sel, Res, Badge, Tabs, SavedCalcs, Scene3D, C, sty };

// 🔥 DEV MODE (controle central)
const DEV_MODE = true;

function GlossaryPanel({moduleId,visible,onClose}:any){const mod=MODULES.find(m=>m.id===moduleId);if(!visible||!mod)return null;return(<div style={{width:"270px",flexShrink:0,background:C.s1,borderLeft:`1px solid ${C.border}`,padding:"12px",overflowY:"auto",maxHeight:"calc(100vh - 40px)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}><div style={{fontSize:"10px",fontWeight:600,color:C.accent,letterSpacing:"1px"}}>GLOSSÁRIO</div><button onClick={onClose} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:"14px",fontFamily:"inherit"}}>✕</button></div>{mod.glossary.map((cat:any,ci:number)=>(<div key={ci} style={{marginBottom:"12px"}}><div style={{fontSize:"8px",fontWeight:600,letterSpacing:"1px",marginBottom:"6px",padding:"3px 6px",borderRadius:"3px",color:cat.cat==="SAÍDA"?C.success:C.warn,background:cat.cat==="SAÍDA"?"rgba(63,185,80,0.06)":"rgba(210,153,34,0.06)",border:`1px solid ${cat.cat==="SAÍDA"?C.success+"22":C.warn+"22"}`}}>{cat.cat}</div>{cat.items.map((it:any,ii:number)=>(<div key={ii} style={{padding:"4px 6px",marginBottom:"2px",borderRadius:"3px",background:ii%2===0?"transparent":C.s2+"44",borderLeft:`2px solid ${cat.cat==="SAÍDA"?C.success+"44":C.warn+"44"}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><span style={{fontWeight:600,color:C.accent,fontSize:"9px"}}>{it.s}</span>{it.u&&<span style={{fontSize:"7px",color:C.muted,background:C.s3,padding:"1px 3px",borderRadius:"2px"}}>{it.u}</span>}</div><div style={{fontSize:"8px",color:C.dim,marginTop:"1px",lineHeight:"1.3"}}>{it.d}</div></div>))}</div>))}</div>);}

export default function Dashboard({ user, logoutAction, checkoutStatus }: { user: any, logoutAction: any, checkoutStatus?: string }) {
  const [mod, setMod] = useState(MODULES[0].id);
  const [sec, setSec] = useState("mod");
  const [saveM, setSaveM] = useState<any>(null);
  const [pName, setPName] = useState("");
  const [toast, setToast] = useState<{msg:string,type:"s"|"d"}|null>(null);
  const [showGloss, setShowGloss] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string, type: "s" | "d") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (checkoutStatus === 'success') {
      showToast("Pagamento aprovado! O módulo foi ativado.", "s");
      window.history.replaceState({}, document.title, "/");
    } else if (checkoutStatus === 'cancel') {
      showToast("Pagamento cancelado.", "d");
      window.history.replaceState({}, document.title, "/");
    }
  }, [checkoutStatus]);

  const activate = async (id: string) => {
    // 🔓 DEV MODE: desativa Stripe
    if (DEV_MODE) {
      showToast("Modo DEV: módulo liberado sem pagamento", "s");
      return;
    }

    setIsSubmitting(true);
    const mod = MODULES.find(m => m.id === id);
    if (!mod) return;

    try {
        const res = await fetch('/api/pay/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                moduleId: id,
                moduleName: mod.name,
                priceInCents: Math.round(mod.price * 100),
            }),
        });

        if (res.ok) {
            const { url } = await res.json();
            if (url) window.location.href = url;
        } else {
            showToast("Erro ao iniciar pagamento.", "d");
        }
    } catch (error) {
        showToast("Erro de conexão.", "d");
    } finally {
        setIsSubmitting(false);
    }
  };

  const save = (d: any) => { setSaveM(d); setPName(`${d.type}_${new Date().toISOString().slice(0, 10)}`) };
  const confirmSave = async () => { if (!pName) return; localStorage.setItem(`p:${user.email}:${Date.now()}`, JSON.stringify({ ...saveM, name: pName, at: new Date().toISOString() })); setSaveM(null); showToast("Cálculo salvo!", "s") };
  
  const activeMod = MODULES.find(m => m.id === mod);

  // 🔓 DEV MODE libera tudo
  const canAccess = DEV_MODE ? true : user.modules.includes(mod);

  const activeModules = DEV_MODE
    ? MODULES
    : MODULES.filter(m => user.modules.includes(m.id));

  const inactiveModules = DEV_MODE
    ? []
    : MODULES.filter(m => !user.modules.includes(m.id));

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px" }}>
      {/* restante do código permanece igual */}

      {sec === "store" && <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700 }}>Módulos Disponíveis</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          {MODULES.map(m => {
            const isActive = DEV_MODE ? true : user.modules.includes(m.id);

            return (
              <div key={m.id} style={{ ...sty.card }}>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>{m.name}</div>

                <div>
                  {isActive ? (
                    <span style={{ color: C.success }}>Ativo</span>
                  ) : (
                    <span>R$ {m.price}</span>
                  )}
                </div>

                {/* 🔓 DEV MODE: botão desativado */}
                {!isActive && !DEV_MODE && (
                  <button onClick={() => activate(m.id)}>
                    Ativar
                  </button>
                )}

                {DEV_MODE && (
                  <button disabled style={{ opacity: 0.6 }}>
                    Liberado (DEV)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
