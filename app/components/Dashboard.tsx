"use client";
// ============================================================
// PAINEL PRINCIPAL (CLIENT COMPONENT)
// ============================================================
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Inp, Sel, Res, Badge, Tabs, SavedCalcs, Scene3D, C, sty, MODULES } from "./ui-elements";

const UI = { Inp, Sel, Res, Badge, Tabs, SavedCalcs, Scene3D, C, sty };

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
  // PAGAMENTO DESATIVADO — descomente as 3 linhas abaixo e remova as substituições para reativar
  // const canAccess = user.modules.includes(mod);
  // const activeModules = MODULES.filter(m => user.modules.includes(m.id));
  // const inactiveModules = MODULES.filter(m => !user.modules.includes(m.id));
  const canAccess = true; // TEMP: bypass pagamento
  const activeModules = MODULES; // TEMP: bypass pagamento
  const inactiveModules: typeof MODULES = []; // TEMP: bypass pagamento

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px" }}>
      <div style={{ background: C.s1, borderBottom: `1px solid ${C.border}`, padding: "8px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "2px", background: "linear-gradient(135deg,#58a6ff,#79c0ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ENGCALC PRO</div><span style={{ fontSize: "8px", color: C.muted }}>v4</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {sec === "mod" && canAccess && <button onClick={() => setShowGloss(!showGloss)} style={{ ...sty.btn("g"), fontSize: "9px", padding: "4px 10px", background: showGloss ? C.accentDim : "transparent" }}>{showGloss ? "✕ Glossário" : "📖 Glossário"}</button>}
          <span style={{ fontSize: "10px", color: C.dim }}>{user.name}</span>
          <form action={logoutAction}><button style={{ ...sty.btn("g"), fontSize: "9px", padding: "4px 10px" }}>Sair</button></form>
        </div>
      </div>
      <div style={{ display: "flex", minHeight: "calc(100vh - 40px)" }}>
        <div style={{ width: "190px", background: C.s1, borderRight: `1px solid ${C.border}`, padding: "12px", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ fontSize: "8px", color: C.muted, letterSpacing: "2px", marginBottom: "8px" }}>NAVEGAÇÃO</div>
          {[{ id: "mod", l: "Módulos" }, { id: "store", l: "🛒 Loja" }, { id: "admin", l: "Conta" }].map(s2 => (<div key={s2.id} onClick={() => setSec(s2.id)} style={{ padding: "7px 10px", marginBottom: "3px", borderRadius: "4px", cursor: "pointer", background: sec === s2.id ? C.accentDim : "transparent", border: sec === s2.id ? `1px solid ${C.accent}33` : "1px solid transparent" }}><div style={{ fontSize: "10px", fontWeight: sec === s2.id ? 600 : 400, color: sec === s2.id ? C.accent : C.dim }}>{s2.l}</div></div>))}
          {activeModules.length > 0 && <><div style={{ fontSize: "8px", color: C.success, letterSpacing: "2px", margin: "14px 0 8px" }}>ATIVOS</div>{activeModules.map(m => (<div key={m.id} onClick={() => { setMod(m.id); setSec("mod") }} style={{ padding: "7px 10px", marginBottom: "3px", borderRadius: "4px", cursor: "pointer", background: mod === m.id && sec === "mod" ? C.accentDim : "transparent", border: mod === m.id && sec === "mod" ? `1px solid ${C.accent}33` : "1px solid transparent" }}><div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ color: m.color, fontSize: "12px" }}>{m.icon}</span><div><div style={{ fontSize: "10px", fontWeight: mod === m.id ? 600 : 400, color: mod === m.id && sec === "mod" ? C.text : C.dim }}>{m.name}</div><div style={{ fontSize: "7px", color: C.muted }}>{m.subtitle}</div></div></div></div>))}</>}
          {inactiveModules.length > 0 && <><div style={{ fontSize: "8px", color: C.muted, letterSpacing: "2px", margin: "14px 0 8px" }}>BLOQUEADOS</div>{inactiveModules.map(m => (<div key={m.id} onClick={() => setSec("store")} style={{ padding: "7px 10px", marginBottom: "3px", borderRadius: "4px", cursor: "pointer", opacity: 0.4 }}><div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ fontSize: "12px" }}>🔒</span><div><div style={{ fontSize: "10px", color: C.muted }}>{m.name}</div><div style={{ fontSize: "7px", color: C.muted }}>R$ {m.price.toFixed(0)}</div></div></div></div>))}</>}
        </div>
        <div style={{ flex: 1, padding: "18px", maxWidth: "920px", overflowY: "auto" }}>
            {sec === "mod" && canAccess && activeMod && <activeMod.Component onSave={save} user={user} UI={UI} />}
            {sec === "mod" && !canAccess && <div style={{ ...sty.card, textAlign: "center", padding: "60px 40px" }}><div style={{ fontSize: "40px", marginBottom: "16px" }}>🔒</div><div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>Módulo Bloqueado</div><div style={{ fontSize: "11px", color: C.dim, marginBottom: "20px" }}>Acesse a loja para ativar este módulo.</div><button onClick={() => setSec("store")} style={{ ...sty.btn("p"), padding: "10px 24px" }}>Ir para a Loja</button></div>}
            {sec === "store" && <div>
                <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700 }}>Módulos Disponíveis</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    {MODULES.map(m => {const isActive = user.modules.includes(m.id); return (<div key={m.id} style={{ ...sty.card, padding: "20px", border: isActive ? `1px solid ${C.success}44` : `1px solid ${C.border}`, background: isActive ? "rgba(63,185,80,0.03)" : C.s1, position: "relative" }}>{isActive && <div style={{ position: "absolute", top: "10px", right: "10px", background: C.success + "20", color: C.success, padding: "2px 8px", borderRadius: "10px", fontSize: "8px", fontWeight: 600 }}>ATIVO</div>}<div style={{ fontSize: "20px", marginBottom: "8px" }}>{m.icon}</div><div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>{m.name}</div><div style={{ fontSize: "9px", color: C.accent, marginBottom: "10px" }}>{m.norma}</div><div style={{ fontSize: "10px", color: C.dim, lineHeight: "1.5", marginBottom: "14px", minHeight: "36px" }}>{m.description}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{isActive ? <span style={{ fontSize: "11px", color: C.success, fontWeight: 600 }}>Ativo</span> : <span style={{ fontSize: "18px", fontWeight: 800, color: C.accent }}>R$ {m.price.toFixed(2).replace(".", ",")}</span>}{!isActive && <button onClick={() => activate(m.id)} disabled={isSubmitting} style={{ ...sty.btn("p"), fontSize: "10px", padding: "8px 16px", opacity: isSubmitting ? 0.6 : 1 }}>{isSubmitting ? "..." : "Ativar"}</button>}</div></div>);})}
                </div>
            </div>}
            {sec === "admin" && <div><div style={sty.card}><div style={sty.cardT}>Minha Conta</div><div style={sty.grid(2)}><div><div style={{ fontSize: "8px", color: C.muted }}>NOME</div><div style={{ marginTop: "3px" }}>{user.name}</div></div><div><div style={{ fontSize: "8px", color: C.muted }}>E-MAIL</div><div style={{ marginTop: "3px" }}>{user.email}</div></div><div><div style={{ fontSize: "8px", color: C.muted }}>CRIADO EM</div><div style={{ marginTop: "3px" }}>{new Date(user.created_at).toLocaleDateString("pt-BR")}</div></div><div><div style={{ fontSize: "8px", color: C.muted }}>MÓDULOS</div><div style={{ marginTop: "3px" }}>{user.modules.length}/{MODULES.length}</div></div></div></div></div>}
        </div>
        {sec === "mod" && canAccess && <GlossaryPanel moduleId={mod} visible={showGloss} onClose={() => setShowGloss(false)} />}
      </div>
      {saveM && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}><div style={{ ...sty.card, width: "350px" }}><div style={sty.cardT}>Salvar Cálculo</div><Inp label="Nome" value={pName} onChange={setPName} type="text" /><div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "10px" }}><button onClick={() => setSaveM(null)} style={sty.btn("g")}>Cancelar</button><button onClick={confirmSave} style={sty.btn("p")}>Salvar</button></div></div></div>}
      {toast && <div style={{ position: "fixed", bottom: "16px", right: "16px", padding: "8px 16px", background: toast.type === 's' ? C.success : C.danger, color: "#fff", borderRadius: "4px", fontSize: "11px", fontWeight: 600, zIndex: 300 }}>{toast.msg}</div>}
    </div>
  );
}