// app/modules/transportador.tsx
// ============================================================
// MÓDULO: TRANSPORTADOR DE CORREIA — CEMA 7th Edition (Expanded)
// Inspirado em Belt Analyst (Overland Conveyor Co.)
// Recursos: multi-trecho, área de enchimento, curvas côncava/convexa,
// editor visual 2D com tambores arrastáveis, 3 tipos de tensionamento,
// análise completa de resistências CEMA, ângulos máx/mín por material
// ============================================================
"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

export const CONFIG = {
  id: "transportador",
  name: "Transportador de Correia",
  subtitle: "CEMA 7th Ed. — Análise Completa",
  icon: "↗",
  color: "#0a9396",
  price: 299.90,
  description:
    "Dimensionamento completo de transportador de correia conforme CEMA 7th Edition. Multi-trecho com curvas côncava/convexa, análise de área de enchimento por seção, ângulos máximos/mínimos por material, 3 tipos de tensionamento (gravidade, parafuso, automático), editor visual interativo com tambores arrastáveis em 2D/3D, decomposição completa de resistências (Tx, Ty, Tyc, Tyr, Tac, Tbc, Tpl, Tam), perfil de tensão ao longo da correia, verificação T1≤Tad, sag mínimo, raio mínimo de curvas, e potência por acionamento.",
  norma: "CEMA 7th Ed. · ISO 5048 · DIN 22101",
};

export const GLOSSARY = [
  { cat: "MATERIAL", items: [
    { s: "ρ", d: "Densidade aparente do material", u: "kg/m³" },
    { s: "Q", d: "Capacidade requerida (vazão mássica)", u: "t/h" },
    { s: "Φs", d: "Surcharge angle (ângulo de sobrecarga)", u: "°" },
    { s: "Φr", d: "Repose angle (ângulo de repouso)", u: "°" },
    { s: "Φm", d: "Ângulo máx. de transporte (material)", u: "°" },
  ]},
  { cat: "GEOMETRIA / PERFIL", items: [
    { s: "L", d: "Comprimento total horizontal projetado", u: "m" },
    { s: "H", d: "Elevação total (cauda → cabeça)", u: "m" },
    { s: "βi", d: "Ângulo de inclinação do trecho i", u: "°" },
    { s: "Li", d: "Comprimento do trecho i (real)", u: "m" },
    { s: "Rcv/Rcc", d: "Raio mín. curva convexa/côncava", u: "m" },
  ]},
  { cat: "CORREIA E ROLETES", items: [
    { s: "B", d: "Largura da correia", u: "pol / mm" },
    { s: "v", d: "Velocidade da correia", u: "m/s" },
    { s: "Wb", d: "Peso por metro da correia", u: "kgf/m" },
    { s: "λ", d: "Ângulo do rolete lateral (trough angle)", u: "°" },
    { s: "Si", d: "Espaçamento dos roletes de carga", u: "m" },
    { s: "Sir", d: "Espaçamento dos roletes de retorno", u: "m" },
    { s: "Au", d: "Área de enchimento útil (seção)", u: "m²" },
    { s: "Au_max", d: "Área de enchimento máxima teórica (CEMA)", u: "m²" },
    { s: "Ku", d: "Fator de utilização (Au/Au_max)", u: "-" },
    { s: "Wm", d: "Peso por metro do material", u: "kgf/m" },
  ]},
  { cat: "RESISTÊNCIAS CEMA", items: [
    { s: "Tx", d: "Resistência por flexão dos roletes (idlers)", u: "kgf" },
    { s: "Ty", d: "Resistência por flexão da correia", u: "kgf" },
    { s: "Tyc", d: "Resistência por flexão do material", u: "kgf" },
    { s: "Tyr", d: "Resistência por flexão correia (retorno)", u: "kgf" },
    { s: "Tm", d: "Resistência por elevação do material", u: "kgf" },
    { s: "Tb", d: "Resistência por elevação da correia", u: "kgf" },
    { s: "Tac", d: "Resistência por acessórios (skirts, plows)", u: "kgf" },
    { s: "Tbc", d: "Resistência dos limpadores (belt cleaners)", u: "kgf" },
    { s: "Tpl", d: "Resistência dos plows (raspadores)", u: "kgf" },
    { s: "Tsb", d: "Resistência dos skirtboards (guias laterais)", u: "kgf" },
    { s: "Te", d: "Tensão efetiva total (sum dos T's)", u: "kgf" },
  ]},
  { cat: "TENSIONAMENTO E TAMBORES", items: [
    { s: "θ", d: "Ângulo de abraçamento no tambor motor", u: "°" },
    { s: "μ", d: "Coef. de atrito correia–tambor (lagging)", u: "-" },
    { s: "Cw", d: "Fator de wrap (Euler) = e^(μθ)", u: "-" },
    { s: "T1", d: "Tensão no lado tenso (entrada do tambor motor)", u: "kgf" },
    { s: "T2", d: "Tensão no lado frouxo (saída do tambor motor)", u: "kgf" },
    { s: "Tad", d: "Tensão admissível da correia (lonas × resistência)", u: "kgf" },
    { s: "Tsag", d: "Tensão mínima por sag (catenária ≤ 2%)", u: "kgf" },
    { s: "Wcp", d: "Peso do contrapeso (gravidade)", u: "kgf" },
  ]},
  { cat: "ACIONAMENTO", items: [
    { s: "P_motor", d: "Potência por motor", u: "kW / HP" },
    { s: "n_mot", d: "Rotação do motor", u: "rpm" },
    { s: "n_tamb", d: "Rotação do tambor motor", u: "rpm" },
    { s: "i_red", d: "Relação de redução", u: "-" },
    { s: "η", d: "Rendimento total (motor·redutor·acopl.)", u: "-" },
  ]},
];

// ============================================================
// CONSTANTES CEMA 7th Ed.
// ============================================================

// Ky — fator de flexão (CEMA Tab 6.1) — interpolação por L (m)
const KY_TABLE: [number, number][] = [
  [30, 0.0407], [60, 0.0379], [90, 0.0355], [120, 0.0334],
  [150, 0.0316], [180, 0.0301], [210, 0.0287], [240, 0.0274],
  [270, 0.0263], [300, 0.0252], [360, 0.0233], [420, 0.0218],
  [480, 0.0204], [540, 0.0193], [600, 0.0183], [750, 0.0163],
  [900, 0.0149], [1200, 0.0128], [1500, 0.0115], [1800, 0.0106],
];
function interpKy(L: number): number {
  if (L <= KY_TABLE[0][0]) return KY_TABLE[0][1];
  if (L >= KY_TABLE[KY_TABLE.length - 1][0]) return KY_TABLE[KY_TABLE.length - 1][1];
  for (let i = 0; i < KY_TABLE.length - 1; i++) {
    const [x1, y1] = KY_TABLE[i];
    const [x2, y2] = KY_TABLE[i + 1];
    if (L >= x1 && L <= x2) return y1 + (y2 - y1) * (L - x1) / (x2 - x1);
  }
  return 0.025;
}

// Capacidade volumétrica por largura (m³/h por m/s) — CEMA Tab 4.3 (3 roletes 35° surcharge 20°)
const CEMA_CAP_VOL: Record<number, number> = {
  18: 62, 24: 115, 30: 186, 36: 272, 42: 374, 48: 492,
  54: 627, 60: 778, 72: 1128, 84: 1548, 96: 2034,
};

// Larguras padrão CEMA
export const BW_OPTIONS = [18, 24, 30, 36, 42, 48, 54, 60, 72, 84, 96];

// Classe de roletes CEMA
const IDLER_CLASS: Record<string, { l: string; A1: number; A2: number; max_load_lb: number }> = {
  B: { l: "CEMA B (light)", A1: 1.5, A2: 0.0150, max_load_lb: 410 },
  C: { l: "CEMA C (medium)", A1: 1.8, A2: 0.0180, max_load_lb: 900 },
  D: { l: "CEMA D (heavy)", A1: 2.4, A2: 0.0220, max_load_lb: 1500 },
  E: { l: "CEMA E (very heavy)", A1: 3.0, A2: 0.0260, max_load_lb: 2400 },
  F: { l: "CEMA F (heaviest)", A1: 3.6, A2: 0.0300, max_load_lb: 3600 },
};

// Material database — densidade, surcharge, repose, ângulo máximo
export const MATERIAL_DB: Record<string, { name: string; rho: number; phi_s: number; phi_r: number; phi_max: number }> = {
  iron_ore_pellets: { name: "Pelotas de minério de ferro", rho: 2100, phi_s: 15, phi_r: 30, phi_max: 13 },
  iron_ore_fines: { name: "Minério de ferro (fino)", rho: 2500, phi_s: 20, phi_r: 35, phi_max: 18 },
  iron_ore_lump: { name: "Minério de ferro (granulado)", rho: 2400, phi_s: 25, phi_r: 35, phi_max: 18 },
  coal_run: { name: "Carvão (run-of-mine)", rho: 800, phi_s: 25, phi_r: 38, phi_max: 18 },
  coal_fine: { name: "Carvão fino", rho: 900, phi_s: 25, phi_r: 35, phi_max: 22 },
  limestone_crushed: { name: "Calcário britado", rho: 1500, phi_s: 22, phi_r: 38, phi_max: 18 },
  gravel_dry: { name: "Cascalho seco", rho: 1700, phi_s: 20, phi_r: 35, phi_max: 18 },
  sand_dry: { name: "Areia seca", rho: 1600, phi_s: 15, phi_r: 30, phi_max: 16 },
  bauxite: { name: "Bauxita", rho: 1280, phi_s: 25, phi_r: 35, phi_max: 18 },
  cement_clinker: { name: "Clínquer de cimento", rho: 1400, phi_s: 22, phi_r: 38, phi_max: 18 },
  custom: { name: "Customizado", rho: 900, phi_s: 20, phi_r: 35, phi_max: 18 },
};

// ============================================================
// ÁREA DE ENCHIMENTO — CEMA 7th Ed. (3 roletes iguais)
// Au = Ab + As, onde:
//   Ab = área da seção em "U" = f(B, λ, b)
//   As = área da coroa (surcharge cap)
// b = largura útil da correia (CEMA: b = 0.9·B – 0.05 para B em metros)
// ============================================================
function fillingArea(B_mm: number, lambda_deg: number, phi_s_deg: number) {
  const B = B_mm / 1000; // m
  const b = 0.9 * B - 0.05; // largura útil (m)
  const ll = b / 3; // comprimento de cada rolete (3 iguais)
  const lambda = lambda_deg * Math.PI / 180;
  const phi_s = phi_s_deg * Math.PI / 180;

  // Largura no topo da seção em U
  const bs = ll + 2 * (b - ll) / 2 * Math.cos(lambda);
  // Altura do trapézio
  const h = ((b - ll) / 2) * Math.sin(lambda);
  // Área do trapézio (base lateral inferior + retângulo central)
  // Decomposição: retângulo (ll × h) + 2 triângulos
  const A_trap = ll * h + 2 * (0.5 * ((b - ll) / 2) * Math.cos(lambda) * h);

  // Área do "cap" superior (segmento circular surcharge)
  // Aproximação CEMA: triângulo isósceles com base bs e altura h_s
  const h_s = (bs / 2) * Math.tan(phi_s);
  const A_cap = 0.5 * bs * h_s;

  const Au = A_trap + A_cap;
  // Au máxima teórica (correia plana = 0, λ=0): apenas o cap → muito pequena
  // Au máxima de referência: λ=45°, phi_s=phi_r → usamos a área para esses valores
  return { Au, A_trap, A_cap, b_util: b, h_trough: h, h_cap: h_s };
}

// ============================================================
// ÂNGULO MÁXIMO DE TRANSPORTE
// Verifica se algum trecho excede o ângulo máximo do material
// ============================================================
function checkMaxAngle(segments: any[], phi_max: number) {
  const violations: { idx: number; ang: number; max: number }[] = [];
  segments.forEach((seg, i) => {
    if (Math.abs(seg.ang) > phi_max) {
      violations.push({ idx: i, ang: seg.ang, max: phi_max });
    }
  });
  return violations;
}

