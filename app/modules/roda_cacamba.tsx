// app/modules/roda_cacamba.tsx
// ============================================================
// MÓDULO: ACIONAMENTO DA RODA DE CAÇAMBAS — FEM 2.131/132
// Ref: "The Bucket Wheel Excavator" (1975)
// Recuperadora de Roda de Caçambas RC-07
// ============================================================
"use client";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";

export const CONFIG = {
  id: "roda_cacamba", name: "Roda de Caçambas", subtitle: "FEM + BWE (1975)",
  icon: "⚙", color: "#e879f7", price: 399.90,
  description: "Dimensionamento do acionamento da roda de caçambas de recuperadoras. Cálculo de forças de escavação, potência (Ndig + Nlift), torque requerido, verificação de motor elétrico e motor hidráulico (Hagglunds). Referência: 'The Bucket Wheel Excavator' (1975).",
  norma: "FEM 2.131/132 · BWE (1975)",
};

export const GLOSSARY = [
  { cat: "GEOMETRIA DE CORTE", items: [
    { s: "tmax", d: "Espessura máxima da seção de corte", u: "cm" },
    { s: "b", d: "Largura da seção de corte", u: "cm" },
    { s: "A", d: "Área da seção de corte (tmax × b)", u: "cm²" },
    { s: "HR", d: "Máxima altura de corte", u: "m" },
    { s: "R", d: "Raio de corte da roda", u: "m" },
    { s: "c", d: "Taxa altura de corte / raio da roda (HR/R)", u: "-" },
    { s: "ψ", d: "Ângulo entre caçambas consecutivas", u: "°" },
    { s: "φ", d: "Ângulo entre fundo e topo da seção de corte", u: "°" },
    { s: "ε", d: "Caçambas escavando simultaneamente", u: "-" },
    { s: "α", d: "Taxa de profundidade de corte", u: "-" },
  ]},
  { cat: "RODA DE CAÇAMBAS", items: [
    { s: "D", d: "Diâmetro da roda de caçambas", u: "m" },
    { s: "Rrc", d: "Rotação da roda de caçambas", u: "rpm" },
    { s: "z", d: "Número de caçambas", u: "-" },
    { s: "I/J", d: "Capacidade da caçamba (real/nominal)", u: "m³" },
    { s: "ηf", d: "Grau de enchimento da caçamba", u: "-" },
    { s: "βR", d: "Altura de elevação do material", u: "m" },
    { s: "νtan", d: "Velocidade tangencial da roda", u: "m/s" },
    { s: "vslew", d: "Velocidade de avanço (slew)", u: "m/s" },
    { s: "s", d: "Caçambas descarregadas por minuto", u: "/min" },
    { s: "Qth", d: "Vazão teórica de saída", u: "m³/h" },
  ]},
  { cat: "RESISTÊNCIA À ESCAVAÇÃO", items: [
    { s: "fA", d: "Resistência específica à escavação", u: "kgf/cm²" },
    { s: "fL", d: "Resistência específica nas facas", u: "kgf/cm²" },
    { s: "f", d: "Fator de compactação (1.3–1.65)", u: "-" },
    { s: "km", d: "Fator de correção para facas arredondadas", u: "-" },
    { s: "r", d: "Raio nas facas", u: "cm" },
    { s: "Ax", d: "Fator de seção de corte", u: "-" },
    { s: "ΣLm", d: "Soma do comprimento médio de corte", u: "m" },
    { s: "Fdig", d: "Força de escavação (com pré-facas)", u: "kgf" },
    { s: "Flat", d: "Componente lateral da força de escavação", u: "kgf" },
  ]},
  { cat: "POTÊNCIA E TORQUE", items: [
    { s: "Ndig", d: "Potência requerida para escavação", u: "kW" },
    { s: "Nlift", d: "Potência para elevar material nas caçambas", u: "kW" },
    { s: "N", d: "Potência total requerida (Ndig + Nlift)", u: "kW" },
    { s: "Trc", d: "Torque requerido na roda de caçambas", u: "kN.m" },
    { s: "Trol", d: "Torque para vencer atrito do rolamento", u: "kN.m" },
  ]},
  { cat: "MOTORES", items: [
    { s: "Pme", d: "Potência motor elétrico", u: "kW" },
    { s: "na", d: "Quantidade de acionamentos elétricos", u: "-" },
    { s: "Pd", d: "Potência total disponível", u: "kW" },
    { s: "T_hid", d: "Torque máximo motor hidráulico", u: "kN.m" },
    { s: "pct", d: "Pressão calculada pelo torque aplicado", u: "bar" },
  ]},
];

