// app/modules/translacao.tsx
// ============================================================
// MÓDULO: ACIONAMENTO DA TRANSLAÇÃO — FEM 2.131/132
// Recuperadora de Roda de Caçambas RC-07
// ============================================================
"use client";
import { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, Cell, ScatterChart, Scatter, ZAxis } from "recharts";

export const CONFIG = {
  id: "translacao", name: "Acionamento da Translação", subtitle: "FEM 2.131/132",
  icon: "⟐", color: "#f0883e", price: 399.90,
  description: "Cálculo completo do acionamento de translação de recuperadoras de roda de caçambas conforme FEM 2.131/132. Carregamentos de vento, material, incrustação, escavação, forças dinâmicas. Verificação de motores (Casos I/II/III), freios (análise de falha 0-18), distância de frenagem, segurança contra deslizamento (FEM 3-7).",
  norma: "FEM 2.131/132 · FEM 3-7 · NBR 8400",
};

export const GLOSSARY = [
  { cat: "DADOS DE PROJETO", items: [
    { s: "nr", d: "Número total de rodas de translação", u: "-" },
    { s: "na", d: "Número de rodas acionadas", u: "-" },
    { s: "Dr", d: "Diâmetro das rodas de translação", u: "m" },
    { s: "Vt", d: "Velocidade nominal de translação", u: "m/s" },
    { s: "Pp", d: "Peso próprio da recuperadora", u: "kgf" },
    { s: "Drc", d: "Diâmetro da roda de caçambas", u: "m" },
  ]},
  { cat: "MOTORES E REDUTORES", items: [
    { s: "Pm", d: "Potência do motor de translação", u: "kW" },
    { s: "n1", d: "Rotação síncrona do motor", u: "rpm" },
    { s: "T1", d: "Torque no eixo de saída do motor", u: "N.m" },
    { s: "ηm/ηr", d: "Rendimento do motor / redutor", u: "-" },
    { s: "i", d: "Relação de redução do redutor", u: "-" },
    { s: "T2", d: "Torque na saída do redutor", u: "N.m" },
    { s: "FSm/FSr", d: "Fator de serviço motor / redutor", u: "-" },
  ]},
  { cat: "FREIOS E GARRAS", items: [
    { s: "nf", d: "Número de freios", u: "-" },
    { s: "Tf", d: "Torque de frenagem por freio", u: "N.m" },
    { s: "tr", d: "Tempo de resposta de frenagem", u: "s" },
    { s: "ngt", d: "Número de garras trilho", u: "-" },
    { s: "Fgt", d: "Força por garra trilho", u: "N" },
  ]},
  { cat: "CARREGAMENTOS FEM", items: [
    { s: "Ptme", d: "Peso total material (entupimento)", u: "kgf" },
    { s: "Ptmo", d: "Peso total material (operação)", u: "kgf" },
    { s: "Fmvo", d: "Força do vento em operação (20m/s)", u: "N" },
    { s: "Fmvor", d: "Força vento operação reduzida (q/3)", u: "N" },
    { s: "Fvfs", d: "Força vento fora de serviço (36-42m/s)", u: "N" },
    { s: "Ci", d: "Carga de incrustação total", u: "kgf" },
    { s: "Flat", d: "Força lateral de escavação", u: "N" },
    { s: "Fad", d: "Força aceleração/desaceleração", u: "N" },
    { s: "Fraa", d: "Resistência atrito (aceleração)", u: "N" },
    { s: "Fraf", d: "Resistência atrito (frenagem)", u: "N" },
    { s: "Fin", d: "Resistência inclinação do trilho", u: "N" },
    { s: "Fb", d: "Força de bloqueio (2 rodas)", u: "N" },
  ]},
  { cat: "RESULTADOS", items: [
    { s: "F_caso_I", d: "Força total Caso I (FEM Tab. 2-5.1.3)", u: "N" },
    { s: "F_caso_IIa", d: "Força total Caso II operando", u: "N" },
    { s: "F_caso_IIb", d: "Força total Caso II fora de serviço", u: "N" },
    { s: "T_req", d: "Torque requerido por acionamento", u: "N.m" },
    { s: "FS_desliz", d: "Fator segurança contra deslizamento", u: "-" },
    { s: "d_fren", d: "Distância de frenagem", u: "m" },
    { s: "n_falha_max", d: "Nº máx. freios em falha (FS≥1.3)", u: "-" },
  ]},
];

// ============================================================
// CÁLCULOS FEM 2.131/132
// ============================================================
const g = 9.81;

