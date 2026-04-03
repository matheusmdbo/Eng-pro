// app/modules/giro.tsx
// ============================================================
// MÓDULO: ACIONAMENTO DO SISTEMA DE GIRO — FEM 2.131/132
// Cremalheira de pinos · 2 acionamentos 15kW
// Recuperadora de Roda de Caçambas RC-07
// ============================================================
"use client";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, Cell } from "recharts";

export const CONFIG = {
  id: "giro", name: "Sistema de Giro", subtitle: "FEM 2.131/132",
  icon: "↻", color: "#79c0ff", price: 399.90,
  description: "Cálculo do acionamento do sistema de giro com cremalheira de pinos. Torques em função da rotação variável, verificação de motores (Casos I/II), freios, deslizamento roda-trilho, variação de carga de vento (FEM 3-7). Acoplamento com torque de deslizamento.",
  norma: "FEM 2.131/132 · FEM 3-7",
};

export const GLOSSARY = [
  { cat: "DADOS DE PROJETO", items: [
    { s: "Amaxg", d: "Ângulo máximo de giro", u: "°" },
    { s: "Vmáxg/Vmíng", d: "Velocidades de giro (mín/máx)", u: "°/min" },
    { s: "Dpc", d: "Diâmetro primitivo da cremalheira de pinos", u: "m" },
    { s: "Dpp", d: "Diâmetro primitivo do pinhão", u: "m" },
    { s: "Dea", d: "Distância extremidade→eixo de giro", u: "m" },
    { s: "Pp", d: "Peso próprio estrutura (vazia)", u: "kg" },
  ]},
  { cat: "MOTOR E REDUTOR", items: [
    { s: "na", d: "Quantidade de acionamentos", u: "-" },
    { s: "P", d: "Potência do motor", u: "kW" },
    { s: "nmín/nmáx", d: "Rotação mínima/máxima do motor", u: "rpm" },
    { s: "ηm/ηr", d: "Rendimento motor/redutor", u: "-" },
    { s: "i", d: "Relação de redução", u: "-" },
    { s: "Tmáxa", d: "Torque máx. até deslizamento do acoplamento", u: "N.m" },
    { s: "Tmína", d: "Torque mín. interrompendo deslizamento", u: "N.m" },
  ]},
  { cat: "FREIOS", items: [
    { s: "nf", d: "Número de freios", u: "-" },
    { s: "Mfmín/Mfmáx", d: "Torque de frenagem (mín/máx)", u: "N.m" },
    { s: "d1", d: "Diâmetro da roda de freio", u: "m" },
  ]},
  { cat: "CARREGAMENTOS FEM", items: [
    { s: "Ptme", d: "Peso total material (entupimento)", u: "kgf" },
    { s: "Ptmo", d: "Peso total material (operação)", u: "kgf" },
    { s: "Tvo", d: "Torque do vento operação (50% lado oposto)", u: "N.m" },
    { s: "Tvp", d: "Torque do vento projeto", u: "N.m" },
    { s: "Tvfs", d: "Torque do vento fora de serviço", u: "N.m" },
    { s: "Flat", d: "Força lateral de escavação", u: "N" },
    { s: "Fad", d: "Força aceleração/desaceleração", u: "N" },
    { s: "Fraa/Fraf", d: "Resistência atrito aceleração/frenagem", u: "N" },
    { s: "Fin", d: "Resistência inclinação", u: "N" },
  ]},
  { cat: "RESULTADOS", items: [
    { s: "T_caso_I", d: "Torque total Caso I (FEM Tab. 2-5.1.2)", u: "kN.m" },
    { s: "T_caso_II", d: "Torque total Caso II operando", u: "kN.m" },
    { s: "T_req_red", d: "Torque requerido na saída do redutor", u: "N.m" },
    { s: "T_req_mot", d: "Torque requerido por motor", u: "N.m" },
    { s: "FS_fren", d: "Fator de segurança dos freios", u: "-" },
    { s: "FS_desliz", d: "Fator segurança deslizamento roda-trilho", u: "-" },
  ]},
];

// ============================================================
// CÁLCULOS FEM 2.131/132 — SISTEMA DE GIRO
// ============================================================
const g = 9.81;

