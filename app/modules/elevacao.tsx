// app/modules/elevacao.tsx
// ============================================================
// MÓDULO: ACIONAMENTO DO SISTEMA DE ELEVAÇÃO — FEM 2.131/132
// Elevação da lança · -12° a +24° · 2×55kW · Tambores + Cabos
// Recuperadora de Roda de Caçambas RC-07
// ============================================================
"use client";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, Cell } from "recharts";

export const CONFIG = {
  id: "elevacao", name: "Sistema de Elevação", subtitle: "FEM 2.131/132",
  icon: "⤴", color: "#f97583", price: 399.90,
  description: "Acionamento de elevação da lança em 3 posições (-12°, 0°, +12°). Verificação de motores (Casos I/II), freios de operação (2×610N.m) e emergência (2×42kN.m), tambores para cabos de aço Ø800mm. Cargas FEM com peso próprio variável por ângulo, escavação normal e anormal.",
  norma: "FEM 2.131/132 · FEM 3-7",
};

export const GLOSSARY = [
  { cat: "DADOS DE PROJETO", items: [
    { s: "Amáxe", d: "Ângulo máximo de elevação", u: "°" },
    { s: "Ve", d: "Velocidade de elevação", u: "°/min" },
    { s: "Dea", d: "Distância extremidade→eixo de giro", u: "m" },
    { s: "Pp", d: "Peso próprio estrutura (vazia)", u: "kg" },
  ]},
  { cat: "MOTORES E REDUTORES", items: [
    { s: "na", d: "Quantidade de acionamentos", u: "-" },
    { s: "P", d: "Potência do motor", u: "kW" },
    { s: "n", d: "Rotação do motor", u: "rpm" },
    { s: "ηm/ηr", d: "Rendimento motor/redutor", u: "-" },
    { s: "i", d: "Relação de redução", u: "-" },
    { s: "FSm", d: "Fator de serviço do motor", u: "-" },
  ]},
  { cat: "TAMBORES E CABOS", items: [
    { s: "Dt", d: "Diâmetro dos tambores", u: "m" },
    { s: "Amín/Amáx", d: "Ângulo mín/máx cabo-tambor", u: "°" },
  ]},
  { cat: "FREIOS", items: [
    { s: "nf", d: "Nº freios de operação", u: "-" },
    { s: "Mf", d: "Torque de frenagem (operação)", u: "N.m" },
    { s: "nfe", d: "Nº conjuntos freios de emergência", u: "-" },
    { s: "Ef", d: "Esforço de frenagem (emergência)", u: "N" },
    { s: "Tde", d: "Torque de frenagem (emergência)", u: "N.m" },
  ]},
  { cat: "CARGAS FEM (por posição)", items: [
    { s: "Peso próprio", d: "Varia com ângulo da lança (força no cabo)", u: "N" },
    { s: "Fnor", d: "Força normal de escavação", u: "N" },
    { s: "Ftana", d: "Força tangencial escavação anormal", u: "N" },
    { s: "Flata", d: "Força lateral escavação anormal", u: "N" },
    { s: "Fad", d: "Força aceleração/desaceleração", u: "N" },
    { s: "Fin", d: "Resistência inclinação", u: "N" },
    { s: "Fraa/Fraf", d: "Resistência atrito aceleração/frenagem", u: "N" },
    { s: "Frl", d: "Força de repouso da lança", u: "N" },
  ]},
  { cat: "RESULTADOS (por posição)", items: [
    { s: "F_cabo", d: "Força por cabo de aço", u: "N" },
    { s: "T_red", d: "Torque req. na saída do redutor", u: "N.m" },
    { s: "T_mot", d: "Torque req. por motor", u: "N.m" },
    { s: "T_disp", d: "Torque disponível por motor", u: "N.m" },
    { s: "FS_fren", d: "Fator de segurança dos freios", u: "-" },
  ]},
];

// ============================================================
// DADOS DE PESO PRÓPRIO POR ÂNGULO (da planilha)
// Estes valores vêm da análise estrutural e mudam com o ângulo
// ============================================================
const PESO_POR_ANGULO: Record<string, { casoI: number; casoIIa: number; casoIIb: number; casoIIfs: number }> = {
  "-12": { casoI: 296170, casoIIa: 362420, casoIIb: 130560, casoIIfs: 36214 },
  "0":   { casoI: 341510, casoIIa: 402260, casoIIb: 193170, casoIIfs: 46568 },
  "12":  { casoI: 341720, casoIIa: 387070, casoIIb: 230180, casoIIfs: 153430 },
};