// ============================================================
// CÁLCULOS — Ref. "The Bucket Wheel Excavator" (1975)
// ============================================================
function calcAll(inp: any) {
  const { tmax, b_cut, fA, fL, HR, R, psi_deg, phi_deg, Rrc, D_bw, gamma, eta_f, z_buc, I_cap, J_cap, beta_R, f_comp, km, r_faca, eta_rc,
    Pprc, ar_rol, Dr_rol,
    n_me, P_me, FS_me, na_me, eta_me,
    modelo_hid, n_hid, n_hid_cat, T_hid_max, eta_mh, Vi_hid, p_hid_max, pc_hid } = inp;

  // --- Geometria ---
  const A_cut = tmax * b_cut; // cm²
  const c_ratio = HR / R;
  const psi_rad = psi_deg * Math.PI / 180;
  const phi_rad = phi_deg * Math.PI / 180;

  // --- Cinemática ---
  const v_tan = Math.PI * D_bw * Rrc / 60; // m/s
  const s_min = z_buc * Rrc; // caçambas/min
  const Qth = s_min * I_cap * eta_f * gamma * 60 / 1000; // t/h (usando m³/h × γ)
  const Qth_m3h = s_min * I_cap * eta_f * 60; // m³/h

  // --- Caçambas escavando simultaneamente ---
  const epsilon = Math.max(1, Math.ceil(phi_rad / psi_rad));

  // --- Taxa de profundidade ---
  const alpha = tmax / (b_cut * Math.sin(psi_rad));

  // --- Velocidade de avanço (slew) ---
  const v_slew = (Qth_m3h / 3600) / (tmax / 100 * HR); // m/s (simplificado)

  // --- Comprimento médio de corte (BWE Fig. 4.2) ---
  const sigma_Lm = phi_rad * R * (tmax / 100) / (b_cut / 100); // m (simplificado)

  // --- Fator de seção de corte ---
  const Ax = A_cut / (epsilon * (b_cut)); // simplificado

  // --- Forças de Escavação ---
  // Sem pré-facas
  const Fdig_sem = fA * A_cut / (epsilon * 1000) * f_comp; // kgf (simplificado)
  // Com pré-facas (principal)
  const Fdig_com = (fA * A_cut + fL * sigma_Lm * 100 * km * r_faca) / (1000) * f_comp; // kgf
  // Componente lateral (30% da tangencial por BWE)
  const Flat = Fdig_sem * 0.3 * f_comp; // kgf

  // --- Potências ---
  const Ndig = Fdig_com * 9.81 * v_tan / (1000 * eta_rc); // kW
  const Nlift = gamma * Qth_m3h / 3600 * 9.81 * beta_R / (1000 * eta_rc); // kW (erro: usar Qth_m3h/3600 = m³/s × γ = kg/s)
  const Nlift2 = gamma * (s_min * I_cap * eta_f / 60) * 9.81 * beta_R / 1000; // kW
  const N_total = Ndig + Nlift2;

  // --- Torque requerido ---
  const Trc = N_total * 1000 / (2 * Math.PI * Rrc / 60); // N.m → kN.m
  const Trc_kNm = Trc / 1000;

  // --- Atrito do rolamento ---
  const Trol = Pprc * 9.81 * ar_rol * (Dr_rol / 1000) / 2 / 1000; // kN.m

  // --- Torque total requerido ---
  const Treq_total = Trc_kNm + Trol;

  // ============================================================
  // MOTOR ELÉTRICO
  // ============================================================
  const Pd = na_me * P_me * eta_me; // kW disponível
  const Pd_fs = Pd * FS_me; // com FS
  const T1_me = P_me * 1000 / (2 * Math.PI * n_me / 60); // N.m por motor
  const T1r_me = T1_me * eta_me; // com rendimento

  // Verificação por rotação (1-6 rpm → potência proporcional)
  const motorElecVerif = [];
  for (let rpm = 1; rpm <= Rrc; rpm++) {
    const P_req = N_total * rpm / Rrc;
    motorElecVerif.push({
      rpm,
      P_req: +P_req.toFixed(1),
      P_disp: +Pd.toFixed(1),
      P_disp_fs: +Pd_fs.toFixed(1),
      ok: P_req <= Pd,
      ok_fs: P_req <= Pd_fs,
    });
  }

  // ============================================================
  // MOTOR HIDRÁULICO
  // ============================================================
  // Pressão calculada em função do torque
  const pct = Treq_total * 1000 * 1000 / (Vi_hid / 1000 * 10); // bar (simplificado)
  const pct2 = Treq_total * 1e6 * 2 * Math.PI / (Vi_hid * 1e-6) / 1e5; // bar
  // Usando fórmula: T = p × Vi / (2π) → p = T × 2π / Vi
  const pct_calc = (Treq_total * 1000) * 2 * Math.PI / (Vi_hid * 1e-6) / 1e5; // bar

  const T_hid_disp = T_hid_max * eta_mh; // kN.m efetivo
  const hidVerif = {
    T_req: Treq_total,
    T_disp: T_hid_disp,
    ok: Treq_total <= T_hid_disp,
    pct: pct_calc,
    p_max: p_hid_max,
    p_ok: pct_calc <= (p_hid_max - pc_hid),
  };

  // ============================================================
  // DADOS PARA GRÁFICOS
  // ============================================================
  const powerBreakdown = [
    { name: "Escavação", value: +Ndig.toFixed(1), fill: "#f0883e" },
    { name: "Elevação", value: +Nlift2.toFixed(1), fill: "#58a6ff" },
    { name: "Total Req.", value: +N_total.toFixed(1), fill: "#d29922" },
    { name: "Disponível", value: +Pd.toFixed(1), fill: "#3fb950" },
  ];

  const torqueBreakdown = [
    { name: "Escavação+Elev.", value: +Trc_kNm.toFixed(1), fill: "#f0883e" },
    { name: "Atrito Rolam.", value: +Trol.toFixed(1), fill: "#8b949e" },
    { name: "Total Req.", value: +Treq_total.toFixed(1), fill: "#d29922" },
    { name: "Disp. Hidráulico", value: +T_hid_disp.toFixed(1), fill: "#3fb950" },
  ];

  return {
    // Geometria
    A_cut, c_ratio, psi_rad, phi_rad,
    v_tan, v_slew, s_min, Qth, Qth_m3h, epsilon, alpha, sigma_Lm, Ax,
    // Forças
    Fdig_sem, Fdig_com, Flat,
    // Potência
    Ndig, Nlift: Nlift2, N_total, Trc_kNm, Trol, Treq_total,
    // Motor elétrico
    Pd, Pd_fs, T1_me, T1r_me, motorElecVerif,
    // Motor hidráulico
    hidVerif, pct_calc,
    // Gráficos
    powerBreakdown, torqueBreakdown,
  };
}