// ============================================================
// RAIOS MÍNIMOS DE CURVAS (CEMA 7th Ed. cap. 9)
// Convexa: T1 não pode descolar → Rmin = T1 / (Wb · cos(β))
// Côncava: levantamento da correia → Rmin = T1 / (Wb·g·cos(β))
// ============================================================
function minRadius(T1_kgf: number, Wb: number, beta_deg: number) {
  const beta = beta_deg * Math.PI / 180;
  const cos_b = Math.max(Math.cos(beta), 0.01);
  // Convexa: empírico CEMA → Rmin ≈ T1 / (Wb · cos(β)) para correias txteis
  const R_convex = T1_kgf / (Wb * cos_b);
  // Côncava: levantamento → mais crítico, fator 1.5
  const R_concave = 1.5 * T1_kgf / (Wb * cos_b);
  return { R_convex, R_concave };
}

// ============================================================
// CÁLCULO PRINCIPAL — CEMA 7th Ed. com decomposição completa
// ============================================================
function calc(inp: any, pulleys: any[] = []) {
  const g = 9.81;
  const {
    mat_d, cap_th, phi_s,
    segments,
    larg_pol, ang_rol, vel_ms, Wb, n_lonas, cap_tens,
    esp_rol, esp_rol_ret, idler_cl, p_rol_carga, p_rol_ret,
    d_tamb_mm, ang_abr, mu_lag,
    n_limp, comp_guias, Cs, n_plows, F_plow,
    freq_hz, n_polos, n_ac, ef_c, ef_r, ef_a,
    tens_type,
    // Dinâmico (novos)
    Kst = 1.5, t_start = 8, t_brake = 10, a_brake = 0.3,
    // Chute entupido (novos)
    chute_plug = false, chute_area_m2 = 1.2, mat_shear_kpa = 35,
  } = inp;

  // ----- Geometria -----
  const L_h = segments.reduce((a: number, s: any) => a + s.comp * Math.cos(s.ang * Math.PI / 180), 0);
  const L_total = segments.reduce((a: number, s: any) => a + s.comp, 0);
  const H_total = segments.reduce((a: number, s: any) => a + s.comp * Math.sin(s.ang * Math.PI / 180), 0);
  const beta_eq = Math.atan2(H_total, L_h) * 180 / Math.PI;

  // ----- Material e capacidade -----
  const cap_vol_ref = CEMA_CAP_VOL[larg_pol] || 500; // m³/h por m/s, ref CEMA 35°/20°
  const fa = fillingArea(larg_pol * 25.4, ang_rol, phi_s);
  // Au de referência CEMA (35°/20°)
  const fa_ref = fillingArea(larg_pol * 25.4, 35, 20);
  const cap_vol_real = cap_vol_ref * (fa.Au / fa_ref.Au); // ajusta pela Au real
  const V_min = cap_th / (mat_d / 1000 * cap_vol_real);
  const V = Math.max(vel_ms, V_min);
  const cap_real = cap_vol_real * V * mat_d / 1000;
  const Ku = fa.Au / fa_ref.Au; // fator de utilização
  const Wm = cap_th * 1000 / (3600 * V); // kgf/m

  // ----- Coeficientes -----
  const Ky = interpKy(L_total);
  const idx = IDLER_CLASS[idler_cl] || IDLER_CLASS.D;
  const Kx = 0.00068 * (Wb + Wm) + idx.A1 / esp_rol; // CEMA: A1 lb por idler / espaçamento

  // ----- Resistências CEMA decompostas (kgf) -----
  // Tx — flexão dos roletes
  const Tx = Kx * L_total;
  // Ty — flexão da correia (carga)
  const Ty = Ky * L_total * (Wb + Wm);
  // Tyr — flexão da correia (retorno)
  const Kyr = Ky * 0.6;
  const Tyr = Kyr * L_total * Wb;
  // Tyc — não usado separado no CEMA básico (já em Ty), mantido = 0
  const Tyc = 0;
  // Tm — elevação do material
  const Tm = H_total * Wm;
  // Tb — elevação da correia (zera no fim do ciclo, mas relevante por trecho)
  const Tb = 0;
  // Tac — guias laterais (skirts)
  const Tsb = Cs * (comp_guias || 0) * V * V * mat_d / 1000;
  // Tbc — limpadores
  const Tbc = n_limp * 100.8;
  // Tpl — plows
  const Tpl = (n_plows || 0) * (F_plow || 0);
  // Aceleração do material (start to belt speed)
  const Tam = cap_th * 1000 * V / (3600 * g);

  const Te = Tx + Ty + Tyr + Tm + Tb + Tsb + Tbc + Tpl + Tam;

  // ----- Potência -----
  const Ne_kw = Te * g * V / 1000; // kW efetivo
  const ef_t = ef_c * ef_r * ef_a;
  const N_kw = Ne_kw / ef_t;
  const N_hp = N_kw / 0.7355;
  const N_cv = N_kw / 0.7355 * 1.01387;
  const N_per_kw = N_kw / n_ac;
  const N_per_hp = N_hp / n_ac;

  // ----- Rotações e redução -----
  const n_sinc = (120 * freq_hz) / n_polos;
  const n_mot = n_sinc * 0.97;
  const n_tamb = (V * 60) / (Math.PI * (d_tamb_mm / 1000));
  const i_red = n_mot / n_tamb;

  // ----- Tensões T1, T2 -----
  // Ângulo de abraçamento real: 180° base + bônus de snub próximo ao motor
  const drivePulley = pulleys.find(p => p.type === "drive");
  const snubPulley = pulleys.find(p => p.type === "snub");
  let ang_abr_real = ang_abr;
  if (drivePulley && snubPulley) {
    const dist = Math.abs(snubPulley.x - drivePulley.x);
    // Quanto mais próximo o snub do motor, maior o wrap adicional (até +40°)
    const bonus = dist < 5 ? 40 * (1 - dist / 5) : 0;
    ang_abr_real = Math.min(240, ang_abr + bonus);
  }
  const wrap_r = ang_abr_real * Math.PI / 180;
  const Cw = Math.exp(mu_lag * wrap_r);
  const T1 = Te * Cw / (Cw - 1);
  const T2_min = T1 - Te;

  // Posição do tensionamento afeta T2 efetivo
  // Take-up próximo à cauda: T2 = T2_min (ideal)
  // Take-up longe da cauda: T2 cresce ~5% por cada 10m de distância
  const takeupPulley = pulleys.find(p => p.type === "takeup");
  const tailPulley = pulleys.find(p => p.type === "tail");
  let T2_factor = 1.0;
  if (takeupPulley && tailPulley) {
    const dist_tu = Math.abs(takeupPulley.x - tailPulley.x);
    T2_factor = 1 + Math.min(dist_tu / 200, 0.15); // até +15%
  }
  const T2 = T2_min * T2_factor;
  const T1_eff = T2 + Te;
  const Tad = (cap_tens * (larg_pol * 25.4) / 1000) / g;

  // ----- Sag (catenária mínima 2%) -----
  const T_sag_carga = (esp_rol * (Wb + Wm)) / (8 * 0.02);
  const T_sag_ret = (esp_rol_ret * Wb) / (8 * 0.02);
  const T_sag = Math.max(T_sag_carga, T_sag_ret);

  // ----- Tensionamento -----
  let Wcp = 0, screw_travel = 0, auto_force = 0;
  if (tens_type === "gravity") {
    Wcp = 2 * T2; // contrapeso = 2·T2 (dois ramais)
  } else if (tens_type === "screw") {
    // Curso = elongation total da correia (~1.5%)
    screw_travel = L_total * 0.015 * 1000; // mm
  } else if (tens_type === "automatic") {
    auto_force = 2 * T2;
  }

  // ----- Raios mínimos de curvas -----
  const radii = minRadius(T1, Wb, Math.abs(beta_eq));

  // ----- Ângulo máx vs material -----
  const phi_max_mat = inp.phi_max_mat || 18;
  const angle_violations = checkMaxAngle(segments, phi_max_mat);

  // ----- Perfil de tensão por trecho -----
  // Constrói curva integrando resistências distribuídas
  const curve: any[] = [];
  const npts = 30;
  let cum_L = 0, cum_H = 0;
  // Tensão começa em T2 na cauda (lado da volta entra como T2, na carga sai como T1)
  // Modelo simplificado: T(x) = T2 + (Te) · (x/L_total) ao longo do ramo de carga
  for (let i = 0; i <= npts; i++) {
    const x = (L_total * i) / npts;
    // Encontra o trecho atual
    let acc = 0, h_acc = 0;
    for (const seg of segments) {
      if (acc + seg.comp >= x) {
        const dx = x - acc;
        h_acc += dx * Math.sin(seg.ang * Math.PI / 180);
        break;
      }
      acc += seg.comp;
      h_acc += seg.comp * Math.sin(seg.ang * Math.PI / 180);
    }
    const frac = x / L_total;
    curve.push({
      pos: +x.toFixed(1),
      T_carga: +(T2 + Te * frac).toFixed(0),
      T_volta: +(T2 - Tyr * frac + Tx * 0.4 * frac).toFixed(0),
      h: +h_acc.toFixed(2),
    });
  }

  // ----- REGIME DE PARTIDA (CEMA 14.5) -----
  const mass_belt_kg = Wb * L_total * 2;
  const mass_mat_kg = Wm * L_total;
  const mass_idlers_kg = (p_rol_carga / esp_rol + p_rol_ret / esp_rol_ret) * L_total;
  const mass_total = mass_belt_kg + mass_mat_kg + mass_idlers_kg;
  const a_start = V / t_start;
  const Fi_start = mass_total * a_start;
  const Te_start = Kst * Te + Fi_start;
  const T1_start = Te_start * Cw / (Cw - 1);
  const P_start_kw = Te_start * g * V / (1000 * ef_t);
  const torque_peak_start = Te_start * (d_tamb_mm / 2000);
  const start_ok = T1_start <= Tad;

  // ----- REGIME DE FRENAGEM (CEMA 14.6) -----
  const Fi_brake = mass_total * a_brake;
  const Te_brake = Math.max(Math.abs(Te - Fi_brake), Te * 0.3);
  const T1_brake = Te_brake * Cw / (Cw - 1);
  const stop_distance = 0.5 * V * t_brake;
  const brake_ok = T1_brake <= Tad;

  // ----- CHUTE ENTUPIDO -----
  const F_shear_plug = chute_plug ? (mat_shear_kpa * 1000 * chute_area_m2) / g : 0;
  const Te_plug = Te + F_shear_plug;
  const T1_plug = Te_plug * Cw / (Cw - 1);
  const Te_start_plug = Kst * Te_plug + Fi_start;
  const T1_start_plug = Te_start_plug * Cw / (Cw - 1);
  const torque_peak_worst = Te_start_plug * (d_tamb_mm / 2000);
  const plug_ok = T1_start_plug <= Tad;

  return {
    ang_abr_real, T2_factor, T1_eff,
    mass_total, a_start, Fi_start, Te_start, T1_start, P_start_kw, torque_peak_start, start_ok,
    a_brake, Fi_brake, Te_brake, T1_brake, stop_distance, brake_ok,
    F_shear_plug, Te_plug, T1_plug, Te_start_plug, T1_start_plug, torque_peak_worst, plug_ok,
    // Geometria
    L_total, L_h, H_total, beta_eq,
    // Material
    fa, fa_ref, Ku, V_min, V, cap_vol_real, cap_real, Wm,
    // Coeficientes
    Ky, Kx,
    // Resistências
    Tx, Ty, Tyr, Tyc, Tm, Tb, Tsb, Tbc, Tpl, Tam, Te,
    // Potência
    Ne_kw, N_kw, N_hp, N_cv, N_per_kw, N_per_hp, ef_t,
    // Rotação
    n_sinc, n_mot, n_tamb, i_red,
    // Tensões
    Cw, T1, T2, Tad, T_sag, T_sag_carga, T_sag_ret,
    // Tensionamento
    Wcp, screw_travel, auto_force,
    // Curvas
    radii, angle_violations,
    // Perfil
    curve,
    // Status
    cap_ok: cap_real >= cap_th,
    tension_ok: T1 <= Tad,
    sag_ok: T2 >= T_sag,
    angle_ok: angle_violations.length === 0,
  };
}