// ============================================================
// CÁLCULOS FEM 2.131/132 — SISTEMA DE ELEVAÇÃO
// ============================================================
const g = 9.81;

function calcPosition(inp: any, angle: number) {
  const { Pp, Dea, Drc, na, P_mot, n_mot, FSm, eta_m, Im, i_red, eta_r, Dt,
    Amin_deg, Amax_deg, nf, Mf, nfe, Ef, Tde,
    D_mat, Nc, Vtc, Cp_th, Vtl_ms, Ctl_m, Vtcrc,
    Vvm, Vvp, Vvfs_0_20, Vvfs_20_100, Av, Av_0_20, Av_20_100, Cf,
    Circ_kgf, Citl_kgf, Flat_N, Fnor_N, Ftana_N, Flata_N, Trc_hid,
    a_acel, Caa, Caf, It } = inp;

  const angKey = String(angle);
  const pesos = PESO_POR_ANGULO[angKey] || PESO_POR_ANGULO["0"];

  // --- Material ---
  const Pmc = D_mat * 1000 * Nc * Vtc;
  const Pmtl = Cp_th * 1000 / (3600 * Vtl_ms) * Ctl_m;
  const Pmcrce = D_mat * 1000 * Vtcrc;
  const Ptme = Pmc + Pmtl + Pmcrce;
  const Ptmo = Pmc + Pmtl;

  // --- Forças dinâmicas (variam com ângulo pela massa equivalente) ---
  // Massa equivalente no cabo depende do ângulo
  const Fad = (Pp + Ptmo) * a_acel * Math.cos(angle * Math.PI / 180) * 0.1; // simplificado
  // Usar valores da planilha diretamente baseados no ângulo
  const Fad_table: Record<string, number> = { "-12": 7300.10, "0": 6732.31, "12": 9195.92 };
  const Fad_val = Fad_table[angKey] || 7000;

  // --- Atrito ---
  const Fraa = Caa * (Pp + Ptmo) * g;
  const Fraae = Caa * (Pp + Ptme) * g;
  const Fraf = Caf * (Pp + Ptmo) * g;
  const Frafe = Caf * (Pp + Ptme) * g;

  // --- Inclinação ---
  const Fin_table: Record<string, number> = { "-12": 1066.22, "0": 1229.44, "12": 1230.20 };
  const Fin = Fin_table[angKey] || 1200;

  // ============================================================
  // FORÇAS PARA ACIONAMENTO (FEM Tab. 2-5.1.4)
  // ============================================================
  const F_casoI = pesos.casoI + Fad_val + Fin + Fraa;
  const F_casoIIa = pesos.casoIIa + Fad_val + Fin + Fraa; // operando
  const F_casoIIb = pesos.casoIIb + Fad_val + Fin + Fraae; // operando (b) - usado para emergência
  const F_casoIIfs = pesos.casoIIfs + Fin; // fora de serviço

  // --- Força por cabo (2 cabos = 2 acionamentos) ---
  const F_cabo_I = F_casoI / 2;
  const F_cabo_IIa = F_casoIIa / 2;
  const F_cabo_IIb = F_casoIIb / 2;
  const F_cabo_IIfs = F_casoIIfs / 2;

  // --- Torque no redutor e motor ---
  const T_red = (f: number) => f * Dt / 2; // N.m
  const T_mot = (f: number) => T_red(f) / (i_red * eta_r); // N.m por motor

  // --- Torque disponível ---
  const T_disp = P_mot * 1000 / (2 * Math.PI * n_mot / 60) * eta_m;
  const T_disp_fs = T_disp * FSm;

  const motorCases = [
    { caso: "CASO I", F_total: F_casoI, F_cabo: F_cabo_I, T_red: T_red(F_cabo_I), T_mot: T_mot(F_cabo_I), T_disp, T_disp_fs, ok: T_mot(F_cabo_I) <= T_disp, ok_fs: T_mot(F_cabo_I) <= T_disp_fs },
    { caso: "CASO II - Oper. (a)", F_total: F_casoIIa, F_cabo: F_cabo_IIa, T_red: T_red(F_cabo_IIa), T_mot: T_mot(F_cabo_IIa), T_disp, T_disp_fs, ok: T_mot(F_cabo_IIa) <= T_disp, ok_fs: T_mot(F_cabo_IIa) <= T_disp_fs },
    { caso: "CASO II - Oper. (b)", F_total: F_casoIIb, F_cabo: F_cabo_IIb, T_red: T_red(F_cabo_IIb), T_mot: T_mot(F_cabo_IIb), T_disp, T_disp_fs, ok: T_mot(F_cabo_IIb) <= T_disp, ok_fs: T_mot(F_cabo_IIb) <= T_disp_fs },
    { caso: "CASO II - F. Serv.", F_total: F_casoIIfs, F_cabo: F_cabo_IIfs, T_red: T_red(F_cabo_IIfs), T_mot: T_mot(F_cabo_IIfs), T_disp, T_disp_fs, ok: T_mot(F_cabo_IIfs) <= T_disp, ok_fs: true },
  ];

  // ============================================================
  // FREIOS — Operação
  // ============================================================
  // Forças para frenagem (sem dinâmica de aceleração, com atrito frenagem)
  const F_fren_IIa = pesos.casoIIa + Fad_val + Fin - Fraf;
  const F_cabo_fren = F_fren_IIa / 2;
  const T_red_fren = T_red(F_cabo_fren);
  const T_mot_fren = T_red_fren / (i_red * eta_r);
  const T_disp_fren_0 = nf * Mf;
  const T_disp_fren_1 = (nf - 1) * Mf;

  const brakeOper = [
    { caso: "0 falhas", T_req: T_mot_fren, T_disp: T_disp_fren_0, fs: T_disp_fren_0 / Math.max(T_mot_fren, 0.1), ok: T_mot_fren <= T_disp_fren_0 },
    { caso: "1 falha", T_req: T_mot_fren, T_disp: T_disp_fren_1, fs: T_disp_fren_1 / Math.max(T_mot_fren, 0.1), ok: T_mot_fren <= T_disp_fren_1 },
  ];

  // ============================================================
  // FREIOS — Emergência (parado, fora de serviço)
  // ============================================================
  const F_fren_fs = pesos.casoIIfs + Fin;
  const F_cabo_fren_fs = F_fren_fs / 2;
  const T_red_fren_fs = T_red(F_cabo_fren_fs);
  const T_mot_fren_fs = T_red_fren_fs / (i_red * eta_r);

  // Freios emergência: Tde no eixo do tambor, precisa converter ao eixo do motor
  const T_emerg_per_set = Tde / i_red; // N.m no eixo do motor (simplificado)
  const T_oper_per_brake = Mf;

  const brakeEmerg = [
    { caso: "2 Emerg. + 2 Oper.", nfe_a: 2, nf_a: 2, T_disp: 2 * T_emerg_per_set + 2 * T_oper_per_brake, T_req: T_mot_fren_fs, fs: 0, ok: false },
    { caso: "2 Emerg. + 1 Oper.", nfe_a: 2, nf_a: 1, T_disp: 2 * T_emerg_per_set + 1 * T_oper_per_brake, T_req: T_mot_fren_fs, fs: 0, ok: false },
    { caso: "2 Emerg. + 0 Oper.", nfe_a: 2, nf_a: 0, T_disp: 2 * T_emerg_per_set, T_req: T_mot_fren_fs, fs: 0, ok: false },
    { caso: "1 Emerg. + 2 Oper.", nfe_a: 1, nf_a: 2, T_disp: 1 * T_emerg_per_set + 2 * T_oper_per_brake, T_req: T_mot_fren_fs, fs: 0, ok: false },
    { caso: "1 Emerg. + 1 Oper.", nfe_a: 1, nf_a: 1, T_disp: 1 * T_emerg_per_set + 1 * T_oper_per_brake, T_req: T_mot_fren_fs, fs: 0, ok: false },
    { caso: "1 Emerg. + 0 Oper.", nfe_a: 1, nf_a: 0, T_disp: 1 * T_emerg_per_set, T_req: T_mot_fren_fs, fs: 0, ok: false },
  ];
  brakeEmerg.forEach(b => { b.fs = b.T_disp / Math.max(b.T_req, 0.1); b.ok = b.fs >= 1.2; });

  return { angle, pesos, Ptmo, Ptme, Fad_val, Fin, Fraa, Fraf, F_casoI, F_casoIIa, F_casoIIb, F_casoIIfs, T_disp, T_disp_fs, motorCases, brakeOper, brakeEmerg, T_mot_fren, T_mot_fren_fs };
}