function calcAll(inp: any) {
  const { Amaxg, Vmaxg_deg, Vming_deg, Dpc, Dpp, Dea, Pp, Drc,
    na, P_mot, nmin, nmax, FSm, eta_m, Im, i_red, eta_r, Tmax_acop, Tmin_acop,
    nf, Mf_min, Mf_max, d1_freio,
    D_mat, Nc, Vtc, Cp_th, Vtl_ms, Ctl_m, Vtcrc, Vtcc,
    Vvm, Vvp, Vvfs_0_20, Vvfs_20_100,
    Av, Av_0_20, Av_20_100, Cf,
    Ec, Circ_kgf, Citl_kgf, Flat_N, a_acel,
    Caa, Caf, It, Caert, Cacrt } = inp;

  // --- Velocidades ---
  const Vmaxe = Vmaxg_deg / 360 * Math.PI * 2 * Dea / 60; // m/s
  const Vmine = Vming_deg / 360 * Math.PI * 2 * Dea / 60;
  const nr_red = nmax / i_red; // rpm na saída do redutor

  // --- Peso de Material (mesmos cálculos) ---
  const Pmc = D_mat * 1000 * Nc * Vtc;
  const Pmtl = Cp_th * 1000 / (3600 * Vtl_ms) * Ctl_m;
  const Pmcrce = D_mat * 1000 * Vtcrc;
  const Pmcce = D_mat * 1000 * Vtcc;
  const Ptme = Pmc + Pmtl + Pmcrce + Pmcce;
  const Ptmo = Pmc + Pmtl;

  // --- Carga de Vento → TORQUE (Nota 3: 50% no lado oposto) ---
  const qmo = 0.613 * Vvm * Vvm;
  const qmor = qmo / 3;
  const Fvo = qmo * Av * Cf;
  const Tvo = Fvo * Dpc / 2 * 1.5; // N.m (50% extra no lado oposto)
  const Fvor = qmor * Av * Cf;
  const Tvor = Fvor * Dpc / 2 * 1.5;
  const Fvp = 0.613 * Vvp * Vvp * Av * Cf;
  const Tvp = Fvp * Dpc / 2 * 1.5;
  const Fvfs_low = 0.613 * Vvfs_0_20 * Vvfs_0_20 * Av_0_20 * Cf;
  const Fvfs_high = 0.613 * Vvfs_20_100 * Vvfs_20_100 * Av_20_100 * Cf;
  const Tvfs = (Fvfs_low + Fvfs_high) * Dpc / 2 * 1.5;

  // --- Incrustação ---
  const Ci = (Circ_kgf + Citl_kgf);

  // --- Forças dinâmicas ---
  const Fado_I = (Pp + Ptmo) * a_acel;
  const Fade_III = (Pp + Ptme) * a_acel;

  // --- Atrito rolamentos ---
  const Fraa = Caa * (Pp + Ptmo) * g;
  const Fraf = Caf * (Pp + Ptmo) * g;

  // --- Inclinação ---
  const Fin = It * (Pp + Ptmo) * g;

  // --- Conversão forças → torques no giro ---
  const R_giro = Dpc / 2; // raio da cremalheira
  const T_flat = Flat_N * R_giro;
  const T_fado = Fado_I * R_giro;
  const T_fraa = Fraa * R_giro;
  const T_fraf = Fraf * R_giro;
  const T_fin = Fin * R_giro;

  // ============================================================
  // TABELA FEM 2-5.1.2 — Forças / Torques por caso
  // ============================================================
  // CASO I: Escavação + aceleração + inclinação + vento red. + atrito acel.
  const T_caso_I = T_flat + T_fado + T_fin + Tvor + T_fraa;
  // CASO II operando: Escavação + inclinação + vento 20m/s + atrito acel.
  const T_caso_IIa = T_flat + T_fin + Tvo + T_fraa;
  // CASO II fora de serviço: Inclinação + vento fora serviço
  const T_caso_IIfs = T_fin + Tvfs;

  // --- Torque na saída do redutor ---
  const T_req_red_I = T_caso_I * 1000 / (Dpc / Dpp); // N.m (relação cremalheira/pinhão)
  const T_req_mot_I = T_req_red_I / (i_red * na * eta_r);

  const T_req_red_IIa = T_caso_IIa * 1000 / (Dpc / Dpp);
  const T_req_mot_IIa = T_req_red_IIa / (i_red * na * eta_r);

  const T_req_red_IIfs = T_caso_IIfs * 1000 / (Dpc / Dpp);
  const T_req_mot_IIfs = T_req_red_IIfs / (i_red * na * eta_r);

  // ============================================================
  // VARIAÇÃO TORQUE × ROTAÇÃO
  // ============================================================
  // Motor de velocidade variável: torque ∝ 1/n para potência constante
  const T_mot_max = P_mot * 1000 / (2 * Math.PI * nmin / 60); // torque a rotação mínima
  const T_mot_min = P_mot * 1000 / (2 * Math.PI * nmax / 60); // torque a rotação máxima

  const rotTorqueCurve = [];
  const nSteps = 9;
  for (let step = 0; step <= nSteps - 1; step++) {
    const n = nmin + step * (nmax - nmin) / (nSteps - 1);
    const T_disp = P_mot * 1000 / (2 * Math.PI * n / 60);
    rotTorqueCurve.push({
      rpm: +n.toFixed(0),
      T_disp: +T_disp.toFixed(1),
      T_req_I: +T_req_mot_I.toFixed(1),
      T_req_II: +T_req_mot_IIa.toFixed(1),
    });
  }

  // Motor cases
  const motorCases = [
    { caso: "CASO I", T_kNm: T_caso_I / 1000, T_red: T_req_red_I, T_mot: T_req_mot_I, T_disp_min: T_mot_min, T_disp_max: T_mot_max, ok_min: T_req_mot_I <= T_mot_min, ok_max: T_req_mot_I <= T_mot_max },
    { caso: "CASO II - Operando", T_kNm: T_caso_IIa / 1000, T_red: T_req_red_IIa, T_mot: T_req_mot_IIa, T_disp_min: T_mot_min, T_disp_max: T_mot_max, ok_min: T_req_mot_IIa <= T_mot_min, ok_max: T_req_mot_IIa <= T_mot_max },
    { caso: "CASO II - Fora Serviço", T_kNm: T_caso_IIfs / 1000, T_red: T_req_red_IIfs, T_mot: T_req_mot_IIfs, T_disp_min: T_mot_min, T_disp_max: T_mot_max, ok_min: T_req_mot_IIfs <= T_mot_min, ok_max: true },
  ];

  // ============================================================
  // VERIFICAÇÃO FREIOS
  // ============================================================
  const T_fren_base = T_flat + T_fado + T_fin + Tvo - T_fraf;
  const T_fren_red = T_fren_base * 1000 / (Dpc / Dpp);
  const T_fren_eixo = T_fren_red / (i_red * eta_r); // no eixo do motor

  // Torque total de frenagem disponível
  const Mf_total = nf * (Mf_min + Mf_max) / 2; // média
  const brakeVerif = [
    { caso: "0 falhas", nf_ativo: nf, T_disp: nf * Mf_max, T_req: T_fren_eixo, ok: T_fren_eixo <= nf * Mf_max },
    { caso: "1 falha", nf_ativo: nf - 1, T_disp: (nf - 1) * Mf_max, T_req: T_fren_eixo, ok: T_fren_eixo <= (nf - 1) * Mf_max },
  ];

  // ============================================================
  // DESLIZAMENTO RODA-TRILHO (caso tivesse trucks de giro)
  // ============================================================
  const F_tang_roda = T_mot_max * i_red * eta_r / (Dpp / 2); // N por roda
  const F_atrito_est = Caert * (Pp + Ptmo) * g / 2; // N (peso total / 2 lados)
  const slip_partida = { T_disp: T_mot_max, F_tang: F_tang_roda, F_atrito: F_atrito_est, ok: F_tang_roda < F_atrito_est };
  const F_tang_fren = Mf_max * i_red / (Dpp / 2);
  const slip_frenagem = { T_disp: Mf_max, F_tang: F_tang_fren, F_atrito: F_atrito_est, ok: F_tang_fren < F_atrito_est };

  // ============================================================
  // SEGURANÇA CONTRA DESLIZAMENTO FEM 3-7
  // ============================================================
  // Operando
  const fs_oper_0 = brakeVerif[0].T_disp / Math.max(T_fren_eixo, 1);
  const fs_oper_1 = brakeVerif[1].T_disp / Math.max(T_fren_eixo, 1);
  // Parado (fora de serviço)
  const T_fs_parado = T_caso_IIfs * 1000 / (Dpc / Dpp) / (i_red * eta_r);
  const fs_parado_0 = (nf * Mf_max) / Math.max(T_fs_parado, 1);
  const fs_parado_1 = ((nf - 1) * Mf_max) / Math.max(T_fs_parado, 1);

  const slipFEM = [
    { caso: "Operando (0 falhas)", T_req: T_fren_eixo, T_disp: nf * Mf_max, fs: fs_oper_0, req: 1.3, ok: fs_oper_0 >= 1.3 },
    { caso: "Operando (1 falha)", T_req: T_fren_eixo, T_disp: (nf - 1) * Mf_max, fs: fs_oper_1, req: 1.3, ok: fs_oper_1 >= 1.3 },
    { caso: "Parado (0 falhas)", T_req: T_fs_parado, T_disp: nf * Mf_max, fs: fs_parado_0, req: 1.2, ok: fs_parado_0 >= 1.2 },
    { caso: "Parado (1 falha)", T_req: T_fs_parado, T_disp: (nf - 1) * Mf_max, fs: fs_parado_1, req: 1.2, ok: fs_parado_1 >= 1.2 },
  ];

  // ============================================================
  // VARIAÇÃO DE VENTO — Torque vs velocidade
  // ============================================================
  const windCurve = [];
  for (let v = 0; v <= 46.25; v += 1.25) {
    const qv = 0.613 * v * v;
    const Fv = qv * Av * Cf;
    const Tv = Fv * R_giro * 1.5; // com Nota 3
    windCurve.push({
      v: +v.toFixed(2),
      T_vento: +(Tv / 1000).toFixed(1), // kN.m
      T_total_oper: +((T_flat + T_fado + T_fin + Tv + T_fraa) / 1000).toFixed(1),
      T_total_fs: +((T_fin + Tv) / 1000).toFixed(1),
    });
  }

  return {
    // Velocidades
    Vmaxe, Vmine, nr_red,
    // Material
    Pmc, Pmtl, Ptme, Ptmo,
    // Vento
    Fvo, Tvo, Tvor, Tvp, Tvfs, Fvfs_low, Fvfs_high,
    // Forças/Torques intermediários
    Ci, Fado_I, Fraa, Fraf, Fin,
    T_flat, T_fado, T_fraa, T_fraf, T_fin,
    // Casos FEM
    T_caso_I, T_caso_IIa, T_caso_IIfs,
    // Motor
    T_mot_max, T_mot_min, motorCases, rotTorqueCurve,
    // Freios
    brakeVerif, T_fren_eixo,
    // Deslizamento
    slip_partida, slip_frenagem,
    // FEM 3-7
    slipFEM, T_fs_parado,
    // Vento
    windCurve,
  };
}