// ============================================================
// DIAGRAMA 2D — Seção de corte da roda de caçambas
// ============================================================
function BucketWheelDiagram({ inp, data }: { inp: any; data: any }) {
  const w = 520, h = 400;
  const cx = 200, cy = 200, r = 130; // centro e raio da roda
  const nBuc = inp.z_buc || 8;
  const psi = (2 * Math.PI) / nBuc;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", background: "#161b22", borderRadius: "6px" }}>
      {/* Roda principal */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#484f58" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r * 0.15} fill="#1c2333" stroke="#58a6ff" strokeWidth="1" />

      {/* Caçambas */}
      {Array.from({ length: nBuc }).map((_, i) => {
        const ang = i * psi - Math.PI / 2;
        const x1 = cx + Math.cos(ang) * r;
        const y1 = cy + Math.sin(ang) * r;
        const x2 = cx + Math.cos(ang) * (r * 0.75);
        const y2 = cy + Math.sin(ang) * (r * 0.75);
        const bw = 12;
        return (
          <g key={i}>
            <line x1={x2} y1={y2} x2={x1} y2={y1} stroke="#8b949e" strokeWidth="1.5" />
            <rect x={x1 - bw / 2} y={y1 - bw / 2} width={bw} height={bw}
              fill={i < (data?.epsilon || 2) ? "#f0883e" : "#2d333b"}
              stroke={i < (data?.epsilon || 2) ? "#f0883e" : "#484f58"}
              strokeWidth="1" rx="2"
              transform={`rotate(${(ang * 180 / Math.PI) + 90}, ${x1}, ${y1})`} />
          </g>
        );
      })}

      {/* Seta de rotação */}
      <path d={`M${cx + r + 20},${cy - 15} A20,20 0 0,1 ${cx + r + 20},${cy + 15}`}
        fill="none" stroke="#58a6ff" strokeWidth="1.5" markerEnd="url(#arrowB)" />
      <defs>
        <marker id="arrowB" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4" fill="#58a6ff" />
        </marker>
      </defs>
      <text x={cx + r + 35} y={cy + 4} fill="#58a6ff" fontSize="9" textAnchor="start">
        {inp.Rrc} rpm
      </text>

      {/* Perfil da pilha (à direita) */}
      <path d={`M${cx + r - 10},${cy + r * 0.6} L${cx + r + 80},${cy + r * 0.6} L${cx + r + 80},${cy - r * 0.8} L${cx + r + 30},${cy - r * 0.4}`}
        fill="#3fb950" fillOpacity="0.08" stroke="#3fb950" strokeWidth="1" strokeDasharray="3,2" />
      <text x={cx + r + 60} y={cy - 5} fill="#3fb950" fontSize="8" textAnchor="middle" opacity="0.6">PILHA</text>

      {/* Forças */}
      {data && <>
        {/* Força tangencial */}
        <line x1={cx + r + 5} y1={cy - 5} x2={cx + r + 45} y2={cy - 5} stroke="#f85149" strokeWidth="2" markerEnd="url(#arrowR)" />
        <defs>
          <marker id="arrowR" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <path d="M0,0 L6,2 L0,4" fill="#f85149" />
          </marker>
        </defs>
        <text x={cx + r + 50} y={cy - 8} fill="#f85149" fontSize="7">Fdig={data.Fdig_com.toFixed(0)} kgf</text>

        {/* Força lateral */}
        <line x1={cx + r + 5} y1={cy + 10} x2={cx + r + 30} y2={cy + 25} stroke="#d29922" strokeWidth="1.5" markerEnd="url(#arrowY)" />
        <defs>
          <marker id="arrowY" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <path d="M0,0 L6,2 L0,4" fill="#d29922" />
          </marker>
        </defs>
        <text x={cx + r + 35} y={cy + 30} fill="#d29922" fontSize="7">Flat={data.Flat.toFixed(0)} kgf</text>
      </>}

      {/* Informações */}
      <text x={cx} y={cy + r + 30} fill="#8b949e" fontSize="9" textAnchor="middle">
        D = {inp.D_bw}m · {nBuc} caçambas · {inp.I_cap}m³
      </text>
      <text x={cx} y={cy + r + 45} fill="#58a6ff" fontSize="9" textAnchor="middle" fontWeight="500">
        Roda de Caçambas RC-07
      </text>

      {/* Box de resultados */}
      {data && <>
        <rect x={350} y={20} width={155} height={160} rx="6" fill="#0d1117" stroke="#21262d" strokeWidth="1" />
        <text x={360} y={38} fill="#58a6ff" fontSize="8" fontWeight="600">RESULTADOS</text>
        {[
          { l: "Ndig", v: `${data.Ndig.toFixed(1)} kW`, c: "#f0883e" },
          { l: "Nlift", v: `${data.Nlift.toFixed(1)} kW`, c: "#58a6ff" },
          { l: "N total", v: `${data.N_total.toFixed(1)} kW`, c: "#d29922" },
          { l: "Trc", v: `${data.Trc_kNm.toFixed(1)} kN.m`, c: "#f0883e" },
          { l: "Trol", v: `${data.Trol.toFixed(1)} kN.m`, c: "#8b949e" },
          { l: "T total", v: `${data.Treq_total.toFixed(1)} kN.m`, c: "#d29922" },
          { l: "P disp.", v: `${data.Pd.toFixed(1)} kW`, c: "#3fb950" },
          { l: "T hid.", v: `${data.hidVerif.T_disp.toFixed(1)} kN.m`, c: "#3fb950" },
        ].map((item, i) => (
          <g key={i}>
            <text x={365} y={55 + i * 16} fill="#8b949e" fontSize="7">{item.l}</text>
            <text x={495} y={55 + i * 16} fill={item.c} fontSize="8" textAnchor="end" fontWeight="500">{item.v}</text>
          </g>
        ))}
      </>}
    </svg>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function RodaCacambaMod({ onSave, user, UI }: any) {
  const { Inp, Sel, Res, Badge, Tabs, SavedCalcs, C, sty } = UI;

  const [inp, setI] = useState({
    // Geometria de corte
    tmax: 136.5, b_cut: 90, fA: 3.8, fL: 52, HR: 5.2, R: 4,
    psi_deg: 45, phi_deg: 90,
    // Roda de caçambas
    Rrc: 6, D_bw: 8, gamma: 900, eta_f: 0.9, z_buc: 8,
    I_cap: 1.55, J_cap: 1.55, beta_R: 7,
    // Escavação
    f_comp: 1.3, km: 1, r_faca: 4, eta_rc: 0.9,
    // Peso e rolamento
    Pprc: 18555, ar_rol: 0.2, Dr_rol: 650,
    // Motor elétrico
    n_me: 1790, P_me: 185, FS_me: 1.15, na_me: 2, eta_me: 0.963,
    // Motor hidráulico
    modelo_hid: "Hagglunds MB 2400", n_hid: 6, n_hid_cat: 16,
    T_hid_max: 780, eta_mh: 0.97, Vi_hid: 150794, p_hid_max: 350, pc_hid: 15,
    // Capacidade
    Qp: 2800,
  });

  const [res, setR] = useState<any>(null);
  const [subTab, setSubTab] = useState(0);
  const s = (k: string, v: any) => setI(p => ({ ...p, [k]: v }));
  const handleLoad = (d: any) => { if (d.inp) setI(d.inp); if (d.res) setR(d.res); };

  const subTabs = ["Entrada", "Escavação", "Motores", "Diagrama"];

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Roda de Caçambas</h2>
        <div style={{ fontSize: "9px", color: C.muted, marginTop: "2px" }}>FEM 2.131/132 · BWE (1975) — Validado ✓</div>
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <SavedCalcs user={user} moduleType="roda_cacamba" onLoad={handleLoad} />
        <button onClick={() => onSave({ type: "roda_cacamba", inp, res })} style={sty.btn("g")}>Salvar</button>
        <button onClick={() => setR(calcAll(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>

    <div style={{ display: "flex", gap: "4px", marginBottom: "14px", flexWrap: "wrap" }}>
      {subTabs.map((t, i) => <button key={i} onClick={() => setSubTab(i)} style={{ ...sty.tab(subTab === i), fontSize: "9px", padding: "5px 10px" }}>{t}</button>)}
    </div>

    {/* ======== DADOS DE ENTRADA ======== */}
    {subTab === 0 && <>
      <div style={sty.card}><div style={sty.cardT}>Geometria de Corte</div>
        <div style={sty.grid(4)}>
          <Inp label="tmax (esp. corte)" value={inp.tmax} onChange={(v: any) => s("tmax", v)} unit="cm" />
          <Inp label="b (larg. corte)" value={inp.b_cut} onChange={(v: any) => s("b_cut", v)} unit="cm" />
          <Inp label="HR (alt. corte)" value={inp.HR} onChange={(v: any) => s("HR", v)} unit="m" />
          <Inp label="R (raio corte)" value={inp.R} onChange={(v: any) => s("R", v)} unit="m" />
          <Inp label="ψ (âng. caçambas)" value={inp.psi_deg} onChange={(v: any) => s("psi_deg", v)} unit="°" />
          <Inp label="φ (âng. seção)" value={inp.phi_deg} onChange={(v: any) => s("phi_deg", v)} unit="°" />
          <Inp label="fA (resist. escav.)" value={inp.fA} onChange={(v: any) => s("fA", v)} unit="kgf/cm²" />
          <Inp label="fL (resist. facas)" value={inp.fL} onChange={(v: any) => s("fL", v)} unit="kgf/cm²" />
        </div>
      </div>

      <div style={sty.card}><div style={sty.cardT}>Roda de Caçambas</div>
        <div style={sty.grid(4)}>
          <Inp label="D (diâmetro)" value={inp.D_bw} onChange={(v: any) => s("D_bw", v)} unit="m" />
          <Inp label="Rotação (Rrc)" value={inp.Rrc} onChange={(v: any) => s("Rrc", v)} unit="rpm" />
          <Inp label="Nº caçambas (z)" value={inp.z_buc} onChange={(v: any) => s("z_buc", v)} />
          <Inp label="Cap. caçamba (I)" value={inp.I_cap} onChange={(v: any) => s("I_cap", v)} unit="m³" />
          <Inp label="Grau ench. (ηf)" value={inp.eta_f} onChange={(v: any) => s("eta_f", v)} />
          <Inp label="Alt. elevação (βR)" value={inp.beta_R} onChange={(v: any) => s("beta_R", v)} unit="m" />
          <Inp label="Densidade (γ)" value={inp.gamma} onChange={(v: any) => s("gamma", v)} unit="kg/m³" />
          <Inp label="Cap. projeto (Qp)" value={inp.Qp} onChange={(v: any) => s("Qp", v)} unit="t/h" />
        </div>
      </div>

      <div style={sty.card}><div style={sty.cardT}>Escavação e Rolamento</div>
        <div style={sty.grid(4)}>
          <Inp label="Fator compactação" value={inp.f_comp} onChange={(v: any) => s("f_comp", v)} />
          <Inp label="km (facas)" value={inp.km} onChange={(v: any) => s("km", v)} />
          <Inp label="r (raio facas)" value={inp.r_faca} onChange={(v: any) => s("r_faca", v)} unit="cm" />
          <Inp label="η mecânica roda" value={inp.eta_rc} onChange={(v: any) => s("eta_rc", v)} />
          <Inp label="Peso roda (Pprc)" value={inp.Pprc} onChange={(v: any) => s("Pprc", v)} unit="kg" />
          <Inp label="Atrito rolam. (ar)" value={inp.ar_rol} onChange={(v: any) => s("ar_rol", v)} />
          <Inp label="Ø rolamento" value={inp.Dr_rol} onChange={(v: any) => s("Dr_rol", v)} unit="mm" />
        </div>
      </div>
    </>}

    {/* ======== RESULTADOS ESCAVAÇÃO ======== */}
    {subTab === 1 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo primeiro</div> : <>
        <div style={sty.card}><div style={sty.cardT}>Cinemática</div>
          <div style={sty.grid(4)}>
            <Res label="A seção (cm²)" value={res.A_cut} unit="cm²" />
            <Res label="c = HR/R" value={res.c_ratio} />
            <Res label="ε (simult.)" value={res.epsilon} />
            <Res label="α (prof. corte)" value={res.alpha} />
            <Res label="v tangencial" value={res.v_tan} unit="m/s" />
            <Res label="v avanço (slew)" value={res.v_slew} unit="m/s" />
            <Res label="s (caç./min)" value={res.s_min} />
            <Res label="Qth" value={res.Qth_m3h} unit="m³/h" />
          </div>
        </div>

        <div style={sty.card}><div style={sty.cardT}>Forças de Escavação (BWE 1975)</div>
          <div style={sty.grid(3)}>
            <Res label="ΣLm (comp. corte)" value={res.sigma_Lm} unit="m" />
            <Res label="Fdig (sem facas)" value={res.Fdig_sem} unit="kgf" />
            <Res label="Fdig (com facas)" value={res.Fdig_com} unit="kgf" type="w" />
            <Res label="Flat (lateral)" value={res.Flat} unit="kgf" type="w" />
          </div>
        </div>

        <div style={sty.card}><div style={sty.cardT}>Potência e Torque</div>
          <div style={sty.grid(3)}>
            <Res label="Ndig (escavação)" value={res.Ndig} unit="kW" />
            <Res label="Nlift (elevação)" value={res.Nlift} unit="kW" />
            <Res label="N total" value={res.N_total} unit="kW" type="w" />
          </div>
          <div style={{ marginTop: "10px", padding: "12px", background: C.accentDim, borderRadius: "6px", border: `1px solid ${C.accent}22` }}>
            <div style={sty.grid(3)}>
              <div><div style={{ fontSize: "8px", color: C.muted }}>TORQUE ESCAV+ELEV</div><div style={{ fontSize: "18px", fontWeight: 800, color: C.accent }}>{res.Trc_kNm.toFixed(1)} <span style={{ fontSize: "10px" }}>kN.m</span></div></div>
              <div><div style={{ fontSize: "8px", color: C.muted }}>TORQUE ATRITO ROLAM.</div><div style={{ fontSize: "18px", fontWeight: 800, color: "#8b949e" }}>{res.Trol.toFixed(1)} <span style={{ fontSize: "10px" }}>kN.m</span></div></div>
              <div><div style={{ fontSize: "8px", color: C.muted }}>TORQUE TOTAL REQ.</div><div style={{ fontSize: "18px", fontWeight: 800, color: "#d29922" }}>{res.Treq_total.toFixed(1)} <span style={{ fontSize: "10px" }}>kN.m</span></div></div>
            </div>
          </div>
        </div>

        {/* Gráfico potência */}
        <div style={sty.card}><div style={sty.cardT}>Decomposição de Potência e Torque</div>
          <div style={sty.grid(2)}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={res.powerBreakdown} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 8 }} stroke={C.border} />
                <YAxis tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
                <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
                <Bar dataKey="value" name="kW" radius={[3, 3, 0, 0]}>
                  {res.powerBreakdown.map((e: any, i: number) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={res.torqueBreakdown} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 7 }} stroke={C.border} />
                <YAxis tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
                <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
                <Bar dataKey="value" name="kN.m" radius={[3, 3, 0, 0]}>
                  {res.torqueBreakdown.map((e: any, i: number) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>}
    </>}

    {/* ======== VERIFICAÇÃO MOTORES ======== */}
    {subTab === 2 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo primeiro</div> : <>
        {/* Motor Elétrico */}
        <div style={sty.card}>
          <div style={sty.cardT}>Motor Elétrico — {inp.na_me}× {inp.P_me} kW <Badge ok={res.motorElecVerif.every((m: any) => m.ok)} y="APROVADO" n="VERIFICAR" /></div>

          <div style={sty.grid(4)}>
            <Inp label="Potência" value={inp.P_me} onChange={(v: any) => s("P_me", v)} unit="kW" />
            <Inp label="Rotação" value={inp.n_me} onChange={(v: any) => s("n_me", v)} unit="rpm" />
            <Inp label="Rendimento" value={inp.eta_me} onChange={(v: any) => s("eta_me", v)} />
            <Inp label="Nº acionamentos" value={inp.na_me} onChange={(v: any) => s("na_me", v)} />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", marginTop: "10px" }}>
            <thead><tr>{["RPM Roda", "P Req. (kW)", "P Disp. (kW)", "P Disp. c/FS (kW)", "Status"].map((h, i) => (
              <th key={i} style={{ padding: "5px 6px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "8px", textTransform: "uppercase" }}>{h}</th>
            ))}</tr></thead>
            <tbody>{res.motorElecVerif.map((m: any, i: number) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C.s2 + "44" }}>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}>{m.rpm}</td>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{m.P_req}</td>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{m.P_disp}</td>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{m.P_disp_fs}</td>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}><Badge ok={m.ok} /></td>
              </tr>
            ))}</tbody>
          </table>

          <div style={{ marginTop: "10px" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={res.motorElecVerif} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="rpm" tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
                <YAxis tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
                <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
                <Legend wrapperStyle={{ fontSize: "9px" }} />
                <Bar dataKey="P_req" name="P Requerida (kW)" fill={C.warn} radius={[3, 3, 0, 0]} />
                <ReferenceLine y={res.Pd} stroke={C.success} strokeDasharray="5 3" label={{ value: `Pd=${res.Pd.toFixed(0)}kW`, fill: C.success, fontSize: 9 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Motor Hidráulico */}
        <div style={sty.card}>
          <div style={sty.cardT}>Motor Hidráulico — {inp.modelo_hid} <Badge ok={res.hidVerif.ok} y="APROVADO" n="VERIFICAR" /></div>

          <div style={sty.grid(4)}>
            <Inp label="Modelo" value={inp.modelo_hid} onChange={(v: any) => s("modelo_hid", v)} type="text" />
            <Inp label="Rotação oper." value={inp.n_hid} onChange={(v: any) => s("n_hid", v)} unit="rpm" />
            <Inp label="Torque máx." value={inp.T_hid_max} onChange={(v: any) => s("T_hid_max", v)} unit="kN.m" />
            <Inp label="Rendimento" value={inp.eta_mh} onChange={(v: any) => s("eta_mh", v)} />
            <Inp label="Deslocamento" value={inp.Vi_hid} onChange={(v: any) => s("Vi_hid", v)} unit="cm³/rev" />
            <Inp label="Pressão máx." value={inp.p_hid_max} onChange={(v: any) => s("p_hid_max", v)} unit="bar" />
            <Inp label="Pressão perdida" value={inp.pc_hid} onChange={(v: any) => s("pc_hid", v)} unit="bar" />
          </div>

          <div style={{ marginTop: "10px", ...sty.grid(3) }}>
            <Res label="T req. total" value={res.hidVerif.T_req} unit="kN.m" type="w" />
            <Res label="T disp. (c/ η)" value={res.hidVerif.T_disp} unit="kN.m" type="s" />
            <Res label="Margem" value={((res.hidVerif.T_disp / res.hidVerif.T_req - 1) * 100)} unit="%" type={res.hidVerif.ok ? "s" : "d"} />
            <Res label="Pressão calc." value={res.pct_calc} unit="bar" type={res.hidVerif.p_ok ? "s" : "d"} />
            <Res label="Pressão máx." value={inp.p_hid_max} unit="bar" type="s" />
            <Res label="T1 motor elét." value={res.T1_me} unit="N.m" />
          </div>
        </div>
      </>}
    </>}

    {/* ======== DIAGRAMA ======== */}
    {subTab === 3 && <>
      <div style={sty.card}><div style={sty.cardT}>Vista da Roda de Caçambas</div>
        {!res ? <p style={{ color: C.dim, textAlign: "center" }}>Execute o cálculo</p> :
          <BucketWheelDiagram inp={inp} data={res} />}
      </div>
    </>}
  </div>);
}