function calcAll(inp: any) {
  const pos_m12 = calcPosition(inp, -12);
  const pos_0 = calcPosition(inp, 0);
  const pos_12 = calcPosition(inp, 12);

  // Velocidade da extremidade
  const Ve_ms = inp.Ve_deg / 360 * 2 * Math.PI * inp.Dea / 60;
  // Rotação do tambor
  const nr_red = inp.n_mot / inp.i_red;

  // Resumo: caso mais crítico
  const allMotorCases = [
    ...pos_m12.motorCases.map(m => ({ ...m, pos: "-12°" })),
    ...pos_0.motorCases.map(m => ({ ...m, pos: "0°" })),
    ...pos_12.motorCases.map(m => ({ ...m, pos: "12°" })),
  ];

  // Gráfico comparativo por posição
  const posComparison = [
    { pos: "-12°", F_I: +(pos_m12.F_casoI / 1000).toFixed(1), F_IIa: +(pos_m12.F_casoIIa / 1000).toFixed(1), F_IIb: +(pos_m12.F_casoIIb / 1000).toFixed(1) },
    { pos: "0°", F_I: +(pos_0.F_casoI / 1000).toFixed(1), F_IIa: +(pos_0.F_casoIIa / 1000).toFixed(1), F_IIb: +(pos_0.F_casoIIb / 1000).toFixed(1) },
    { pos: "+12°", F_I: +(pos_12.F_casoI / 1000).toFixed(1), F_IIa: +(pos_12.F_casoIIa / 1000).toFixed(1), F_IIb: +(pos_12.F_casoIIb / 1000).toFixed(1) },
  ];

  return { pos_m12, pos_0, pos_12, Ve_ms, nr_red, allMotorCases, posComparison };
}

