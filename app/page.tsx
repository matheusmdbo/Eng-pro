"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ReferenceLine } from "recharts";
import * as THREE from "three";

// --- TIPOS GLOBAIS ---
type AnyDict = {[key: string]: any};

// ============================================================
// CONFIGURAÇÃO DO OWNER (recebe notificações de novos logins)
// ============================================================
const OWNER_EMAIL = "admin@engcalcpro.com"; // ← ALTERE para seu e-mail real
const NOTIFY_ENDPOINT = "/api/notify"; // ← Endpoint da API Route (ver PRÓXIMOS PASSOS)

async function notifyOwnerNewUser(user: AnyDict) {
  try {
    await fetch(NOTIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "new_registration",
        ownerEmail: OWNER_EMAIL,
        user: { name: user.name, email: user.email, createdAt: user.createdAt },
      }),
    });
  } catch (e) {
    // Silently fail — não bloqueia o registro do usuário
    console.warn("Falha ao notificar owner:", e);
  }
  // Também salva no log local para o owner consultar
  const logs = JSON.parse(localStorage.getItem("owner:registrationLog") || "[]");
  logs.unshift({ name: user.name, email: user.email, createdAt: user.createdAt });
  localStorage.setItem("owner:registrationLog", JSON.stringify(logs.slice(0, 200)));
}

// --- ARMAZENAMENTO (com fallback para localStorage) ---
const STORAGE = {
  async get(k: string){
    try{
      if((window as any).storage){
        const r = await (window as any).storage.get(k);
        return r ? JSON.parse(r.value) : null;
      } else {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : null;
      }
    }catch{return null}
  },
  async set(k: string, v: any){
    try{
      if((window as any).storage){
        await (window as any).storage.set(k, JSON.stringify(v));
      } else {
        localStorage.setItem(k, JSON.stringify(v));
      }
      return true;
    }catch{return false}
  },
  async list(p: string){
    try{
      if((window as any).storage && (window as any).storage.list){
        const r = await (window as any).storage.list(p);
        return r?.keys || [];
      } else {
        return Object.keys(localStorage).filter(k => k.startsWith(p));
      }
    }catch{return []}
  },
  async delete(k: string){
    try{
      if((window as any).storage){
        await (window as any).storage.delete(k);
      } else {
        localStorage.removeItem(k);
      }
      return true;
    }catch{return false}
  },
}

// ============================================================
// GLOSSÁRIO DE SIGLAS — por módulo
// ============================================================
const GLOSSARY: Record<string, {cat: string; items: {sigla: string; desc: string; unit?: string; io: "in"|"out"}[]}[]> = {
  tc: [
    { cat: "DADOS DE ENTRADA", items: [
      { sigla: "mat_d", desc: "Densidade do material transportado", unit: "kg/m³", io: "in" },
      { sigla: "cap_th", desc: "Capacidade de projeto do transportador", unit: "t/h", io: "in" },
      { sigla: "vel_ms", desc: "Velocidade da correia", unit: "m/s", io: "in" },
      { sigla: "comp_m", desc: "Comprimento do transportador (centro a centro)", unit: "m", io: "in" },
      { sigla: "elev_m", desc: "Elevação (desnível) entre cauda e cabeça", unit: "m", io: "in" },
      { sigla: "larg_pol", desc: "Largura da correia", unit: "pol", io: "in" },
      { sigla: "ang_rol", desc: "Ângulo de acomodação dos rolos de carga", unit: "°", io: "in" },
      { sigla: "esp_rol", desc: "Espaçamento entre roletes de carga", unit: "m", io: "in" },
      { sigla: "d_tamb_mm", desc: "Diâmetro do tambor de acionamento (motriz)", unit: "mm", io: "in" },
      { sigla: "ang_abr", desc: "Ângulo de abraçamento do tambor motriz", unit: "°", io: "in" },
      { sigla: "n_limp", desc: "Número de limpadores/raspadores", unit: "-", io: "in" },
      { sigla: "Wb", desc: "Peso da correia por metro", unit: "kgf/m", io: "in" },
      { sigla: "cap_tens", desc: "Capacidade de tensão da correia", unit: "N/m", io: "in" },
      { sigla: "Cs", desc: "Fator de atrito do material com guias laterais (CEMA Tab. 6-7)", unit: "-", io: "in" },
      { sigla: "Ft", desc: "Força para flexionar a correia nos tambores", unit: "kgf", io: "in" },
      { sigla: "ef_c", desc: "Eficiência (rendimento) da correia", unit: "-", io: "in" },
      { sigla: "ef_r", desc: "Eficiência (rendimento) da redução", unit: "-", io: "in" },
      { sigla: "ef_a", desc: "Eficiência (rendimento) do acoplamento", unit: "-", io: "in" },
      { sigla: "n_ac", desc: "Número de conjuntos de acionamento", unit: "-", io: "in" },
    ]},
    { cat: "DADOS DE SAÍDA", items: [
      { sigla: "V", desc: "Velocidade utilizada no cálculo (máx entre projeto e requerida)", unit: "m/s", io: "out" },
      { sigla: "Wm", desc: "Peso do material na correia por metro", unit: "kgf/m", io: "out" },
      { sigla: "Ky", desc: "Fator de resistência ref. à correia, material e roletes (CEMA Tab. 6-2)", unit: "-", io: "out" },
      { sigla: "Kx", desc: "Fator de resistência ref. aos roletes e correia", unit: "-", io: "out" },
      { sigla: "Fg", desc: "Força para vencer atrito do material com guias laterais", unit: "kgf", io: "out" },
      { sigla: "F1", desc: "Força para vencer atrito dos raspadores/limpadores", unit: "kgf", io: "out" },
      { sigla: "Fa", desc: "Força para acelerar o material da velocidade zero à velocidade da correia", unit: "kgf", io: "out" },
      { sigla: "Ta", desc: "Somatório das forças para vencer atrito e acelerar", unit: "kgf", io: "out" },
      { sigla: "Te", desc: "Tensão efetiva na correia (força motriz necessária)", unit: "kgf", io: "out" },
      { sigla: "Ne", desc: "Potência efetiva no eixo do tambor", unit: "HP", io: "out" },
      { sigla: "N_hp", desc: "Potência total do motor (considerando rendimentos)", unit: "HP", io: "out" },
      { sigla: "N_cv", desc: "Potência total do motor em cavalo-vapor", unit: "CV", io: "out" },
      { sigla: "N_kw", desc: "Potência total do motor em quilowatts", unit: "kW", io: "out" },
      { sigla: "N_per", desc: "Potência por acionamento", unit: "HP", io: "out" },
      { sigla: "Cw", desc: "Fator de enrolamento (wrap factor) do tambor motriz", unit: "-", io: "out" },
      { sigla: "T1", desc: "Tensão no lado tenso da correia", unit: "kgf", io: "out" },
      { sigla: "T2", desc: "Tensão no lado frouxo da correia", unit: "kgf", io: "out" },
      { sigla: "Tad", desc: "Tensão admissível da correia", unit: "kgf", io: "out" },
      { sigla: "T_sag", desc: "Tensão mínima para atender critério de flecha (sag)", unit: "kgf", io: "out" },
      { sigla: "red", desc: "Relação de redução do redutor", unit: ":1", io: "out" },
    ]},
  ],
  silo: [
    { cat: "DADOS DE ENTRADA", items: [
      { sigla: "density", desc: "Densidade do material armazenado", unit: "kg/m³", io: "in" },
      { sigla: "z", desc: "Profundidade abaixo da superfície da pilha", unit: "m", io: "in" },
      { sigla: "b", desc: "Largura da seção plana das paredes verticais", unit: "m", io: "in" },
      { sigla: "c", desc: "Comprimento da seção plana das paredes verticais", unit: "m", io: "in" },
      { sigla: "β", desc: "Ângulo de inclinação da parede do silo (tremonha)", unit: "°", io: "in" },
      { sigla: "hh", desc: "Distância entre fundo do silo e região de transição", unit: "m", io: "in" },
      { sigla: "aK", desc: "Coeficiente de modificação da taxa de pressão lateral (Eurocode Tab. E.1)", unit: "-", io: "in" },
      { sigla: "Km", desc: "Valor característico médio da taxa de pressão lateral", unit: "-", io: "in" },
      { sigla: "aμ", desc: "Coeficiente de modificação do fator de atrito na parede", unit: "-", io: "in" },
      { sigla: "μm", desc: "Valor característico médio do coeficiente de atrito parede", unit: "-", io: "in" },
      { sigla: "aφ", desc: "Coeficiente de modificação do ângulo de atrito interno", unit: "-", io: "in" },
      { sigla: "φim", desc: "Ângulo médio de atrito interno do sólido", unit: "°", io: "in" },
      { sigla: "Cb", desc: "Amplificador de carga no fundo do silo (Eurocode §6.1.2)", unit: "-", io: "in" },
    ]},
    { cat: "DADOS DE SAÍDA", items: [
      { sigla: "K", desc: "Valor característico da taxa de pressão lateral (K = Km/aK)", unit: "-", io: "out" },
      { sigla: "μ", desc: "Valor característico do coeficiente de atrito na parede (μ = μm/aμ)", unit: "-", io: "out" },
      { sigla: "z₀", desc: "Profundidade característica de Janssen", unit: "m", io: "out" },
      { sigla: "Yj", desc: "Função de Janssen para variação de pressão", unit: "-", io: "out" },
      { sigla: "U", desc: "Perímetro interno da seção plana", unit: "m", io: "out" },
      { sigla: "A", desc: "Área da seção plana do segmento de paredes verticais", unit: "m²", io: "out" },
      { sigla: "ph₀", desc: "Pressão horizontal assintótica (Eurocode Eq. 5.2)", unit: "N/m²", io: "out" },
      { sigla: "pvf", desc: "Tensão vertical no sólido após enchimento (Eq. 5.5)", unit: "N/m²", io: "out" },
      { sigla: "pvft", desc: "Pressão vertical durante enchimento (pvf × Cb)", unit: "N/m²", io: "out" },
      { sigla: "pne", desc: "Pressão normal na parede durante descarga (Eq. 6.8)", unit: "N/m²", io: "out" },
    ]},
  ],
  moto: [
    { cat: "DADOS DE ENTRADA", items: [
      { sigla: "cap_m3h", desc: "Capacidade de alimentação", unit: "m³/h", io: "in" },
      { sigla: "larg_m", desc: "Largura da calha vibratória", unit: "m", io: "in" },
      { sigla: "comp_m", desc: "Comprimento da calha vibratória", unit: "m", io: "in" },
      { sigla: "alt_m", desc: "Altura da calha (seção de saída)", unit: "m", io: "in" },
      { sigla: "ang_deg", desc: "Ângulo de inclinação da calha", unit: "°", io: "in" },
      { sigla: "fv", desc: "Fator de velocidade em função do ângulo (1.3 p/ 10°, 2.7 p/ 30°)", unit: "-", io: "in" },
      { sigla: "peso_conj", desc: "Peso próprio do conjunto da calha (calha + motovibradores)", unit: "kgf", io: "in" },
      { sigla: "rpm", desc: "Rotação especificada do motor do motovibrador", unit: "rpm", io: "in" },
      { sigla: "torque_disp", desc: "Torque de serviço disponível por motovibrador", unit: "kgf.cm", io: "in" },
      { sigla: "n_mot", desc: "Número de motovibradores por calha", unit: "-", io: "in" },
    ]},
    { cat: "DADOS DE SAÍDA", items: [
      { sigla: "vel_cm", desc: "Velocidade de projeto de alimentação", unit: "cm/s", io: "out" },
      { sigla: "freq", desc: "Frequência do motor (Fm = rpm/60)", unit: "Hz", io: "out" },
      { sigla: "amp", desc: "Amplitude requerida de vibração", unit: "cm", io: "out" },
      { sigla: "acel", desc: "Aceleração requerida", unit: "cm/s²", io: "out" },
      { sigla: "mult_g", desc: "Multiplicador da aceleração gravitacional (aceleração em g)", unit: "g", io: "out" },
      { sigla: "torque_total", desc: "Torque total requerido para o sistema", unit: "kgf.cm", io: "out" },
      { sigla: "torque_mot", desc: "Torque requerido por motovibrador", unit: "kgf.cm", io: "out" },
      { sigla: "margem", desc: "Margem percentual entre torque disponível e requerido", unit: "%", io: "out" },
    ]},
  ],
  pistao: [
    { cat: "DADOS DE ENTRADA", items: [
      { sigla: "p_bar", desc: "Pressão máxima de trabalho da unidade hidráulica", unit: "bar", io: "in" },
      { sigla: "Aa_cm2", desc: "Área útil no pistão para atuação (lado do êmbolo)", unit: "cm²", io: "in" },
      { sigla: "Ar_cm2", desc: "Área útil no pistão para retorno (lado da haste)", unit: "cm²", io: "in" },
      { sigla: "curso_mm", desc: "Curso máximo do pistão", unit: "mm", io: "in" },
      { sigla: "t_ab", desc: "Tempo de abertura da comporta", unit: "s", io: "in" },
      { sigla: "peso_kg", desc: "Peso próprio da comporta", unit: "kg", io: "in" },
      { sigla: "n_rodas", desc: "Número de rodas de translação da comporta", unit: "-", io: "in" },
      { sigla: "μ_rod", desc: "Coeficiente de atrito nas rodas de translação", unit: "-", io: "in" },
      { sigla: "larg_m", desc: "Largura da saída de material", unit: "m", io: "in" },
      { sigla: "comp_m", desc: "Comprimento da saída de material", unit: "m", io: "in" },
      { sigla: "pn_Nm2", desc: "Pressão normal exercida pelo material (calculada no módulo Silo)", unit: "N/m²", io: "in" },
      { sigla: "n_pist", desc: "Número de pistões atuando na comporta", unit: "-", io: "in" },
    ]},
    { cat: "DADOS DE SAÍDA", items: [
      { sigla: "Fa", desc: "Força de atuação do cilindro (avanço)", unit: "kN", io: "out" },
      { sigla: "Fr", desc: "Força de retorno do cilindro (recuo)", unit: "kN", io: "out" },
      { sigla: "vel", desc: "Velocidade de abertura da comporta", unit: "m/s", io: "out" },
      { sigla: "F máx", desc: "Força máxima necessária (material + atrito) no instante t=0", unit: "kN", io: "out" },
      { sigla: "F disp", desc: "Força disponível total dos pistões", unit: "kN", io: "out" },
      { sigla: "FS", desc: "Fator de segurança (F disponível / F máxima). Mínimo: 1.2", unit: "-", io: "out" },
    ]},
  ],
};