function calcWind(V: number, Av: number, Cf: number) {
  const q = 0.613 * V * V; // pressão aerodinâmica N/m²
  return q * Av * Cf;       // força N
}

function calcAll(inp: any) {
  const { nr, na, Dr, Vt, Pp, Drc, Pm, n1, eta_m, FSm, Im, n2_rpm, T2_nom, eta_r, FSr, i_red,
    nf, Tf, tr, ngt, Fgt_unit, D_mat, Nc, Vtc, Cp_th, Vtl_ms, Ctl_m, Vtcrc, Vtcc,
    Vvm, Vvp, Vvfs_0_20, Vvfs_20_100, Av, Av_0_20, Av_20_100, Cf, Ec,
    Circ_kgf, Citl_kgf, Flat_N, a_acel, Caa, Caf, Cart, Cmr, nrb, It,
    Hy_N, Df_lim } = inp;

  // --- Peso de Material ---
  const Pmc = D_mat * 1000 * Nc * Vtc;  // kgf na roda de caçambas
  const Pmtl = Cp_th * 1000 / (3600 * Vtl_ms) * Ctl_m; // kgf transportador lança
  const Pmcrce = D_mat * 1000 * Vtcrc; // kgf chute roda caçamba (entupimento)
  const Pmcce = D_mat * 1000 * Vtcc;   // kgf chute central (entupimento)
  const Ptme = Pmc + Pmtl + Pmcrce + Pmcce; // peso total material entupimento
  const Ptmo = Pmc + Pmtl + D_mat * 1000 * Vtcrc * 0.5; // operação (sem entupimento total)

  // --- Peso total por caso ---
  const Pp_N = Pp * g;
  const Ptme_N = Ptme * g;
  const Ptmo_N = Ptmo * g;

  // --- Carga de Vento ---
  const qmo = 0.613 * Vvm * Vvm;
  const qmor = qmo / 3;
  const Fmvo = qmo * Av * Cf;
  const Fmvor = qmor * Av * Cf;
  const Fvp = 0.613 * Vvp * Vvp * Av * Cf;
  const Fvfs_low = 0.613 * Vvfs_0_20 * Vvfs_0_20 * Av_0_20 * Cf;
  const Fvfs_high = 0.613 * Vvfs_20_100 * Vvfs_20_100 * Av_20_100 * Cf;

  // --- Incrustação ---
  const Ci = (Circ_kgf + Citl_kgf) * g; // N

  // --- Forças Dinâmicas ---
  const Fado_pp = (Pp) * a_acel; // apenas peso próprio (N) — Pp já em kgf, converter
  const Fado_I = (Pp + Ptmo) * a_acel;
  const Fade_III = (Pp + Ptme) * a_acel;

  // --- Atrito Rolamentos ---
  const Fraa_pp = Caa * Pp * g;
  const Fraa_I = Caa * (Pp + Ptmo) * g;
  const Fraa_III = Caa * (Pp + Ptme) * g;
  const Fraf_pp = Caf * Pp * g;
  const Fraf_I = Caf * (Pp + Ptmo) * g;
  const Fraf_III = Caf * (Pp + Ptme) * g;

  // --- Inclinação ---
  const Fin_pp = It * Pp * g;
  const Fin_I = It * (Pp + Ptmo) * g;
  const Fin_III = It * (Pp + Ptme) * g;

  // --- Bloqueio ---
  const Fb = Cart * Cmr * nrb;

  // --- Resistência Freios ---
  const Tfr = Tf * eta_m; // torque efetivo por freio
  const Frm_total = nf * Tfr * 2 / Dr; // força total de frenagem (N)

  // --- Garras Trilho ---
  const Frgt = ngt * Fgt_unit;

  // ============================================================
  // TABELA FEM 2-5.1.3 — VERIFICAÇÃO MOTORES
  // ============================================================
  const F_caso_I = Flat_N + Fado_I + Fin_I + Fmvor + Hy_N + Fraa_I;
  const F_caso_IIa = Flat_N + Fin_I + Fmvo + Hy_N + Fraa_I; // operando
  const F_caso_IIb = Fin_I + Fb + Fraa_I; // operando b
  const F_caso_IIfs = Fin_I + Fvfs_low + Fvfs_high + Fraa_I; // fora de serviço

  // Torque requerido
  const T_req_total = (f: number) => f * Dr / 2;
  const T_req_per_drive = (f: number) => T_req_total(f) / na;

  // Torque disponível do motor
  const T1 = Pm * 1000 / (n1 * 2 * Math.PI / 60);
  const T1r = T1 * eta_m;
  const T2r = T2_nom * eta_r;
  const T_disp = T2r; // torque disponível por acionamento na saída do redutor
  const T_disp_fs = T_disp * FSm;

  // Motor verification
  const motorCases = [
    { caso: "CASO I", F: F_caso_I, T_req: T_req_per_drive(F_caso_I), ok: T_req_per_drive(F_caso_I) <= T_disp },
    { caso: "CASO II - Operando (a)", F: F_caso_IIa, T_req: T_req_per_drive(F_caso_IIa), ok: T_req_per_drive(F_caso_IIa) <= T_disp },
    { caso: "CASO II - Operando (b)", F: F_caso_IIb, T_req: T_req_per_drive(F_caso_IIb), ok: T_req_per_drive(F_caso_IIb) <= T_disp },
    { caso: "CASO II - Fora de Serviço", F: F_caso_IIfs, T_req: T_req_per_drive(F_caso_IIfs), ok: true }, // usado para deslizamento
  ];

  // ============================================================
  // VERIFICAÇÃO DE FREIOS — Falha de 0 a 18
  // ============================================================
  const F_fren_base = Flat_N + Fado_I + Fin_I + Fmvo - Fraf_I; // Caso II operando para frenagem

  const brakeAnalysis = [];
  for (let fail = 0; fail <= nf; fail++) {
    const nf_ativo = nf - fail;
    const F_disp_freio = nf_ativo * Tfr * 2 / Dr;
    const T_req_per_brake = F_fren_base > 0 ? (T_req_total(F_fren_base) / Math.max(nf_ativo, 1)) : 0;
    const ok = nf_ativo > 0 ? (T_req_per_brake <= Tfr) : false;

    // Distância de frenagem
    const F_result = F_disp_freio - F_fren_base;
    const d_fren = F_result > 0 ? (0.5 * (Pp + Ptmo) * Vt * Vt / F_result + Vt * tr) : (F_result === 0 ? Infinity : -1);

    // Fator FEM 3-7
    const fs_desliz = F_fren_base > 0 ? F_disp_freio / F_fren_base : Infinity;

    brakeAnalysis.push({
      fail, nf_ativo,
      F_req: F_fren_base,
      F_disp: F_disp_freio,
      F_result,
      T_req_brake: T_req_per_brake,
      d_fren: d_fren > 0 ? d_fren : null,
      d_ok: d_fren > 0 && d_fren <= Df_lim,
      fs_desliz,
      fs_ok: fs_desliz >= 1.3,
      ok,
    });
  }

  // Max falhas mantendo FS >= 1.3
  const maxFailFS = brakeAnalysis.filter(b => b.fs_ok).length - 1;
  // Max falhas mantendo distância <= 1m
  const maxFailDist = brakeAnalysis.filter(b => b.d_ok).length - 1;

  // ============================================================
  // SEGURANÇA CONTRA DESLIZAMENTO — Parado (com garras)
  // ============================================================
  const F_fs_parado = Fin_III + Fvfs_low + Fvfs_high - Fraf_III;
  const slipAnalysis = [];
  for (let fail = 0; fail <= nf; fail++) {
    const nf_ativo = nf - fail;
    const F_disp = nf_ativo * Tfr * 2 / Dr + Frgt;
    const fs = F_fs_parado > 0 ? F_disp / F_fs_parado : Infinity;
    slipAnalysis.push({ fail, F_disp, F_req: F_fs_parado, fs, ok: fs >= 1.2 });
  }
  const maxFailSlipParado = slipAnalysis.filter(s => s.ok).length - 1;

  // ============================================================
  // VARIAÇÃO DE VENTO — Distância de frenagem
  // ============================================================
  const windCurve = [];
  for (let v = 0; v <= 25; v += 1.25) {
    const Fv = calcWind(v, Av, Cf);
    const F_req = Fin_I + Fv + Fraa_I - Fraf_I + Fado_I;
    // com todos os freios
    const F_disp = Frm_total;
    const F_res = F_disp - F_req;
    const d = F_res > 0 ? (0.5 * (Pp + Ptmo) * Vt * Vt / F_res + Vt * tr) : -1;
    windCurve.push({ v, F_req, F_disp, d: d > 0 ? +d.toFixed(4) : null, ok: d > 0 && d <= Df_lim });
  }

  return {
    // Material
    Pmc, Pmtl, Pmcrce, Pmcce, Ptme, Ptmo,
    // Vento
    qmo, Fmvo, Fmvor, Fvp, Fvfs_low, Fvfs_high,
    // Incrustação
    Ci,
    // Dinâmicas
    Fado_pp, Fado_I, Fade_III,
    // Atrito
    Fraa_I, Fraf_I, Fin_I,
    // Bloqueio e freios
    Fb, Frm_total, Frgt, Tfr,
    // Casos FEM
    F_caso_I, F_caso_IIa, F_caso_IIb, F_caso_IIfs,
    // Motor
    T1, T1r, T_disp, T_disp_fs, motorCases,
    // Freios
    brakeAnalysis, maxFailFS, maxFailDist,
    // Deslizamento parado
    slipAnalysis, maxFailSlipParado,
    // Vento variação
    windCurve,
  };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function TranslacaoMod({ onSave, user, UI }: any) {
  const { Inp, Sel, Res, Badge, C, sty, ModuleHeader, ModuleWrap } = UI;

  const [inp, setI] = useState({
    // Projeto
    nr: 42, na: 18, Dr: 0.5, Vt: 0.497, Pp: 561555.65, Drc: 8,
    // Motor
    Pm: 7.5, n1: 1770, eta_m: 0.913, FSm: 1.15, Im: 0.035,
    // Redutor
    n2_rpm: 19, T2_nom: 3803, eta_r: 0.93, FSr: 2, i_red: 93.18,
    // Freios
    nf: 18, Tf: 100, tr: 0.5,
    // Garras
    ngt: 2, Fgt_unit: 250000,
    // Material
    D_mat: 0.9, Nc: 8, Vtc: 1.55, Cp_th: 3080, Vtl_ms: 4.33, Ctl_m: 51.08, Vtcrc: 6.72, Vtcc: 26.24,
    // Vento
    Vvm: 20, Vvp: 35, Vvfs_0_20: 36, Vvfs_20_100: 42,
    Av: 339.72, Av_0_20: 284.62, Av_20_100: 55.10, Cf: 1.1,
    // Incrustação
    Ec: 0.05, Circ_kgf: 2261.95, Citl_kgf: 1009.28,
    // Escavação
    Flat_N: 4467.46,
    // Dinâmico
    a_acel: 0.2,
    // Atrito
    Caa: 0.01, Caf: 0.005,
    // Bloqueio
    Cart: 0.2, Cmr: 245250, nrb: 2,
    // Inclinação
    It: 0.003,
    // Forças especiais
    Hy_N: 49050,
    // Distância limite
    Df_lim: 1.0,
  });

  const [res, setR] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [subTab, setSubTab] = useState(0);
  const s = (k: string, v: any) => setI(p => ({ ...p, [k]: v }));

  const handleCalc = () => setR(calcAll(inp));
  const handleLoad = (d: any) => { if (d.inp) setI(d.inp); if (d.res) setR(d.res); };

  // Sub-tabs for the calculation view
  const subTabs = ["Dados", "Carregamentos", "Motores", "Freios", "Deslizamento", "Vento"];

  const gbtn = { background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, padding: "8px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
  const tabSty = (a: boolean) => ({ background: a ? C.bg : "transparent", color: a ? C.accent : C.dim, border: `1px solid ${a ? C.border : "transparent"}`, borderBottom: a ? `1px solid ${C.bg}` : "1px solid transparent", borderRadius: "6px 6px 0 0", padding: "7px 14px", fontSize: 11, fontWeight: a ? 700 : 500, cursor: "pointer", fontFamily: "inherit", marginBottom: -1 });

  return (<ModuleWrap>
    <ModuleHeader icon="⟐" name="Acionamento da Translação" norma="FEM 2.131/132 · FEM 3-7 · NBR 8400" color="#f0883e" user={user} moduleType="translacao" onSave={() => onSave({ type: "translacao", inp, res })} onLoad={handleLoad}>
      <button onClick={handleCalc} style={gbtn}>CALCULAR</button>
    </ModuleHeader>

    {/* Sub-tabs */}
    <div style={{ display: "flex", gap: 4, padding: "8px 10px 0", background: C.s1, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", marginBottom: 14 }}>
      {subTabs.map((t, i) => (
        <button key={i} onClick={() => setSubTab(i)} style={tabSty(subTab === i)}>{t}</button>
      ))}
    </div>

    <div style={{ padding: 14 }}>
    {/* ======== DADOS DE ENTRADA ======== */}
    {subTab === 0 && <>
      <div style={sty.card}><div style={sty.cardT}>Dados de Projeto</div>
        <div style={sty.grid(4)}>
          <Inp label="Nº rodas (nr)" value={inp.nr} onChange={(v: any) => s("nr", v)} />
          <Inp label="Rodas acionadas (na)" value={inp.na} onChange={(v: any) => s("na", v)} />
          <Inp label="Ø rodas (Dr)" value={inp.Dr} onChange={(v: any) => s("Dr", v)} unit="m" />
          <Inp label="Vel. translação (Vt)" value={inp.Vt} onChange={(v: any) => s("Vt", v)} unit="m/s" />
          <Inp label="Peso próprio (Pp)" value={inp.Pp} onChange={(v: any) => s("Pp", v)} unit="kgf" />
          <Inp label="Ø roda caçambas" value={inp.Drc} onChange={(v: any) => s("Drc", v)} unit="m" />
          <Inp label="Aceleração (a)" value={inp.a_acel} onChange={(v: any) => s("a_acel", v)} unit="m/s²" />
          <Inp label="Dist. fren. limite" value={inp.Df_lim} onChange={(v: any) => s("Df_lim", v)} unit="m" />
        </div>
      </div>

      <div style={sty.card}><div style={sty.cardT}>Motores da Translação</div>
        <div style={sty.grid(4)}>
          <Inp label="Potência (Pm)" value={inp.Pm} onChange={(v: any) => s("Pm", v)} unit="kW" />
          <Inp label="Rotação (n1)" value={inp.n1} onChange={(v: any) => s("n1", v)} unit="rpm" />
          <Inp label="Rendimento motor" value={inp.eta_m} onChange={(v: any) => s("eta_m", v)} />
          <Inp label="FS motor" value={inp.FSm} onChange={(v: any) => s("FSm", v)} />
          <Inp label="Inércia motor" value={inp.Im} onChange={(v: any) => s("Im", v)} unit="kg.m²" />
        </div>
      </div>

      <div style={sty.card}><div style={sty.cardT}>Redutores</div>
        <div style={sty.grid(4)}>
          <Inp label="Rotação saída (n2)" value={inp.n2_rpm} onChange={(v: any) => s("n2_rpm", v)} unit="rpm" />
          <Inp label="Torque saída (T2)" value={inp.T2_nom} onChange={(v: any) => s("T2_nom", v)} unit="N.m" />
          <Inp label="Rendimento red." value={inp.eta_r} onChange={(v: any) => s("eta_r", v)} />
          <Inp label="Relação redução" value={inp.i_red} onChange={(v: any) => s("i_red", v)} />
          <Inp label="FS redutor" value={inp.FSr} onChange={(v: any) => s("FSr", v)} />
        </div>
      </div>

      <div style={sty.card}><div style={sty.cardT}>Freios e Garras Trilho</div>
        <div style={sty.grid(4)}>
          <Inp label="Nº freios (nf)" value={inp.nf} onChange={(v: any) => s("nf", v)} />
          <Inp label="Torque freio (Tf)" value={inp.Tf} onChange={(v: any) => s("Tf", v)} unit="N.m" />
          <Inp label="Tempo resposta" value={inp.tr} onChange={(v: any) => s("tr", v)} unit="s" />
          <Inp label="Nº garras trilho" value={inp.ngt} onChange={(v: any) => s("ngt", v)} />
          <Inp label="Força/garra" value={inp.Fgt_unit} onChange={(v: any) => s("Fgt_unit", v)} unit="N" />
        </div>
      </div>

      <div style={sty.card}><div style={sty.cardT}>Coeficientes de Atrito e Inclinação</div>
        <div style={sty.grid(4)}>
          <Inp label="Caa (aceleração)" value={inp.Caa} onChange={(v: any) => s("Caa", v)} />
          <Inp label="Caf (frenagem)" value={inp.Caf} onChange={(v: any) => s("Caf", v)} />
          <Inp label="Cart (roda-trilho)" value={inp.Cart} onChange={(v: any) => s("Cart", v)} />
          <Inp label="Cmr (carga/roda)" value={inp.Cmr} onChange={(v: any) => s("Cmr", v)} unit="N" />
          <Inp label="Rodas bloq. (nrb)" value={inp.nrb} onChange={(v: any) => s("nrb", v)} />
          <Inp label="Inclinação (It)" value={inp.It} onChange={(v: any) => s("It", v)} />
          <Inp label="Hy (força/roda)" value={inp.Hy_N} onChange={(v: any) => s("Hy_N", v)} unit="N" />
        </div>
      </div>
    </>}

    {/* ======== CARREGAMENTOS FEM ======== */}
    {subTab === 1 && <>
      <div style={sty.card}><div style={sty.cardT}>Material (FEM 2-2.1.2)</div>
        <div style={sty.grid(4)}>
          <Inp label="Densidade (D)" value={inp.D_mat} onChange={(v: any) => s("D_mat", v)} unit="t/m³" />
          <Inp label="Nº caçambas" value={inp.Nc} onChange={(v: any) => s("Nc", v)} />
          <Inp label="Vol. caçambas" value={inp.Vtc} onChange={(v: any) => s("Vtc", v)} unit="m³" />
          <Inp label="Cap. pico TC" value={inp.Cp_th} onChange={(v: any) => s("Cp_th", v)} unit="t/h" />
          <Inp label="Vel. TC lança" value={inp.Vtl_ms} onChange={(v: any) => s("Vtl_ms", v)} unit="m/s" />
          <Inp label="Comp. TC lança" value={inp.Ctl_m} onChange={(v: any) => s("Ctl_m", v)} unit="m" />
          <Inp label="Vol. chute RC" value={inp.Vtcrc} onChange={(v: any) => s("Vtcrc", v)} unit="m³" />
          <Inp label="Vol. chute central" value={inp.Vtcc} onChange={(v: any) => s("Vtcc", v)} unit="m³" />
        </div>
        {res && <div style={{ marginTop: "10px", ...sty.grid(3) }}>
          <Res label="Pmc (caçambas)" value={res.Pmc} unit="kgf" />
          <Res label="Pmtl (TC lança)" value={res.Pmtl} unit="kgf" />
          <Res label="Ptme (entupim.)" value={res.Ptme} unit="kgf" type="w" />
          <Res label="Ptmo (operação)" value={res.Ptmo} unit="kgf" type="s" />
        </div>}
      </div>

      <div style={sty.card}><div style={sty.cardT}>Vento (FEM 2-2.2.1)</div>
        <div style={sty.grid(4)}>
          <Inp label="V operação" value={inp.Vvm} onChange={(v: any) => s("Vvm", v)} unit="m/s" />
          <Inp label="V projeto" value={inp.Vvp} onChange={(v: any) => s("Vvp", v)} unit="m/s" />
          <Inp label="V fora serv. 0-20m" value={inp.Vvfs_0_20} onChange={(v: any) => s("Vvfs_0_20", v)} unit="m/s" />
          <Inp label="V fora serv. 20-100m" value={inp.Vvfs_20_100} onChange={(v: any) => s("Vvfs_20_100", v)} unit="m/s" />
          <Inp label="Área total (Av)" value={inp.Av} onChange={(v: any) => s("Av", v)} unit="m²" />
          <Inp label="Av 0-20m" value={inp.Av_0_20} onChange={(v: any) => s("Av_0_20", v)} unit="m²" />
          <Inp label="Av 20-100m" value={inp.Av_20_100} onChange={(v: any) => s("Av_20_100", v)} unit="m²" />
          <Inp label="Cf (forma)" value={inp.Cf} onChange={(v: any) => s("Cf", v)} />
        </div>
        {res && <div style={{ marginTop: "10px", ...sty.grid(3) }}>
          <Res label="Fmvo (20m/s)" value={res.Fmvo} unit="N" />
          <Res label="Fmvor (q/3)" value={res.Fmvor} unit="N" />
          <Res label="Fvfs (36+42m/s)" value={res.Fvfs_low + res.Fvfs_high} unit="N" type="w" />
        </div>}
      </div>

      <div style={sty.card}><div style={sty.cardT}>Incrustação e Escavação</div>
        <div style={sty.grid(4)}>
          <Inp label="Esp. camada (Ec)" value={inp.Ec} onChange={(v: any) => s("Ec", v)} unit="m" />
          <Inp label="Ci roda caçamba" value={inp.Circ_kgf} onChange={(v: any) => s("Circ_kgf", v)} unit="kgf" />
          <Inp label="Ci TC lança" value={inp.Citl_kgf} onChange={(v: any) => s("Citl_kgf", v)} unit="kgf" />
          <Inp label="Flat (escavação)" value={inp.Flat_N} onChange={(v: any) => s("Flat_N", v)} unit="N" />
        </div>
        {res && <div style={{ marginTop: "10px", ...sty.grid(3) }}>
          <Res label="Ci total" value={res.Ci} unit="N" />
          <Res label="Fad Caso I" value={res.Fado_I} unit="N" />
          <Res label="Fin inclinação" value={res.Fin_I} unit="N" />
        </div>}
      </div>
    </>}

    {/* ======== VERIFICAÇÃO MOTORES ======== */}
    {subTab === 2 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo primeiro</div> : <>
        <div style={sty.card}><div style={sty.cardT}>Forças por Caso de Carregamento (FEM Tab. 2-5.1.3)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead><tr>{["Caso", "Força Total (N)", "Torque Req. (N.m)", "Torque/Acion. (N.m)", "T Disp. (N.m)", "Status"].map((h, i) => (
              <th key={i} style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "8px", textTransform: "uppercase" }}>{h}</th>
            ))}</tr></thead>
            <tbody>{res.motorCases.map((mc: any, i: number) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C.s2 + "44" }}>
                <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 500 }}>{mc.caso}</td>
                <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{mc.F.toFixed(0)}</td>
                <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>{(mc.F * inp.Dr / 2).toFixed(1)}</td>
                <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: C.accent }}>{mc.T_req.toFixed(1)}</td>
                <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{res.T_disp.toFixed(1)}</td>
                <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}><Badge ok={mc.ok} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <div style={sty.card}><div style={sty.cardT}>Dados do Motor</div>
          <div style={sty.grid(3)}>
            <Res label="T1 (motor)" value={res.T1} unit="N.m" />
            <Res label="T1r (c/ rendim.)" value={res.T1r} unit="N.m" />
            <Res label="T2r (redutor)" value={res.T_disp} unit="N.m" type="s" />
            <Res label="T disp. c/ FS" value={res.T_disp_fs} unit="N.m" type="s" />
            <Res label="Frm total freios" value={res.Frm_total} unit="N" />
            <Res label="Frgt garras" value={res.Frgt} unit="N" />
          </div>
        </div>

        {/* Gráfico de forças por caso */}
        <div style={sty.card}><div style={sty.cardT}>Forças por Caso de Carregamento</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={res.motorCases.map((mc: any) => ({ name: mc.caso.replace("CASO ", "").substring(0, 12), F: +(mc.F / 1000).toFixed(1), T: +mc.T_req.toFixed(1) }))} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 8 }} stroke={C.border} />
              <YAxis tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} label={{ value: "kN", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
              <Bar dataKey="F" name="Força (kN)" fill={C.accent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>}
    </>}

    {/* ======== VERIFICAÇÃO FREIOS ======== */}
    {subTab === 3 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo primeiro</div> : <>
        <div style={sty.card}>
          <div style={sty.cardT}>
            Análise de Falha de Freios (0 a {inp.nf})
            <span style={{ marginLeft: "10px" }}>
              <Badge ok={res.maxFailFS >= 10} y={`Até ${res.maxFailFS} falhas (FS≥1.3)`} n={`Apenas ${res.maxFailFS} falhas (FS≥1.3)`} />
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", minWidth: "700px" }}>
              <thead><tr>{["Falhas", "Freios Ativos", "F Disp. (kN)", "FS Desliz.", "d Fren. (m)", "Status"].map((h, i) => (
                <th key={i} style={{ padding: "5px 6px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "7px", textTransform: "uppercase" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{res.brakeAnalysis.map((b: any, i: number) => (
                <tr key={i} style={{ background: !b.fs_ok ? C.danger + "08" : i % 2 === 0 ? "transparent" : C.s2 + "22" }}>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{b.fail}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}>{b.nf_ativo}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{(b.F_disp / 1000).toFixed(1)}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: b.fs_ok ? C.success : C.danger, fontWeight: 600 }}>{b.fs_desliz.toFixed(2)}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: b.d_ok ? C.text : C.danger }}>{b.d_fren !== null ? b.d_fren.toFixed(3) : "∞"}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}><Badge ok={b.fs_ok && b.d_ok} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        {/* Gráfico FS vs Falhas */}
        <div style={sty.card}><div style={sty.cardT}>Fator de Segurança vs Nº de Falhas</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={res.brakeAnalysis.map((b: any) => ({ fail: b.fail, fs: +b.fs_desliz.toFixed(3), d: b.d_fren ? +b.d_fren.toFixed(3) : null }))} margin={{ top: 10, right: 40, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="fail" label={{ value: "Nº Freios em Falha", position: "bottom", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <YAxis yAxisId="l" label={{ value: "FS", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <YAxis yAxisId="r" orientation="right" label={{ value: "m", angle: 90, position: "insideRight", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
              <Legend wrapperStyle={{ fontSize: "9px" }} />
              <Line yAxisId="l" type="monotone" dataKey="fs" name="FS Deslizamento" stroke={C.accent} strokeWidth={2} dot={{ r: 2 }} />
              <Line yAxisId="r" type="monotone" dataKey="d" name="Distância (m)" stroke={C.warn} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
              <ReferenceLine yAxisId="l" y={1.3} stroke={C.danger} strokeDasharray="5 3" label={{ value: "FS=1.3", fill: C.danger, fontSize: 9 }} />
              <ReferenceLine yAxisId="r" y={inp.Df_lim} stroke={C.success} strokeDasharray="5 3" label={{ value: `d=${inp.Df_lim}m`, fill: C.success, fontSize: 9 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </>}
    </>}

    {/* ======== SEGURANÇA CONTRA DESLIZAMENTO ======== */}
    {subTab === 4 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo primeiro</div> : <>
        <div style={sty.card}>
          <div style={sty.cardT}>
            Segurança Contra Deslizamento — Equip. Parado (FEM 3-7)
            <span style={{ marginLeft: "10px" }}><Badge ok={res.maxFailSlipParado >= 10} y={`Até ${res.maxFailSlipParado} falhas`} n={`Até ${res.maxFailSlipParado} falhas`} /></span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
              <thead><tr>{["Falhas", "F Disp. (kN)", "F Req. (kN)", "FS", "Req. (≥1.2)", "Status"].map((h, i) => (
                <th key={i} style={{ padding: "5px 6px", textAlign: "left", borderBottom: `1px solid ${C.accent}33`, color: C.accent, fontSize: "7px", textTransform: "uppercase" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{res.slipAnalysis.map((s2: any, i: number) => (
                <tr key={i} style={{ background: !s2.ok ? C.danger + "08" : i % 2 === 0 ? "transparent" : C.s2 + "22" }}>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{s2.fail}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.success }}>{(s2.F_disp / 1000).toFixed(1)}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.warn }}>{(s2.F_req / 1000).toFixed(1)}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: s2.ok ? C.success : C.danger, fontWeight: 600 }}>{s2.fs.toFixed(2)}</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}>1.20</td>
                  <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}` }}><Badge ok={s2.ok} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        <div style={sty.card}><div style={sty.cardT}>FS vs Nº de Falhas (Parado com Garras)</div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={res.slipAnalysis.map((s2: any) => ({ fail: s2.fail, fs: +s2.fs.toFixed(3) }))} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="fail" label={{ value: "Nº Freios em Falha", position: "bottom", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <YAxis label={{ value: "FS", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
              <Line type="monotone" dataKey="fs" name="FS" stroke={C.accent} strokeWidth={2} dot={{ r: 2 }} />
              <ReferenceLine y={1.2} stroke={C.danger} strokeDasharray="5 3" label={{ value: "FS=1.2", fill: C.danger, fontSize: 9 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </>}
    </>}

    {/* ======== VARIAÇÃO DE VENTO ======== */}
    {subTab === 5 && <>
      {!res ? <div style={{ ...sty.card, textAlign: "center", padding: "40px", color: C.dim }}>Execute o cálculo primeiro</div> : <>
        <div style={sty.card}><div style={sty.cardT}>Distância de Frenagem vs Velocidade de Vento (todos freios ativos)</div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={res.windCurve} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="v" label={{ value: "Vento (m/s)", position: "bottom", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <YAxis label={{ value: "Distância (m)", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} domain={[0, 'auto']} />
              <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
              <Legend wrapperStyle={{ fontSize: "9px" }} />
              <Line type="monotone" dataKey="d" name="d frenagem (m)" stroke={C.accent} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
              <ReferenceLine y={inp.Df_lim} stroke={C.danger} strokeDasharray="5 3" label={{ value: `Limite ${inp.Df_lim}m`, fill: C.danger, fontSize: 9 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={sty.card}><div style={sty.cardT}>Força Requerida vs Disponível</div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={res.windCurve} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="v" label={{ value: "Vento (m/s)", position: "bottom", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <YAxis label={{ value: "kN", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 10 }} tick={{ fill: C.dim, fontSize: 9 }} stroke={C.border} />
              <Tooltip contentStyle={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: "5px", fontSize: "10px", color: C.text }} />
              <Legend wrapperStyle={{ fontSize: "9px" }} />
              <Line type="monotone" dataKey="F_req" name="F requerida (N)" stroke={C.warn} strokeWidth={2} dot={false} />
              <ReferenceLine y={res.Frm_total} stroke={C.success} strokeDasharray="5 3" label={{ value: "F disp. freios", fill: C.success, fontSize: 9 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={sty.card}><div style={sty.cardT}>Resumo</div>
          <div style={sty.grid(3)}>
            <Res label="Máx. falhas FS≥1.3" value={res.maxFailFS} type={res.maxFailFS >= 10 ? "s" : "w"} />
            <Res label="Máx. falhas d≤1m" value={res.maxFailDist} type={res.maxFailDist >= 8 ? "s" : "w"} />
            <Res label="Máx. falhas parado" value={res.maxFailSlipParado} type={res.maxFailSlipParado >= 10 ? "s" : "w"} />
          </div>
        </div>
      </>}
    </>}
    </div>
  </ModuleWrap>);
}