// ============================================================
// AVISOS / VALIDAÇÃO
// ============================================================
function generateWarnings(inp: any, res: any) {
  const items: { level: "ok" | "warn" | "bad"; text: string }[] = [];

  if (!res.tension_ok) items.push({ level: "bad",
    text: `T1 (${res.T1.toFixed(0)} kgf) excede a tensão admissível Tad (${res.Tad.toFixed(0)} kgf). Aumente lonas, capacidade da correia ou reduza Te.` });

  if (!res.cap_ok) items.push({ level: "bad",
    text: `Capacidade real (${res.cap_real.toFixed(0)} t/h) < requerida (${inp.cap_th} t/h). Aumente velocidade, largura ou densidade.` });

  if (!res.angle_ok) {
    res.angle_violations.forEach((v: any) => items.push({ level: "bad",
      text: `Trecho ${v.idx + 1}: ângulo ${v.ang.toFixed(1)}° excede o máximo do material (${v.max}°). Risco de escorregamento/derrame.` }));
  }

  if (!res.sag_ok) items.push({ level: "warn",
    text: `T2 (${res.T2.toFixed(0)} kgf) abaixo do sag mínimo (${res.T_sag.toFixed(0)} kgf). Aumente o contrapeso para evitar derrame entre roletes.` });

  if (res.i_red < 8) items.push({ level: "warn",
    text: `Redução baixa (${res.i_red.toFixed(1)}:1). Verifique disponibilidade comercial.` });
  if (res.i_red > 80) items.push({ level: "warn",
    text: `Redução alta (${res.i_red.toFixed(1)}:1). Considere estágio extra.` });

  if (inp.ang_abr < 180) items.push({ level: "warn",
    text: `Ângulo de abraçamento ${inp.ang_abr}° < 180°. Use snub pulley para aumentar Cw.` });

  if (res.Ku > 1.0) items.push({ level: "warn",
    text: `Fator de utilização Ku=${res.Ku.toFixed(2)} > 1.0. A seção opera acima da referência CEMA — verifique transbordamento.` });
  if (res.Ku < 0.5) items.push({ level: "warn",
    text: `Fator de utilização Ku=${res.Ku.toFixed(2)} < 0.5. Correia subutilizada — considere reduzir largura.` });

  if (res.N_per_kw > 200) items.push({ level: "warn",
    text: `Potência por acionamento alta (${res.N_per_kw.toFixed(0)} kW). Considere mais acionamentos.` });

  if (res.radii.R_concave > 100) items.push({ level: "warn",
    text: `Raio mínimo de curva côncava elevado (${res.radii.R_concave.toFixed(0)} m). Verifique geometria do perfil.` });

  if (res.start_ok === false) items.push({ level: "bad",
    text: `Partida: T1 (${res.T1_start.toFixed(0)} kgf) excede Tad durante aceleração. Aumente t_start, reduza Kst ou use soft-starter/inversor.` });

  if (res.brake_ok === false) items.push({ level: "bad",
    text: `Frenagem: T1 (${res.T1_brake.toFixed(0)} kgf) excede Tad na desaceleração. Aumente t_brake ou reduza a_brake.` });

  if (inp.chute_plug && !res.plug_ok) items.push({ level: "bad",
    text: `Chute entupido + partida: T1 (${res.T1_start_plug.toFixed(0)} kgf) > Tad. Instalar detector de chute obstruído + intertravamento com acionamento.` });

  if (inp.chute_plug && res.plug_ok) items.push({ level: "warn",
    text: `Chute entupido considerado no dimensionamento. Torque de pico no acionamento: ${res.torque_peak_worst.toFixed(0)} N.m. Verifique se motor/redutor suportam.` });

  if (!items.length) items.push({ level: "ok",
    text: "Todos os critérios CEMA 7th Ed. atendidos. O transportador opera dentro dos limites recomendados." });

  return items;
}