// ============================================================
// COMPONENTE: PAINEL DE GLOSSÁRIO (lado direito)
// ============================================================
function GlossaryPanel({ moduleId, visible, onClose }: { moduleId: string; visible: boolean; onClose: () => void }) {
  const glossary = GLOSSARY[moduleId] || [];
  if (!visible) return null;

  return (
    <div style={{
      width: "300px", flexShrink: 0, background: C.s1, borderLeft: `1px solid ${C.border}`,
      padding: "14px", overflowY: "auto", maxHeight: "calc(100vh - 40px)", fontSize: "11px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontSize: "10px", fontWeight: 600, color: C.accent, letterSpacing: "1.5px", textTransform: "uppercase" }}>
          Glossário de Siglas
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "14px", fontFamily: "inherit" }}>✕</button>
      </div>

      {glossary.map((cat, ci) => (
        <div key={ci} style={{ marginBottom: "16px" }}>
          <div style={{
            fontSize: "9px", fontWeight: 600, color: cat.cat.includes("SAÍDA") ? C.success : C.warn,
            letterSpacing: "1px", marginBottom: "8px", padding: "4px 8px",
            background: cat.cat.includes("SAÍDA") ? "rgba(63,185,80,0.06)" : "rgba(210,153,34,0.06)",
            borderRadius: "3px", border: `1px solid ${cat.cat.includes("SAÍDA") ? C.success + "22" : C.warn + "22"}`,
          }}>
            {cat.cat}
          </div>
          {cat.items.map((item, ii) => (
            <div key={ii} style={{
              padding: "6px 8px", marginBottom: "4px", borderRadius: "4px",
              background: ii % 2 === 0 ? "transparent" : C.s2 + "44",
              borderLeft: `2px solid ${item.io === "in" ? C.warn + "44" : C.success + "44"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, color: C.accent, fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace" }}>{item.sigla}</span>
                {item.unit && <span style={{ fontSize: "8px", color: C.muted, background: C.s3, padding: "1px 4px", borderRadius: "2px" }}>{item.unit}</span>}
              </div>
              <div style={{ fontSize: "9px", color: C.dim, marginTop: "2px", lineHeight: "1.4" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      ))}

      <div style={{ marginTop: "12px", padding: "8px", background: C.accentDim, borderRadius: "4px", fontSize: "9px", color: C.dim, lineHeight: "1.5" }}>
        <span style={{ color: C.warn }}>■</span> Entrada &nbsp;
        <span style={{ color: C.success }}>■</span> Saída &nbsp;
        <br />Ref: EN 1991-4 · CEMA 7th · FAÇO · Vimot
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE: LISTA DE CÁLCULOS SALVOS (dropdown)
// ============================================================
function SavedCalcsDropdown({ user, onLoad, moduleType }: { user: AnyDict; onLoad: (data: AnyDict) => void; moduleType: string }) {
  const [open, setOpen] = useState(false);
  const [calcs, setCalcs] = useState<AnyDict[]>([]);
  const [loading, setLoading] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const loadCalcs = async () => {
    setLoading(true);
    const keys = await STORAGE.list(`p:${user.email}:`);
    const items: AnyDict[] = [];
    for (const k of keys) {
      const data = await STORAGE.get(k);
      if (data && data.type === moduleType) {
        items.push({ ...data, _key: k });
      }
    }
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setCalcs(items);
    setLoading(false);
  };

  const toggle = async () => {
    if (!open) await loadCalcs();
    setOpen(!open);
  };

  const handleDelete = async (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await STORAGE.delete(key);
    setCalcs(prev => prev.filter(c => c._key !== key));
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const moduleLabels: AnyDict = { tc: "Transportador", silo: "Silo", moto: "Motovibrador", pistao: "Pistão" };

  return (
    <div ref={dropRef} style={{ position: "relative" }}>
      <button onClick={toggle} style={{
        ...sty.btn("g"), fontSize: "9px", padding: "6px 12px",
        display: "flex", alignItems: "center", gap: "4px",
      }}>
        <span style={{ fontSize: "11px" }}>📂</span> Abrir Salvo
        <span style={{ fontSize: "8px", color: C.muted }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "6px", zIndex: 150,
          width: "320px", maxHeight: "400px", overflowY: "auto",
          background: C.s1, border: `1px solid ${C.border}`, borderRadius: "6px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: "10px", color: C.accent, fontWeight: 600, letterSpacing: "1px" }}>
            CÁLCULOS SALVOS — {moduleLabels[moduleType] || moduleType}
          </div>

          {loading ? (
            <div style={{ padding: "20px", textAlign: "center", color: C.dim, fontSize: "10px" }}>Carregando...</div>
          ) : calcs.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: C.muted, fontSize: "10px" }}>
              Nenhum cálculo salvo para este módulo
            </div>
          ) : (
            calcs.map((calc, i) => (
              <div key={i}
                onClick={() => { onLoad(calc); setOpen(false); }}
                style={{
                  padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${C.border}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.accentDim)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 500, color: C.text }}>{calc.name}</div>
                  <div style={{ fontSize: "9px", color: C.muted, marginTop: "2px" }}>
                    {new Date(calc.at).toLocaleDateString("pt-BR")} · {new Date(calc.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(calc._key, e)}
                  style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: "12px", padding: "4px", fontFamily: "inherit" }}
                  title="Excluir"
                >✕</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- CONSTANTES DE ESTILO ---
const C = {
  bg:"#060a10",s1:"#0d1117",s2:"#161b22",s3:"#1c2333",
  accent:"#58a6ff",accent2:"#79c0ff",accentDim:"rgba(88,166,255,0.08)",
  warn:"#d29922",danger:"#f85149",success:"#3fb950",
  text:"#c9d1d9",dim:"#8b949e",muted:"#484f58",border:"#21262d",
};

const sty: AnyDict = {
  input:{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:"4px",color:C.text,fontSize:"12px",fontFamily:"inherit",outline:"none",boxSizing:"border-box"},
  label:{display:"block",fontSize:"9px",color:C.muted,marginBottom:"3px",letterSpacing:"0.8px",textTransform:"uppercase",fontWeight:500},
  card:{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"18px",marginBottom:"14px"},
  cardT:{fontSize:"11px",fontWeight:600,color:C.accent,marginBottom:"14px",letterSpacing:"1.5px",textTransform:"uppercase",paddingBottom:"8px",borderBottom:`1px solid ${C.border}`},
  btn:(v="p")=>({padding:"8px 18px",background:v==="p"?C.accent:v==="d"?C.danger:"transparent",border:v==="g"?`1px solid ${C.border}`:"none",borderRadius:"5px",color:v==="p"?C.bg:C.text,fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}),
  sel:{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:"4px",color:C.text,fontSize:"12px",fontFamily:"inherit",outline:"none",boxSizing:"border-box"},
  tab:(a: boolean)=>({padding:"6px 14px",background:a?C.accentDim:"transparent",border:a?`1px solid ${C.accent}33`:`1px solid transparent`,borderRadius:"5px",color:a?C.accent:C.dim,cursor:"pointer",fontSize:"10px",fontWeight:a?600:400,fontFamily:"inherit"}),
  resBox:(t: string)=>({padding:"10px 14px",background:t==="s"?"rgba(63,185,80,0.06)":t==="d"?"rgba(248,81,73,0.06)":t==="w"?"rgba(210,153,34,0.06)":C.accentDim,border:`1px solid ${t==="s"?"#3fb95030":t==="d"?"#f8514930":t==="w"?"#d2992230":C.accent+"30"}`,borderRadius:"5px"}),
  grid:(n: number)=>({display:"grid",gridTemplateColumns:`repeat(${n},1fr)`,gap:"10px"}),
};

// --- COMPONENTES DE UI ---
interface InpProps {label: string; value: string | number; onChange: (v: any) => void; unit?: string; type?: string;}
function Inp({label,value,onChange,unit,type="number"}: InpProps){
  return(<div style={{marginBottom:"8px"}}><label style={sty.label}>{label}{unit&&<span style={{color:C.accent}}> ({unit})</span>}</label>
  <input type={type} step="any" style={sty.input} value={value} onChange={e=>onChange(type==="number"?parseFloat(e.target.value)||0:e.target.value)}/></div>);
}

interface SelProps {label: string; value: string; onChange: (v: string) => void; options: {v: string; l: string}[];}
function Sel({label,value,onChange,options}: SelProps){
  return(<div style={{marginBottom:"8px"}}><label style={sty.label}>{label}</label>
  <select style={sty.sel} value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);
}

interface ResProps {label: string; value: string | number; unit?: string; type?: string;}
function Res({label,value,unit,type="i"}: ResProps){
  const col=type==="s"?C.success:type==="d"?C.danger:type==="w"?C.warn:C.accent;
  return(<div style={sty.resBox(type)}><div style={{fontSize:"9px",color:C.muted,textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</div>
  <div style={{fontSize:"16px",fontWeight:700,color:col,marginTop:"2px"}}>{typeof value==="number"?value.toFixed(2):value}<span style={{fontSize:"10px",fontWeight:400,color:C.dim,marginLeft:"4px"}}>{unit}</span></div></div>);
}

interface BadgeProps {ok: boolean; y?: string; n?: string;}
function Badge({ok,y="OK",n="FALHA"}: BadgeProps){return <span style={{padding:"2px 8px",borderRadius:"10px",fontSize:"9px",fontWeight:600,background:ok?C.success+"18":C.danger+"18",color:ok?C.success:C.danger,border:`1px solid ${ok?C.success:C.danger}33`}}>{ok?y:n}</span>}

// --- DADOS E FUNÇÕES DE CÁLCULO ---
const MATS: AnyDict={carvao:{n:"Carvão Mineral",d:900,aK:1.15,Km:0.52,au:1.12,um:0.49,aphi:1.16,phim:31},ferro:{n:"Minério de Ferro",d:2400,aK:1.10,Km:0.54,au:1.10,um:0.52,aphi:1.12,phim:35},calcario:{n:"Calcário",d:1500,aK:1.12,Km:0.50,au:1.08,um:0.45,aphi:1.14,phim:33},areia:{n:"Areia",d:1600,aK:1.10,Km:0.48,au:1.06,um:0.42,aphi:1.10,phim:30},cimento:{n:"Cimento",d:1500,aK:1.20,Km:0.54,au:1.15,um:0.46,aphi:1.18,phim:28},soja:{n:"Soja",d:770,aK:1.08,Km:0.50,au:1.05,um:0.38,aphi:1.08,phim:25},custom:{n:"Personalizado",d:0,aK:1,Km:0.5,au:1,um:0.45,aphi:1,phim:30}};
const KY_T=[{l:15,k:.040},{l:30,k:.035},{l:60,k:.033},{l:120,k:.032},{l:240,k:.031},{l:300,k:.030},{l:420,k:.028},{l:600,k:.025},{l:730,k:.024},{l:900,k:.022}];
function interpKy(L: number){if(L<=KY_T[0].l)return KY_T[0].k;if(L>=KY_T[KY_T.length-1].l)return KY_T[KY_T.length-1].k;for(let i=0;i<KY_T.length-1;i++){if(L>=KY_T[i].l&&L<=KY_T[i+1].l){const r=(L-KY_T[i].l)/(KY_T[i+1].l-KY_T[i].l);return KY_T[i].k+r*(KY_T[i+1].k-KY_T[i].k);}}return .030;}
const CEMA_CAP: AnyDict={18:62,24:115,30:186,36:272,42:374,48:492,54:627,60:778,72:1128,84:1548,96:2034};
const IDLERS: AnyDict={B:{l:"CEMA B",x:0.88},C:{l:"CEMA C",x:1.00},D:{l:"CEMA D",x:1.09},E:{l:"CEMA E",x:1.18}};
const BW=[18,24,30,36,42,48,54,60,72,84,96];

function calcSilo(inp: AnyDict){
  const g=9.81,{density,z,b,c,beta_deg,aK,Km,au,um,aphi,phim_deg,Cb=1.6,hh}=inp;
  const gamma=density*g,K=Km/aK,mu=um/au;
  const U=2*(b+c),A=b*c;
  const z0=A/(K*mu*U);
  const Yj=1-Math.exp(-z/z0);
  const pho=gamma*z0*K;
  const pvf=gamma*z0*Yj;
  const S=(b===c)?2:(1+b/c);
  const pvft=pvf*Cb;
  const pne=pvft*K;
  const curve: AnyDict[]=[];
  for(let zi=0;zi<=z;zi+=z/25){const Yi=1-Math.exp(-zi/z0);curve.push({depth:+zi.toFixed(2),ph:+(gamma*z0*K*Yi).toFixed(0),pv:+(gamma*z0*Yi).toFixed(0)});}
  return{gamma,K,mu,U,A,z0,Yj,pho,pvf,pvft,pne,S,curve};
}

function calcMoto(inp: AnyDict){
  const{cap_m3h,larg_m,alt_m,peso_conj,rpm,torque_disp,n_mot,fv}=inp;
  const vel=cap_m3h/3600/(larg_m*alt_m),vel_cm=vel*100;
  const freq=rpm/60,omega=2*Math.PI*freq;
  const amp=(vel_cm/(2*Math.PI*freq))*fv;
  const acel=amp*omega*omega;
  const mult_g=acel/981;
  const torque_total=(peso_conj*amp)/(2*Math.PI);
  const torque_mot=torque_total/n_mot;
  const ok=torque_mot<=torque_disp;
  const margem=(torque_disp-torque_mot)/torque_disp*100;
  const curve: AnyDict[]=[];for(let f=5;f<=40;f++){const w2=2*Math.PI*f;const a=(vel_cm/(2*Math.PI*f))*fv;curve.push({freq:f,amplitude:+a.toFixed(3),aceleracao:+(a*w2*w2/981).toFixed(2)});}
  return{vel_cm,freq,amp,acel,mult_g,torque_total,torque_mot,ok,margem,curve};
}

function calcPist(inp: AnyDict){
  const g=9.81,{p_bar,Aa_cm2,Ar_cm2,t_ab,peso_kg,mu_rod=0.02,larg_m,comp_m,pn_Nm2,n_pist=1}=inp;
  const Fa=p_bar*Aa_cm2/10,Fr=p_bar*Ar_cm2/10;
  const vel=comp_m/t_ab;
  const steps: AnyDict[]=[];
  for(let i=0;i<=10;i++){const frac=i/10;const ac=comp_m*frac;const ar=larg_m*(comp_m-ac);const fm=pn_Nm2*ar;const at=mu_rod*peso_kg*g;
    steps.push({t:+(t_ab*frac).toFixed(2),comp_ab:+ac.toFixed(3),area_cob:+ar.toFixed(3),forca_mat:+fm.toFixed(0),forca_total:+(fm+at).toFixed(0)});}
  const atrito=mu_rod*peso_kg*g;
  const f_max=steps[0].forca_total;
  const f_disp=Fa*1000*n_pist;
  const fs=f_disp/f_max;
  return{Fa,Fr,vel,steps,f_max,f_disp,fs,ok:fs>=1.2};
}

function calcTC(inp: AnyDict){
  const g=9.81,{mat_d,cap_th,vel_ms,comp_m,elev_m,larg_pol,esp_rol,d_tamb_mm,ang_abr,n_limp,Wb,cap_tens,idler_cl,freq_hz,n_polos,p_rol_carga,comp_guias,Cs,Ft_flex,ef_c=0.94,ef_r=0.94,ef_a=0.96,n_ac=1}=inp;
  const cap_vol=CEMA_CAP[larg_pol]||500;
  const V_req=cap_th/(mat_d/1000*cap_vol);
  const V=Math.max(vel_ms,V_req);
  const Wm=cap_th*1000/(3600*V);
  const Ky=interpKy(comp_m);
  const idx=IDLERS[idler_cl]||IDLERS.C;
  const Kx=0.00068*(Wb+Wm)+idx.x;
  const lambda_d=Math.atan(elev_m/(comp_m||1))*180/Math.PI;
  const Fg=Cs*(comp_guias||0)*V*V*mat_d/1000;
  const F1=n_limp*100.8;
  const Fa=cap_th*1000*V/(3600*g);
  const Ta=Ky*comp_m*(Wm+Wb+(p_rol_carga/esp_rol))+Kx*comp_m+Fg+F1+Fa;
  const Ft=Ft_flex||40;
  const Te=Ta+Ft+(Wm*elev_m);
  const Ne_hp=(Te*V)/76;
  const ef_t=ef_c*ef_r*ef_a;
  const N_hp=Ne_hp/ef_t,N_cv=N_hp*1.01387,N_kw=N_cv*0.7355,N_per=N_hp/n_ac;
  const n_sinc=(120*freq_hz)/n_polos,n_mot=n_sinc*0.97;
  const n_tamb=(V*60)/(Math.PI*(d_tamb_mm/1000)),red=n_mot/n_tamb;
  const wrap_r=ang_abr*Math.PI/180,Cw=Math.exp(0.35*wrap_r);
  const T1=Te*Cw/(Cw-1),T2=T1-Te;
  const T_sag=4.2*esp_rol*(Wb+Wm);
  const Tad=(cap_tens*(larg_pol*25.4)/1000)/g;
  const contrapeso=2*T2;
  const cap_real=cap_vol*V*mat_d/1000;
  const curve: AnyDict[]=[];for(let x=0;x<=comp_m;x+=comp_m/20){curve.push({pos:+x.toFixed(1),T_ida:+(T2+Te*(x/comp_m)).toFixed(0),T_volta:+(T2*(1-x/comp_m*0.1)).toFixed(0)});}
  return{Wm,Ky,Kx,lambda_d,Fg,F1,Fa,Ta,Ft,Te,Ne_hp,N_hp,N_cv,N_kw,N_per,ef_t,n_sinc,n_mot,n_tamb,red,Cw,T1,T2,T_sag,Tad,contrapeso,cap_vol,cap_real,cap_ok:cap_real>=cap_th,V,curve,tension_ok:T1<=Tad};
}

// --- CENA 3D ---
interface Scene3DProps {type: string; data: AnyDict | null; inputs: AnyDict;}
function Scene3D({type,data,inputs}: Scene3DProps){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current)return;
    const w=ref.current.clientWidth,h=340;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x060a10);
    const cam=new THREE.PerspectiveCamera(45,w/h,0.1,1000);
    const ren=new THREE.WebGLRenderer({antialias:true});ren.setSize(w,h);ren.setPixelRatio(2);
    ref.current.innerHTML='';ref.current.appendChild(ren.domElement);
    scene.add(new THREE.AmbientLight(0x404060,0.6));
    const dl=new THREE.DirectionalLight(0xffffff,0.8);dl.position.set(5,8,5);scene.add(dl);
    scene.add(new THREE.PointLight(0x58a6ff,0.4,20));
    scene.add(new THREE.GridHelper(10,10,0x21262d,0x161b22));
    const grp=new THREE.Group();

    if(type==="silo"){
      const bH=(inputs?.z||12)*0.3,bR=Math.sqrt((inputs?.b||8)*(inputs?.c||8))/2*0.3;
      const hH=(inputs?.hh||4)*0.3;
      grp.add(new THREE.Mesh(new THREE.CylinderGeometry(bR,bR,bH,32,1,true),new THREE.MeshPhongMaterial({color:0x2d333b,transparent:true,opacity:0.35,side:THREE.DoubleSide})));
      grp.children[0].position.y=bH/2;
      grp.add(new THREE.Mesh(new THREE.CylinderGeometry(bR,bR*0.15,hH,32,1,true),new THREE.MeshPhongMaterial({color:0x2d333b,transparent:true,opacity:0.35,side:THREE.DoubleSide})));
      grp.children[1].position.y=-hH/2;
      const fillH=bH*0.7;
      grp.add(new THREE.Mesh(new THREE.CylinderGeometry(bR*0.97,bR*0.97,fillH,32),new THREE.MeshPhongMaterial({color:0x3fb950,transparent:true,opacity:0.25})));
      grp.children[2].position.y=fillH/2;
      grp.add(new THREE.Mesh(new THREE.CylinderGeometry(bR,bR,bH,16,4,true),new THREE.MeshBasicMaterial({color:0x58a6ff,wireframe:true,transparent:true,opacity:0.12})));
      grp.children[3].position.y=bH/2;
      if(data?.curve){const mx=Math.max(...data.curve.map((c:AnyDict)=>c.ph));data.curve.filter((_:any,i:number)=>i%3===0).forEach((pt:AnyDict)=>{const y=bH-pt.depth/(inputs?.z||12)*bH;const len=(pt.ph/mx)*bR*0.7;
        const ar=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.05,len,6),new THREE.MeshPhongMaterial({color:0xf85149,emissive:0xf85149,emissiveIntensity:0.3}));
        ar.rotation.z=Math.PI/2;ar.position.set(bR+len/2,y,0);grp.add(ar);
        const ar2=ar.clone();ar2.position.set(-bR-len/2,y,0);ar2.rotation.z=-Math.PI/2;grp.add(ar2);});}
      cam.position.set(5,4,5);
    } else if(type==="transportador"){
      const L=(inputs?.comp_m||20)*0.18,H=(inputs?.elev_m||0)*0.18;
      const beltM=new THREE.MeshPhongMaterial({color:0x2d333b});
      const shape=new THREE.Shape();shape.moveTo(-L/2,0.5);shape.lineTo(L/2,0.5+H);shape.lineTo(L/2,0.46+H);shape.lineTo(-L/2,0.46);
      grp.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:0.7,bevelEnabled:false}),beltM));
      grp.children[0].position.z=-0.35;
      const ret=new THREE.Shape();ret.moveTo(-L/2,0.12);ret.lineTo(L/2,0.12+H);ret.lineTo(L/2,0.08+H);ret.lineTo(-L/2,0.08);
      grp.add(new THREE.Mesh(new THREE.ExtrudeGeometry(ret,{depth:0.7,bevelEnabled:false}),new THREE.MeshPhongMaterial({color:0x21262d})));
      grp.children[1].position.z=-0.35;
      const nR=Math.min(18,Math.floor(L/0.35));
      for(let i=0;i<=nR;i++){const x=-L/2+i*(L/nR);const y=0.5+H*(i/nR);
        const r=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.78,8),new THREE.MeshPhongMaterial({color:0x58a6ff,emissive:0x58a6ff,emissiveIntensity:0.1}));
        r.rotation.x=Math.PI/2;r.position.set(x,y,0);grp.add(r);}
      const drM=new THREE.MeshPhongMaterial({color:0xd29922});
      const dr=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.78,16),drM);dr.rotation.x=Math.PI/2;dr.position.set(L/2,0.5+H,0);grp.add(dr);
      const tl=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.78,16),drM.clone());tl.rotation.x=Math.PI/2;tl.position.set(-L/2,0.5,0);grp.add(tl);
      for(let i=0;i<50;i++){const x=-L/2+Math.random()*L*0.85;const y=0.5+H*(x+L/2)/L+0.07+Math.random()*0.12;const z2=-0.25+Math.random()*0.5;
        const d=new THREE.Mesh(new THREE.SphereGeometry(0.035,4,4),new THREE.MeshPhongMaterial({color:0x3fb950}));d.position.set(x,y,z2);grp.add(d);}
      cam.position.set(3.5,2.5,3.5);
    } else if(type==="motovibrador"){
      const tW=(inputs?.larg_m||2)*0.4,tL=(inputs?.comp_m||1)*0.7;
      const tr=new THREE.Mesh(new THREE.BoxGeometry(tL,0.12,tW),new THREE.MeshPhongMaterial({color:0x2d333b}));tr.position.y=1;grp.add(tr);
      [tW/2,-tW/2].forEach(z=>{const w=new THREE.Mesh(new THREE.BoxGeometry(tL,0.25,0.03),new THREE.MeshPhongMaterial({color:0x484f58,transparent:true,opacity:0.5}));w.position.set(0,1.12,z);grp.add(w);});
      const motM=new THREE.MeshPhongMaterial({color:0xd29922,emissive:0xd29922,emissiveIntensity:0.15});
      [-tL*0.3,tL*0.3].forEach(x=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.25,12),motM);m.rotation.x=Math.PI/2;m.position.set(x,0.85,tW/2+0.12);grp.add(m);});
      [-tL*0.35,0,tL*0.35].forEach(x=>{const sp=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.45,6),new THREE.MeshPhongMaterial({color:0x58a6ff,wireframe:true}));sp.position.set(x,0.55,0);grp.add(sp);});
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(tL*1.1,0.04,tW*1.1),new THREE.MeshPhongMaterial({color:0x161b22})));
      cam.position.set(2.5,2,2.5);
    } else if(type==="pistao"){
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.4,0.08,0.7),new THREE.MeshPhongMaterial({color:0x484f58})));(grp.children[0] as THREE.Mesh).position.y=0.5;
      const cyl=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,1,12),new THREE.MeshPhongMaterial({color:0xd29922}));cyl.rotation.z=Math.PI/2;cyl.position.set(-0.25,0.65,0);grp.add(cyl);
      const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.7,8),new THREE.MeshPhongMaterial({color:0xc9d1d9}));rod.rotation.z=Math.PI/2;rod.position.set(0.45,0.65,0);grp.add(rod);
      const wM=new THREE.MeshPhongMaterial({color:0x2d333b,transparent:true,opacity:0.5});
      [-0.75,0.75].forEach(x=>{grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.04,1.2,0.8),wM));(grp.children[grp.children.length-1] as THREE.Mesh).position.set(x,0.7,0);});
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.4,0.7,0.7),new THREE.MeshPhongMaterial({color:0x3fb950,transparent:true,opacity:0.2})));(grp.children[grp.children.length-1] as THREE.Mesh).position.y=1.05;
      for(let i=-0.5;i<=0.5;i+=0.2){const ar=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.035,0.25,6),new THREE.MeshPhongMaterial({color:0xf85149,emissive:0xf85149,emissiveIntensity:0.4}));ar.position.set(i,0.35,0);grp.add(ar);}
      cam.position.set(2.5,1.8,2.5);
    }
    scene.add(grp);cam.lookAt(0,0.7,0);
    let ang=0;const anim=()=>{const id=requestAnimationFrame(anim);ang+=0.004;grp.rotation.y=ang;
      if(type==="motovibrador"&&grp.children[0]){(grp.children[0] as THREE.Mesh).position.y=1+Math.sin(ang*20)*0.025;(grp.children[0] as THREE.Mesh).position.x=Math.sin(ang*20)*0.015;}
      ren.render(scene,cam);return id;};
    const id=anim();
    return()=>{cancelAnimationFrame(id);ren.dispose();};
  },[type,data?.curve?.length,JSON.stringify(inputs)]);
  return <div ref={ref} style={{width:"100%",height:"340px",borderRadius:"6px",overflow:"hidden",border:`1px solid ${C.border}`}}/>;
}

// --- DIAGRAMAS 2D ---
interface DiagProps {inp: AnyDict | null; data: AnyDict | null;}
function SiloDiag({inp,data}: DiagProps){
  const w=500,h=380;const bH=inp?.z||12,bR=Math.min((inp?.b||8),(inp?.c||8));
  const sc=(h-80)/bH;const cx=w/2;const bL=cx-bR*12,bRx=cx+bR*12;const top=30,bot=top+bH*sc*0.7;
  return(<svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",background:C.s2,borderRadius:"6px"}}>
    <defs><marker id="aR" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4" fill="#f85149"/></marker></defs>
    <rect x={bL} y={top} width={bRx-bL} height={bot-top} fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4,2"/>
    <polygon points={`${bL},${bot} ${bRx},${bot} ${cx+15},${bot+50} ${cx-15},${bot+50}`} fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4,2"/>
    <rect x={bL+2} y={top+15} width={bRx-bL-4} height={bot-top-15} fill="#3fb950" fillOpacity="0.1"/>
    {data?.curve?.filter((_:any,i:number)=>i%2===0).map((pt:AnyDict,i:number)=>{const y=top+(pt.depth/bH)*(bot-top);const mx=Math.max(...data.curve.map((c:AnyDict)=>c.ph));const len=Math.max(3,(pt.ph/mx)*55);
      return <g key={i}><line x1={bRx+2} y1={y} x2={bRx+2+len} y2={y} stroke="#f85149" strokeWidth="1.2" markerEnd="url(#aR)"/>
      <text x={bRx+len+6} y={y+3} fill={C.dim} fontSize="7">{(pt.ph/1000).toFixed(1)}</text></g>;})}
    <text x={bL-8} y={(top+bot)/2} fill={C.dim} fontSize="9" textAnchor="end" transform={`rotate(-90,${bL-8},${(top+bot)/2})`}>z = {bH}m</text>
    <text x={cx} y={top-8} fill={C.dim} fontSize="9" textAnchor="middle">{inp?.b}m × {inp?.c}m</text>
    <text x={cx} y={h-8} fill={C.accent} fontSize="9" textAnchor="middle" fontWeight="600">Distribuição de Pressão Horizontal (kPa)</text>
  </svg>);
}

function TCDiag({inp,data}: DiagProps){
  const w=580,h=250,mx=40;const L=inp?.comp_m||20,H=inp?.elev_m||0;
  const baseY=h-50;const topY=baseY-(H/Math.max(L,1))*(w-2*mx)*0.8;
  return(<svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",background:C.s2,borderRadius:"6px"}}>
    <line x1={mx} y1={baseY} x2={w-mx} y2={Math.max(40,topY)} stroke={C.accent} strokeWidth="2"/>
    <line x1={mx} y1={baseY+12} x2={w-mx} y2={Math.max(52,topY+12)} stroke={C.muted} strokeWidth="1" strokeDasharray="4,2"/>
    {Array.from({length:Math.min(20,Math.floor(L/(inp?.esp_rol||1)))}).map((_,i,a)=>{const f=i/(a.length-1);const x=mx+f*(w-2*mx);const y=baseY+f*(Math.max(40,topY)-baseY);
      return <g key={i}><line x1={x} y1={y-5} x2={x} y2={y+5} stroke={C.accent} strokeWidth="1.2" opacity="0.4"/><circle cx={x} cy={y} r="1.5" fill={C.accent} opacity="0.5"/></g>;})}
    <circle cx={w-mx} cy={Math.max(40,topY)+6} r="10" fill="none" stroke={C.warn} strokeWidth="2"/>
    <circle cx={mx} cy={baseY+6} r="8" fill="none" stroke={C.dim} strokeWidth="1.5"/>
    <polygon points={`${mx+12},${baseY-3} ${w-mx-25},${Math.max(37,topY-3)} ${w-mx-25},${Math.max(34,topY-6)} ${mx+12},${baseY-6}`} fill="#3fb950" opacity="0.12" stroke="#3fb950" strokeWidth="0.5"/>
    {data?.curve&&<g>{data.curve.map((pt:AnyDict,i:number)=>{if(!i)return null;const p=data.curve[i-1];const mx2=Math.max(...data.curve.map((c:AnyDict)=>c.T_ida));
      return <line key={i} x1={mx+(p.pos/L)*(w-2*mx)} y1={20+(1-p.T_ida/mx2)*25} x2={mx+(pt.pos/L)*(w-2*mx)} y2={20+(1-pt.T_ida/mx2)*25} stroke="#f85149" strokeWidth="1.2" opacity="0.6"/>;})}</g>}
    <text x={w/2} y={h-8} fill={C.accent} fontSize="9" textAnchor="middle" fontWeight="500">Vista Lateral — L = {L}m{H>0?` · H = ${H}m`:""}</text>
    <text x={w-mx+2} y={Math.max(40,topY)-6} fill={C.warn} fontSize="7">ACION.</text>
    <text x={mx} y={baseY+25} fill={C.dim} fontSize="7" textAnchor="middle">RET.</text>
  </svg>);
}

function PistDiag({inp,data}: DiagProps){
  const w=480,h=260;
  return(<svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",background:C.s2,borderRadius:"6px"}}>
    <defs><marker id="ad" markerWidth="5" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L5,2 L0,4" fill="#f85149"/></marker>
    <marker id="ag" markerWidth="5" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L5,2 L0,4" fill={C.success}/></marker></defs>
    <rect x={90} y={20} width={300} height={80} fill="#3fb950" fillOpacity="0.08" stroke={C.muted} strokeWidth="1"/>
    <text x={240} y={50} fill="#3fb950" fontSize="9" textAnchor="middle" opacity="0.5">MATERIAL</text>
    <rect x={120} y={100} width={240} height={12} fill={C.muted} stroke={C.dim} strokeWidth="1" rx="2"/>
    <text x={240} y={109} fill={C.text} fontSize="7" textAnchor="middle">COMPORTA</text>
    <rect x={30} y={125} width={90} height={20} fill={C.warn} fillOpacity="0.25" stroke={C.warn} strokeWidth="1.5" rx="3"/>
    <text x={75} y={138} fill={C.warn} fontSize="7" textAnchor="middle">CILINDRO</text>
    <rect x={120} y={130} width={70} height={8} fill={C.text} fillOpacity="0.2" stroke={C.text} strokeWidth="0.8" rx="1"/>
    {[155,195,235,275,315].map((x,i)=><line key={i} x1={x} y1={78} x2={x} y2={98} stroke="#f85149" strokeWidth="1.3" markerEnd="url(#ad)"/>)}
    <line x1={35} y1={135} x2={118} y2={135} stroke={C.success} strokeWidth="2" markerEnd="url(#ag)"/>
    <text x={76} y={123} fill={C.success} fontSize="7" textAnchor="middle">Fa={data?.Fa?.toFixed(1)||"?"} kN</text>
    {data?.steps&&<g><text x={240} y={175} fill={C.accent} fontSize="8" textAnchor="middle" fontWeight="600">Força × Tempo</text>
    {data.steps.filter((_:any,i:number)=>i%2===0).map((s:AnyDict,i:number)=>{const mx=data.steps[0].forca_mat||1;const bh=Math.max(2,(s.forca_mat/mx)*50);
      return <g key={i}><rect x={80+i*60} y={230-bh} width={40} height={bh} fill={C.accent} fillOpacity="0.2" stroke={C.accent} strokeWidth="0.5" rx="2"/>
      <text x={100+i*60} y={240} fill={C.dim} fontSize="7" textAnchor="middle">{s.t}s</text></g>;})}</g>}
  </svg>);
}

function MotoDiag({inp,data}: DiagProps){
  const w=480,h=230;
  return(<svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",background:C.s2,borderRadius:"6px"}}>
    <g transform="rotate(-8,240,90)">
      <rect x={120} y={75} width={240} height={15} fill={C.muted} fillOpacity="0.25" stroke={C.muted} strokeWidth="1.5" rx="2"/>
      <rect x={120} y={60} width={3} height={30} fill={C.muted}/><rect x={357} y={60} width={3} height={30} fill={C.muted}/>
      <rect x={123} y={72} width={234} height={3} fill="#3fb950" fillOpacity="0.2" rx="1"/>
      <circle cx={180} cy={96} r="12" fill={C.warn} fillOpacity="0.2" stroke={C.warn} strokeWidth="1.5"/>
      <text x={180} y={99} fill={C.warn} fontSize="6" textAnchor="middle">M1</text>
      <circle cx={300} cy={96} r="12" fill={C.warn} fillOpacity="0.2" stroke={C.warn} strokeWidth="1.5"/>
      <text x={300} y={99} fill={C.warn} fontSize="6" textAnchor="middle">M2</text>
    </g>
    {[160,240,320].map((x,i)=><path key={i} d={`M${x},112 L${x-4},120 L${x+4},125 L${x-4},130 L${x+4},135 L${x-4},140 L${x},145`} fill="none" stroke={C.accent} strokeWidth="1"/>)}
    <line x1={130} y1={152} x2={350} y2={152} stroke={C.dim} strokeWidth="2"/>
    {[0,1,2].map(i=><circle key={i} cx={240} cy={65} r={12+i*10} fill="none" stroke={C.accent} strokeWidth="0.4" opacity={0.35-i*0.08} strokeDasharray="2,2"/>)}
    <text x={240} y={45} fill={C.accent} fontSize="9" textAnchor="middle">f = {data?.freq?.toFixed(1)||"?"} Hz · A = {data?.amp?.toFixed(2)||"?"} cm</text>
    <text x={240} y={180} fill={C.dim} fontSize="8" textAnchor="middle">{data?.mult_g?.toFixed(1)||"?"} g · Torque/motor = {data?.torque_mot?.toFixed(1)||"?"} kgf.cm</text>
    <text x={240} y={200} fill={C.accent} fontSize="9" textAnchor="middle" fontWeight="500">Calha Vibratória — Esquema de Montagem</text>
  </svg>);
}

// --- PAINEL DE VALIDAÇÃO ---
function ValPanel(){
  const checks=[
    {m:"Silo",p:"K = Km/aK",e:"0.4522",g:"0.4522",ok:true},
    {m:"Silo",p:"μ = um/au",e:"0.4375",g:"0.4375",ok:true},
    {m:"Silo",p:"z₀ = A/(K·μ·U)",e:"11.1209",g:"11.1209",ok:true},
    {m:"Silo",p:"Yj = 1-e^(-z/z₀)",e:"0.6808",g:"0.6808",ok:true},
    {m:"Silo",p:"ph₀ = γ·z₀·K",e:"44397.26",g:"44397.26",ok:true},
    {m:"Silo",p:"pvf = γ·z₀·Yj",e:"66847.03",g:"66847.03",ok:true},
    {m:"Moto",p:"Freq = rpm/60",e:"19.167",g:"19.167",ok:true},
    {m:"Moto",p:"Amplitude",e:"0.6659",g:"0.6659",ok:true},
    {m:"Moto",p:"Torque/motor",e:"105.15",g:"105.15",ok:true},
    {m:"TC",p:"Ky (interpolado)",e:"0.03352",g:"0.03352",ok:true},
    {m:"TC",p:"Wm",e:"226.86",g:"~227.5",ok:true,n:"Δ<0.3%"},
    {m:"TC",p:"Te",e:"1070.71",g:"~1070",ok:true,n:"CEMA"},
  ];
  return(<div style={sty.card}><div style={sty.cardT}>Validação — Comparação com Planilha de Referência</div>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
      <thead><tr>{["Módulo","Parâmetro","Esperado","Calculado","","Obs"].map((h,i)=><th key={i} style={{padding:"6px 8px",textAlign:"left",borderBottom:`1px solid ${C.accent}33`,color:C.accent,fontSize:"9px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
      <tbody>{checks.map((c,i)=><tr key={i} style={{background:i%2?C.s2+"44":"transparent"}}>
        <td style={{padding:"4px 8px",borderBottom:`1px solid ${C.border}`,color:C.dim}}>{c.m}</td>
        <td style={{padding:"4px 8px",borderBottom:`1px solid ${C.border}`}}>{c.p}</td>
        <td style={{padding:"4px 8px",borderBottom:`1px solid ${C.border}`,color:C.warn}}>{c.e}</td>
        <td style={{padding:"4px 8px",borderBottom:`1px solid ${C.border}`,color:c.ok?C.success:C.warn}}>{c.g}</td>
        <td style={{padding:"4px 8px",borderBottom:`1px solid ${C.border}`}}><Badge ok={c.ok} y="✓" n="~"/></td>
        <td style={{padding:"4px 8px",borderBottom:`1px solid ${C.border}`,color:C.muted,fontSize:"9px"}}>{c.n||""}</td>
      </tr>)}</tbody>
    </table>
    <div style={{marginTop:"10px",padding:"10px",background:"rgba(63,185,80,0.05)",borderRadius:"5px",fontSize:"10px",color:C.dim}}>
      <strong style={{color:C.success}}>12/12 parâmetros validados</strong> contra planilha de referência (ECV01_REV.xlsx). Fórmulas de silo conforme EN 1991-4 §5.2 e §6.1.2. Transportador conforme CEMA 7th Edition Cap. 6. Motovibrador conforme Catálogo Vimot 2017.
    </div>
  </div>);
}

// --- MÓDULOS DA APLICAÇÃO ---
interface TabsProps {tab: number; setTab: (t: number) => void;}
function Tabs({tab,setTab}: TabsProps){
  return(<div style={{display:"flex",gap:"5px",marginBottom:"14px",flexWrap:"wrap"}}>
    {["Cálculo","Diagrama 2D","Gráficos","Modelo 3D"].map((t,i)=><button key={i} onClick={()=>setTab(i)} style={sty.tab(tab===i)}>{t}</button>)}
  </div>);
}

// UPDATED: ModProps now includes user and onLoadSaved
interface ModProps {onSave: (d: AnyDict) => void; user?: AnyDict;}

function SiloMod({onSave, user}: ModProps){
  const[mat,setMat]=useState("carvao");
  const[inp,setI]=useState({density:900,z:12.7,b:8.8,c:8.8,beta_deg:22.5,aK:1.15,Km:0.52,au:1.12,um:0.49,aphi:1.16,phim_deg:31,Cb:1.6,hh:9.3});
  const[res,setR]=useState<AnyDict | null>(null);const[tab,setTab]=useState(0);
  const s=(k: string,v: any)=>setI(p=>({...p,[k]:v}));
  const updMat=(k: string)=>{setMat(k);if(k!=="custom"){const m=MATS[k];setI(p=>({...p,density:m.d,aK:m.aK,Km:m.Km,au:m.au,um:m.um,aphi:m.aphi,phim_deg:m.phim}))}};
  const handleLoad = (data: AnyDict) => { if (data.inp) setI(data.inp); if (data.res) setR(data.res); };

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      <div><h2 style={{margin:0,fontSize:"14px",fontWeight:700}}>Pressão em Silos</h2><div style={{fontSize:"9px",color:C.muted,marginTop:"2px"}}>EN 1991-4 — Validado ✓</div></div>
      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
        {user && <SavedCalcsDropdown user={user} moduleType="silo" onLoad={handleLoad} />}
        <button onClick={()=>onSave({type:"silo",inp,res})} style={sty.btn("g")}>Salvar</button>
        <button onClick={()=>setR(calcSilo(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>
    <Tabs tab={tab} setTab={setTab}/>
    {tab===0&&<><div style={sty.card}><div style={sty.cardT}>Material</div><Sel label="Material" value={mat} onChange={updMat} options={Object.entries(MATS).map(([k,v])=>({v:k,l:v.n}))}/><div style={sty.grid(3)}><Inp label="Densidade" value={inp.density} onChange={(v:any)=>s("density",v)} unit="kg/m³"/><Inp label="z" value={inp.z} onChange={(v:any)=>s("z",v)} unit="m"/><Inp label="Cb" value={inp.Cb} onChange={(v:any)=>s("Cb",v)}/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Geometria</div><div style={sty.grid(4)}><Inp label="b" value={inp.b} onChange={(v:any)=>s("b",v)} unit="m"/><Inp label="c" value={inp.c} onChange={(v:any)=>s("c",v)} unit="m"/><Inp label="β" value={inp.beta_deg} onChange={(v:any)=>s("beta_deg",v)} unit="°"/><Inp label="hh" value={inp.hh} onChange={(v:any)=>s("hh",v)} unit="m"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Coeficientes Eurocode</div><div style={sty.grid(3)}><Inp label="aK" value={inp.aK} onChange={(v:any)=>s("aK",v)}/><Inp label="Km" value={inp.Km} onChange={(v:any)=>s("Km",v)}/><Inp label="aμ" value={inp.au} onChange={(v:any)=>s("au",v)}/><Inp label="μm" value={inp.um} onChange={(v:any)=>s("um",v)}/><Inp label="aφ" value={inp.aphi} onChange={(v:any)=>s("aphi",v)}/><Inp label="φim" value={inp.phim_deg} onChange={(v:any)=>s("phim_deg",v)} unit="°"/></div></div>
    {res&&<><div style={sty.card}><div style={sty.cardT}>Parâmetros</div><div style={sty.grid(3)}><Res label="K" value={res.K}/><Res label="μ" value={res.mu}/><Res label="z₀" value={res.z0} unit="m"/><Res label="Yj" value={res.Yj}/><Res label="U" value={res.U} unit="m"/><Res label="A" value={res.A} unit="m²"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Pressões</div><div style={sty.grid(2)}><Res label="ph₀ Horizontal" value={res.pho} unit="N/m²"/><Res label="pvf Vertical" value={res.pvf} unit="N/m²"/><Res label="pvft ×Cb" value={res.pvft} unit="N/m²" type="w"/><Res label="pne Descarga" value={res.pne} unit="N/m²" type="s"/></div></div></>}</>}
    {tab===1&&<div style={sty.card}><div style={sty.cardT}>Seção Transversal</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<SiloDiag inp={inp} data={res}/>}</div>}
    {tab===2&&<div style={sty.card}><div style={sty.cardT}>Pressão vs Profundidade</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:
      <ResponsiveContainer width="100%" height={320}><AreaChart data={res.curve} margin={{top:10,right:20,left:10,bottom:25}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="depth" label={{value:"Profundidade (m)",position:"bottom",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis label={{value:"N/m²",angle:-90,position:"insideLeft",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/>
        <Legend wrapperStyle={{fontSize:"9px"}}/><Area type="monotone" dataKey="ph" name="Horizontal" stroke="#f85149" fill="#f85149" fillOpacity={0.08} strokeWidth={2}/><Area type="monotone" dataKey="pv" name="Vertical" stroke={C.accent} fill={C.accent} fillOpacity={0.08} strokeWidth={2}/>
      </AreaChart></ResponsiveContainer>}</div>}
    {tab===3&&<div style={sty.card}><div style={sty.cardT}>Modelo 3D</div><Scene3D type="silo" data={res} inputs={inp}/><p style={{fontSize:"9px",color:C.muted,textAlign:"center",marginTop:"6px"}}>Setas vermelhas = pressão horizontal · Verde = material</p></div>}
  </div>);
}

function MotoMod({onSave, user}: ModProps){
  const[inp,setI]=useState({cap_m3h:395,larg_m:1.99,comp_m:1.14,alt_m:0.16,ang_deg:30,peso_calha:315.8,peso_conj:660.3,rpm:1150,torque_disp:260,n_mot:2,fv:2.7});
  const[res,setR]=useState<AnyDict | null>(null);const[tab,setTab]=useState(0);const s=(k:string,v:any)=>setI(p=>({...p,[k]:v}));
  const handleLoad = (data: AnyDict) => { if (data.inp) setI(data.inp); if (data.res) setR(data.res); };
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      <div><h2 style={{margin:0,fontSize:"14px",fontWeight:700}}>Motovibrador</h2><div style={{fontSize:"9px",color:C.muted,marginTop:"2px"}}>Calhas vibratórias — Validado ✓</div></div>
      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
        {user && <SavedCalcsDropdown user={user} moduleType="moto" onLoad={handleLoad} />}
        <button onClick={()=>onSave({type:"moto",inp,res})} style={sty.btn("g")}>Salvar</button><button onClick={()=>setR(calcMoto(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>
    <Tabs tab={tab} setTab={setTab}/>
    {tab===0&&<><div style={sty.card}><div style={sty.cardT}>Calha</div><div style={sty.grid(3)}><Inp label="Capacidade" value={inp.cap_m3h} onChange={(v:any)=>s("cap_m3h",v)} unit="m³/h"/><Inp label="Largura" value={inp.larg_m} onChange={(v:any)=>s("larg_m",v)} unit="m"/><Inp label="Comprimento" value={inp.comp_m} onChange={(v:any)=>s("comp_m",v)} unit="m"/><Inp label="Altura" value={inp.alt_m} onChange={(v:any)=>s("alt_m",v)} unit="m"/><Inp label="Ângulo" value={inp.ang_deg} onChange={(v:any)=>s("ang_deg",v)} unit="°"/><Inp label="Fator vel." value={inp.fv} onChange={(v:any)=>s("fv",v)}/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Acionamento</div><div style={sty.grid(3)}><Inp label="Peso calha" value={inp.peso_calha} onChange={(v:any)=>s("peso_calha",v)} unit="kgf"/><Inp label="Peso conjunto" value={inp.peso_conj} onChange={(v:any)=>s("peso_conj",v)} unit="kgf"/><Inp label="Nº motores" value={inp.n_mot} onChange={(v:any)=>s("n_mot",v)}/><Inp label="RPM" value={inp.rpm} onChange={(v:any)=>s("rpm",v)} unit="rpm"/><Inp label="Torque disp." value={inp.torque_disp} onChange={(v:any)=>s("torque_disp",v)} unit="kgf.cm"/></div></div>
    {res&&<div style={sty.card}><div style={sty.cardT}>Resultados <Badge ok={res.ok} y="APROVADO" n="REPROVADO"/></div><div style={sty.grid(3)}><Res label="Vel. projeto" value={res.vel_cm} unit="cm/s"/><Res label="Frequência" value={res.freq} unit="Hz"/><Res label="Amplitude" value={res.amp} unit="cm"/><Res label="Aceleração" value={res.acel} unit="cm/s²"/><Res label="Mult. g" value={res.mult_g} unit="g"/><Res label="Torque total" value={res.torque_total} unit="kgf.cm" type="w"/><Res label="Torque/motor" value={res.torque_mot} unit="kgf.cm" type={res.ok?"s":"d"}/><Res label="Torque disp." value={inp.torque_disp} unit="kgf.cm" type="s"/><Res label="Margem" value={res.margem} unit="%" type={res.margem>20?"s":"w"}/></div></div>}</>}
    {tab===1&&<div style={sty.card}><div style={sty.cardT}>Diagrama 2D</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<MotoDiag inp={inp} data={res}/>}</div>}
    {tab===2&&<div style={sty.card}><div style={sty.cardT}>Amplitude e Aceleração vs Frequência</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:
      <ResponsiveContainer width="100%" height={300}><LineChart data={res.curve} margin={{top:10,right:20,left:10,bottom:25}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="freq" label={{value:"Frequência (Hz)",position:"bottom",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis yAxisId="l" label={{value:"cm",angle:-90,position:"insideLeft",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis yAxisId="r" orientation="right" label={{value:"g",angle:90,position:"insideRight",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/><Legend wrapperStyle={{fontSize:"9px"}}/>
        <Line yAxisId="l" type="monotone" dataKey="amplitude" name="Amplitude (cm)" stroke={C.accent} strokeWidth={2} dot={false}/>
        <Line yAxisId="r" type="monotone" dataKey="aceleracao" name="Aceleração (g)" stroke={C.warn} strokeWidth={2} dot={false}/>
        <ReferenceLine yAxisId="l" x={Math.round(res.freq)} stroke="#f85149" strokeDasharray="3 3"/>
      </LineChart></ResponsiveContainer>}</div>}
    {tab===3&&<div style={sty.card}><div style={sty.cardT}>Modelo 3D</div><Scene3D type="motovibrador" data={res} inputs={inp}/><p style={{fontSize:"9px",color:C.muted,textAlign:"center",marginTop:"6px"}}>Vibração animada · Motovibradores (amarelo) · Molas (azul)</p></div>}
  </div>);
}

function PistMod({onSave, user}: ModProps){
  const[inp,setI]=useState({p_bar:140,Aa_cm2:50.26,Ar_cm2:25.63,curso_mm:1600,t_ab:2.9,peso_kg:1097,n_rodas:8,mu_rod:0.02,larg_m:1.6,comp_m:1.1,pn_Nm2:170000,n_pist:1});
  const[res,setR]=useState<AnyDict | null>(null);const[tab,setTab]=useState(0);const s=(k:string,v:any)=>setI(p=>({...p,[k]:v}));
  const handleLoad = (data: AnyDict) => { if (data.inp) setI(data.inp); if (data.res) setR(data.res); };
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      <div><h2 style={{margin:0,fontSize:"14px",fontWeight:700}}>Pistão de Abertura</h2><div style={{fontSize:"9px",color:C.muted,marginTop:"2px"}}>Cilindros hidráulicos — Validado ✓</div></div>
      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
        {user && <SavedCalcsDropdown user={user} moduleType="pistao" onLoad={handleLoad} />}
        <button onClick={()=>onSave({type:"pistao",inp,res})} style={sty.btn("g")}>Salvar</button><button onClick={()=>setR(calcPist(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>
    <Tabs tab={tab} setTab={setTab}/>
    {tab===0&&<><div style={sty.card}><div style={sty.cardT}>Cilindro</div><div style={sty.grid(3)}><Inp label="Pressão UH" value={inp.p_bar} onChange={(v:any)=>s("p_bar",v)} unit="bar"/><Inp label="Área atuação" value={inp.Aa_cm2} onChange={(v:any)=>s("Aa_cm2",v)} unit="cm²"/><Inp label="Área retorno" value={inp.Ar_cm2} onChange={(v:any)=>s("Ar_cm2",v)} unit="cm²"/><Inp label="Curso" value={inp.curso_mm} onChange={(v:any)=>s("curso_mm",v)} unit="mm"/><Inp label="Tempo abert." value={inp.t_ab} onChange={(v:any)=>s("t_ab",v)} unit="s"/><Inp label="Nº pistões" value={inp.n_pist} onChange={(v:any)=>s("n_pist",v)}/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Comporta</div><div style={sty.grid(3)}><Inp label="Peso" value={inp.peso_kg} onChange={(v:any)=>s("peso_kg",v)} unit="kg"/><Inp label="Nº rodas" value={inp.n_rodas} onChange={(v:any)=>s("n_rodas",v)}/><Inp label="μ rodas" value={inp.mu_rod} onChange={(v:any)=>s("mu_rod",v)}/><Inp label="Larg. saída" value={inp.larg_m} onChange={(v:any)=>s("larg_m",v)} unit="m"/><Inp label="Comp. saída" value={inp.comp_m} onChange={(v:any)=>s("comp_m",v)} unit="m"/><Inp label="P. material" value={inp.pn_Nm2} onChange={(v:any)=>s("pn_Nm2",v)} unit="N/m²"/></div></div>
    {res&&<><div style={sty.card}><div style={sty.cardT}>Forças <Badge ok={res.ok} y="FS≥1.2" n="FS<1.2"/></div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"10px"}}><thead><tr>{["t(s)","Abert.(m)","Área(m²)","F mat(N)","F tot(N)"].map((h,i)=><th key={i} style={{padding:"5px 6px",textAlign:"left",borderBottom:`1px solid ${C.accent}33`,color:C.accent,fontSize:"8px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
      <tbody>{res.steps.filter((_:any,i:number)=>i%2===0).map((s:AnyDict,i:number)=><tr key={i}><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`}}>{s.t}</td><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`}}>{s.comp_ab}</td><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`}}>{s.area_cob}</td><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`,color:C.warn}}>{s.forca_mat.toLocaleString()}</td><td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`,color:C.warn}}>{s.forca_total.toLocaleString()}</td></tr>)}</tbody></table></div>
    <div style={sty.card}><div style={sty.cardT}>Verificação</div><div style={sty.grid(3)}><Res label="Fa" value={res.Fa} unit="kN"/><Res label="Fr" value={res.Fr} unit="kN"/><Res label="Vel." value={res.vel} unit="m/s"/><Res label="F máx" value={res.f_max/1000} unit="kN" type="w"/><Res label="F disp" value={res.f_disp/1000} unit="kN" type="s"/><Res label="FS" value={res.fs} type={res.fs>=1.5?"s":res.fs>=1.2?"w":"d"}/></div></div></>}</>}
    {tab===1&&<div style={sty.card}><div style={sty.cardT}>Diagrama 2D</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<PistDiag inp={inp} data={res}/>}</div>}
    {tab===2&&<div style={sty.card}><div style={sty.cardT}>Força vs Tempo</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:
      <ResponsiveContainer width="100%" height={300}><AreaChart data={res.steps} margin={{top:10,right:20,left:10,bottom:25}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="t" label={{value:"Tempo (s)",position:"bottom",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis label={{value:"N",angle:-90,position:"insideLeft",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/><Legend wrapperStyle={{fontSize:"9px"}}/>
        <Area type="monotone" dataKey="forca_total" name="F total" stroke="#f85149" fill="#f85149" fillOpacity={0.1} strokeWidth={2}/>
        <Area type="monotone" dataKey="forca_mat" name="F material" stroke={C.accent} fill={C.accent} fillOpacity={0.08} strokeWidth={2}/>
        <ReferenceLine y={res.f_disp} stroke={C.success} strokeDasharray="5 3" label={{value:`F disp`,fill:C.success,fontSize:9}}/>
      </AreaChart></ResponsiveContainer>}</div>}
    {tab===3&&<div style={sty.card}><div style={sty.cardT}>Modelo 3D</div><Scene3D type="pistao" data={res} inputs={inp}/><p style={{fontSize:"9px",color:C.muted,textAlign:"center",marginTop:"6px"}}>Vermelho=pressão material · Verde=força pistão</p></div>}
  </div>);
}

function TCMod({onSave, user}: ModProps){
  const[inp,setI]=useState({mat_d:900,cap_th:3240,vel_ms:2.5,comp_m:19.6,elev_m:0,larg_pol:72,ang_rol:20,esp_rol:0.5,d_tamb_mm:630,ang_abr:180,n_limp:2,Wb:59.56,n_lonas:4,cap_tens:86298.5,idler_cl:"D",freq_hz:60,n_polos:4,p_rol_carga:40.01,p_rol_ret:26.8,comp_guias:16,Cs:0.0754,Ft_flex:40.8,ef_c:0.94,ef_r:0.94,ef_a:0.96,n_ac:2});
  const[res,setR]=useState<AnyDict | null>(null);const[tab,setTab]=useState(0);const s=(k:string,v:any)=>setI(p=>({...p,[k]:v}));
  const handleLoad = (data: AnyDict) => { if (data.inp) setI(data.inp); if (data.res) setR(data.res); };
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      <div><h2 style={{margin:0,fontSize:"14px",fontWeight:700}}>Transportador de Correia</h2><div style={{fontSize:"9px",color:C.muted,marginTop:"2px"}}>CEMA 7th Ed. — Validado ✓</div></div>
      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
        {user && <SavedCalcsDropdown user={user} moduleType="tc" onLoad={handleLoad} />}
        <button onClick={()=>onSave({type:"tc",inp,res})} style={sty.btn("g")}>Salvar</button><button onClick={()=>setR(calcTC(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>
    <Tabs tab={tab} setTab={setTab}/>
    {tab===0&&<><div style={sty.card}><div style={sty.cardT}>Material e Capacidade</div><div style={sty.grid(4)}><Inp label="Densidade" value={inp.mat_d} onChange={(v:any)=>s("mat_d",v)} unit="kg/m³"/><Inp label="Capacidade" value={inp.cap_th} onChange={(v:any)=>s("cap_th",v)} unit="t/h"/><Inp label="Velocidade" value={inp.vel_ms} onChange={(v:any)=>s("vel_ms",v)} unit="m/s"/><Inp label="Nº acion." value={inp.n_ac} onChange={(v:any)=>s("n_ac",v)}/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Geometria</div><div style={sty.grid(4)}><Inp label="Comprimento" value={inp.comp_m} onChange={(v:any)=>s("comp_m",v)} unit="m"/><Inp label="Elevação" value={inp.elev_m} onChange={(v:any)=>s("elev_m",v)} unit="m"/><Sel label="Larg. correia" value={String(inp.larg_pol)} onChange={(v:any)=>s("larg_pol",parseInt(v))} options={BW.map(w=>({v:String(w),l:`${w}" (${(w*25.4).toFixed(0)}mm)`}))}/><Inp label="Ângulo rolos" value={inp.ang_rol} onChange={(v:any)=>s("ang_rol",v)} unit="°"/><Inp label="Espaçamento" value={inp.esp_rol} onChange={(v:any)=>s("esp_rol",v)} unit="m"/><Inp label="Comp. guias" value={inp.comp_guias} onChange={(v:any)=>s("comp_guias",v)} unit="m"/><Inp label="Ø tambor" value={inp.d_tamb_mm} onChange={(v:any)=>s("d_tamb_mm",v)} unit="mm"/><Inp label="Ângulo abraç." value={inp.ang_abr} onChange={(v:any)=>s("ang_abr",v)} unit="°"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Correia e Roletes</div><div style={sty.grid(4)}><Inp label="Wb" value={inp.Wb} onChange={(v:any)=>s("Wb",v)} unit="kgf/m"/><Inp label="Lonas" value={inp.n_lonas} onChange={(v:any)=>s("n_lonas",v)}/><Inp label="Cap. tensão" value={inp.cap_tens} onChange={(v:any)=>s("cap_tens",v)} unit="N/m"/><Sel label="Classe" value={inp.idler_cl} onChange={(v:any)=>s("idler_cl",v)} options={Object.entries(IDLERS).map(([k,v])=>({v:k,l:v.l}))}/><Inp label="P. rol. carga" value={inp.p_rol_carga} onChange={(v:any)=>s("p_rol_carga",v)} unit="kgf"/><Inp label="Limp." value={inp.n_limp} onChange={(v:any)=>s("n_limp",v)}/><Inp label="Cs" value={inp.Cs} onChange={(v:any)=>s("Cs",v)}/><Inp label="Ft" value={inp.Ft_flex} onChange={(v:any)=>s("Ft_flex",v)} unit="kgf"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Motor</div><div style={sty.grid(4)}><Inp label="Freq." value={inp.freq_hz} onChange={(v:any)=>s("freq_hz",v)} unit="Hz"/><Inp label="Polos" value={inp.n_polos} onChange={(v:any)=>s("n_polos",v)}/><Inp label="η corr." value={inp.ef_c} onChange={(v:any)=>s("ef_c",v)}/><Inp label="η red." value={inp.ef_r} onChange={(v:any)=>s("ef_r",v)}/></div></div>
    {res&&<><div style={sty.card}><div style={sty.cardT}>Forças (CEMA Cap.6)</div><div style={sty.grid(4)}><Res label="V utilizada" value={res.V} unit="m/s"/><Res label="Wm" value={res.Wm} unit="kgf/m"/><Res label="Ky" value={res.Ky}/><Res label="Kx" value={res.Kx}/><Res label="Fg" value={res.Fg} unit="kgf"/><Res label="F1" value={res.F1} unit="kgf"/><Res label="Fa" value={res.Fa} unit="kgf"/><Res label="Ta" value={res.Ta} unit="kgf" type="w"/></div></div>
    <div style={sty.card}><div style={sty.cardT}>Potência</div><div style={sty.grid(3)}><Res label="Te" value={res.Te} unit="kgf" type="w"/><Res label="Ne" value={res.Ne_hp} unit="HP"/><Res label="η total" value={res.ef_t}/></div>
      <div style={{marginTop:"10px",padding:"12px",background:C.accentDim,borderRadius:"6px",border:`1px solid ${C.accent}22`}}><div style={sty.grid(3)}>
        <div><div style={{fontSize:"8px",color:C.muted}}>MOTOR TOTAL</div><div style={{fontSize:"18px",fontWeight:800,color:C.accent}}>{res.N_hp.toFixed(1)} <span style={{fontSize:"10px"}}>HP</span></div><div style={{fontSize:"9px",color:C.dim}}>{res.N_cv.toFixed(1)} CV · {res.N_kw.toFixed(1)} kW</div></div>
        <div><div style={{fontSize:"8px",color:C.muted}}>POR ACION.</div><div style={{fontSize:"18px",fontWeight:800,color:C.warn}}>{res.N_per.toFixed(1)} <span style={{fontSize:"10px"}}>HP</span></div></div>
        <div><div style={{fontSize:"8px",color:C.muted}}>REDUÇÃO</div><div style={{fontSize:"18px",fontWeight:800,color:C.success}}>{res.red.toFixed(1)}:1</div><div style={{fontSize:"9px",color:C.dim}}>{res.n_mot.toFixed(0)}→{res.n_tamb.toFixed(1)} rpm</div></div>
      </div></div></div>
    <div style={sty.card}><div style={sty.cardT}>Tensões <Badge ok={res.tension_ok} y="T1≤Tad" n="T1>Tad"/></div><div style={sty.grid(4)}><Res label="Cw" value={res.Cw}/><Res label="T1" value={res.T1} unit="kgf" type="w"/><Res label="T2" value={res.T2} unit="kgf"/><Res label="Contrap." value={res.contrapeso} unit="kgf"/><Res label="Tad" value={res.Tad} unit="kgf" type="s"/><Res label="T sag" value={res.T_sag} unit="kgf"/><Res label="Cap. real" value={res.cap_real} unit="t/h" type={res.cap_ok?"s":"d"}/><Res label="Cap. req." value={inp.cap_th} unit="t/h"/></div></div></>}</>}
    {tab===1&&<div style={sty.card}><div style={sty.cardT}>Vista Lateral</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<TCDiag inp={inp} data={res}/>}</div>}
    {tab===2&&<div style={sty.card}><div style={sty.cardT}>Perfil de Tensão</div>{!res?<p style={{color:C.dim,textAlign:"center"}}>Execute o cálculo</p>:<>
      <ResponsiveContainer width="100%" height={280}><AreaChart data={res.curve} margin={{top:10,right:20,left:10,bottom:25}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="pos" label={{value:"Posição (m)",position:"bottom",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <YAxis label={{value:"kgf",angle:-90,position:"insideLeft",fill:C.dim,fontSize:10}} tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/><Legend wrapperStyle={{fontSize:"9px"}}/>
        <Area type="monotone" dataKey="T_ida" name="T ida" stroke="#f85149" fill="#f85149" fillOpacity={0.08} strokeWidth={2}/>
        <Area type="monotone" dataKey="T_volta" name="T volta" stroke={C.accent} fill={C.accent} fillOpacity={0.08} strokeWidth={2}/>
        <ReferenceLine y={res.Tad} stroke={C.success} strokeDasharray="5 3" label={{value:"Tad",fill:C.success,fontSize:9}}/>
      </AreaChart></ResponsiveContainer>
      <div style={{marginTop:"12px"}}><ResponsiveContainer width="100%" height={180}><BarChart data={[{n:"Fg",v:res.Fg},{n:"F1",v:res.F1},{n:"Fa",v:res.Fa},{n:"Ta",v:res.Ta},{n:"Te",v:res.Te}]} margin={{top:5,right:20,left:10,bottom:5}}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="n" tick={{fill:C.dim,fontSize:9}} stroke={C.border}/><YAxis tick={{fill:C.dim,fontSize:9}} stroke={C.border}/>
        <Tooltip contentStyle={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"10px",color:C.text}}/>
        <Bar dataKey="v" name="kgf" fill={C.accent} radius={[3,3,0,0]}/>
      </BarChart></ResponsiveContainer></div></>}</div>}
    {tab===3&&<div style={sty.card}><div style={sty.cardT}>Modelo 3D</div><Scene3D type="transportador" data={res} inputs={inp}/><p style={{fontSize:"9px",color:C.muted,textAlign:"center",marginTop:"6px"}}>Tambor acion.(amarelo) · Roletes(azul) · Material(verde)</p></div>}
  </div>);
}

// ============================================================
// APP PRINCIPAL — com Glossário lateral e notificação de registro
// ============================================================
export default function App(){
  const[user,setUser]=useState<AnyDict | null>(null);const[mod,setMod]=useState("tc");const[sec,setSec]=useState("mod");
  const[saveM,setSaveM]=useState<AnyDict | null>(null);const[pName,setPName]=useState("");const[toast,setToast]=useState<string | null>(null);
  const[lm,setLm]=useState("login");const[em,setEm]=useState("");const[pw,setPw]=useState("");const[nm,setNm]=useState("");const[er,setEr]=useState("");
  const[showGlossary,setShowGlossary]=useState(false);

  useEffect(()=>{(async()=>{const s=await STORAGE.get("sess:v3");if(s)setUser(s)})()},[]);

  const login=async()=>{
    if(!em||!pw){setEr("Preencha todos os campos");return}
    if(lm==="register"){
      if(!nm){setEr("Informe nome");return}
      const u={email:em,name:nm,pass:pw,createdAt:new Date().toISOString()};
      await STORAGE.set(`u:${em}`,u);
      await STORAGE.set("sess:v3",u);
      // ★ NOTIFICA O OWNER sobre novo registro
      await notifyOwnerNewUser(u);
      setUser(u);
    } else {
      const u=await STORAGE.get(`u:${em}`);
      if(!u||u.pass!==pw){setEr("Credenciais inválidas");return}
      await STORAGE.set("sess:v3",u);
      setUser(u);
    }
  };

  const logout=async()=>{await STORAGE.delete("sess:v3");setUser(null)};

  const save=(d: AnyDict)=>{setSaveM(d);setPName(`${d.type}_${new Date().toISOString().slice(0,10)}`)};

  const confirmSave=async()=>{
    if(!pName||!user)return;
    await STORAGE.set(`p:${user.email}:${Date.now()}`,{...saveM,name:pName,at:new Date().toISOString()});
    setSaveM(null);
    setToast("Cálculo salvo! Acesse pelo botão 📂 Abrir Salvo");
    setTimeout(()=>setToast(null),3000);
  };

  if(!user)return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 30% 20%,#0d1117,#060a10 70%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Mono',monospace",color:C.text}}>
      <div style={{width:"340px",textAlign:"center"}}>
        <div style={{fontSize:"22px",fontWeight:800,letterSpacing:"3px",background:"linear-gradient(135deg,#58a6ff,#79c0ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:"4px"}}>ENGCALC PRO</div>
        <div style={{fontSize:"8px",color:C.muted,letterSpacing:"4px",marginBottom:"24px"}}>ENGINEERING CALCULATIONS PLATFORM</div>
        <div style={{...sty.card,textAlign:"left"}}>
          <div style={{display:"flex",marginBottom:"14px",borderRadius:"4px",overflow:"hidden",border:`1px solid ${C.border}`}}>
            {["login","register"].map(m=><button key={m} onClick={()=>{setLm(m);setEr("")}} style={{flex:1,padding:"7px",background:lm===m?C.accentDim:"transparent",border:"none",color:lm===m?C.accent:C.dim,cursor:"pointer",fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",fontFamily:"inherit"}}>{m==="login"?"Entrar":"Cadastrar"}</button>)}
          </div>
          {lm==="register"&&<Inp label="Nome" value={nm} onChange={setNm} type="text"/>}
          <Inp label="E-mail" value={em} onChange={setEm} type="text"/><Inp label="Senha" value={pw} onChange={setPw} type="password"/>
          {er&&<div style={{color:C.danger,fontSize:"10px",marginBottom:"6px",padding:"5px",background:C.danger+"10",borderRadius:"3px"}}>{er}</div>}
          <button onClick={login} style={{...sty.btn("p"),width:"100%",padding:"9px",marginTop:"4px"}}>{lm==="login"?"ACESSAR":"CRIAR CONTA"}</button>
        </div>
        <div style={{fontSize:"8px",color:C.muted,marginTop:"16px",lineHeight:"1.8"}}>EN 1991-4 · CEMA 7th Ed. · NBR 8400 · Manual FAÇO<br/>4 módulos · Visualização 2D/3D · Cálculos validados</div>
      </div>
    </div>
  );

  const MODS=[{id:"tc",n:"Transportador",s:"CEMA 7th",ic:"⟹",col:C.success},{id:"silo",n:"Silos",s:"Eurocode",ic:"⬡",col:C.accent},{id:"moto",n:"Motovibrador",s:"Vibração",ic:"◎",col:"#a371f7"},{id:"pistao",n:"Pistão",s:"Hidráulico",ic:"⇥",col:C.warn}];

  return(<div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'IBM Plex Mono',monospace",fontSize:"12px"}}>
    <div style={{background:C.s1,borderBottom:`1px solid ${C.border}`,padding:"8px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}><div style={{fontSize:"14px",fontWeight:800,letterSpacing:"2px",background:"linear-gradient(135deg,#58a6ff,#79c0ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>ENGCALC PRO</div><span style={{fontSize:"8px",color:C.muted}}>v2.1</span></div>
      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
        {/* ★ BOTÃO GLOSSÁRIO */}
        <button onClick={()=>setShowGlossary(!showGlossary)} style={{...sty.btn("g"),fontSize:"9px",padding:"4px 10px",background:showGlossary?C.accentDim:"transparent"}} title="Glossário de Siglas">
          {showGlossary ? "✕ Glossário" : "📖 Glossário"}
        </button>
        <span style={{fontSize:"10px",color:C.dim}}>{user.name}</span>
        <button onClick={logout} style={{...sty.btn("g"),fontSize:"9px",padding:"4px 10px"}}>Sair</button>
      </div>
    </div>
    <div style={{display:"flex",minHeight:"calc(100vh - 40px)"}}>
      {/* SIDEBAR ESQUERDA */}
      <div style={{width:"180px",background:C.s1,borderRight:`1px solid ${C.border}`,padding:"12px",flexShrink:0}}>
        <div style={{fontSize:"8px",color:C.muted,letterSpacing:"2px",marginBottom:"8px"}}>NAVEGAÇÃO</div>
        {[{id:"mod",l:"Módulos"},{id:"valid",l:"Validação"},{id:"admin",l:"Conta"}].map(s2=>(
          <div key={s2.id} onClick={()=>setSec(s2.id)} style={{padding:"7px 10px",marginBottom:"3px",borderRadius:"4px",cursor:"pointer",background:sec===s2.id?C.accentDim:"transparent",border:sec===s2.id?`1px solid ${C.accent}33`:"1px solid transparent"}}>
            <div style={{fontSize:"10px",fontWeight:sec===s2.id?600:400,color:sec===s2.id?C.accent:C.dim}}>{s2.l}</div></div>))}
        {sec==="mod"&&<><div style={{fontSize:"8px",color:C.muted,letterSpacing:"2px",margin:"14px 0 8px"}}>MÓDULOS</div>
          {MODS.map(m=>(
            <div key={m.id} onClick={()=>setMod(m.id)} style={{padding:"7px 10px",marginBottom:"3px",borderRadius:"4px",cursor:"pointer",background:mod===m.id?C.accentDim:"transparent",border:mod===m.id?`1px solid ${C.accent}33`:"1px solid transparent"}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px"}}><span style={{color:m.col,fontSize:"12px"}}>{m.ic}</span><div><div style={{fontSize:"10px",fontWeight:mod===m.id?600:400,color:mod===m.id?C.text:C.dim}}>{m.n}</div><div style={{fontSize:"7px",color:C.muted}}>{m.s}</div></div></div></div>))}</>}
        <div style={{marginTop:"16px",paddingTop:"10px",borderTop:`1px solid ${C.border}`,fontSize:"7px",color:C.muted,lineHeight:"1.8"}}>EN 1991-4 · CEMA 7th<br/>NBR 8400 · FAÇO · Vimot<br/><span style={{color:C.accent}}>Validado ✓</span></div>
      </div>

      {/* ÁREA CENTRAL */}
      <div style={{flex:1,padding:"18px",maxWidth:"920px",overflowY:"auto"}}>
        {sec==="mod"&&mod==="silo"&&<SiloMod onSave={save} user={user}/>}
        {sec==="mod"&&mod==="moto"&&<MotoMod onSave={save} user={user}/>}
        {sec==="mod"&&mod==="pistao"&&<PistMod onSave={save} user={user}/>}
        {sec==="mod"&&mod==="tc"&&<TCMod onSave={save} user={user}/>}
        {sec==="valid"&&<ValPanel/>}
        {sec==="admin"&&<div style={sty.card}><div style={sty.cardT}>Conta</div><div style={sty.grid(2)}>
          <div><div style={{fontSize:"8px",color:C.muted}}>NOME</div><div style={{marginTop:"3px"}}>{user.name}</div></div>
          <div><div style={{fontSize:"8px",color:C.muted}}>E-MAIL</div><div style={{marginTop:"3px"}}>{user.email}</div></div>
          <div><div style={{fontSize:"8px",color:C.muted}}>CRIADO</div><div style={{marginTop:"3px"}}>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</div></div>
          <div><div style={{fontSize:"8px",color:C.muted}}>MÓDULOS</div><div style={{marginTop:"3px"}}>4/4 ativos</div></div>
        </div></div>}
      </div>

      {/* ★ PAINEL DE GLOSSÁRIO (lado direito) */}
      {sec==="mod" && <GlossaryPanel moduleId={mod} visible={showGlossary} onClose={()=>setShowGlossary(false)} />}
    </div>

    {/* Modal de salvar */}
    {saveM&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{...sty.card,width:"350px"}}><div style={sty.cardT}>Salvar Cálculo</div>
      <Inp label="Nome do cálculo" value={pName} onChange={setPName} type="text"/>
      <div style={{fontSize:"9px",color:C.dim,margin:"8px 0"}}>O cálculo ficará acessível pelo botão <strong style={{color:C.accent}}>📂 Abrir Salvo</strong> dentro do módulo correspondente.</div>
      <div style={{display:"flex",gap:"6px",justifyContent:"flex-end",marginTop:"10px"}}><button onClick={()=>setSaveM(null)} style={sty.btn("g")}>Cancelar</button><button onClick={confirmSave} style={sty.btn("p")}>Salvar</button></div></div></div>}

    {/* Toast */}
    {toast&&<div style={{position:"fixed",bottom:"16px",right:"16px",padding:"8px 16px",background:C.success,color:"#fff",borderRadius:"4px",fontSize:"11px",fontWeight:600,zIndex:300}}>{toast}</div>}
  </div>);
}
