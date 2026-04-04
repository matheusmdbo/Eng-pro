"use client";
// ============================================================
// PAINEL PRINCIPAL (CLIENT COMPONENT)
// ============================================================
import { useState, useEffect } from "react";
import * as THREE from "three";
import { Inp, Sel, Res, Badge, Tabs, SavedCalcs, Scene3D, C, sty, MODULES } from "./ui-elements";

const UI = { Inp, Sel, Res, Badge, Tabs, SavedCalcs, Scene3D, C, sty };

// 🔥 DEV MODE
const DEV_MODE = true;

export default function Dashboard({ user, logoutAction, checkoutStatus }: { user: any, logoutAction: any, checkoutStatus?: string }) {
  
  // 🔓 GARANTE módulos no DEV
  const userModules = DEV_MODE
    ? MODULES.map(m => m.id)
    : (user?.modules || []);

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

  // 🔥 força navegação correta no DEV
  useEffect(() => {
    if (DEV_MODE) {
      setSec("mod");
      setMod(MODULES[0].id);
    }
  }, []);

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
    // 🔓 DESATIVA PAGAMENTO
    if (DEV_MODE) {
      showToast("Modo DEV: módulo liberado automaticamente", "s");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pay/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: id }),
      });

      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const save = (d: any) => { setSaveM(d); setPName(`${d.type}_${new Date().toISOString().slice(0, 10)}`) };
  const confirmSave = async () => {
    if (!pName) return;
    localStorage.setItem(`p:${user.email}:${Date.now()}`, JSON.stringify({ ...saveM, name: pName }));
    setSaveM(null);
    showToast("Cálculo salvo!", "s");
  };

  const activeMod = MODULES.find(m => m.id === mod);

  // 🔓 BASEADO NO userModules (corrigido)
  const canAccess = userModules.includes(mod);
  const activeModules = MODULES.filter(m => userModules.includes(m.id));
  const inactiveModules = MODULES.filter(m => !userModules.includes(m.id));

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      
      {/* HEADER */}
      <div style={{ padding: "10px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between" }}>
        <div>ENGCALC PRO</div>
        <div>
          {user?.name}
          <form action={logoutAction}>
            <button>Sair</button>
          </form>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        
        {/* SIDEBAR */}
        <div style={{ width: "200px", borderRight: "1px solid #333", padding: "10px" }}>
          
          <div onClick={() => setSec("mod")}>Módulos</div>
          <div onClick={() => setSec("store")}>Loja</div>

          <hr />

          <div>ATIVOS</div>
          {activeModules.map(m => (
            <div key={m.id} onClick={() => { setMod(m.id); setSec("mod"); }}>
              {m.name}
            </div>
          ))}
        </div>

        {/* CONTEÚDO */}
        <div style={{ flex: 1, padding: "20px" }}>
          
          {/* MÓDULO */}
          {sec === "mod" && canAccess && activeMod && (
            <activeMod.Component onSave={save} user={user} UI={UI} />
          )}

          {/* BLOQUEADO */}
          {sec === "mod" && !canAccess && (
            <div>Módulo bloqueado</div>
          )}

          {/* LOJA */}
          {sec === "store" && (
            <div>
              <h2>Loja</h2>

              {MODULES.map(m => {
                const isActive = userModules.includes(m.id);

                return (
                  <div key={m.id} style={{ marginBottom: "10px" }}>
                    <div>{m.name}</div>

                    {isActive ? (
                      <span>Ativo</span>
                    ) : (
                      <button onClick={() => activate(m.id)} disabled={isSubmitting}>
                        Ativar
                      </button>
                    )}

                    {/* 🔓 DEV MODE */}
                    {DEV_MODE && <span> (Liberado DEV)</span>}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: 10, right: 10 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