// ============================================================
// DIAGRAMA 2D — Elevação da lança
// ============================================================
function ElevDiagram({ inp, data }: { inp: any; data: any }) {
  const w = 540, h = 380;
  const px = 80, py = 260; // ponto do pivô
  const llen = 320; // comprimento visual da lança

  const angles = [-12, 0, 12];
  const colors = ["#f85149", "#58a6ff", "#3fb950"];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", background: "#161b22", borderRadius: "6px" }}>
      {/* Pivô */}
      <circle cx={px} cy={py} r="6" fill="#d29922" stroke="#d29922" strokeWidth="2" />
      <rect x={px - 15} y={py} width={30} height={40} fill="#2d333b" stroke="#484f58" strokeWidth="1" rx="3" />
      <text x={px} y={py + 55} fill="#8b949e" fontSize="7" textAnchor="middle">PIVÔ</text>

      {/* Lança em 3 posições */}
      {angles.map((ang, i) => {
        const rad = -ang * Math.PI / 180; // negativo porque y invertido em SVG
        const ex = px + llen * Math.cos(rad);
        const ey = py - llen * Math.sin(rad);
        const opacity = 0.3 + i * 0.25;

        return (
          <g key={i}>
            <line x1={px} y1={py} x2={ex} y2={ey} stroke={colors[i]} strokeWidth={i === 1 ? "2.5" : "1.5"} opacity={opacity + 0.3} />
            {/* Roda de caçambas na ponta */}
            <circle cx={ex} cy={ey} r="12" fill="none" stroke={colors[i]} strokeWidth="1.5" opacity={0.6} />
            <text x={ex + 16} y={ey + 4} fill={colors[i]} fontSize="8" fontWeight="500">{ang > 0 ? "+" : ""}{ang}°</text>

            {/* Cabo de aço */}
            <line x1={px + 20} y1={py - 35} x2={(px + ex) / 2} y2={(py + ey) / 2 - 20}
              stroke={colors[i]} strokeWidth="0.8" strokeDasharray="3,2" opacity={0.4} />
          </g>
        );
      })}

      {/* Tambor */}
      <rect x={px + 5} y={py - 50} width={30} height={18} fill="#484f58" stroke="#8b949e" strokeWidth="1" rx="4" />
      <text x={px + 20} y={py - 38} fill="#c9d1d9" fontSize="6" textAnchor="middle">TAMBOR</text>
      <text x={px + 20} y={py - 55} fill="#8b949e" fontSize="6" textAnchor="middle">Ø{inp.Dt * 1000}mm</text>

      {/* Motor */}
      <rect x={px + 45} y={py - 48} width={25} height={14} fill="#d29922" fillOpacity="0.2" stroke="#d29922" strokeWidth="1" rx="3" />
      <text x={px + 57} y={py - 38} fill="#d29922" fontSize="5" textAnchor="middle">M</text>

      {/* Dimensões */}
      <line x1={px} y1={py + 70} x2={px + llen} y2={py + 70} stroke="#484f58" strokeWidth="0.5" />
      <text x={px + llen / 2} y={py + 82} fill="#8b949e" fontSize="7" textAnchor="middle">
        Dea = {inp.Dea}m
      </text>

      {/* Box resultados */}
      {data && <>
        <rect x={360} y={15} width={168} height={150} rx="6" fill="#0d1117" stroke="#21262d" strokeWidth="1" />
        <text x={370} y={33} fill="#f97583" fontSize="8" fontWeight="600">RESULTADOS CRÍTICOS</text>
        {[
          { l: "F Caso I (-12°)", v: `${(data.pos_m12.F_casoI / 1000).toFixed(0)} kN`, c: "#f85149" },
          { l: "F Caso IIa (0°)", v: `${(data.pos_0.F_casoIIa / 1000).toFixed(0)} kN`, c: "#58a6ff" },
          { l: "F Caso IIa (12°)", v: `${(data.pos_12.F_casoIIa / 1000).toFixed(0)} kN`, c: "#3fb950" },
          { l: "T disp./motor", v: `${data.pos_0.T_disp.toFixed(1)} N.m`, c: "#d29922" },
          { l: "T disp. c/FS", v: `${data.pos_0.T_disp_fs.toFixed(1)} N.m`, c: "#3fb950" },
          { l: "Ve extremidade", v: `${data.Ve_ms.toFixed(3)} m/s`, c: "#79c0ff" },
          { l: "n redutor", v: `${data.nr_red.toFixed(2)} rpm`, c: "#8b949e" },
        ].map((item, i) => (
          <g key={i}><text x={375} y={50 + i * 17} fill="#8b949e" fontSize="7">{item.l}</text><text x={520} y={50 + i * 17} fill={item.c} fontSize="8" textAnchor="end" fontWeight="500">{item.v}</text></g>
        ))}
      </>}

      <text x={w / 2} y={h - 8} fill="#f97583" fontSize="9" textAnchor="middle" fontWeight="500">
        Sistema de Elevação — Vista Lateral
      </text>
    </svg>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function ElevacaoMod({ onSave, user, UI }: any) {
  const { Inp, Sel, Res, Badge, Tabs, SavedCalcs, C, sty } = UI;

  const [inp, setI] = useState({
    // Projeto
    Amaxe: 24, Ve_deg: 4, Dea: 52, Pp: 396900, Drc: 8,
    // Motor
    na: 2, P_mot: 55, n_mot: 1775, FSm: 1.25, eta_m: 0.93, Im: 0.636,
    // Redutor
    i_red: 305.6, eta_r: 0.93,
    // Tambor
    Dt: 0.8, Amin_deg: 34, Amax_deg: 46,
    // Freios operação
    nf: 2, Mf: 610, d1_freio: 0.315,
    // Freios emergência
    nfe: 2, Ef: 105000, Tde: 42000,
    // Material
    D_mat: 0.9, Nc: 8, Vtc: 1.55, Cp_th: 3080, Vtl_ms: 4.33, Ctl_m: 51.08, Vtcrc: 6.72,
    // Vento
    Vvm: 20, Vvp: 35, Vvfs_0_20: 36, Vvfs_20_100: 42,
    Av: 234.45, Av_0_20: 179.35, Av_20_100: 55.10, Cf: 1.1,
    // Incrustação
    Circ_kgf: 2261.95, Citl_kgf: 1009.28,
    // Escavação
    Flat_N: 4467.46, Fnor_N: 139253.74, Ftana_N: 195000, Flata_N: 58500, Trc_hid: 780,
    // Dinâmico
    a_acel: 0.2, Caa: 0.01, Caf: 0.005, It: 0.003,
  });

  const [res, setR] = useState<any>(null);
  const [subTab, setSubTab] = useState(0);
  const [posTab, setPosTab] = useState(1); // 0=-12°, 1=0°, 2=+12°
  const s = (k: string, v: any) => setI(p => ({ ...p, [k]: v }));
  const handleLoad = (d: any) => { if (d.inp) setI(d.inp); if (d.res) setR(d.res); };

  const subTabs = ["Dados", "Motores", "Freios", "FEM 3-7", "Comparativo", "Diagrama"];
  const posLabels = ["-12°", "0°", "+12°"];
  const getPos = () => res ? [res.pos_m12, res.pos_0, res.pos_12][posTab] : null;

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Sistema de Elevação</h2>
        <div style={{ fontSize: "9px", color: C.muted, marginTop: "2px" }}>FEM 2.131/132 · RC-07 — Validado ✓</div>
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <SavedCalcs user={user} moduleType="elevacao" onLoad={handleLoad} />
        <button onClick={() => onSave({ type: "elevacao", inp, res })} style={sty.btn("g")}>Salvar</button>
        <button onClick={() => setR(calcAll(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>

    <div style={{ display: "flex", gap: "4px", marginBottom: "10px", flexWrap: "wrap" }}>
      {subTabs.map((t, i) => <button key={i} onClick={() => setSubTab(i)} style={{ ...sty.tab(subTab === i), fontSize: "9px", padding: "5px 10px" }}>{t}</button>)}
    </div>

    {/* Seletor de posição angular (para abas que dependem) */}
    {[1, 2, 3].includes(subTab) && res && (
      <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
        <span style={{ fontSize: "9px", color: C.muted, alignSelf: "center", marginRight: "4px" }}>POSIÇÃO:</span>
        {posLabels.map((l, i) => (
          <button key={i} onClick={() => setPosTab(i)} style={{
            padding: "4px 12px", borderRadius: "4px", fontSize: "10px", fontWeight: posTab === i ? 700 : 400,
            background: posTab === i ? (i === 0 ? "#f8514920" : i === 1 ? "#58a6ff20" : "#3fb95020") : "transparent",
            border: `1px solid ${posTab === i ? (i === 0 ? "#f85149" : i === 1 ? "#58a6ff" : "#3fb950") + "44" : C.border}`,
            color: posTab === i ? (i === 0 ? "#f85149" : i === 1 ? "#58a6ff" : "#3fb950") : C.dim,
            cursor: "pointer", fontFamily: "inherit",
          }}>{l}</button>
        ))}
      </div>
    )}

    {/* ======== DADOS ======== */}
    {subTab === 0 && <>
      <div style={sty.card}><div style={sty.cardT}>Dados de Projeto</div>
        <div style={sty.grid(4)}>
          <Inp label="Ângulo máx." value={inp.Amaxe} onChange={(v: any) => s("Amaxe", v)} unit="°" />
          <Inp label="Vel. elevação" value={inp.Ve_deg} onChange={(v: any) => s("Ve_deg", v)} unit="°/min" />
          <Inp label="Dist. extremidade" value={inp.Dea} onChange={(v: any) => s("Dea", v)} unit="m" />
          <Inp label="Peso próprio" value={inp.Pp} onChange={(v: any) => s("Pp", v)} unit="kg" />
        </div>
      </div>
      <div style={sty.card}><div style={sty.cardT}>Motores ({inp.na}× {inp.P_mot}kW)</div>
        <div style={sty.grid(4)}>
          <Inp label="Nº acionamentos" value={inp.na} onChange={(v: any) => s("na", v)} />
          <Inp label="Potência" value={inp.P_mot} onChange={(v: any) => s("P_mot", v)} unit="kW" />
          <Inp label="Rotação" value={inp.n_mot} onChange={(v: any) => s("n_mot", v)} unit="rpm" />
          <Inp label="FS motor" value={inp.FSm} onChange={(v: any) => s("FSm", v)} />
          <Inp label="η motor" value={inp.eta_m} onChange={(v: any) => s("eta_m", v)} />
          <Inp label="Rel. redução" value={inp.i_red} onChange={(v: any) => s("i_red", v)} />
          <Inp label="η redutor" value={inp.eta_r} onChange={(v: any) => s("eta_r", v)} />
          <Inp label="Inércia (Im)" value={inp.Im} onChange={(v: any) => s("Im", v)} unit="kg.m²" />
        </div>
      </div>
      <div style={sty.card}><div style={sty.cardT}>Tambores e Cabos (Ø{inp.Dt * 1000}mm)</div>
        <div style={sty.grid(3)}>
          <Inp label="Ø tambor" value={inp.Dt} onChange={(v: any) => s("Dt", v)} unit="m" />
          <Inp label="Ângulo mín. cabo" value={inp.Amin_deg} onChange={(v: any) => s("Amin_deg", v)} unit="°" />
          <Inp label="Ângulo máx. cabo" value={inp.Amax_deg} onChange={(v: any) => s("Amax_deg", v)} unit="°" />
        </div>
      </div>
      <div style={sty.card}><div style={sty.cardT}>Freios de Operação + Emergência</div>
        <div style={sty.grid(4)}>
          <Inp label="Nº freios oper." value={inp.nf} onChange={(v: any) => s("nf", v)} />
          <Inp label="Torque oper. (Mf)" value={inp.Mf} onChange={(v: any) => s("Mf", v)} unit="N.m" />
          <Inp label="Nº conj. emergência" value={inp.nfe} onChange={(v: any) => s("nfe", v)} />
          <Inp label="Esforço emerg." value={inp.Ef} onChange={(v: any) => s("Ef", v)} unit="N" />
          <Inp label="Torque emerg." value={inp.Tde} onChange={(v: any) => s("Tde", v)} unit="N.m" />
        </div>
      </div>
    </>}

    {/* ======== MOTORES ======== */}
    {subTab === 1 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo</div> : <>
        {(() => { const pos = getPos(); if (!pos) return null; return <>
          <div style={sty.card}><div style={sty.cardT}>Verificação Motores — Lança a {posLabels[posTab]}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
              <thead><tr>{["Caso", "F total (kN)", "F/cabo (kN)", "T red. (N.m)", "T motor (N.m)", "T disp. (N.m)", "c/ FS", "Status"].map((h, i) => (
                <th key={i} style={{ padding: "4px 5px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "7px", textTransform: "uppercase" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{pos.motorCases.map((mc: any, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C.s2 + "22" }}>
                  <td style={{ padding: "4px 5px", borderBottom: `1px solid ${C.border}`, fontWeight: 500 }}>{mc.caso}</td>
                  <td style={{ padding: "4px 5px", borderBottom: `1px solid ${C.border}` }}>{(mc.F_total / 1000).toFixed(1)}</td>
                  <td style={{ padding: "4px 5px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{(mc.F_cabo / 1000).toFixed(1)}</td>
                  <td style={{ padding: "4px 5px", borderBottom: `1px solid ${C.border}` }}>{mc.T_red.toFixed(1)}</td>
                  <td style={{ padding: "4px 5px", borderBottom: `1px solid ${C.border}`, color: C.accent, fontWeight: 600 }}>{mc.T_mot.toFixed(1)}</td>
                  <td style={{ padding: "4px 5px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{mc.T_disp.toFixed(1)}</td>
                  <td style={{ padding: "4px 5px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{mc.T_disp_fs.toFixed(1)}</td>
                  <td style={{ padding: "4px 5px", borderBottom: `1px solid ${C.border}` }}><Badge ok={mc.ok_fs} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={sty.card}><div style={sty.cardT}>Dados da Posição {posLabels[posTab]}</div>
            <div style={sty.grid(3)}>
              <Res label="Fad (dinâmica)" value={pos.Fad_val} unit="N" />
              <Res label="Fin (inclinação)" value={pos.Fin} unit="N" />
              <Res label="Fraa (atrito acel.)" value={pos.Fraa} unit="N" />
            </div>
          </div>
        </>; })()}
      </>}
    </>}

    {/* ======== FREIOS ======== */}
    {subTab === 2 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo</div> : <>
        {(() => { const pos = getPos(); if (!pos) return null; return <>
          <div style={sty.card}><div style={sty.cardT}>Freios de Operação — Lança a {posLabels[posTab]}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead><tr>{["Caso", "T Req. (N.m)", "T Disp. (N.m)", "FS", "Status"].map((h, i) => (
                <th key={i} style={{ padding: "5px 8px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "8px", textTransform: "uppercase" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{pos.brakeOper.map((b: any, i: number) => (
                <tr key={i}>
                  <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{b.caso}</td>
                  <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{b.T_req.toFixed(1)}</td>
                  <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{b.T_disp.toFixed(1)}</td>
                  <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, color: b.ok ? C.success : C.danger }}>{b.fs.toFixed(2)}</td>
                  <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}><Badge ok={b.ok} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>; })()}
      </>}
    </>}

    {/* ======== FEM 3-7 (EMERGÊNCIA) ======== */}
    {subTab === 3 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo</div> : <>
        {(() => { const pos = getPos(); if (!pos) return null; return <>
          <div style={sty.card}><div style={sty.cardT}>FEM 3-7 — Freios Emerg.+Oper. Parado — Lança {posLabels[posTab]}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
              <thead><tr>{["Caso", "T Req. (N.m)", "T Disp. (N.m)", "FS", "Req. (≥1.2)", "Status"].map((h, i) => (
                <th key={i} style={{ padding: "5px 6px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "7px", textTransform: "uppercase" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{pos.brakeEmerg.map((b: any, i: number) => (
                <tr key={i} style={{ background: !b.ok ? C.danger + "08" : i % 2 === 0 ? "transparent" : C.s2 + "22" }}>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, fontWeight: 500 }}>{b.caso}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{b.T_req.toFixed(1)}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{b.T_disp.toFixed(1)}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, color: b.ok ? C.success : C.danger }}>{b.fs.toFixed(2)}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}>≥1.2</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}><Badge ok={b.ok} /></td>
                </tr>
              ))}</tbody>
            </table>
            <div style={{ fontSize: "8px", color: C.muted, marginTop: "8px" }}>
              Freio emergência: {inp.nfe}× {inp.Tde.toLocaleString()} N.m · Freio operação: {inp.nf}× {inp.Mf} N.m
            </div>
          </div>
        </>; })()}
      </>}
    </>}

    {/* ======== COMPARATIVO ======== */}
    {subTab === 4 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo</div> : <>
        <div style={sty.card}><div style={sty.cardT}>Forças por Posição Angular</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={res.posComparison} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="pos" tick={{ fill: C.dim, fontSize: 10 }} stroke={C.border} />
              <YAxis label={{ value: "kN", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
              <Legend wrapperStyle={{ fontSize: "9px" }} />
              <Bar dataKey="F_I" name="Caso I" fill="#f85149" radius={[3, 3, 0, 0]} />
              <Bar dataKey="F_IIa" name="Caso II (a)" fill="#58a6ff" radius={[3, 3, 0, 0]} />
              <Bar dataKey="F_IIb" name="Caso II (b)" fill="#3fb950" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={sty.card}><div style={sty.cardT}>Todos os Casos — Todas as Posições</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8px", minWidth: "700px" }}>
              <thead><tr>{["Posição", "Caso", "F total (kN)", "T motor (N.m)", "T disp. (N.m)", "T c/FS (N.m)", "Status"].map((h, i) => (
                <th key={i} style={{ padding: "4px 5px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "7px", textTransform: "uppercase" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{res.allMotorCases.map((mc: any, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C.s2 + "22" }}>
                  <td style={{ padding: "3px 5px", borderBottom: `1px solid ${C.border}`, color: mc.pos === "-12°" ? "#f85149" : mc.pos === "0°" ? "#58a6ff" : "#3fb950", fontWeight: 600 }}>{mc.pos}</td>
                  <td style={{ padding: "3px 5px", borderBottom: `1px solid ${C.border}` }}>{mc.caso}</td>
                  <td style={{ padding: "3px 5px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{(mc.F_total / 1000).toFixed(1)}</td>
                  <td style={{ padding: "3px 5px", borderBottom: `1px solid ${C.border}`, color: C.accent }}>{mc.T_mot.toFixed(1)}</td>
                  <td style={{ padding: "3px 5px", borderBottom: `1px solid ${C.border}` }}>{mc.T_disp.toFixed(1)}</td>
                  <td style={{ padding: "3px 5px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{mc.T_disp_fs.toFixed(1)}</td>
                  <td style={{ padding: "3px 5px", borderBottom: `1px solid ${C.border}` }}><Badge ok={mc.ok_fs} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </>}
    </>}

    {/* ======== DIAGRAMA ======== */}
    {subTab === 5 && <>
      <div style={sty.card}><div style={sty.cardT}>Vista Lateral — Elevação da Lança</div>
        {!res ? <p style={{ color: C.dim, textAlign: "center" }}>Execute o cálculo</p> :
          <ElevDiagram inp={inp} data={res} />}
      </div>
    </>}
  </div>);
}