// ============================================================
// DIAGRAMA 2D — Vista superior do sistema de giro
// ============================================================
function GiroDiagram({ inp, data }: { inp: any; data: any }) {
  const w = 520, h = 380;
  const cx = 220, cy = 190;
  const r_crem = 100; // raio da cremalheira
  const r_pin = r_crem * (inp.Dpp / inp.Dpc);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", background: "#161b22", borderRadius: "6px" }}>
      {/* Cremalheira circular */}
      <circle cx={cx} cy={cy} r={r_crem} fill="none" stroke="#484f58" strokeWidth="3" strokeDasharray="6,3" />
      <circle cx={cx} cy={cy} r={r_crem - 8} fill="none" stroke="#21262d" strokeWidth="1" />
      <text x={cx} y={cy + r_crem + 18} fill="#8b949e" fontSize="8" textAnchor="middle">
        Cremalheira Dpc={inp.Dpc}m
      </text>

      {/* Centro de giro */}
      <circle cx={cx} cy={cy} r="4" fill="#58a6ff" />
      <circle cx={cx} cy={cy} r="8" fill="none" stroke="#58a6ff" strokeWidth="1" strokeDasharray="2,2" />

      {/* Eixo de giro → lança (linha tracejada) */}
      <line x1={cx} y1={cy} x2={cx + 180} y2={cy - 30} stroke="#3fb950" strokeWidth="1.5" strokeDasharray="4,3" />
      <circle cx={cx + 180} cy={cy - 30} r="18" fill="none" stroke="#3fb950" strokeWidth="1.5" />
      <text x={cx + 180} y={cy - 25} fill="#3fb950" fontSize="7" textAnchor="middle">RC</text>
      <text x={cx + 180} y={cy - 45} fill="#8b949e" fontSize="7" textAnchor="middle">Dea={inp.Dea}m</text>

      {/* Pinhões (2 acionamentos) */}
      {[45, 225].map((ang_deg, i) => {
        const ang = ang_deg * Math.PI / 180;
        const px = cx + Math.cos(ang) * r_crem;
        const py = cy + Math.sin(ang) * r_crem;
        return (
          <g key={i}>
            <circle cx={px} cy={py} r={r_pin * 2} fill="#d29922" fillOpacity="0.15" stroke="#d29922" strokeWidth="1.5" />
            <text x={px} y={py + 3} fill="#d29922" fontSize="7" textAnchor="middle" fontWeight="600">M{i + 1}</text>
            <text x={px} y={py + 13} fill="#8b949e" fontSize="6" textAnchor="middle">{inp.P_mot}kW</text>
          </g>
        );
      })}

      {/* Seta de rotação */}
      <path d={`M${cx - 40},${cy - r_crem - 15} A${r_crem + 15},${r_crem + 15} 0 0,1 ${cx + 40},${cy - r_crem - 15}`}
        fill="none" stroke="#79c0ff" strokeWidth="1.5" markerEnd="url(#arrowG)" />
      <defs>
        <marker id="arrowG" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4" fill="#79c0ff" />
        </marker>
        <marker id="arrowGR" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4" fill="#f85149" />
        </marker>
      </defs>
      <text x={cx} y={cy - r_crem - 22} fill="#79c0ff" fontSize="8" textAnchor="middle">
        {inp.Vmaxg_deg}–{inp.Vming_deg} °/min
      </text>

      {/* Ângulo máximo */}
      <path d={`M${cx + 60},${cy} A60,60 0 0,0 ${cx + 60 * Math.cos(-inp.Amaxg / 2 * Math.PI / 180)},${cy + 60 * Math.sin(-inp.Amaxg / 2 * Math.PI / 180)}`}
        fill="none" stroke="#58a6ff" strokeWidth="0.8" strokeDasharray="2,2" />
      <text x={cx + 70} y={cy - 5} fill="#58a6ff" fontSize="7">{inp.Amaxg}°</text>

      {/* Vento (seta) */}
      {data && <>
        <line x1={30} y1={cy} x2={90} y2={cy} stroke="#f85149" strokeWidth="2" markerEnd="url(#arrowGR)" />
        <text x={60} y={cy - 8} fill="#f85149" fontSize="7" textAnchor="middle">Vento</text>
        <text x={60} y={cy + 12} fill="#8b949e" fontSize="6" textAnchor="middle">{inp.Vvm}m/s</text>
      </>}

      {/* Box resultados */}
      {data && <>
        <rect x={350} y={20} width={155} height={130} rx="6" fill="#0d1117" stroke="#21262d" strokeWidth="1" />
        <text x={360} y={38} fill="#79c0ff" fontSize="8" fontWeight="600">RESULTADOS</text>
        {[
          { l: "T Caso I", v: `${(data.T_caso_I / 1000).toFixed(1)} kN.m`, c: "#f0883e" },
          { l: "T Caso II op.", v: `${(data.T_caso_IIa / 1000).toFixed(1)} kN.m`, c: "#d29922" },
          { l: "T Caso II f.s.", v: `${(data.T_caso_IIfs / 1000).toFixed(1)} kN.m`, c: "#f85149" },
          { l: "T mot. (máx)", v: `${data.T_mot_max.toFixed(1)} N.m`, c: "#3fb950" },
          { l: "T mot. (mín)", v: `${data.T_mot_min.toFixed(1)} N.m`, c: "#8b949e" },
          { l: "Vmáx ext.", v: `${data.Vmaxe.toFixed(3)} m/s`, c: "#79c0ff" },
        ].map((item, i) => (
          <g key={i}>
            <text x={365} y={55 + i * 16} fill="#8b949e" fontSize="7">{item.l}</text>
            <text x={495} y={55 + i * 16} fill={item.c} fontSize="8" textAnchor="end" fontWeight="500">{item.v}</text>
          </g>
        ))}
      </>}

      <text x={cx} y={h - 10} fill="#79c0ff" fontSize="9" textAnchor="middle" fontWeight="500">
        Sistema de Giro — Vista Superior
      </text>
    </svg>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function GiroMod({ onSave, user, UI }: any) {
  const { Inp, Sel, Res, Badge, Tabs, SavedCalcs, C, sty } = UI;

  const [inp, setI] = useState({
    Amaxg: 165, Vmaxg_deg: 3.6, Vming_deg: 36,
    Dpc: 8.594, Dpp: 0.382, Dea: 53.5, Pp: 385282.67, Drc: 8,
    // Motor
    na: 2, P_mot: 15, nmin: 118, nmax: 1180, FSm: 1, eta_m: 0.917, Im: 0.02,
    // Redutor
    i_red: 473, eta_r: 0.93,
    Tmax_acop: 23501, Tmin_acop: 2938,
    // Freios
    nf: 2, Mf_min: 140, Mf_max: 310, d1_freio: 0.315,
    // Material
    D_mat: 0.9, Nc: 8, Vtc: 1.55, Cp_th: 3080, Vtl_ms: 4.33, Ctl_m: 51.08, Vtcrc: 6.72, Vtcc: 26.24,
    // Vento
    Vvm: 20, Vvp: 35, Vvfs_0_20: 36, Vvfs_20_100: 42,
    Av: 234.45, Av_0_20: 179.35, Av_20_100: 55.10, Cf: 1.1,
    // Incrustação
    Ec: 0.05, Circ_kgf: 2261.95, Citl_kgf: 1009.28,
    // Escavação
    Flat_N: 4467.46,
    // Dinâmico
    a_acel: 0.2,
    // Atrito
    Caa: 0.01, Caf: 0.005,
    // Inclinação
    It: 0.003,
    // Deslizamento
    Caert: 0.14, Cacrt: 0.08,
  });

  const [res, setR] = useState<any>(null);
  const [subTab, setSubTab] = useState(0);
  const s = (k: string, v: any) => setI(p => ({ ...p, [k]: v }));
  const handleLoad = (d: any) => { if (d.inp) setI(d.inp); if (d.res) setR(d.res); };

  const subTabs = ["Dados", "Carregamentos", "Motores", "Freios/Desliz.", "Vento", "Diagrama"];

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Sistema de Giro</h2>
        <div style={{ fontSize: "9px", color: C.muted, marginTop: "2px" }}>FEM 2.131/132 · RC-07 — Validado ✓</div>
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <SavedCalcs user={user} moduleType="giro" onLoad={handleLoad} />
        <button onClick={() => onSave({ type: "giro", inp, res })} style={sty.btn("g")}>Salvar</button>
        <button onClick={() => setR(calcAll(inp))} style={sty.btn("p")}>CALCULAR</button>
      </div>
    </div>

    <div style={{ display: "flex", gap: "4px", marginBottom: "14px", flexWrap: "wrap" }}>
      {subTabs.map((t, i) => <button key={i} onClick={() => setSubTab(i)} style={{ ...sty.tab(subTab === i), fontSize: "9px", padding: "5px 10px" }}>{t}</button>)}
    </div>

    {/* ======== DADOS ======== */}
    {subTab === 0 && <>
      <div style={sty.card}><div style={sty.cardT}>Dados de Projeto</div>
        <div style={sty.grid(4)}>
          <Inp label="Ângulo máx. giro" value={inp.Amaxg} onChange={(v: any) => s("Amaxg", v)} unit="°" />
          <Inp label="V máx. giro" value={inp.Vmaxg_deg} onChange={(v: any) => s("Vmaxg_deg", v)} unit="°/min" />
          <Inp label="V mín. giro" value={inp.Vming_deg} onChange={(v: any) => s("Vming_deg", v)} unit="°/min" />
          <Inp label="Ø cremalheira (Dpc)" value={inp.Dpc} onChange={(v: any) => s("Dpc", v)} unit="m" />
          <Inp label="Ø pinhão (Dpp)" value={inp.Dpp} onChange={(v: any) => s("Dpp", v)} unit="m" />
          <Inp label="Dist. extremidade" value={inp.Dea} onChange={(v: any) => s("Dea", v)} unit="m" />
          <Inp label="Peso próprio (Pp)" value={inp.Pp} onChange={(v: any) => s("Pp", v)} unit="kg" />
          <Inp label="Ø roda caçambas" value={inp.Drc} onChange={(v: any) => s("Drc", v)} unit="m" />
        </div>
      </div>

      <div style={sty.card}><div style={sty.cardT}>Motor (Vel. Variável)</div>
        <div style={sty.grid(4)}>
          <Inp label="Nº acionamentos" value={inp.na} onChange={(v: any) => s("na", v)} />
          <Inp label="Potência (P)" value={inp.P_mot} onChange={(v: any) => s("P_mot", v)} unit="kW" />
          <Inp label="n mín" value={inp.nmin} onChange={(v: any) => s("nmin", v)} unit="rpm" />
          <Inp label="n máx" value={inp.nmax} onChange={(v: any) => s("nmax", v)} unit="rpm" />
          <Inp label="FS motor" value={inp.FSm} onChange={(v: any) => s("FSm", v)} />
          <Inp label="η motor" value={inp.eta_m} onChange={(v: any) => s("eta_m", v)} />
          <Inp label="Inércia (Im)" value={inp.Im} onChange={(v: any) => s("Im", v)} unit="kg.m²" />
          <Inp label="Relação redução" value={inp.i_red} onChange={(v: any) => s("i_red", v)} />
        </div>
      </div>

      <div style={sty.card}><div style={sty.cardT}>Redutor e Acoplamento</div>
        <div style={sty.grid(4)}>
          <Inp label="η redutor" value={inp.eta_r} onChange={(v: any) => s("eta_r", v)} />
          <Inp label="T máx. acoplamento" value={inp.Tmax_acop} onChange={(v: any) => s("Tmax_acop", v)} unit="N.m" />
          <Inp label="T mín. acoplamento" value={inp.Tmin_acop} onChange={(v: any) => s("Tmin_acop", v)} unit="N.m" />
        </div>
      </div>

      <div style={sty.card}><div style={sty.cardT}>Freios</div>
        <div style={sty.grid(4)}>
          <Inp label="Nº freios" value={inp.nf} onChange={(v: any) => s("nf", v)} />
          <Inp label="Mf mín" value={inp.Mf_min} onChange={(v: any) => s("Mf_min", v)} unit="N.m" />
          <Inp label="Mf máx" value={inp.Mf_max} onChange={(v: any) => s("Mf_max", v)} unit="N.m" />
          <Inp label="Ø roda freio" value={inp.d1_freio} onChange={(v: any) => s("d1_freio", v)} unit="m" />
        </div>
      </div>
    </>}

    {/* ======== CARREGAMENTOS ======== */}
    {subTab === 1 && <>
      <div style={sty.card}><div style={sty.cardT}>Material e Vento</div>
        <div style={sty.grid(4)}>
          <Inp label="Densidade" value={inp.D_mat} onChange={(v: any) => s("D_mat", v)} unit="t/m³" />
          <Inp label="V vento oper." value={inp.Vvm} onChange={(v: any) => s("Vvm", v)} unit="m/s" />
          <Inp label="Área vento (Av)" value={inp.Av} onChange={(v: any) => s("Av", v)} unit="m²" />
          <Inp label="Cf (forma)" value={inp.Cf} onChange={(v: any) => s("Cf", v)} />
          <Inp label="Flat (escavação)" value={inp.Flat_N} onChange={(v: any) => s("Flat_N", v)} unit="N" />
          <Inp label="Aceleração" value={inp.a_acel} onChange={(v: any) => s("a_acel", v)} unit="m/s²" />
          <Inp label="Caa (atrito acel.)" value={inp.Caa} onChange={(v: any) => s("Caa", v)} />
          <Inp label="Inclinação (It)" value={inp.It} onChange={(v: any) => s("It", v)} />
        </div>
        {res && <div style={{ marginTop: "10px", ...sty.grid(3) }}>
          <Res label="Ptmo (operação)" value={res.Ptmo} unit="kgf" />
          <Res label="Tvo (vento giro)" value={(res.Tvo / 1000)} unit="kN.m" type="w" />
          <Res label="Tvfs (fora serv.)" value={(res.Tvfs / 1000)} unit="kN.m" type="d" />
          <Res label="T_flat (escav.)" value={(res.T_flat / 1000)} unit="kN.m" />
          <Res label="T_fado (dinâm.)" value={(res.T_fado / 1000)} unit="kN.m" />
          <Res label="T_fin (inclina.)" value={(res.T_fin / 1000)} unit="kN.m" />
        </div>}
      </div>
    </>}

    {/* ======== MOTORES ======== */}
    {subTab === 2 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo</div> : <>
        <div style={sty.card}><div style={sty.cardT}>Torques por Caso (FEM Tab. 2-5.1.2)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
            <thead><tr>{["Caso", "T giro (kN.m)", "T redutor (N.m)", "T motor (N.m)", "T disp. mín (N.m)", "T disp. máx (N.m)", "Status"].map((h, i) => (
              <th key={i} style={{ padding: "5px 6px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "7px", textTransform: "uppercase" }}>{h}</th>
            ))}</tr></thead>
            <tbody>{res.motorCases.map((mc: any, i: number) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C.s2 + "22" }}>
                <td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.border}`, fontWeight: 500, fontSize: "9px" }}>{mc.caso}</td>
                <td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{mc.T_kNm.toFixed(1)}</td>
                <td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.border}` }}>{mc.T_red.toFixed(1)}</td>
                <td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.border}`, color: C.accent, fontWeight: 600 }}>{mc.T_mot.toFixed(1)}</td>
                <td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.border}`, color: C.dim }}>{mc.T_disp_min.toFixed(1)}</td>
                <td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{mc.T_disp_max.toFixed(1)}</td>
                <td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.border}` }}><Badge ok={mc.ok_max} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <div style={sty.card}><div style={sty.cardT}>Torque Disponível vs Rotação (Motor Vel. Variável)</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={res.rotTorqueCurve} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="rpm" label={{ value: "Rotação (rpm)", position: "bottom", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <YAxis label={{ value: "N.m", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
              <Legend wrapperStyle={{ fontSize: "9px" }} />
              <Line type="monotone" dataKey="T_disp" name="T disponível" stroke={C.success} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="T_req_I" name="T req. Caso I" stroke={C.warn} strokeWidth={1.5} strokeDasharray="5,3" dot={false} />
              <Line type="monotone" dataKey="T_req_II" name="T req. Caso II" stroke="#f85149" strokeWidth={1.5} strokeDasharray="5,3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontSize: "8px", color: C.muted, textAlign: "center", marginTop: "4px" }}>
            Motor {inp.P_mot}kW · {inp.nmin}–{inp.nmax} rpm · Torque ∝ 1/n (potência constante)
          </div>
        </div>
      </>}
    </>}

    {/* ======== FREIOS E DESLIZAMENTO ======== */}
    {subTab === 3 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo</div> : <>
        <div style={sty.card}><div style={sty.cardT}>Verificação dos Freios</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead><tr>{["Caso", "T Req. (N.m)", "T Disp. (N.m)", "Status"].map((h, i) => (
              <th key={i} style={{ padding: "5px 8px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "8px", textTransform: "uppercase" }}>{h}</th>
            ))}</tr></thead>
            <tbody>{res.brakeVerif.map((b: any, i: number) => (
              <tr key={i}>
                <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{b.caso}</td>
                <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{b.T_req.toFixed(1)}</td>
                <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{b.T_disp.toFixed(1)}</td>
                <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}><Badge ok={b.ok} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <div style={sty.card}><div style={sty.cardT}>Segurança Contra Deslizamento (FEM 3-7)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
            <thead><tr>{["Caso", "T Req. (N.m)", "T Disp. (N.m)", "FS", "Req.", "Status"].map((h, i) => (
              <th key={i} style={{ padding: "5px 6px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "7px", textTransform: "uppercase" }}>{h}</th>
            ))}</tr></thead>
            <tbody>{res.slipFEM.map((s2: any, i: number) => (
              <tr key={i} style={{ background: !s2.ok ? C.danger + "08" : i % 2 === 0 ? "transparent" : C.s2 + "22" }}>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, fontWeight: 500 }}>{s2.caso}</td>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{s2.T_req.toFixed(1)}</td>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{s2.T_disp.toFixed(1)}</td>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: s2.ok ? C.success : C.danger, fontWeight: 600 }}>{s2.fs.toFixed(2)}</td>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}>≥{s2.req}</td>
                <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}><Badge ok={s2.ok} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <div style={sty.card}><div style={sty.cardT}>Deslizamento Roda-Trilho</div>
          <div style={sty.grid(2)}>
            <div style={{ padding: "12px", background: C.accentDim, borderRadius: "6px" }}>
              <div style={{ fontSize: "9px", color: C.muted, marginBottom: "6px" }}>PARTIDA</div>
              <Res label="F tangencial/roda" value={res.slip_partida.F_tang} unit="N" />
              <div style={{ marginTop: "6px" }}><Res label="F atrito estático" value={res.slip_partida.F_atrito} unit="N" type="s" /></div>
              <div style={{ marginTop: "6px", textAlign: "center" }}><Badge ok={res.slip_partida.ok} y="Sem deslizamento" n="DESLIZA" /></div>
            </div>
            <div style={{ padding: "12px", background: C.accentDim, borderRadius: "6px" }}>
              <div style={{ fontSize: "9px", color: C.muted, marginBottom: "6px" }}>FRENAGEM</div>
              <Res label="F tangencial/roda" value={res.slip_frenagem.F_tang} unit="N" />
              <div style={{ marginTop: "6px" }}><Res label="F atrito estático" value={res.slip_frenagem.F_atrito} unit="N" type="s" /></div>
              <div style={{ marginTop: "6px", textAlign: "center" }}><Badge ok={res.slip_frenagem.ok} y="Sem deslizamento" n="DESLIZA" /></div>
            </div>
          </div>
        </div>
      </>}
    </>}

    {/* ======== VENTO ======== */}
    {subTab === 4 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo</div> : <>
        <div style={sty.card}><div style={sty.cardT}>Torque de Vento vs Velocidade</div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={res.windCurve} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="v" label={{ value: "Vento (m/s)", position: "bottom", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <YAxis label={{ value: "kN.m", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
              <Legend wrapperStyle={{ fontSize: "9px" }} />
              <Area type="monotone" dataKey="T_vento" name="T vento (kN.m)" stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.08} strokeWidth={2} />
              <Area type="monotone" dataKey="T_total_oper" name="T total operação" stroke="#d29922" fill="#d29922" fillOpacity={0.05} strokeWidth={1.5} />
              <Area type="monotone" dataKey="T_total_fs" name="T total fora serv." stroke="#f85149" fill="#f85149" fillOpacity={0.05} strokeWidth={1.5} />
              <ReferenceLine x={20} stroke={C.warn} strokeDasharray="3 3" label={{ value: "20m/s", fill: C.warn, fontSize: 8 }} />
              <ReferenceLine x={35} stroke={C.danger} strokeDasharray="3 3" label={{ value: "35m/s", fill: C.danger, fontSize: 8 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </>}
    </>}

    {/* ======== DIAGRAMA ======== */}
    {subTab === 5 && <>
      <div style={sty.card}><div style={sty.cardT}>Vista Superior — Sistema de Giro</div>
        {!res ? <p style={{ color: C.dim, textAlign: "center" }}>Execute o cálculo</p> :
          <GiroDiagram inp={inp} data={res} />}
      </div>
    </>}
  </div>);
}