// ============================================================
// EDITOR 2D INTERATIVO — Tambores arrastáveis + Multi-trecho
// ============================================================
function InteractiveProfile2D({ inp, res, palette, pulleys, setPulleys, onSegmentChange }: any) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  // Calcula bounding box do perfil
  const segs = inp.segments;
  const W = 760, H = 380;
  const padX = 60, padY = 50;

  // Pontos do perfil (cauda → cabeça) integrando segmentos
  const profilePts: { x: number; y: number; xm: number; ym: number }[] = [];
  let cx = 0, cy = 0;
  profilePts.push({ x: 0, y: 0, xm: 0, ym: 0 });
  for (const seg of segs) {
    const dx = seg.comp * Math.cos(seg.ang * Math.PI / 180);
    const dy = seg.comp * Math.sin(seg.ang * Math.PI / 180);
    cx += dx; cy += dy;
    profilePts.push({ x: cx, y: cy, xm: cx, ym: cy });
  }

  const maxX = Math.max(...profilePts.map(p => p.x)) || 1;
  const minY = Math.min(...profilePts.map(p => p.y));
  const maxY = Math.max(...profilePts.map(p => p.y));
  const rangeY = (maxY - minY) || 1;

  // Escala (preserva aspecto razoável)
  const sx = (W - 2 * padX) / maxX;
  const sy = (H - 2 * padY) / Math.max(rangeY * 1.5, 5);

  const toScreen = (xm: number, ym: number) => ({
    x: padX + xm * sx,
    y: H - padY - (ym - minY) * sy,
  });

  // Linha da correia (lado de carga - superior)
  const beltTop = profilePts.map(p => toScreen(p.x, p.y));
  // Lado de retorno (offset paralelo abaixo)
  const beltOffset = 18;
  const beltBot = beltTop.map(p => ({ x: p.x, y: p.y + beltOffset }));

  // Drag handler
  const onMouseDown = (i: number) => (e: any) => {
    e.preventDefault();
    setDragging(i);
  };
  const onMouseMove = (e: any) => {
    if (dragging === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) * W) / rect.width;
    const xm = (px - padX) / sx;
    setPulleys((prev: any[]) => prev.map((p, i) => i === dragging ? { ...p, x: Math.max(0, Math.min(maxX, xm)) } : p));
  };
  const onMouseUp = () => setDragging(null);

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", background: palette.bg1, borderRadius: 8, border: `1px solid ${palette.border}`, cursor: dragging !== null ? "grabbing" : "default" }}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

        {/* Grid */}
        <defs>
          <pattern id="grid-tp" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={palette.border} strokeWidth="0.5" opacity="0.4"/>
          </pattern>
          <linearGradient id="belt-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={palette.copper} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={palette.copper} stopOpacity="0.1"/>
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#grid-tp)"/>

        {/* Eixo de elevação (esquerda) */}
        <line x1={padX - 5} y1={padY} x2={padX - 5} y2={H - padY} stroke={palette.muted} strokeWidth="1"/>
        <text x={padX - 10} y={padY + 5} fill={palette.muted} fontSize="9" textAnchor="end">{maxY.toFixed(1)}m</text>
        <text x={padX - 10} y={H - padY + 3} fill={palette.muted} fontSize="9" textAnchor="end">{minY.toFixed(1)}m</text>
        <text x={padX - 35} y={H / 2} fill={palette.muted} fontSize="9" textAnchor="middle" transform={`rotate(-90 ${padX - 35} ${H / 2})`}>Elevação (m)</text>

        {/* Eixo horizontal */}
        <line x1={padX} y1={H - padY + 8} x2={W - padX} y2={H - padY + 8} stroke={palette.muted} strokeWidth="1"/>
        <text x={padX} y={H - padY + 22} fill={palette.muted} fontSize="9">0m</text>
        <text x={W - padX} y={H - padY + 22} fill={palette.muted} fontSize="9" textAnchor="end">{maxX.toFixed(1)}m</text>
        <text x={W / 2} y={H - 8} fill={palette.muted} fontSize="9" textAnchor="middle">Comprimento horizontal</text>

        {/* Material no lado de carga (área preenchida) */}
        <path d={
          "M " + beltTop.map(p => `${p.x},${p.y}`).join(" L ") +
          " L " + beltTop.slice().reverse().map(p => `${p.x},${p.y - 8}`).join(" L ") + " Z"
        } fill="url(#belt-grad)" stroke="none"/>

        {/* Correia - lado de carga */}
        <polyline points={beltTop.map(p => `${p.x},${p.y}`).join(" ")}
          fill="none" stroke={palette.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Correia - retorno */}
        <polyline points={beltBot.map(p => `${p.x},${p.y}`).join(" ")}
          fill="none" stroke={palette.primaryDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>

        {/* Marcações dos vértices entre trechos (com ângulos) */}
        {beltTop.map((p, i) => i > 0 && i < beltTop.length - 1 && (
          <g key={`v${i}`}>
            <circle cx={p.x} cy={p.y} r="4" fill={palette.copper} stroke={palette.bg1} strokeWidth="1.5"/>
            <text x={p.x} y={p.y - 10} fill={palette.copper} fontSize="9" textAnchor="middle" fontWeight="600">
              {segs[i].ang > 0 ? "+" : ""}{segs[i].ang}°
            </text>
          </g>
        ))}

        {/* Tambores (arrastáveis) */}
        {pulleys.map((p: any, i: number) => {
          // encontra y na correia interpolando
          let y = beltTop[0].y;
          for (let k = 0; k < profilePts.length - 1; k++) {
            if (p.x >= profilePts[k].x && p.x <= profilePts[k + 1].x) {
              const f = (p.x - profilePts[k].x) / (profilePts[k + 1].x - profilePts[k].x || 1);
              y = beltTop[k].y + f * (beltTop[k + 1].y - beltTop[k].y);
              break;
            }
          }
          if (p.x >= profilePts[profilePts.length - 1].x) y = beltTop[beltTop.length - 1].y;
          const sp = toScreen(p.x, 0);
          const px = sp.x;
          const py = p.side === "top" ? y : y + beltOffset;
          const r = p.type === "drive" ? 13 : p.type === "tail" ? 11 : 9;
          const color = p.type === "drive" ? palette.copper :
                        p.type === "tail" ? palette.primary :
                        p.type === "takeup" ? palette.warn :
                        p.type === "snub" ? palette.muted : palette.primaryLight;
          return (
            <g key={i} style={{ cursor: "grab" }}
              onMouseDown={onMouseDown(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={px} cy={py} r={r + 2} fill={palette.bg1} stroke={color} strokeWidth="2.5"/>
              <circle cx={px} cy={py} r={r - 2} fill={color} opacity="0.6"/>
              <text x={px} y={py + 3} fill={palette.text} fontSize="8" textAnchor="middle" fontWeight="700">{p.label}</text>
              {hover === i && (
                <g>
                  <rect x={px - 60} y={py - 38} width={120} height={28} rx={4} fill={palette.bg0} stroke={color} strokeWidth="1"/>
                  <text x={px} y={py - 24} fill={palette.text} fontSize="9" textAnchor="middle" fontWeight="600">{p.name}</text>
                  <text x={px} y={py - 14} fill={palette.muted} fontSize="8" textAnchor="middle">x = {p.x.toFixed(1)}m</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Legenda de status */}
        <g transform={`translate(${W - 180}, 12)`}>
          <rect x={0} y={0} width={170} height={42} rx={5} fill={palette.bg0} stroke={palette.border}/>
          <text x={8} y={14} fill={palette.muted} fontSize="8" fontWeight="600">PERFIL CALCULADO</text>
          <text x={8} y={26} fill={palette.text} fontSize="8">L = {res?.L_total?.toFixed(1) || "—"}m  ·  H = {res?.H_total?.toFixed(1) || "—"}m</text>
          <text x={8} y={37} fill={palette.text} fontSize="8">β eq = {res?.beta_eq?.toFixed(1) || "—"}°  ·  T1 = {res?.T1?.toFixed(0) || "—"} kgf</text>
        </g>
      </svg>

      <div style={{ marginTop: 8, fontSize: 10, color: palette.muted, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>● <strong style={{ color: palette.copper }}>Motor</strong></span>
        <span>● <strong style={{ color: palette.primary }}>Cauda</strong></span>
        <span>● <strong style={{ color: palette.warn }}>Tensionamento</strong></span>
        <span>● <strong style={{ color: palette.muted }}>Snub/Bend</strong></span>
        <span>· Arraste os tambores para reposicionar</span>
      </div>
    </div>
  );
}

// ============================================================
// SEÇÃO TRANSVERSAL — Área de enchimento (CEMA)
// ============================================================
function CrossSection({ inp, res, palette }: any) {
  const W = 360, H = 260;
  const cx = W / 2, cy = H * 0.65;
  const B_mm = inp.larg_pol * 25.4;
  const scale = (W * 0.7) / (B_mm / 1000);
  const B = (B_mm / 1000) * scale;
  const lambda = inp.ang_rol * Math.PI / 180;
  const phi_s = inp.phi_s * Math.PI / 180;
  const b_util = (B_mm / 1000 * 0.9 - 0.05) * scale;
  const ll = b_util / 3;

  // 3 roletes
  const x_ll = cx - ll / 2;
  const x_lr = cx + ll / 2;
  const lat_dx = ((b_util - ll) / 2) * Math.cos(lambda);
  const lat_dy = ((b_util - ll) / 2) * Math.sin(lambda);

  const x_left = x_ll - lat_dx;
  const y_left = cy - lat_dy;
  const x_right = x_lr + lat_dx;
  const y_right = cy - lat_dy;

  // Cap do material
  const bs = (x_right - x_left);
  const cap_h = (bs / 2) * Math.tan(phi_s);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", background: palette.bg1, borderRadius: 8, border: `1px solid ${palette.border}` }}>
      <defs>
        <linearGradient id="cs-mat" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.copper} stopOpacity="0.7"/>
          <stop offset="100%" stopColor={palette.copperDark} stopOpacity="0.9"/>
        </linearGradient>
      </defs>

      {/* Material (área de enchimento) */}
      <path d={`
        M ${x_left} ${y_left}
        L ${x_ll} ${cy}
        L ${x_lr} ${cy}
        L ${x_right} ${y_right}
        Q ${cx} ${y_left - cap_h * 1.4}, ${x_left} ${y_left}
        Z
      `} fill="url(#cs-mat)" stroke={palette.copper} strokeWidth="1.5"/>

      {/* Correia */}
      <line x1={x_left - 8} y1={y_left + 4} x2={x_ll} y2={cy + 4} stroke={palette.primary} strokeWidth="4" strokeLinecap="round"/>
      <line x1={x_ll} y1={cy + 4} x2={x_lr} y2={cy + 4} stroke={palette.primary} strokeWidth="4" strokeLinecap="round"/>
      <line x1={x_lr} y1={cy + 4} x2={x_right + 8} y2={y_right + 4} stroke={palette.primary} strokeWidth="4" strokeLinecap="round"/>

      {/* Roletes */}
      <line x1={x_left - 12} y1={y_left + 8} x2={x_ll - 4} y2={cy + 8} stroke={palette.muted} strokeWidth="6" strokeLinecap="round"/>
      <line x1={x_ll - 2} y1={cy + 8} x2={x_lr + 2} y2={cy + 8} stroke={palette.muted} strokeWidth="6" strokeLinecap="round"/>
      <line x1={x_lr + 4} y1={cy + 8} x2={x_right + 12} y2={y_right + 8} stroke={palette.muted} strokeWidth="6" strokeLinecap="round"/>

      {/* Cotas */}
      <line x1={x_left} y1={H - 20} x2={x_right} y2={H - 20} stroke={palette.muted} strokeWidth="0.8"/>
      <line x1={x_left} y1={H - 24} x2={x_left} y2={H - 16} stroke={palette.muted} strokeWidth="0.8"/>
      <line x1={x_right} y1={H - 24} x2={x_right} y2={H - 16} stroke={palette.muted} strokeWidth="0.8"/>
      <text x={cx} y={H - 8} fill={palette.muted} fontSize="9" textAnchor="middle">B útil = {((B_mm / 1000 * 0.9 - 0.05) * 1000).toFixed(0)} mm</text>

      {/* Ângulos */}
      <text x={x_left - 4} y={y_left - 6} fill={palette.primary} fontSize="9" textAnchor="end" fontWeight="600">λ = {inp.ang_rol}°</text>
      <text x={cx} y={y_left - cap_h * 1.4 - 6} fill={palette.copper} fontSize="9" textAnchor="middle" fontWeight="600">Φs = {inp.phi_s}°</text>

      {/* Title */}
      <text x={cx} y={20} fill={palette.text} fontSize="11" textAnchor="middle" fontWeight="700">Seção Transversal</text>
      {res?.fa && (
        <g transform={`translate(${W - 140}, 30)`}>
          <text x={0} y={0} fill={palette.muted} fontSize="9">Au real:</text>
          <text x={130} y={0} fill={palette.copper} fontSize="9" textAnchor="end" fontWeight="700">{res.fa.Au.toFixed(4)} m²</text>
          <text x={0} y={14} fill={palette.muted} fontSize="9">Au ref CEMA:</text>
          <text x={130} y={14} fill={palette.text} fontSize="9" textAnchor="end">{res.fa_ref.Au.toFixed(4)} m²</text>
          <text x={0} y={28} fill={palette.muted} fontSize="9">Ku:</text>
          <text x={130} y={28} fill={res.Ku >= 0.9 && res.Ku <= 1.1 ? palette.ok : palette.warn} fontSize="9" textAnchor="end" fontWeight="700">{res.Ku.toFixed(3)}</text>
        </g>
      )}
    </svg>
  );
}

// ============================================================
// GRÁFICO DE TENSÃO ao longo da correia
// ============================================================
function TensionChart({ res, palette }: any) {
  if (!res?.curve) return null;
  const W = 760, H = 280, padL = 60, padR = 30, padT = 20, padB = 40;
  const data = res.curve;
  const maxT = Math.max(...data.map((d: any) => Math.max(d.T_carga, d.T_volta)), res.Tad) * 1.1;
  const maxX = data[data.length - 1].pos;

  const sx = (W - padL - padR) / maxX;
  const sy = (H - padT - padB) / maxT;
  const xT = (x: number) => padL + x * sx;
  const yT = (t: number) => H - padB - t * sy;

  const pathCarga = data.map((d: any, i: number) => `${i === 0 ? "M" : "L"} ${xT(d.pos)} ${yT(d.T_carga)}`).join(" ");
  const pathVolta = data.map((d: any, i: number) => `${i === 0 ? "M" : "L"} ${xT(d.pos)} ${yT(d.T_volta)}`).join(" ");
  const areaCarga = pathCarga + ` L ${xT(maxX)} ${yT(0)} L ${xT(0)} ${yT(0)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", background: palette.bg1, borderRadius: 8, border: `1px solid ${palette.border}` }}>
      <defs>
        <linearGradient id="ten-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.primary} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={palette.primary} stopOpacity="0.05"/>
        </linearGradient>
      </defs>

      {/* Eixos */}
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={palette.muted} strokeWidth="1"/>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={palette.muted} strokeWidth="1"/>

      {/* Grid horizontal */}
      {[0.25, 0.5, 0.75, 1.0].map((f, i) => (
        <g key={i}>
          <line x1={padL} y1={yT(maxT * f)} x2={W - padR} y2={yT(maxT * f)} stroke={palette.border} strokeWidth="0.5" strokeDasharray="3,3"/>
          <text x={padL - 5} y={yT(maxT * f) + 3} fill={palette.muted} fontSize="9" textAnchor="end">{(maxT * f).toFixed(0)}</text>
        </g>
      ))}

      {/* Linha Tad (limite) */}
      <line x1={padL} y1={yT(res.Tad)} x2={W - padR} y2={yT(res.Tad)} stroke={palette.bad} strokeWidth="1.5" strokeDasharray="6,4"/>
      <text x={W - padR - 4} y={yT(res.Tad) - 4} fill={palette.bad} fontSize="9" textAnchor="end" fontWeight="600">Tad = {res.Tad.toFixed(0)} kgf</text>

      {/* Área e linha da carga */}
      <path d={areaCarga} fill="url(#ten-grad)"/>
      <path d={pathCarga} fill="none" stroke={palette.primary} strokeWidth="2.5"/>
      <path d={pathVolta} fill="none" stroke={palette.copper} strokeWidth="2" strokeDasharray="5,3"/>

      {/* Pontos T1, T2 */}
      <circle cx={xT(maxX)} cy={yT(res.T1)} r={4} fill={palette.primary} stroke={palette.bg1} strokeWidth="1.5"/>
      <text x={xT(maxX) - 8} y={yT(res.T1) - 6} fill={palette.primary} fontSize="9" textAnchor="end" fontWeight="700">T1 = {res.T1.toFixed(0)}</text>

      <circle cx={xT(0)} cy={yT(res.T2)} r={4} fill={palette.copper} stroke={palette.bg1} strokeWidth="1.5"/>
      <text x={xT(0) + 8} y={yT(res.T2) - 6} fill={palette.copper} fontSize="9" fontWeight="700">T2 = {res.T2.toFixed(0)}</text>

      {/* Eixo X labels */}
      <text x={padL} y={H - padB + 16} fill={palette.muted} fontSize="9">0m (cauda)</text>
      <text x={W - padR} y={H - padB + 16} fill={palette.muted} fontSize="9" textAnchor="end">{maxX}m (cabeça)</text>
      <text x={W / 2} y={H - 5} fill={palette.muted} fontSize="9" textAnchor="middle">Posição ao longo da correia</text>
      <text x={20} y={H / 2} fill={palette.muted} fontSize="9" textAnchor="middle" transform={`rotate(-90 20 ${H / 2})`}>Tensão (kgf)</text>

      {/* Title */}
      <text x={W / 2} y={14} fill={palette.text} fontSize="11" textAnchor="middle" fontWeight="700">Perfil de Tensão da Correia</text>

      {/* Legend */}
      <g transform={`translate(${padL + 20}, ${padT + 14})`}>
        <line x1={0} y1={0} x2={20} y2={0} stroke={palette.primary} strokeWidth="2.5"/>
        <text x={24} y={3} fill={palette.text} fontSize="9">Lado tenso (carga)</text>
        <line x1={130} y1={0} x2={150} y2={0} stroke={palette.copper} strokeWidth="2" strokeDasharray="5,3"/>
        <text x={154} y={3} fill={palette.text} fontSize="9">Lado frouxo (retorno)</text>
      </g>
    </svg>
  );
}

// ============================================================
// BARRAS — Decomposição das resistências
// ============================================================
function ResistanceBars({ res, palette }: any) {
  if (!res) return null;
  const W = 760, H = 240, padL = 80, padR = 20, padT = 20, padB = 40;
  const items = [
    { l: "Tx (idlers)", v: res.Tx, c: palette.primary },
    { l: "Ty (correia)", v: res.Ty, c: palette.primaryLight },
    { l: "Tyr (retorno)", v: res.Tyr, c: palette.primaryDark },
    { l: "Tm (elev. mat.)", v: res.Tm, c: palette.copper },
    { l: "Tsb (skirts)", v: res.Tsb, c: palette.warn },
    { l: "Tbc (limpadores)", v: res.Tbc, c: palette.muted },
    { l: "Tpl (plows)", v: res.Tpl, c: palette.copperDark },
    { l: "Tam (acel.)", v: res.Tam, c: palette.ok },
  ];
  const maxV = Math.max(...items.map(i => i.v), 1);
  const bw = (W - padL - padR) / items.length - 8;
  const sy = (H - padT - padB) / maxV;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", background: palette.bg1, borderRadius: 8, border: `1px solid ${palette.border}` }}>
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={palette.muted} strokeWidth="1"/>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={palette.muted} strokeWidth="1"/>

      {items.map((it, i) => {
        const x = padL + 4 + i * (bw + 8);
        const h = it.v * sy;
        const y = H - padB - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} fill={it.c} opacity="0.85" rx={2}/>
            <text x={x + bw / 2} y={y - 4} fill={palette.text} fontSize="9" textAnchor="middle" fontWeight="600">{it.v.toFixed(0)}</text>
            <text x={x + bw / 2} y={H - padB + 14} fill={palette.muted} fontSize="8" textAnchor="middle">{it.l.split(" ")[0]}</text>
            <text x={x + bw / 2} y={H - padB + 24} fill={palette.muted} fontSize="7" textAnchor="middle">{it.l.split(" ").slice(1).join(" ")}</text>
          </g>
        );
      })}

      <text x={W / 2} y={14} fill={palette.text} fontSize="11" textAnchor="middle" fontWeight="700">Decomposição das Resistências (kgf) — Te = {res.Te.toFixed(0)}</text>
    </svg>
  );
}

// ============================================================
// VIEWER 3D — Three.js (CDN dinâmico) com perfil multi-trecho
// ============================================================
function ThreeViewer3D({ inp, res, pulleys, palette }: any) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    const load = async () => {
      try {
        const w: any = window;
        if (!w.THREE) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
            s.onload = () => resolve();
            s.onerror = () => reject();
            document.head.appendChild(s);
          });
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";
            s.onload = () => resolve();
            s.onerror = () => reject();
            document.head.appendChild(s);
          });
        }
        if (cancelled) return;
        const THREE = w.THREE;
        const mount = mountRef.current!;
        const W = mount.clientWidth;
        const H = 480;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(palette.bg1);
        scene.fog = new THREE.Fog(palette.bg1, 40, 200);

        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
        camera.position.set(25, 18, 35);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mount.innerHTML = "";
        mount.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 2, 0);

        // Luzes
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const dl = new THREE.DirectionalLight(0xffffff, 0.85);
        dl.position.set(20, 30, 15);
        scene.add(dl);
        const dl2 = new THREE.DirectionalLight(0x88aaff, 0.25);
        dl2.position.set(-15, 10, -20);
        scene.add(dl2);

        // Grid
        const grid = new THREE.GridHelper(60, 30, palette.border, palette.border);
        (grid.material as any).opacity = 0.4;
        (grid.material as any).transparent = true;
        scene.add(grid);

        // Cores
        const beltColor = new THREE.Color(palette.primary);
        const matColor = new THREE.Color(palette.copper);
        const drumColor = new THREE.Color(palette.copperDark);
        const idlerColor = new THREE.Color(palette.muted);
        const driveColor = new THREE.Color(palette.copper);

        // Calcula pontos do perfil 3D
        const segs = inp.segments;
        let cx = 0, cy = 0;
        const profile: { x: number; y: number }[] = [{ x: 0, y: 0 }];
        for (const seg of segs) {
          cx += seg.comp * Math.cos(seg.ang * Math.PI / 180);
          cy += seg.comp * Math.sin(seg.ang * Math.PI / 180);
          profile.push({ x: cx, y: cy });
        }
        const Lh = profile[profile.length - 1].x;
        const scale = 30 / (Lh || 1);
        const proj = profile.map(p => ({ x: p.x * scale - 15, y: p.y * scale + 1 }));

        const Bw = inp.larg_pol * 25.4 / 1000; // m
        const beltWidth3D = Math.max(Bw * 1.5, 1.2);

        // Constrói correia como tubos cilíndricos por trecho
        for (let i = 0; i < proj.length - 1; i++) {
          const a = proj[i], b = proj[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const ang = Math.atan2(dy, dx);
          const cxm = (a.x + b.x) / 2, cym = (a.y + b.y) / 2;

          // Lado de carga
          const loadGeo = new THREE.BoxGeometry(len, 0.12, beltWidth3D);
          const loadMat = new THREE.MeshStandardMaterial({ color: beltColor, metalness: 0.3, roughness: 0.6 });
          const loadMesh = new THREE.Mesh(loadGeo, loadMat);
          loadMesh.position.set(cxm, cym + 0.5, 0);
          loadMesh.rotation.z = ang;
          scene.add(loadMesh);

          // Material em cima
          const matGeo = new THREE.BoxGeometry(len * 0.95, 0.35, beltWidth3D * 0.7);
          const matMat = new THREE.MeshStandardMaterial({ color: matColor, metalness: 0.1, roughness: 0.85 });
          const matMesh = new THREE.Mesh(matGeo, matMat);
          matMesh.position.set(cxm, cym + 0.78, 0);
          matMesh.rotation.z = ang;
          scene.add(matMesh);

          // Lado de retorno (paralelo abaixo)
          const retMesh = new THREE.Mesh(loadGeo.clone(), new THREE.MeshStandardMaterial({ color: beltColor, metalness: 0.3, roughness: 0.6, opacity: 0.7, transparent: true }));
          retMesh.position.set(cxm, cym - 0.5, 0);
          retMesh.rotation.z = ang;
          scene.add(retMesh);

          // Roletes ao longo do trecho
          const idlerSpacing = inp.esp_rol * scale;
          const nIdlers = Math.max(2, Math.floor(len / idlerSpacing));
          for (let k = 0; k <= nIdlers; k++) {
            const f = k / nIdlers;
            const ix = a.x + (b.x - a.x) * f;
            const iy = a.y + (b.y - a.y) * f;
            // Rolete central
            const rollGeo = new THREE.CylinderGeometry(0.13, 0.13, beltWidth3D * 0.55, 12);
            const rollMat = new THREE.MeshStandardMaterial({ color: idlerColor, metalness: 0.7, roughness: 0.3 });
            const roll = new THREE.Mesh(rollGeo, rollMat);
            roll.position.set(ix, iy + 0.42, 0);
            roll.rotation.x = Math.PI / 2;
            scene.add(roll);
            // Roletes laterais
            [-1, 1].forEach(side => {
              const lat = new THREE.Mesh(rollGeo.clone(), rollMat);
              lat.position.set(ix, iy + 0.52, side * beltWidth3D * 0.4);
              lat.rotation.x = Math.PI / 2;
              lat.rotation.z = side * (inp.ang_rol * Math.PI / 180);
              scene.add(lat);
            });
          }
        }

        // Tambores nas posições editadas
        pulleys.forEach((p: any) => {
          const sx = p.x * scale - 15;
          // Encontra y interpolando
          let py = 0;
          for (let i = 0; i < profile.length - 1; i++) {
            if (p.x >= profile[i].x && p.x <= profile[i + 1].x) {
              const f = (p.x - profile[i].x) / (profile[i + 1].x - profile[i].x || 1);
              py = (proj[i].y + f * (proj[i + 1].y - proj[i].y));
              break;
            }
          }
          if (p.x >= profile[profile.length - 1].x) py = proj[proj.length - 1].y;

          const r = p.type === "drive" ? 0.9 : p.type === "tail" ? 0.75 : 0.55;
          const color = p.type === "drive" ? driveColor : drumColor;
          const drumGeo = new THREE.CylinderGeometry(r, r, beltWidth3D * 1.1, 32);
          const drumMat = new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.25 });
          const drum = new THREE.Mesh(drumGeo, drumMat);
          drum.position.set(sx, py + (p.side === "top" ? 0 : -1), 0);
          drum.rotation.x = Math.PI / 2;
          scene.add(drum);

          // Eixo
          const axisGeo = new THREE.CylinderGeometry(0.08, 0.08, beltWidth3D * 1.6, 12);
          const axis = new THREE.Mesh(axisGeo, new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 }));
          axis.position.copy(drum.position);
          axis.rotation.x = Math.PI / 2;
          scene.add(axis);
        });

        // Solo
        const groundGeo = new THREE.PlaneGeometry(80, 30);
        const groundMat = new THREE.MeshStandardMaterial({ color: palette.bg2, roughness: 0.95, metalness: 0 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        scene.add(ground);

        // Animation
        let raf = 0;
        const animate = () => {
          raf = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();
        setLoaded(true);

        const onResize = () => {
          if (!mount) return;
          const w = mount.clientWidth;
          renderer.setSize(w, H);
          camera.aspect = w / H;
          camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", onResize);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          renderer.dispose();
          mount.innerHTML = "";
        };
      } catch (e) {
        setError(true);
      }
    };
    load();
    return () => { cancelled = true; if (cleanup) cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(inp.segments), JSON.stringify(pulleys), inp.larg_pol, inp.ang_rol, inp.esp_rol, palette.bg1]);

  if (error) return <div style={{ padding: 20, color: palette.bad, textAlign: "center" }}>Erro ao carregar Three.js. Verifique a conexão.</div>;
  return (
    <div style={{ position: "relative" }}>
      <div ref={mountRef} style={{ width: "100%", height: 480, borderRadius: 8, overflow: "hidden", border: `1px solid ${palette.border}` }}/>
      {!loaded && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: palette.muted, fontSize: 11 }}>Carregando 3D…</div>}
    </div>
  );
}

// ============================================================
// CAMPO DE ENTRADA (módulo-level para evitar remonte a cada render)
// ============================================================
function FField({ label, val, set, unit, step = 1, type = "number", p }: any) {
  const lbl = { color: p.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.4 };
  const iSty: any = { background: p.bg0, color: p.text, border: `1px solid ${p.border}`, borderRadius: 5, padding: "6px 8px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none", fontVariantNumeric: "tabular-nums" };
  return (
    <div>
      <div style={lbl}>{label}{unit && <span style={{ color: p.copper, marginLeft: 4 }}>({unit})</span>}</div>
      <input type={type} value={val} step={step} onChange={(e: any) => set(type === "number" ? +e.target.value : e.target.value)} style={iSty}/>
    </div>
  );
}
function SelField({ label, val, set, opts, p }: any) {
  const lbl = { color: p.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.4 };
  const iSty: any = { background: p.bg0, color: p.text, border: `1px solid ${p.border}`, borderRadius: 5, padding: "6px 8px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none", fontVariantNumeric: "tabular-nums" };
  return (
    <div>
      <div style={lbl}>{label}</div>
      <select value={val} onChange={(e: any) => set(e.target.value)} style={iSty}>
        {opts.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function TransportadorMod({ onSave, user, UI }: any) {
  const SavedCalcs = UI?.SavedCalcs;

  const [inp, setI] = useState({
    // Material
    mat_key: "iron_ore_fines",
    mat_d: 2500, cap_th: 3240, phi_s: 20, phi_max_mat: 18,
    // Geometria — multi-trecho
    segments: [
      { comp: 19.6, ang: 0 },
    ],
    // Correia
    larg_pol: 72, ang_rol: 35, vel_ms: 2.5, Wb: 59.56, n_lonas: 4, cap_tens: 86298.5,
    // Roletes
    esp_rol: 1.0, esp_rol_ret: 3.0, idler_cl: "D", p_rol_carga: 40.01, p_rol_ret: 26.8,
    // Tambor motor
    d_tamb_mm: 630, ang_abr: 220, mu_lag: 0.35,
    // Acessórios
    n_limp: 2, comp_guias: 16, Cs: 0.0754, n_plows: 0, F_plow: 0,
    // Acionamento
    freq_hz: 60, n_polos: 4, n_ac: 2, ef_c: 0.94, ef_r: 0.94, ef_a: 0.96,
    // Tensionamento
    tens_type: "gravity",
    // Dinâmico
    Kst: 1.5, t_start: 8, t_brake: 10, a_brake: 0.3,
    // Chute entupido
    chute_plug: false, chute_area_m2: 1.2, mat_shear_kpa: 35,
  });

  const [pulleys, setPulleys] = useState<any[]>([
    { name: "Tambor de cabeça (motor)", label: "M", type: "drive", x: 19.6, side: "top" },
    { name: "Tambor de cauda", label: "C", type: "tail", x: 0, side: "top" },
    { name: "Tambor de tensionamento", label: "T", type: "takeup", x: 2, side: "bot" },
    { name: "Tambor de desvio (snub)", label: "S", type: "snub", x: 18, side: "bot" },
  ]);

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [res, setR] = useState<any>(null);
  const [tab, setTab] = useState(0);

  const s = (k: string, v: any) => setI(p => ({ ...p, [k]: v }));

  // Sincroniza tambores quando muda o comprimento total dos segmentos
  useEffect(() => {
    setR(calc(inp, pulleys));
    const Ltot = inp.segments.reduce((a: number, sg: any) => a + sg.comp, 0);
    setPulleys(prev => prev.map(p => p.type === "drive" ? { ...p, x: Math.min(p.x, Ltot) } : p));
  }, [inp, pulleys]);

  // Quando muda o material da DB, atualiza densidade etc
  useEffect(() => {
    if (inp.mat_key && inp.mat_key !== "custom") {
      const m = MATERIAL_DB[inp.mat_key];
      if (m) setI(p => ({ ...p, mat_d: m.rho, phi_s: m.phi_s, phi_max_mat: m.phi_max }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inp.mat_key]);

  // PALETA
  const palette = useMemo(() => theme === "dark" ? {
    bg0: "#0e1511", bg1: "#16201b", bg2: "#1d2922",
    border: "#2f3d34", text: "#e8efe9", muted: "#9ab3a3",
    primary: "#2d8c70", primaryDark: "#1f6651", primaryLight: "#4ab18e",
    copper: "#c97b3a", copperDark: "#8a4f1e",
    ok: "#5fb37a", warn: "#d4a13c", bad: "#d9656a",
    soft: "#243029",
  } : {
    bg0: "#f4f6f1", bg1: "#fbfcf9", bg2: "#f0f3ec",
    border: "#d6dfd4", text: "#1a2620", muted: "#5e6e63",
    primary: "#1f6651", primaryDark: "#134438", primaryLight: "#2d8c70",
    copper: "#a0501e", copperDark: "#6e3711",
    ok: "#2d7a48", warn: "#9b6a1d", bad: "#9b2c2c",
    soft: "#e6ede4",
  }, [theme]);

  const warnings = useMemo(() => res ? generateWarnings(inp, res) : [], [inp, res]);

  const handleLoad = (d: any) => { if (d.inp) setI(d.inp); if (d.res) setR(d.res); if (d.pulleys) setPulleys(d.pulleys); };

  // Helpers de UI
  const lbl = { color: palette.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.4 };
  const inputSty: any = {
    background: palette.bg0, color: palette.text, border: `1px solid ${palette.border}`,
    borderRadius: 5, padding: "6px 8px", fontSize: 12, fontFamily: "inherit",
    width: "100%", outline: "none", fontVariantNumeric: "tabular-nums",
  };
  const card: any = {
    background: palette.bg1, border: `1px solid ${palette.border}`,
    borderRadius: 8, padding: 16, marginBottom: 14,
  };
  const cardTitle: any = {
    color: palette.copper, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: 0.6, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${palette.border}`,
  };
  const grid = (n: number) => ({ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 12 });


  const tabs = [
    { l: "Material", i: 0 },
    { l: "Geometria", i: 1 },
    { l: "Correia / Roletes", i: 2 },
    { l: "Tambores", i: 3 },
    { l: "Tensionamento", i: 4 },
    { l: "Acionamento", i: 5 },
    { l: "Dinâmica / Chute", i: 11 },
    { l: "Resultados", i: 6 },
    { l: "2D Interativo", i: 7 },
    { l: "3D", i: 8 },
    { l: "Equações", i: 9 },
    { l: "Avisos", i: 10 },
  ];

  // ============== RENDER ==============
  return (
    <div style={{
      background: palette.bg0, color: palette.text,
      fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      margin: "-12px", minHeight: "100%", borderRadius: 8,
    }}>
      {/* HEADER */}
      <div style={{
        background: `linear-gradient(135deg, ${palette.primaryDark}, ${palette.primary})`,
        padding: "16px 22px", borderRadius: "8px 8px 0 0",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "rgba(255,255,255,0.14)", display: "grid", placeItems: "center",
            border: "1px solid rgba(255,255,255,0.22)", color: palette.copper, fontSize: 22, fontWeight: 800,
          }}>↗</div>
          <div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: 0.3 }}>Transportador de Correia</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 }}>CEMA 7th Edition · Análise Completa (Belt Analyst-style)</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{
            background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 6, padding: "7px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}>{theme === "dark" ? "☼ Claro" : "☾ Escuro"}</button>
          {SavedCalcs && <SavedCalcs user={user} moduleType="transportador" onLoad={handleLoad}/>}
          <button onClick={() => onSave?.({ type: "transportador", inp, res, pulleys })} style={{
            background: palette.copper, color: "#fff", border: "none", borderRadius: 6,
            padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>SALVAR</button>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{
        display: "flex", gap: 4, padding: "10px 14px 0", background: palette.bg1,
        borderBottom: `1px solid ${palette.border}`, flexWrap: "wrap",
      }}>
        {tabs.map(t => (
          <button key={t.i} onClick={() => setTab(t.i)} style={{
            background: tab === t.i ? palette.bg0 : "transparent",
            color: tab === t.i ? palette.copper : palette.muted,
            border: `1px solid ${tab === t.i ? palette.border : "transparent"}`,
            borderBottom: tab === t.i ? `1px solid ${palette.bg0}` : `1px solid transparent`,
            borderRadius: "6px 6px 0 0", padding: "8px 14px", fontSize: 11, fontWeight: tab === t.i ? 700 : 500,
            cursor: "pointer", fontFamily: "inherit", marginBottom: -1,
          }}>{t.l}</button>
        ))}
      </div>

      {/* MÉTRICAS PRINCIPAIS (sempre visíveis) */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8,
        padding: "14px 14px 0", background: palette.bg0,
      }}>
        {[
          { l: "Capacidade", v: res?.cap_real?.toFixed(0) || "—", u: "t/h", c: res?.cap_ok ? palette.ok : palette.bad },
          { l: "Velocidade", v: res?.V?.toFixed(2) || "—", u: "m/s", c: palette.text },
          { l: "Te", v: res?.Te?.toFixed(0) || "—", u: "kgf", c: palette.text },
          { l: "T1 / Tad", v: res ? `${res.T1.toFixed(0)} / ${res.Tad.toFixed(0)}` : "—", u: "kgf", c: res?.tension_ok ? palette.ok : palette.bad },
          { l: "Potência", v: res?.N_kw?.toFixed(1) || "—", u: "kW", c: palette.copper },
          { l: "P/motor", v: res?.N_per_kw?.toFixed(1) || "—", u: "kW", c: palette.copper },
          { l: "Redução", v: res?.i_red?.toFixed(1) || "—", u: ":1", c: palette.text },
          { l: "Au real", v: res?.fa?.Au?.toFixed(3) || "—", u: "m²", c: palette.text },
        ].map((m, i) => (
          <div key={i} style={{
            background: palette.bg1, border: `1px solid ${palette.border}`, borderLeft: `3px solid ${m.c}`,
            borderRadius: 6, padding: "8px 10px",
          }}>
            <div style={{ color: palette.muted, fontSize: 9, fontWeight: 600, textTransform: "uppercase" }}>{m.l}</div>
            <div style={{ color: m.c, fontSize: 16, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{m.v}</div>
            <div style={{ color: palette.muted, fontSize: 9 }}>{m.u}</div>
          </div>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: 14 }}>

        {/* === MATERIAL === */}
        {tab === 0 && (
          <div style={card}>
            <div style={cardTitle}>Material Transportado</div>
            <div style={grid(4)}>
              <SelField p={palette} label="Material" val={inp.mat_key} set={(v: any) => s("mat_key", v)}
                opts={Object.keys(MATERIAL_DB).map(k => ({ v: k, l: MATERIAL_DB[k].name }))}/>
              <FField p={palette} label="Densidade" val={inp.mat_d} set={(v: any) => s("mat_d", v)} unit="kg/m³"/>
              <FField p={palette} label="Capacidade" val={inp.cap_th} set={(v: any) => s("cap_th", v)} unit="t/h"/>
              <FField p={palette} label="Surcharge angle Φs" val={inp.phi_s} set={(v: any) => s("phi_s", v)} unit="°"/>
              <FField p={palette} label="Ângulo máx. transp." val={inp.phi_max_mat} set={(v: any) => s("phi_max_mat", v)} unit="°"/>
            </div>
            <div style={{ marginTop: 14, padding: 10, background: palette.bg0, borderRadius: 6, fontSize: 11, color: palette.muted }}>
              <strong style={{ color: palette.copper }}>Φs (surcharge):</strong> ângulo formado pelo material em movimento sobre a correia.
              Determina a área do "cap" superior na seção. Tipicamente 5°-10° abaixo do ângulo de repouso.
              <br/>
              <strong style={{ color: palette.copper }}>Φ máx:</strong> inclinação máxima na qual o material não escorrega.
              CEMA recomenda margem de 2°-5° abaixo deste valor.
            </div>
          </div>
        )}

        {/* === GEOMETRIA === */}
        {tab === 1 && (
          <div style={card}>
            <div style={cardTitle}>Perfil Geométrico (Multi-Trecho)</div>
            <div style={{ marginBottom: 12, color: palette.muted, fontSize: 11 }}>
              Defina até 4 trechos consecutivos com comprimentos e ângulos diferentes.
              Ângulos positivos = subida, negativos = descida. Mudanças de inclinação criam curvas (côncava ou convexa).
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
                  <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Trecho</th>
                  <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Comprimento (m)</th>
                  <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Ângulo (°)</th>
                  <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Tipo</th>
                  <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {inp.segments.map((seg: any, i: number) => {
                  const next = inp.segments[i + 1];
                  const tipo = !next ? "—" : (next.ang > seg.ang ? "côncava" : next.ang < seg.ang ? "convexa" : "reta");
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${palette.border}` }}>
                      <td style={{ padding: 8, color: palette.copper, fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: 8 }}>
                        <input type="number" value={seg.comp} step={1}
                          onChange={(e: any) => {
                            const v = +e.target.value;
                            setI(p => ({ ...p, segments: p.segments.map((s: any, j: number) => j === i ? { ...s, comp: v } : s) }));
                          }}
                          style={{ ...inputSty, width: 100 }}/>
                      </td>
                      <td style={{ padding: 8 }}>
                        <input type="number" value={seg.ang} step={0.5}
                          onChange={(e: any) => {
                            const v = +e.target.value;
                            setI(p => ({ ...p, segments: p.segments.map((s: any, j: number) => j === i ? { ...s, ang: v } : s) }));
                          }}
                          style={{ ...inputSty, width: 100 }}/>
                      </td>
                      <td style={{ padding: 8, color: palette.muted, fontSize: 11 }}>{tipo}</td>
                      <td style={{ padding: 8 }}>
                        {inp.segments.length > 1 && (
                          <button onClick={() => setI(p => ({ ...p, segments: p.segments.filter((_: any, j: number) => j !== i) }))}
                            style={{ background: palette.bad, color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>
                            Remover
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {inp.segments.length < 4 && (
              <button onClick={() => setI(p => ({ ...p, segments: [...p.segments, { comp: 10, ang: 0 }] }))}
                style={{
                  marginTop: 12, background: palette.primary, color: "#fff", border: "none",
                  borderRadius: 5, padding: "8px 14px", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                + Adicionar Trecho
              </button>
            )}

            {res && (
              <div style={{ marginTop: 16, padding: 12, background: palette.bg0, borderRadius: 6 }}>
                <div style={lbl}>Resumo Geométrico</div>
                <div style={{ ...grid(4), marginTop: 8 }}>
                  <div><span style={{ color: palette.muted, fontSize: 10 }}>L total: </span><strong style={{ color: palette.text }}>{res.L_total.toFixed(1)} m</strong></div>
                  <div><span style={{ color: palette.muted, fontSize: 10 }}>L horizontal: </span><strong style={{ color: palette.text }}>{res.L_h.toFixed(1)} m</strong></div>
                  <div><span style={{ color: palette.muted, fontSize: 10 }}>H total: </span><strong style={{ color: palette.text }}>{res.H_total.toFixed(2)} m</strong></div>
                  <div><span style={{ color: palette.muted, fontSize: 10 }}>β eq: </span><strong style={{ color: palette.copper }}>{res.beta_eq.toFixed(2)}°</strong></div>
                  <div><span style={{ color: palette.muted, fontSize: 10 }}>R mín. convexa: </span><strong style={{ color: palette.text }}>{res.radii.R_convex.toFixed(0)} m</strong></div>
                  <div><span style={{ color: palette.muted, fontSize: 10 }}>R mín. côncava: </span><strong style={{ color: palette.text }}>{res.radii.R_concave.toFixed(0)} m</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === CORREIA / ROLETES === */}
        {tab === 2 && (
          <>
            <div style={card}>
              <div style={cardTitle}>Correia</div>
              <div style={grid(4)}>
                <SelField p={palette} label="Largura" val={inp.larg_pol} set={(v: any) => s("larg_pol", +v)}
                  opts={BW_OPTIONS.map(b => ({ v: b, l: `${b}" (${(b * 25.4).toFixed(0)} mm)` }))}/>
                <FField p={palette} label="Velocidade" val={inp.vel_ms} set={(v: any) => s("vel_ms", v)} unit="m/s" step={0.1}/>
                <FField p={palette} label="Peso correia (Wb)" val={inp.Wb} set={(v: any) => s("Wb", v)} unit="kgf/m" step={0.1}/>
                <FField p={palette} label="Ângulo rolete (λ)" val={inp.ang_rol} set={(v: any) => s("ang_rol", v)} unit="°"/>
                <FField p={palette} label="Nº de lonas" val={inp.n_lonas} set={(v: any) => s("n_lonas", v)}/>
                <FField p={palette} label="Resist. lonas" val={inp.cap_tens} set={(v: any) => s("cap_tens", v)} unit="N/m" step={100}/>
              </div>
            </div>
            <div style={card}>
              <div style={cardTitle}>Roletes</div>
              <div style={grid(4)}>
                <SelField p={palette} label="Classe CEMA" val={inp.idler_cl} set={(v: any) => s("idler_cl", v)}
                  opts={Object.keys(IDLER_CLASS).map(k => ({ v: k, l: IDLER_CLASS[k].l }))}/>
                <FField p={palette} label="Espaç. carga (Si)" val={inp.esp_rol} set={(v: any) => s("esp_rol", v)} unit="m" step={0.1}/>
                <FField p={palette} label="Espaç. retorno" val={inp.esp_rol_ret} set={(v: any) => s("esp_rol_ret", v)} unit="m" step={0.1}/>
                <FField p={palette} label="Peso rolete carga" val={inp.p_rol_carga} set={(v: any) => s("p_rol_carga", v)} unit="kgf"/>
                <FField p={palette} label="Peso rolete retorno" val={inp.p_rol_ret} set={(v: any) => s("p_rol_ret", v)} unit="kgf"/>
              </div>
            </div>
            <div style={card}>
              <div style={cardTitle}>Seção Transversal — Área de Enchimento</div>
              <CrossSection inp={inp} res={res} palette={palette}/>
            </div>
          </>
        )}

        {/* === TAMBORES === */}
        {tab === 3 && (
          <>
            <div style={card}>
              <div style={cardTitle}>Tambor Motor (Cabeça)</div>
              <div style={grid(4)}>
                <FField p={palette} label="Diâmetro" val={inp.d_tamb_mm} set={(v: any) => s("d_tamb_mm", v)} unit="mm"/>
                <FField p={palette} label="Ângulo abraçamento" val={inp.ang_abr} set={(v: any) => s("ang_abr", v)} unit="°"/>
                <FField p={palette} label="μ (atrito lagging)" val={inp.mu_lag} set={(v: any) => s("mu_lag", v)} step={0.05}/>
              </div>
            </div>
            <div style={card}>
              <div style={cardTitle}>Tambores no Sistema (Posicionáveis)</div>
              <div style={{ color: palette.muted, fontSize: 11, marginBottom: 12 }}>
                Configure cada tambor: tipo, posição (m), e lado (carga/retorno). Você também pode arrastar visualmente na aba "2D Interativo".
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
                    <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Nome</th>
                    <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Tipo</th>
                    <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Posição (m)</th>
                    <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Lado</th>
                    <th style={{ ...lbl, textAlign: "left", padding: 8 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pulleys.map((p, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${palette.border}` }}>
                      <td style={{ padding: 6 }}>
                        <input value={p.name} onChange={(e: any) => setPulleys(prev => prev.map((q, j) => j === i ? { ...q, name: e.target.value } : q))}
                          style={{ ...inputSty, width: 220 }}/>
                      </td>
                      <td style={{ padding: 6 }}>
                        <select value={p.type} onChange={(e: any) => setPulleys(prev => prev.map((q, j) => j === i ? { ...q, type: e.target.value } : q))}
                          style={{ ...inputSty, width: 120 }}>
                          <option value="drive">Motor</option>
                          <option value="tail">Cauda</option>
                          <option value="takeup">Tensionamento</option>
                          <option value="snub">Snub (desvio)</option>
                          <option value="bend">Bend (retorno)</option>
                        </select>
                      </td>
                      <td style={{ padding: 6 }}>
                        <input type="number" value={p.x.toFixed(2)} step={0.5}
                          onChange={(e: any) => setPulleys(prev => prev.map((q, j) => j === i ? { ...q, x: +e.target.value } : q))}
                          style={{ ...inputSty, width: 90 }}/>
                      </td>
                      <td style={{ padding: 6 }}>
                        <select value={p.side} onChange={(e: any) => setPulleys(prev => prev.map((q, j) => j === i ? { ...q, side: e.target.value } : q))}
                          style={{ ...inputSty, width: 100 }}>
                          <option value="top">Carga</option>
                          <option value="bot">Retorno</option>
                        </select>
                      </td>
                      <td style={{ padding: 6 }}>
                        <button onClick={() => setPulleys(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: palette.bad, color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setPulleys(prev => [...prev, { name: "Novo tambor", label: `${prev.length + 1}`, type: "bend", x: 5, side: "bot" }])}
                style={{
                  marginTop: 12, background: palette.primary, color: "#fff", border: "none",
                  borderRadius: 5, padding: "8px 14px", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                + Adicionar Tambor
              </button>
            </div>
          </>
        )}

        {/* === TENSIONAMENTO === */}
        {tab === 4 && (
          <>
            <div style={card}>
              <div style={cardTitle}>Tipo de Tensionamento</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {[
                  { v: "gravity", l: "Gravidade (Contrapeso)", desc: "Torre vertical com contrapeso. Mantém T2 constante." },
                  { v: "screw", l: "Parafuso (Screw take-up)", desc: "Ajuste manual via parafuso. Sem absorção dinâmica." },
                  { v: "automatic", l: "Automático (Winch/Hidráulico)", desc: "Atuador motorizado. Resposta dinâmica controlada." },
                ].map(opt => (
                  <button key={opt.v} onClick={() => s("tens_type", opt.v)} style={{
                    flex: 1, background: inp.tens_type === opt.v ? palette.primary : palette.bg0,
                    color: inp.tens_type === opt.v ? "#fff" : palette.text,
                    border: `1px solid ${inp.tens_type === opt.v ? palette.primary : palette.border}`,
                    borderRadius: 6, padding: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{opt.l}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {res && (
                <div style={{ padding: 14, background: palette.bg0, borderRadius: 6 }}>
                  {inp.tens_type === "gravity" && (
                    <>
                      <div style={lbl}>Peso do Contrapeso Necessário</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: palette.copper, marginTop: 4 }}>
                        {res.Wcp.toFixed(0)} <span style={{ fontSize: 14, color: palette.muted }}>kgf</span>
                      </div>
                      <div style={{ fontSize: 11, color: palette.muted, marginTop: 8 }}>
                        Wcp = 2 × T2 = 2 × {res.T2.toFixed(0)} kgf<br/>
                        Curso recomendado: {(res.L_total * 0.015).toFixed(2)} m (1.5% do comprimento)
                      </div>
                    </>
                  )}
                  {inp.tens_type === "screw" && (
                    <>
                      <div style={lbl}>Curso do Parafuso de Ajuste</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: palette.copper, marginTop: 4 }}>
                        {res.screw_travel.toFixed(0)} <span style={{ fontSize: 14, color: palette.muted }}>mm</span>
                      </div>
                      <div style={{ fontSize: 11, color: palette.muted, marginTop: 8 }}>
                        Curso = L × 1.5% (elongação típica de correias têxteis)<br/>
                        ⚠️ Não absorve variações dinâmicas — adequado apenas para L &lt; 60m.
                      </div>
                    </>
                  )}
                  {inp.tens_type === "automatic" && (
                    <>
                      <div style={lbl}>Força Aplicada pelo Atuador</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: palette.copper, marginTop: 4 }}>
                        {res.auto_force.toFixed(0)} <span style={{ fontSize: 14, color: palette.muted }}>kgf</span>
                      </div>
                      <div style={{ fontSize: 11, color: palette.muted, marginTop: 8 }}>
                        F = 2 × T2. Sistema mantém T2 ajustável dinamicamente conforme a carga.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* === ACIONAMENTO + ACESSÓRIOS === */}
        {tab === 5 && (
          <>
            <div style={card}>
              <div style={cardTitle}>Motor Elétrico</div>
              <div style={grid(4)}>
                <FField p={palette} label="Frequência" val={inp.freq_hz} set={(v: any) => s("freq_hz", v)} unit="Hz"/>
                <FField p={palette} label="Polos" val={inp.n_polos} set={(v: any) => s("n_polos", v)}/>
                <FField p={palette} label="Nº acionamentos" val={inp.n_ac} set={(v: any) => s("n_ac", v)}/>
                <FField p={palette} label="η correias" val={inp.ef_c} set={(v: any) => s("ef_c", v)} step={0.01}/>
                <FField p={palette} label="η redutor" val={inp.ef_r} set={(v: any) => s("ef_r", v)} step={0.01}/>
                <FField p={palette} label="η acoplamento" val={inp.ef_a} set={(v: any) => s("ef_a", v)} step={0.01}/>
              </div>
            </div>
            <div style={card}>
              <div style={cardTitle}>Acessórios (Resistências Adicionais)</div>
              <div style={grid(4)}>
                <FField p={palette} label="Nº limpadores" val={inp.n_limp} set={(v: any) => s("n_limp", v)}/>
                <FField p={palette} label="Comp. guias" val={inp.comp_guias} set={(v: any) => s("comp_guias", v)} unit="m"/>
                <FField p={palette} label="Coef. skirt (Cs)" val={inp.Cs} set={(v: any) => s("Cs", v)} step={0.001}/>
                <FField p={palette} label="Nº plows" val={inp.n_plows} set={(v: any) => s("n_plows", v)}/>
                <FField p={palette} label="F por plow" val={inp.F_plow} set={(v: any) => s("F_plow", v)} unit="kgf"/>
              </div>
            </div>
          </>
        )}

        {/* === RESULTADOS === */}
        {tab === 6 && res && (
          <>
            <div style={card}>
              <div style={cardTitle}>Resistências CEMA — Decomposição</div>
              <ResistanceBars res={res} palette={palette}/>
            </div>
            <div style={card}>
              <div style={cardTitle}>Perfil de Tensão</div>
              <TensionChart res={res} palette={palette}/>
            </div>
            <div style={card}>
              <div style={cardTitle}>Tabela Completa de Saídas</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <tbody>
                  {[
                    ["Velocidade real (V)", res.V.toFixed(3), "m/s"],
                    ["Velocidade mínima exigida", res.V_min?.toFixed(3) || "—", "m/s"],
                    ["Capacidade real", res.cap_real.toFixed(0), "t/h"],
                    ["Peso do material por metro (Wm)", res.Wm.toFixed(2), "kgf/m"],
                    ["Área de enchimento real (Au)", res.fa.Au.toFixed(4), "m²"],
                    ["Au referência CEMA", res.fa_ref.Au.toFixed(4), "m²"],
                    ["Fator de utilização (Ku)", res.Ku.toFixed(3), "-"],
                    ["Largura útil (b)", (res.fa.b_util * 1000).toFixed(0), "mm"],
                    ["Coeficiente Ky (flexão correia)", res.Ky.toFixed(4), "-"],
                    ["Coeficiente Kx (flexão idlers)", res.Kx.toFixed(4), "-"],
                    ["Te (tensão efetiva)", res.Te.toFixed(0), "kgf"],
                    ["T1 (lado tenso)", res.T1.toFixed(0), "kgf"],
                    ["T2 (lado frouxo)", res.T2.toFixed(0), "kgf"],
                    ["Tad (admissível)", res.Tad.toFixed(0), "kgf"],
                    ["T sag (mín.)", res.T_sag.toFixed(0), "kgf"],
                    ["Cw (Euler)", res.Cw.toFixed(3), "-"],
                    ["Potência total", res.N_kw.toFixed(2), "kW"],
                    ["Potência por motor", res.N_per_kw.toFixed(2), "kW"],
                    ["Rotação tambor motor", res.n_tamb.toFixed(2), "rpm"],
                    ["Relação de redução", res.i_red.toFixed(2), ":1"],
                    ["Raio mín. convexa", res.radii.R_convex.toFixed(0), "m"],
                    ["Raio mín. côncava", res.radii.R_concave.toFixed(0), "m"],
                  ].map(([l, v, u], i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${palette.border}` }}>
                      <td style={{ padding: "7px 8px", color: palette.muted }}>{l}</td>
                      <td style={{ padding: "7px 8px", color: palette.text, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v}</td>
                      <td style={{ padding: "7px 8px", color: palette.copper, fontSize: 10, width: 60 }}>{u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* === 2D INTERATIVO === */}
        {tab === 7 && (
          <div style={card}>
            <div style={cardTitle}>Vista Lateral 2D — Editor Interativo (realimenta cálculos)</div>
            {res && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12, padding: 10, background: palette.bg0, borderRadius: 6 }}>
                {[
                  { l: "θ real (c/ snub)", v: `${res.ang_abr_real.toFixed(0)}°`, c: palette.copper },
                  { l: "Cw efetivo", v: res.Cw.toFixed(3), c: palette.text },
                  { l: "T2 fator (tu)", v: res.T2_factor.toFixed(3), c: palette.warn },
                  { l: "T1 resultante", v: `${res.T1.toFixed(0)} kgf`, c: res.tension_ok ? palette.ok : palette.bad },
                  { l: "T2 resultante", v: `${res.T2.toFixed(0)} kgf`, c: palette.primary },
                ].map((m, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: palette.muted, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
                    <div style={{ fontSize: 14, color: m.c, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{m.v}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: palette.muted, marginBottom: 8 }}>
              ℹ Arraste os tambores: <strong>snub</strong> próximo ao motor aumenta θ (até +40°); <strong>tensionamento</strong> afastado da cauda aumenta T2 (até +15%). Os valores acima e os resultados em todas as abas são recalculados em tempo real.
            </div>
            <InteractiveProfile2D inp={inp} res={res} palette={palette} pulleys={pulleys} setPulleys={setPulleys}/>
          </div>
        )}

        {/* === 3D === */}
        {tab === 8 && (
          <div style={card}>
            <div style={cardTitle}>Visualização 3D — Three.js</div>
            <ThreeViewer3D inp={inp} res={res} pulleys={pulleys} palette={palette}/>
            <div style={{ marginTop: 10, fontSize: 10, color: palette.muted }}>
              Use o mouse para orbitar, zoom (scroll) e pan (botão direito). A correia é renderizada por trechos respeitando os ângulos definidos em "Geometria".
            </div>
          </div>
        )}

        {/* === EQUAÇÕES === */}
        {tab === 9 && (
          <>
            <div style={card}>
              <div style={cardTitle}>Equações Principais — CEMA 7th Edition</div>
              <div style={{ display: "grid", gap: 14 }}>
                {[
                  { t: "Tensão Efetiva", f: "Te = Tx + Ty + Tyr + Tm + Tb + Tsb + Tbc + Tpl + Tam", d: "Soma vetorial de todas as resistências ao movimento da correia carregada." },
                  { t: "Flexão dos roletes (Tx)", f: "Tx = Kx · L", d: "Kx = 0.00068·(Wb + Wm) + A1/Si  — onde A1 é a constante CEMA da classe do rolete." },
                  { t: "Flexão da correia (Ty)", f: "Ty = Ky · L · (Wb + Wm)", d: "Ky depende do comprimento total (interpolação CEMA Tab 6.1)." },
                  { t: "Elevação do material (Tm)", f: "Tm = H · Wm", d: "H = elevação total acumulada de todos os trechos." },
                  { t: "Tensão T1 (Euler)", f: "T1 = Te · Cw / (Cw − 1),   Cw = e^(μ·θ)", d: "θ em radianos. μ ≈ 0.35 com lagging, 0.25 sem lagging." },
                  { t: "Tensão admissível", f: "Tad = (σ_lonas · B) / g", d: "σ_lonas em N/m, B em metros, resultado em kgf." },
                  { t: "Tensão de sag mínima", f: "T_sag = Si · (Wb + Wm) / (8 · sag_max)", d: "sag_max ≤ 2% do espaçamento dos roletes." },
                  { t: "Potência total", f: "P = (Te · g · V) / (η · 1000)", d: "Resultado em kW. η = ηcorreias · ηredutor · ηacoplamento." },
                  { t: "Área de enchimento", f: "Au = A_trapézio + A_cap", d: "A_trapézio = f(λ, b);  A_cap = (bs/2)² · tan(Φs)" },
                  { t: "Raio mínimo convexa", f: "Rmin = T1 / (Wb · cos β)", d: "Evita que a correia descole do tambor em uma curva convexa." },
                  { t: "Raio mínimo côncava", f: "Rmin = 1.5 · T1 / (Wb · cos β)", d: "Evita levantamento da correia em curvas côncavas (mais crítico)." },
                ].map((eq, i) => (
                  <div key={i} style={{ padding: 12, background: palette.bg0, borderRadius: 6, borderLeft: `3px solid ${palette.copper}` }}>
                    <div style={{ color: palette.copper, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{eq.t}</div>
                    <div style={{ fontFamily: '"Cambria Math", "Times New Roman", serif', fontSize: 16, color: palette.text, margin: "8px 0", fontStyle: "italic" }}>{eq.f}</div>
                    <div style={{ fontSize: 11, color: palette.muted }}>{eq.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* === DINÂMICA / CHUTE === */}
        {tab === 11 && (
          <>
            <div style={card}>
              <div style={cardTitle}>Parâmetros de Partida e Frenagem (CEMA 14.5/14.6)</div>
              <div style={grid(4)}>
                <FField p={palette} label="Fator de partida Kst" val={inp.Kst} set={(v: any) => s("Kst", v)} step={0.1}/>
                <FField p={palette} label="Tempo de partida" val={inp.t_start} set={(v: any) => s("t_start", v)} unit="s"/>
                <FField p={palette} label="Tempo de frenagem" val={inp.t_brake} set={(v: any) => s("t_brake", v)} unit="s"/>
                <FField p={palette} label="Desacel. frenagem" val={inp.a_brake} set={(v: any) => s("a_brake", v)} unit="m/s²" step={0.05}/>
              </div>
              <div style={{ marginTop: 12, padding: 10, background: palette.bg0, borderRadius: 6, fontSize: 10, color: palette.muted }}>
                <strong style={{ color: palette.copper }}>Kst:</strong> típico 1.3 (partida suave) a 1.8 (partida direta). Regula o pico de Te na aceleração.<br/>
                <strong style={{ color: palette.copper }}>t_start:</strong> tempo para atingir velocidade nominal. Maior = menor pico.<br/>
                <strong style={{ color: palette.copper }}>a_brake:</strong> CEMA recomenda 0.2–0.5 m/s² para cargas normais; inferior a 0.3 para transportadores inclinados descendentes.
              </div>
            </div>

            {res && (
              <div style={card}>
                <div style={cardTitle}>Regime de Partida</div>
                <div style={{ ...grid(4), marginBottom: 10 }}>
                  {[
                    { l: "Massa total inercial", v: res.mass_total.toFixed(0), u: "kg" },
                    { l: "Aceleração", v: res.a_start.toFixed(3), u: "m/s²" },
                    { l: "Força inercial Fi", v: res.Fi_start.toFixed(0), u: "kgf" },
                    { l: "Te partida", v: res.Te_start.toFixed(0), u: "kgf", c: palette.warn },
                    { l: "T1 partida", v: res.T1_start.toFixed(0), u: "kgf", c: res.start_ok ? palette.ok : palette.bad },
                    { l: "Potência pico", v: res.P_start_kw.toFixed(1), u: "kW", c: palette.copper },
                    { l: "Torque pico (tambor)", v: res.torque_peak_start.toFixed(0), u: "N.m", c: palette.copper },
                    { l: "Status", v: res.start_ok ? "OK" : "EXCEDE Tad", u: "", c: res.start_ok ? palette.ok : palette.bad },
                  ].map((m, i) => (
                    <div key={i} style={{ background: palette.bg0, borderLeft: `3px solid ${m.c || palette.text}`, borderRadius: 5, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: palette.muted, textTransform: "uppercase" }}>{m.l}</div>
                      <div style={{ fontSize: 14, color: m.c || palette.text, fontWeight: 700, marginTop: 2 }}>{m.v}</div>
                      <div style={{ fontSize: 9, color: palette.muted }}>{m.u}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {res && (
              <div style={card}>
                <div style={cardTitle}>Regime de Frenagem</div>
                <div style={grid(4)}>
                  {[
                    { l: "Te frenagem", v: res.Te_brake.toFixed(0), u: "kgf" },
                    { l: "T1 frenagem", v: res.T1_brake.toFixed(0), u: "kgf", c: res.brake_ok ? palette.ok : palette.bad },
                    { l: "Distância parada", v: res.stop_distance.toFixed(1), u: "m" },
                    { l: "Status", v: res.brake_ok ? "OK" : "EXCEDE Tad", u: "", c: res.brake_ok ? palette.ok : palette.bad },
                  ].map((m, i) => (
                    <div key={i} style={{ background: palette.bg0, borderLeft: `3px solid ${m.c || palette.text}`, borderRadius: 5, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: palette.muted, textTransform: "uppercase" }}>{m.l}</div>
                      <div style={{ fontSize: 14, color: m.c || palette.text, fontWeight: 700, marginTop: 2 }}>{m.v}</div>
                      <div style={{ fontSize: 9, color: palette.muted }}>{m.u}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={card}>
              <div style={cardTitle}>Chute Entupido (Plugged Chute) — Cisalhamento do Material</div>
              <div style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={inp.chute_plug} onChange={(e: any) => s("chute_plug", e.target.checked)}/>
                  <span style={{ color: palette.text, fontSize: 12, fontWeight: 600 }}>Simular chute entupido</span>
                </label>
              </div>
              <div style={grid(4)}>
                <FField p={palette} label="Área contato chute" val={inp.chute_area_m2} set={(v: any) => s("chute_area_m2", v)} unit="m²" step={0.1}/>
                <FField p={palette} label="Cisalhamento τ material" val={inp.mat_shear_kpa} set={(v: any) => s("mat_shear_kpa", v)} unit="kPa"/>
              </div>
              <div style={{ marginTop: 12, padding: 10, background: palette.bg0, borderRadius: 6, fontSize: 10, color: palette.muted }}>
                <strong style={{ color: palette.copper }}>τ típicos:</strong> minério de ferro 30-50 kPa, carvão 15-25 kPa, calcário 20-40 kPa.<br/>
                Força de cisalhamento: <em>F = τ · A</em> — aparece como carga adicional em Te se a correia for energizada com o chute obstruído.
              </div>

              {res && inp.chute_plug && (
                <div style={{ marginTop: 14, padding: 14, background: palette.bg0, borderRadius: 6, borderLeft: `4px solid ${palette.bad}` }}>
                  <div style={{ fontSize: 11, color: palette.bad, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>⚠ Pior Caso: Partida com Chute Entupido</div>
                  <div style={grid(4)}>
                    {[
                      { l: "F cisalhamento", v: res.F_shear_plug.toFixed(0), u: "kgf" },
                      { l: "Te com chute", v: res.Te_plug.toFixed(0), u: "kgf" },
                      { l: "Te partida+chute", v: res.Te_start_plug.toFixed(0), u: "kgf", c: palette.warn },
                      { l: "T1 pior caso", v: res.T1_start_plug.toFixed(0), u: "kgf", c: res.plug_ok ? palette.ok : palette.bad },
                      { l: "Torque pico tambor", v: res.torque_peak_worst.toFixed(0), u: "N.m", c: palette.copper },
                      { l: "Tad admissível", v: res.Tad.toFixed(0), u: "kgf" },
                      { l: "Margem", v: ((res.Tad - res.T1_start_plug) / res.Tad * 100).toFixed(1), u: "%", c: res.plug_ok ? palette.ok : palette.bad },
                      { l: "Status", v: res.plug_ok ? "APROVADO" : "REPROVADO", u: "", c: res.plug_ok ? palette.ok : palette.bad },
                    ].map((m, i) => (
                      <div key={i} style={{ background: palette.bg1, borderLeft: `3px solid ${m.c || palette.text}`, borderRadius: 5, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: palette.muted, textTransform: "uppercase" }}>{m.l}</div>
                        <div style={{ fontSize: 14, color: m.c || palette.text, fontWeight: 700, marginTop: 2 }}>{m.v}</div>
                        <div style={{ fontSize: 9, color: palette.muted }}>{m.u}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* === AVISOS === */}
        {tab === 10 && (
          <div style={card}>
            <div style={cardTitle}>Avisos e Validações</div>
            <div style={{ display: "grid", gap: 8 }}>
              {warnings.map((w, i) => {
                const c = w.level === "ok" ? palette.ok : w.level === "warn" ? palette.warn : palette.bad;
                const icon = w.level === "ok" ? "✓" : w.level === "warn" ? "⚠" : "✕";
                return (
                  <div key={i} style={{
                    display: "flex", gap: 12, padding: 12, background: palette.bg0,
                    border: `1px solid ${c}55`, borderLeft: `4px solid ${c}`, borderRadius: 6,
                  }}>
                    <div style={{ color: c, fontSize: 18, fontWeight: 800 }}>{icon}</div>
                    <div style={{ color: palette.text, fontSize: 12, lineHeight: 1.5 }}>{w.text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
