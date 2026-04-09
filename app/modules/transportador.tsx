// app/modules/transportador.tsx
// ============================================================
// MÓDULO: TRANSPORTADOR DE CORREIA — CEMA 7th Edition
// Redesign inspirado em Mill Trommel Worksheet
// Paleta original: Azul-petróleo + Cobre + Grafite
// ============================================================
"use client";
import { useState, useEffect, useRef } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, Cell } from "recharts";

export const CONFIG = {
  id: "transportador",
  name: "Transportador de Correia",
  subtitle: "CEMA 7th Edition",
  icon: "⟹",
  color: "#0a9396",
  price: 299.90,
  description: "Cálculo completo conforme CEMA 7th Edition. Potência, tensões, roletes, tambores, contrapeso, capacidade, perfil de tensão e visualização 3D interativa.",
  norma: "CEMA 7th Ed. · Manual FAÇO",
};

export const GLOSSARY = [
  { cat: "ENTRADA", items: [
    { s: "mat_d", d: "Densidade do material transportado", u: "kg/m³" },
    { s: "cap_th", d: "Capacidade de projeto do transportador", u: "t/h" },
    { s: "vel_ms", d: "Velocidade da correia", u: "m/s" },
    { s: "comp_m", d: "Comprimento centro a centro", u: "m" },
    { s: "elev_m", d: "Elevação (desnível) entre cauda e cabeça", u: "m" },
    { s: "larg_pol", d: "Largura da correia", u: "pol" },
    { s: "esp_rol", d: "Espaçamento entre roletes de carga", u: "m" },
    { s: "d_tamb_mm", d: "Diâmetro do tambor motriz", u: "mm" },
    { s: "ang_abr", d: "Ângulo de abraçamento do tambor motriz", u: "°" },
    { s: "Wb", d: "Peso da correia por metro", u: "kgf/m" },
    { s: "cap_tens", d: "Capacidade de tensão da correia", u: "N/m" },
    { s: "Cs", d: "Fator de atrito material/guias (CEMA Tab. 6-7)", u: "-" },
  ]},
  { cat: "SAÍDA", items: [
    { s: "V", d: "Velocidade utilizada (máx entre projeto e requerida)", u: "m/s" },
    { s: "Wm", d: "Peso do material na correia por metro", u: "kgf/m" },
    { s: "Te", d: "Tensão efetiva na correia (força motriz)", u: "kgf" },
    { s: "Ne/N_hp/N_kw", d: "Potência efetiva, motor total (HP, kW)", u: "HP/kW" },
    { s: "T1/T2", d: "Tensões lado tenso e frouxo", u: "kgf" },
    { s: "Tad", d: "Tensão admissível da correia", u: "kgf" },
  ]},
];

// --- Dados CEMA ---
const KY_T = [{ l: 15, k: .04 }, { l: 30, k: .035 }, { l: 60, k: .033 }, { l: 120, k: .032 }, { l: 240, k: .031 }, { l: 300, k: .03 }, { l: 420, k: .028 }, { l: 600, k: .025 }, { l: 730, k: .024 }, { l: 900, k: .022 }];
function interpKy(L: number) {
  if (L <= KY_T[0].l) return KY_T[0].k;
  if (L >= KY_T[KY_T.length - 1].l) return KY_T[KY_T.length - 1].k;
  for (let i = 0; i < KY_T.length - 1; i++) {
    if (L >= KY_T[i].l && L <= KY_T[i + 1].l) {
      return KY_T[i].k + (L - KY_T[i].l) / (KY_T[i + 1].l - KY_T[i].l) * (KY_T[i + 1].k - KY_T[i].k);
    }
  }
  return .03;
}
const CEMA_CAP: any = { 18: 62, 24: 115, 30: 186, 36: 272, 42: 374, 48: 492, 54: 627, 60: 778, 72: 1128, 84: 1548, 96: 2034 };
const IDLERS: any = { B: { l: "CEMA B", x: 0.88 }, C: { l: "CEMA C", x: 1.00 }, D: { l: "CEMA D", x: 1.09 }, E: { l: "CEMA E", x: 1.18 } };
const BW = [18, 24, 30, 36, 42, 48, 54, 60, 72, 84, 96];

function calc(inp: any) {
  const g = 9.81;
  const { mat_d, cap_th, vel_ms, comp_m, elev_m, larg_pol, esp_rol, d_tamb_mm, ang_abr, n_limp, Wb, cap_tens, idler_cl, freq_hz, n_polos, p_rol_carga, comp_guias, Cs, Ft_flex, ef_c = 0.94, ef_r = 0.94, ef_a = 0.96, n_ac = 1 } = inp;
  const cap_vol = CEMA_CAP[larg_pol] || 500;
  const V_min_req = cap_th / (mat_d / 1000 * cap_vol);
  const V = Math.max(vel_ms, V_min_req);
  const Wm = cap_th * 1000 / (3600 * V);
  const Ky = interpKy(comp_m);
  const idx = IDLERS[idler_cl] || IDLERS.C;
  const Kx = 0.00068 * (Wb + Wm) + idx.x;
  const Fg = Cs * (comp_guias || 0) * V * V * mat_d / 1000;
  const F1 = n_limp * 100.8;
  const Fa = cap_th * 1000 * V / (3600 * g);
  const Ta = Ky * comp_m * (Wm + Wb + (p_rol_carga / esp_rol)) + Kx * comp_m + Fg + F1 + Fa;
  const Ft = Ft_flex || 40;
  const Te = Ta + Ft + (Wm * elev_m);
  const Ne_hp = (Te * V) / 76;
  const ef_t = ef_c * ef_r * ef_a;
  const N_hp = Ne_hp / ef_t;
  const N_cv = N_hp * 1.01387;
  const N_kw = N_cv * 0.7355;
  const N_per = N_hp / n_ac;
  const n_sinc = (120 * freq_hz) / n_polos;
  const n_mot = n_sinc * 0.97;
  const n_tamb = (V * 60) / (Math.PI * (d_tamb_mm / 1000));
  const red = n_mot / n_tamb;
  const wrap_r = ang_abr * Math.PI / 180;
  const Cw = Math.exp(0.35 * wrap_r);
  const T1 = Te * Cw / (Cw - 1);
  const T2 = T1 - Te;
  const T_sag = 4.2 * esp_rol * (Wb + Wm);
  const Tad = (cap_tens * (larg_pol * 25.4) / 1000) / g;
  const contrapeso = 2 * T2;
  const cap_real = cap_vol * V * mat_d / 1000;
  const curve: any[] = [];
  for (let x = 0; x <= comp_m; x += comp_m / 24) {
    curve.push({
      pos: +x.toFixed(1),
      T_ida: +(T2 + Te * (x / comp_m)).toFixed(0),
      T_volta: +(T2 * (1 - x / comp_m * 0.1)).toFixed(0),
    });
  }

  // Warnings
  const warnings: { level: "ok" | "warn" | "bad"; text: string }[] = [];
  if (T1 > Tad) warnings.push({ level: "bad", text: `Tensão T1 (${T1.toFixed(0)} kgf) excede a tensão admissível Tad (${Tad.toFixed(0)} kgf). Aumente a largura da correia ou reduza o comprimento.` });
  else if (T1 > Tad * 0.9) warnings.push({ level: "warn", text: `Tensão T1 (${T1.toFixed(0)} kgf) está dentro de 90% da admissível. Considere margem de segurança.` });
  else warnings.push({ level: "ok", text: `Tensão T1 dentro do limite admissível (${(T1 / Tad * 100).toFixed(1)}% de Tad).` });

  if (cap_real < cap_th) warnings.push({ level: "bad", text: `Capacidade real (${cap_real.toFixed(0)} t/h) é menor que a requerida (${cap_th} t/h). Aumente a velocidade ou a largura.` });
  else warnings.push({ level: "ok", text: `Capacidade real atende ao requisito (${(cap_real / cap_th * 100).toFixed(0)}% da requerida).` });

  if (vel_ms < V_min_req) warnings.push({ level: "warn", text: `Velocidade de projeto (${vel_ms} m/s) é menor que a velocidade mínima necessária (${V_min_req.toFixed(2)} m/s). Velocidade ajustada para o cálculo.` });
  if (comp_m > 900) warnings.push({ level: "warn", text: `Comprimento (${comp_m} m) excede a tabela CEMA padrão. Resultado extrapolado.` });
  if (elev_m / comp_m > 0.3) warnings.push({ level: "warn", text: `Inclinação alta (${(elev_m / comp_m * 100).toFixed(1)}%). Verifique adesão do material à correia.` });

  return { Wm, Ky, Kx, Fg, F1, Fa, Ta, Ft, Te, Ne_hp, N_hp, N_cv, N_kw, N_per, ef_t, n_sinc, n_mot, n_tamb, red, Cw, T1, T2, T_sag, Tad, contrapeso, cap_vol, cap_real, cap_ok: cap_real >= cap_th, V, V_min_req, curve, tension_ok: T1 <= Tad, warnings };
}

// ============================================================
// PALETA — Azul-petróleo + Cobre + Grafite
// ============================================================
const PAL = {
  bg: "#f4f6f8",
  panel: "#ffffff",
  primary: "#0a9396",
  primaryDark: "#005f73",
  accent: "#ca6702",
  accentDark: "#9b5708",
  text: "#001219",
  muted: "#54677a",
  border: "#dde4ec",
  soft: "#e9eef3",
  ok: "#2a9d8f",
  warn: "#bb8a36",
  bad: "#9b2226",
};

const STYLE_ID = "transp-mill-style";
const STYLES = `
.tmw-shell { font-family: Inter, "Segoe UI", Arial, sans-serif; color:${PAL.text}; }
.tmw-shell *, .tmw-shell *::before, .tmw-shell *::after { box-sizing: border-box; }
.tmw-header {
  background: linear-gradient(135deg, ${PAL.primaryDark} 0%, ${PAL.primary} 100%);
  border-radius: 14px; padding: 18px 22px; margin-bottom: 18px;
  display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center;
  box-shadow: 0 8px 22px rgba(0,95,115,0.18); color: white;
}
.tmw-brand { display:flex; align-items:center; gap:14px; }
.tmw-brand-mark {
  width: 50px; height: 50px; border-radius: 12px;
  background: rgba(255,255,255,0.18); display:grid; place-items:center;
  border: 1px solid rgba(255,255,255,0.25);
}
.tmw-brand-mark svg { width: 32px; height: 32px; }
.tmw-brand small { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:rgba(255,255,255,.78); font-weight:600; }
.tmw-brand strong { display:block; font-size:18px; font-weight:800; letter-spacing:-.01em; }
.tmw-header-actions { display:flex; gap:8px; align-items:center; }
.tmw-btn {
  border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.12);
  color: white; border-radius: 9px; padding: 9px 14px; font-weight: 700; font-size: 12px;
  cursor: pointer; transition: all .15s; font-family: inherit;
}
.tmw-btn:hover { background: rgba(255,255,255,0.22); }
.tmw-btn.primary { background: ${PAL.accent}; border-color: ${PAL.accentDark}; box-shadow: 0 3px 10px rgba(202,103,2,0.35); }
.tmw-btn.primary:hover { background: ${PAL.accentDark}; }

.tmw-tool { display:grid; grid-template-columns: 360px minmax(0,1fr); gap:18px; align-items:start; }
@media (max-width: 1100px) { .tmw-tool { grid-template-columns: 1fr; } }

.tmw-panel {
  background: ${PAL.panel}; border: 1px solid ${PAL.border}; border-radius: 14px;
  overflow: hidden; box-shadow: 0 8px 24px rgba(0,32,48,0.06);
}
.tmw-panel-title {
  display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
  padding: 13px 16px; border-bottom: 1px solid ${PAL.border};
  background: linear-gradient(180deg, ${PAL.soft}, transparent);
}
.tmw-panel-title h3 { margin:0; font-size:14px; font-weight:800; color:${PAL.primaryDark}; }
.tmw-panel-title p { margin:3px 0 0; font-size:11px; color:${PAL.muted}; }
.tmw-panel-inner { padding: 14px 16px; }

.tmw-left-col { display: grid; gap: 14px; }
.tmw-section-h {
  margin: 14px 0 10px; font-size: 11px; font-weight: 800; letter-spacing: .07em;
  text-transform: uppercase; color: ${PAL.muted};
  border-bottom: 1px solid ${PAL.primary}; padding-bottom: 6px;
}
.tmw-section-h:first-child { margin-top: 0; }
.tmw-input-row { margin-bottom: 11px; }
.tmw-input-head {
  display:flex; justify-content:space-between; gap:8px; align-items:center;
}
.tmw-input-head label { font-size:11px; font-weight:700; color:${PAL.muted}; line-height:1.3; }
.tmw-input-wrap { display:flex; gap:6px; align-items:center; }
.tmw-input-row input, .tmw-input-row select {
  width: 110px; border: 1px solid ${PAL.border}; background: white; color: ${PAL.text};
  border-radius: 7px; padding: 6px 8px; text-align: right; font: inherit; font-size: 12px;
}
.tmw-input-row input:focus, .tmw-input-row select:focus {
  outline: none; border-color: ${PAL.primary}; box-shadow: 0 0 0 2px rgba(10,147,150,0.15);
}
.tmw-unit-chip {
  display:inline-flex; align-items:center; padding:3px 7px; border-radius:999px;
  background: ${PAL.soft}; border:1px solid ${PAL.border}; color:${PAL.primaryDark};
  font-size:10px; font-weight:700; white-space:nowrap;
}

.tmw-badge {
  display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:999px;
  font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.05em;
  border:1px solid rgba(0,0,0,0.06);
}
.tmw-badge.ok { background: rgba(42,157,143,0.12); color:${PAL.ok}; }
.tmw-badge.warn { background: rgba(187,138,54,0.14); color:${PAL.warn}; }
.tmw-badge.bad { background: rgba(155,34,38,0.12); color:${PAL.bad}; }
.tmw-badge.info { background: rgba(10,147,150,0.12); color:${PAL.primaryDark}; }

.tmw-metrics {
  display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin-bottom: 16px;
}
@media (max-width: 900px) { .tmw-metrics { grid-template-columns: repeat(2, 1fr); } }
.tmw-metric {
  position: relative; overflow: hidden; background: ${PAL.panel};
  border: 1px solid ${PAL.border}; border-radius: 12px; padding: 13px 14px;
  box-shadow: 0 4px 12px rgba(0,32,48,0.05);
}
.tmw-metric::before {
  content:""; position:absolute; left:0; top:0; bottom:0; width:4px;
  background: ${PAL.primary};
}
.tmw-metric.primary::before { background: ${PAL.accent}; }
.tmw-metric-label {
  font-size:10px; text-transform:uppercase; letter-spacing:.07em;
  color:${PAL.muted}; font-weight:800; margin-bottom:6px;
}
.tmw-metric-val {
  font-size: 26px; line-height: 1; font-weight: 900; letter-spacing: -.02em;
  font-variant-numeric: tabular-nums; color: ${PAL.text};
}
.tmw-metric.primary .tmw-metric-val { color: ${PAL.accentDark}; }
.tmw-metric-sub { margin-top:5px; font-size:10px; color:${PAL.muted}; min-height:14px; }

.tmw-viz { display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px; }
@media (max-width: 1100px) { .tmw-viz { grid-template-columns: 1fr; } }

.tmw-bottom { display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px; }
@media (max-width: 1100px) { .tmw-bottom { grid-template-columns: 1fr; } }

.tmw-table {
  width:100%; border-collapse:collapse; font-size:12px; background: ${PAL.panel};
  border-radius: 10px; overflow: hidden;
}
.tmw-table th, .tmw-table td {
  padding: 8px 11px; border-bottom: 1px solid ${PAL.border}; text-align:left; vertical-align:middle;
}
.tmw-table th {
  font-size:10px; text-transform:uppercase; letter-spacing:.06em;
  color:${PAL.muted}; background: ${PAL.soft}; font-weight:800;
}
.tmw-table tr:last-child td { border-bottom:none; }
.tmw-mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, Menlo, Consolas, monospace; }

.tmw-warn-list { display:grid; gap:8px; margin-top:12px; }
.tmw-warn-item {
  border-left: 4px solid ${PAL.primary}; background: ${PAL.soft};
  border-radius: 8px; padding: 9px 11px; font-size: 12px; line-height:1.45; color:${PAL.text};
}
.tmw-warn-item.ok { border-left-color: ${PAL.ok}; }
.tmw-warn-item.warn { border-left-color: ${PAL.warn}; }
.tmw-warn-item.bad { border-left-color: ${PAL.bad}; }

.tmw-basis { display:grid; gap:12px; font-size:12px; line-height:1.5; }
.tmw-basis-box {
  background: ${PAL.soft}; border: 1px solid ${PAL.border}; border-radius: 10px; padding: 11px 13px;
}
.tmw-basis-box h4 {
  margin: 0 0 7px; font-size: 12px; font-weight: 800; color: ${PAL.primaryDark};
  text-transform: uppercase; letter-spacing: .04em;
}
.tmw-eq {
  display:flex; justify-content:space-between; gap:14px; padding: 5px 0;
  border-bottom: 1px dashed ${PAL.border};
}
.tmw-eq:last-child { border-bottom:none; }
.tmw-eq .lhs { font-weight:700; color:${PAL.text}; }
.tmw-eq .rhs { color:${PAL.muted}; text-align:right; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; }

.tmw-viewer-shell { position:relative; height: 380px; background: #0e1620; }
.tmw-viewer-note {
  position:absolute; left:12px; top:12px; z-index:2; font-size:11px; font-weight:700;
  color: white; background: rgba(0,0,0,.5); padding: 5px 10px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.15);
}
`;

// ============================================================
// SCHEMATIC 2D
// ============================================================
function Schematic2D({ inp }: { inp: any }) {
  const w = 540, h = 290, mx = 36;
  const L = inp?.comp_m || 20;
  const H = inp?.elev_m || 0;
  const baseY = h - 70;
  const rise = (H / Math.max(L, 1)) * (w - 2 * mx) * 0.55;
  const topY = baseY - rise;
  const angDeg = Math.atan2(rise, w - 2 * mx) * 180 / Math.PI;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <linearGradient id="beltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={PAL.primary} stopOpacity="0.9" />
          <stop offset="100%" stopColor={PAL.primaryDark} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="matGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={PAL.accent} stopOpacity="0.6" />
          <stop offset="100%" stopColor={PAL.accent} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Material */}
      <polygon points={`${mx + 14},${baseY - 6} ${w - mx - 28},${topY - 6} ${w - mx - 28},${topY - 14} ${mx + 14},${baseY - 14}`}
        fill="url(#matGrad)" stroke={PAL.accent} strokeWidth="0.8" />

      {/* Correia ida */}
      <line x1={mx} y1={baseY} x2={w - mx} y2={topY} stroke="url(#beltGrad)" strokeWidth="3" strokeLinecap="round" />

      {/* Correia retorno */}
      <line x1={mx} y1={baseY + 18} x2={w - mx} y2={topY + 18} stroke={PAL.muted} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.6" />

      {/* Roletes */}
      {Array.from({ length: Math.min(22, Math.max(6, Math.floor(L / Math.max(inp?.esp_rol || 1, 0.5)))) }).map((_, i, a) => {
        const f = i / (a.length - 1);
        const x = mx + f * (w - 2 * mx);
        const y = baseY + f * (topY - baseY);
        return (
          <g key={i}>
            <line x1={x} y1={y - 2} x2={x} y2={y + 4} stroke={PAL.primary} strokeWidth="1.2" opacity="0.7" />
            <circle cx={x} cy={y + 6} r="2" fill={PAL.primary} opacity="0.9" />
            <circle cx={x} cy={y + 24} r="1.4" fill={PAL.muted} opacity="0.5" />
          </g>
        );
      })}

      {/* Tambor cabeça */}
      <circle cx={w - mx} cy={topY + 9} r="13" fill="white" stroke={PAL.accent} strokeWidth="2.5" />
      <circle cx={w - mx} cy={topY + 9} r="5" fill={PAL.accent} />
      <text x={w - mx} y={topY - 8} fill={PAL.accentDark} fontSize="9" fontWeight="700" textAnchor="middle">ACION.</text>

      {/* Tambor cauda */}
      <circle cx={mx} cy={baseY + 9} r="11" fill="white" stroke={PAL.primary} strokeWidth="2" />
      <circle cx={mx} cy={baseY + 9} r="3" fill={PAL.primary} />
      <text x={mx} y={baseY + 36} fill={PAL.primaryDark} fontSize="9" fontWeight="700" textAnchor="middle">CAUDA</text>

      {/* Dimensões */}
      <line x1={mx} y1={h - 18} x2={w - mx} y2={h - 18} stroke={PAL.muted} strokeWidth="0.6" />
      <line x1={mx} y1={h - 22} x2={mx} y2={h - 14} stroke={PAL.muted} strokeWidth="0.6" />
      <line x1={w - mx} y1={h - 22} x2={w - mx} y2={h - 14} stroke={PAL.muted} strokeWidth="0.6" />
      <text x={w / 2} y={h - 6} fill={PAL.text} fontSize="11" textAnchor="middle" fontWeight="700">L = {L} m</text>

      {H > 0 && (
        <>
          <text x={w - mx + 18} y={(baseY + topY) / 2} fill={PAL.accentDark} fontSize="10" fontWeight="700">H={H}m</text>
          <text x={w - mx + 18} y={(baseY + topY) / 2 + 13} fill={PAL.muted} fontSize="9">{angDeg.toFixed(1)}°</text>
        </>
      )}

      <g transform={`translate(${w / 2}, ${(baseY + topY) / 2 - 22})`}>
        <line x1="-18" y1="0" x2="14" y2="0" stroke={PAL.accent} strokeWidth="1.8" />
        <polygon points="14,-4 22,0 14,4" fill={PAL.accent} />
        <text x="0" y="-5" fill={PAL.accentDark} fontSize="9" textAnchor="middle" fontWeight="600">FLUXO</text>
      </g>
    </svg>
  );
}

// ============================================================
// CROSS-SECTION
// ============================================================
function CrossSection({ inp }: { inp: any }) {
  const w = 280, h = 200;
  const cx = w / 2, cy = h / 2 + 10;
  const beltW = 160;
  const angle = inp.ang_rol || 20;
  const angRad = angle * Math.PI / 180;
  const sideW = beltW / 3;
  const centerW = beltW / 3;
  const dy = sideW * Math.sin(angRad);

  const x1 = cx - centerW / 2 - sideW * Math.cos(angRad);
  const x2 = cx - centerW / 2;
  const x3 = cx + centerW / 2;
  const x4 = cx + centerW / 2 + sideW * Math.cos(angRad);
  const y1 = cy - dy;
  const y2 = cy;
  const y3 = cy;
  const y4 = cy - dy;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <linearGradient id="csGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={PAL.accent} stopOpacity="0.5" />
          <stop offset="100%" stopColor={PAL.accent} stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <polygon points={`${x1 + 5},${y1 - 18} ${x2 + 2},${y2 - 24} ${x3 - 2},${y3 - 24} ${x4 - 5},${y4 - 18}`}
        fill="url(#csGrad)" stroke={PAL.accent} strokeWidth="1" />

      <polyline points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`}
        fill="none" stroke={PAL.primaryDark} strokeWidth="3.5" strokeLinejoin="round" />

      <line x1={x1 - 2} y1={y1 + 2} x2={x2 + 2} y2={y2 + 2} stroke={PAL.muted} strokeWidth="3" strokeLinecap="round" />
      <line x1={x2 - 2} y1={y2 + 2} x2={x3 + 2} y2={y3 + 2} stroke={PAL.muted} strokeWidth="3" strokeLinecap="round" />
      <line x1={x3 - 2} y1={y3 + 2} x2={x4 + 2} y2={y4 + 2} stroke={PAL.muted} strokeWidth="3" strokeLinecap="round" />

      <line x1={x1 - 8} y1={y1} x2={x1 - 8} y2={cy + 35} stroke={PAL.muted} strokeWidth="1.5" />
      <line x1={x4 + 8} y1={y4} x2={x4 + 8} y2={cy + 35} stroke={PAL.muted} strokeWidth="1.5" />
      <line x1={x1 - 12} y1={cy + 35} x2={x4 + 12} y2={cy + 35} stroke={PAL.muted} strokeWidth="2" />

      <line x1={x1} y1={20} x2={x4} y2={20} stroke={PAL.muted} strokeWidth="0.6" />
      <line x1={x1} y1={16} x2={x1} y2={24} stroke={PAL.muted} strokeWidth="0.6" />
      <line x1={x4} y1={16} x2={x4} y2={24} stroke={PAL.muted} strokeWidth="0.6" />
      <text x={cx} y={14} fill={PAL.text} fontSize="11" textAnchor="middle" fontWeight="700">
        {inp.larg_pol}" ({(inp.larg_pol * 25.4).toFixed(0)} mm)
      </text>

      <text x={x1 + 20} y={y1 + 14} fill={PAL.primaryDark} fontSize="9" fontWeight="600">{angle}°</text>
      <text x={x4 - 24} y={y4 + 14} fill={PAL.primaryDark} fontSize="9" fontWeight="600">{angle}°</text>

      <text x={cx} y={h - 6} fill={PAL.muted} fontSize="9" textAnchor="middle">Seção transversal · 3 roletes</text>
    </svg>
  );
}

// ============================================================
// 3D VIEWER
// ============================================================
function Viewer3D({ inp }: { inp: any }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let mounted = true;
    let frameId = 0;

    const init = async () => {
      let THREE: any = (window as any).THREE;
      if (!THREE) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject();
          document.head.appendChild(s);
        });
        THREE = (window as any).THREE;
      }
      if (!mounted || !mountRef.current) return;

      if (!(THREE as any).OrbitControls) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";
          s.onload = () => resolve();
          s.onerror = () => reject();
          document.head.appendChild(s);
        });
      }
      if (!mounted || !mountRef.current) return;

      const mount = mountRef.current;
      const w = mount.clientWidth || 600;
      const h = mount.clientHeight || 380;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0e1620);
      scene.fog = new THREE.Fog(0x0e1620, 30, 120);

      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);

      const L = Math.max(inp.comp_m || 20, 5);
      const H = inp.elev_m || 0;
      const beltW = (inp.larg_pol || 36) * 25.4 / 1000;

      const sx = Math.min(20 / L, 1.5);
      const len = L * sx;
      const elev = H * sx;
      const bw = Math.max(beltW * sx * 8, 1.5);

      camera.position.set(len * 0.7, len * 0.5 + 2, len * 0.8);
      camera.lookAt(len / 2, elev / 2, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(w, h);
      mount.innerHTML = "";
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const dl = new THREE.DirectionalLight(0xffffff, 0.7);
      dl.position.set(15, 25, 15);
      scene.add(dl);
      const dl2 = new THREE.DirectionalLight(0x0a9396, 0.3);
      dl2.position.set(-15, 10, -10);
      scene.add(dl2);

      const grid = new THREE.GridHelper(40, 40, 0x2a3441, 0x1a2330);
      scene.add(grid);

      const dx = len, dy = elev;
      const beltLen = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      const beltGeom = new THREE.BoxGeometry(beltLen, 0.08, bw);
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x0a9396, roughness: 0.5, metalness: 0.3 });
      const beltMesh = new THREE.Mesh(beltGeom, beltMat);
      beltMesh.position.set(dx / 2, dy / 2 + 0.5, 0);
      beltMesh.rotation.z = angle;
      scene.add(beltMesh);

      const matH = bw * 0.18;
      const matGeom = new THREE.BoxGeometry(beltLen * 0.92, matH, bw * 0.7);
      const matMat = new THREE.MeshStandardMaterial({ color: 0xca6702, roughness: 0.85 });
      const matMesh = new THREE.Mesh(matGeom, matMat);
      matMesh.position.set(dx / 2, dy / 2 + 0.5 + 0.04 + matH / 2, 0);
      matMesh.rotation.z = angle;
      scene.add(matMesh);

      const retMesh = new THREE.Mesh(beltGeom.clone(), new THREE.MeshStandardMaterial({ color: 0x54677a, roughness: 0.7 }));
      retMesh.position.set(dx / 2, dy / 2 + 0.5 - 0.6, 0);
      retMesh.rotation.z = angle;
      scene.add(retMesh);

      const drumR = bw * 0.35;
      const drumGeom = new THREE.CylinderGeometry(drumR, drumR, bw * 1.1, 24);
      const drumMat = new THREE.MeshStandardMaterial({ color: 0xca6702, roughness: 0.4, metalness: 0.6 });
      const drumMatTail = new THREE.MeshStandardMaterial({ color: 0x54677a, roughness: 0.4, metalness: 0.6 });

      const drum1 = new THREE.Mesh(drumGeom, drumMat);
      drum1.position.set(dx, dy + 0.5, 0);
      drum1.rotation.x = Math.PI / 2;
      scene.add(drum1);

      const drum2 = new THREE.Mesh(drumGeom, drumMatTail);
      drum2.position.set(0, 0.5, 0);
      drum2.rotation.x = Math.PI / 2;
      scene.add(drum2);

      const nRolos = Math.min(15, Math.max(4, Math.floor(L / Math.max(inp.esp_rol || 1, 0.5))));
      const rolGeom = new THREE.CylinderGeometry(bw * 0.08, bw * 0.08, bw * 0.95, 12);
      const rolMat = new THREE.MeshStandardMaterial({ color: 0x9fb0c5, roughness: 0.5, metalness: 0.5 });
      for (let i = 1; i < nRolos; i++) {
        const t = i / nRolos;
        const rol = new THREE.Mesh(rolGeom, rolMat);
        rol.position.set(dx * t, dy * t + 0.42, 0);
        rol.rotation.x = Math.PI / 2;
        scene.add(rol);
      }

      const controls = new (THREE as any).OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.target.set(dx / 2, dy / 2, 0);
      controls.update();

      const animate = () => {
        if (!mounted) return;
        frameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        if (!mountRef.current) return;
        const nw = mountRef.current.clientWidth;
        const nh = mountRef.current.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      window.addEventListener("resize", onResize);
      sceneRef.current = { scene, camera, renderer, controls, cleanup: () => window.removeEventListener("resize", onResize) };
    };

    init().catch(err => console.error("3D init failed:", err));

    return () => {
      mounted = false;
      if (frameId) cancelAnimationFrame(frameId);
      if (sceneRef.current?.cleanup) sceneRef.current.cleanup();
      if (sceneRef.current?.renderer) {
        sceneRef.current.renderer.dispose();
        if (mountRef.current) mountRef.current.innerHTML = "";
      }
    };
  }, [inp.comp_m, inp.elev_m, inp.larg_pol, inp.esp_rol]);

  return (
    <div className="tmw-viewer-shell">
      <div className="tmw-viewer-note">Arraste para orbitar · Scroll para zoom</div>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function TransportadorMod({ onSave, user, UI }: any) {
  const { SavedCalcs } = UI;

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }, []);

  const [inp, setI] = useState({
    mat_d: 900, cap_th: 3240, vel_ms: 2.5, comp_m: 19.6, elev_m: 0, larg_pol: 72,
    ang_rol: 20, esp_rol: 0.5, d_tamb_mm: 630, ang_abr: 180, n_limp: 2, Wb: 59.56,
    n_lonas: 4, cap_tens: 86298.5, idler_cl: "D", freq_hz: 60, n_polos: 4,
    p_rol_carga: 40.01, p_rol_ret: 26.8, comp_guias: 16, Cs: 0.0754, Ft_flex: 40.8,
    ef_c: 0.94, ef_r: 0.94, ef_a: 0.96, n_ac: 2,
  });
  const [res, setR] = useState<any>(null);

  const s = (k: string, v: any) => setI(p => ({ ...p, [k]: v }));
  const handleLoad = (d: any) => { if (d.inp) setI(d.inp); if (d.res) setR(d.res); };

  // Auto-recalcular sempre que inputs mudarem (UX live)
  useEffect(() => { setR(calc(inp)); }, [inp]);

  const fmt = (v: number, dec = 1) => v == null || !isFinite(v) ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const NumInp = ({ label, val, k, unit, step = 0.1 }: any) => (
    <div className="tmw-input-row">
      <div className="tmw-input-head">
        <label>{label}</label>
        <div className="tmw-input-wrap">
          {unit && <span className="tmw-unit-chip">{unit}</span>}
          <input type="number" step={step} value={val} onChange={(e) => s(k, parseFloat(e.target.value) || 0)} />
        </div>
      </div>
    </div>
  );

  const SelInp = ({ label, val, k, opts, unit }: any) => (
    <div className="tmw-input-row">
      <div className="tmw-input-head">
        <label>{label}</label>
        <div className="tmw-input-wrap">
          {unit && <span className="tmw-unit-chip">{unit}</span>}
          <select value={val} onChange={(e) => {
            const raw = e.target.value;
            const num = Number(raw);
            s(k, !isNaN(num) && raw !== "" ? num : raw);
          }}>
            {opts.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const allOk = res && res.tension_ok && res.cap_ok;
  const statusBadge = !res ? { cls: "info", text: "Aguardando" } :
    allOk ? { cls: "ok", text: "Aprovado" } :
      res.tension_ok ? { cls: "warn", text: "Verificar capacidade" } :
        { cls: "bad", text: "T1 > Tad" };

  // Cores para barras de força
  const forceData = res ? [
    { n: "Fg", v: +res.Fg.toFixed(0), full: "Atrito guias", fill: PAL.primary },
    { n: "F1", v: +res.F1.toFixed(0), full: "Limpadores", fill: PAL.primary },
    { n: "Fa", v: +res.Fa.toFixed(0), full: "Aceleração", fill: PAL.primary },
    { n: "Ta", v: +res.Ta.toFixed(0), full: "Resistência total", fill: PAL.warn },
    { n: "Te", v: +res.Te.toFixed(0), full: "Tensão efetiva", fill: PAL.accent },
  ] : [];

  return (
    <div className="tmw-shell">
      {/* HEADER */}
      <div className="tmw-header">
        <div className="tmw-brand">
          <div className="tmw-brand-mark">
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
              <ellipse cx="14" cy="38" rx="8" ry="8" stroke="white" strokeWidth="3" />
              <ellipse cx="50" cy="26" rx="8" ry="8" stroke="white" strokeWidth="3" />
              <line x1="14" y1="30" x2="50" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="14" y1="46" x2="50" y2="34" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <circle cx="22" cy="26" r="1.5" fill="#ca6702" />
              <circle cx="30" cy="24" r="1.5" fill="#ca6702" />
              <circle cx="38" cy="22" r="1.5" fill="#ca6702" />
            </svg>
          </div>
          <div>
            <small>CEMA Worksheet</small>
            <strong>Transportador de Correia</strong>
          </div>
        </div>
        <div className="tmw-header-actions">
          <SavedCalcs user={user} moduleType="transportador" onLoad={handleLoad} />
          <button className="tmw-btn" onClick={() => onSave({ type: "transportador", inp, res })}>Salvar</button>
          <button className="tmw-btn primary" onClick={() => setR(calc(inp))}>Recalcular</button>
        </div>
      </div>

      <div className="tmw-tool">
        {/* COLUNA ESQUERDA */}
        <div className="tmw-left-col">
          <section className="tmw-panel">
            <div className="tmw-panel-title">
              <div>
                <h3>Dados de Entrada</h3>
                <p>Parâmetros do projeto e da correia</p>
              </div>
              <span className={`tmw-badge ${statusBadge.cls}`}>{statusBadge.text}</span>
            </div>
            <div className="tmw-panel-inner">
              <h4 className="tmw-section-h">Material e Capacidade</h4>
              <NumInp label="Densidade" val={inp.mat_d} k="mat_d" unit="kg/m³" step={10} />
              <NumInp label="Capacidade" val={inp.cap_th} k="cap_th" unit="t/h" step={10} />
              <NumInp label="Velocidade" val={inp.vel_ms} k="vel_ms" unit="m/s" step={0.1} />
              <NumInp label="Nº acionamentos" val={inp.n_ac} k="n_ac" step={1} />

              <h4 className="tmw-section-h">Geometria</h4>
              <NumInp label="Comprimento (CC)" val={inp.comp_m} k="comp_m" unit="m" step={0.5} />
              <NumInp label="Elevação" val={inp.elev_m} k="elev_m" unit="m" step={0.5} />
              <SelInp label="Largura correia" val={inp.larg_pol} k="larg_pol" unit="pol" opts={BW.map(w => ({ v: w, l: `${w}" (${(w * 25.4).toFixed(0)} mm)` }))} />
              <NumInp label="Ângulo dos rolos" val={inp.ang_rol} k="ang_rol" unit="°" step={1} />
              <NumInp label="Espaçamento rolos" val={inp.esp_rol} k="esp_rol" unit="m" step={0.05} />
              <NumInp label="Comprimento guias" val={inp.comp_guias} k="comp_guias" unit="m" step={0.5} />
              <NumInp label="Ø tambor motriz" val={inp.d_tamb_mm} k="d_tamb_mm" unit="mm" step={10} />
              <NumInp label="Ângulo abraçamento" val={inp.ang_abr} k="ang_abr" unit="°" step={5} />

              <h4 className="tmw-section-h">Correia e Roletes</h4>
              <NumInp label="Peso correia (Wb)" val={inp.Wb} k="Wb" unit="kgf/m" step={0.5} />
              <NumInp label="Nº lonas" val={inp.n_lonas} k="n_lonas" step={1} />
              <NumInp label="Capacidade tensão" val={inp.cap_tens} k="cap_tens" unit="N/m" step={1000} />
              <SelInp label="Classe rolete" val={inp.idler_cl} k="idler_cl" opts={Object.entries(IDLERS).map(([k, v]: any) => ({ v: k, l: v.l }))} />
              <NumInp label="Peso rol. carga" val={inp.p_rol_carga} k="p_rol_carga" unit="kgf" step={1} />
              <NumInp label="Nº limpadores" val={inp.n_limp} k="n_limp" step={1} />
              <NumInp label="Cs (atrito)" val={inp.Cs} k="Cs" step={0.001} />
              <NumInp label="Ft (flexão)" val={inp.Ft_flex} k="Ft_flex" unit="kgf" step={1} />

              <h4 className="tmw-section-h">Motor</h4>
              <NumInp label="Frequência" val={inp.freq_hz} k="freq_hz" unit="Hz" step={1} />
              <NumInp label="Nº polos" val={inp.n_polos} k="n_polos" step={2} />
              <NumInp label="η correia" val={inp.ef_c} k="ef_c" step={0.01} />
              <NumInp label="η redutor" val={inp.ef_r} k="ef_r" step={0.01} />
              <NumInp label="η acoplam." val={inp.ef_a} k="ef_a" step={0.01} />
            </div>
          </section>
        </div>

        {/* COLUNA DIREITA */}
        <div>
          {/* MÉTRICAS */}
          <section className="tmw-metrics">
            <div className="tmw-metric primary">
              <div className="tmw-metric-label">Potência Motor</div>
              <div className="tmw-metric-val">{res ? fmt(res.N_hp, 1) : "–"}</div>
              <div className="tmw-metric-sub">HP · {res ? fmt(res.N_kw, 1) : "–"} kW</div>
            </div>
            <div className="tmw-metric">
              <div className="tmw-metric-label">Tensão Efetiva</div>
              <div className="tmw-metric-val">{res ? fmt(res.Te, 0) : "–"}</div>
              <div className="tmw-metric-sub">kgf · força motriz</div>
            </div>
            <div className="tmw-metric">
              <div className="tmw-metric-label">Tensão T1</div>
              <div className="tmw-metric-val" style={{ color: res?.tension_ok ? PAL.ok : PAL.bad }}>{res ? fmt(res.T1, 0) : "–"}</div>
              <div className="tmw-metric-sub">kgf · de {res ? fmt(res.Tad, 0) : "–"} adm.</div>
            </div>
            <div className="tmw-metric">
              <div className="tmw-metric-label">Capacidade Real</div>
              <div className="tmw-metric-val" style={{ color: res?.cap_ok ? PAL.ok : PAL.bad }}>{res ? fmt(res.cap_real, 0) : "–"}</div>
              <div className="tmw-metric-sub">t/h · req. {inp.cap_th} t/h</div>
            </div>
            <div className="tmw-metric">
              <div className="tmw-metric-label">Velocidade</div>
              <div className="tmw-metric-val">{res ? fmt(res.V, 2) : "–"}</div>
              <div className="tmw-metric-sub">m/s · utilizada</div>
            </div>
            <div className="tmw-metric">
              <div className="tmw-metric-label">Redução</div>
              <div className="tmw-metric-val">{res ? fmt(res.red, 1) : "–"}</div>
              <div className="tmw-metric-sub">:1 · {res ? fmt(res.n_mot, 0) : "–"}→{res ? fmt(res.n_tamb, 1) : "–"} rpm</div>
            </div>
            <div className="tmw-metric">
              <div className="tmw-metric-label">Contrapeso</div>
              <div className="tmw-metric-val">{res ? fmt(res.contrapeso, 0) : "–"}</div>
              <div className="tmw-metric-sub">kgf · = 2 × T2</div>
            </div>
            <div className="tmw-metric">
              <div className="tmw-metric-label">Pot./acionamento</div>
              <div className="tmw-metric-val">{res ? fmt(res.N_per, 1) : "–"}</div>
              <div className="tmw-metric-sub">HP · de {inp.n_ac} acion.</div>
            </div>
          </section>

          {/* VIZ GRID */}
          <section className="tmw-viz">
            <div className="tmw-panel">
              <div className="tmw-panel-title">
                <div>
                  <h3>Esquemático 2D — Vista Lateral</h3>
                  <p>Layout do transportador, tambores, roletes e material</p>
                </div>
                <span className="tmw-badge info">visual</span>
              </div>
              <div style={{ padding: 12, background: PAL.bg, height: 290 }}>
                <Schematic2D inp={inp} />
              </div>
            </div>
            <div className="tmw-panel">
              <div className="tmw-panel-title">
                <div>
                  <h3>Seção Transversal</h3>
                  <p>Vista frontal · 3 roletes em V</p>
                </div>
                <span className="tmw-badge info">cross-section</span>
              </div>
              <div style={{ padding: 12, background: PAL.bg, height: 290 }}>
                <CrossSection inp={inp} />
              </div>
            </div>
          </section>

          {/* 3D */}
          <section className="tmw-panel" style={{ marginBottom: 16 }}>
            <div className="tmw-panel-title">
              <div>
                <h3>Modelo 3D Interativo</h3>
                <p>Orbite, faça pan e zoom no transportador completo</p>
              </div>
              <span className="tmw-badge info">three.js</span>
            </div>
            <Viewer3D inp={inp} />
          </section>

          {/* GRÁFICOS */}
          <section className="tmw-bottom">
            <div className="tmw-panel">
              <div className="tmw-panel-title">
                <div>
                  <h3>Perfil de Tensão</h3>
                  <p>T_ida, T_volta e tensão admissível</p>
                </div>
                <span className="tmw-badge info">curve</span>
              </div>
              <div style={{ padding: 12 }}>
                {res ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={res.curve} margin={{ top: 8, right: 16, left: 6, bottom: 22 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={PAL.border} />
                      <XAxis dataKey="pos" label={{ value: "Posição (m)", position: "bottom", fill: PAL.muted, fontSize: 10 }} tick={{ fill: PAL.muted, fontSize: 9 }} stroke={PAL.border} />
                      <YAxis label={{ value: "kgf", angle: -90, position: "insideLeft", fill: PAL.muted, fontSize: 10 }} tick={{ fill: PAL.muted, fontSize: 9 }} stroke={PAL.border} />
                      <Tooltip contentStyle={{ background: PAL.panel, border: `1px solid ${PAL.border}`, borderRadius: 8, fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Area type="monotone" dataKey="T_ida" name="T ida" stroke={PAL.accent} fill={PAL.accent} fillOpacity={0.18} strokeWidth={2.2} />
                      <Area type="monotone" dataKey="T_volta" name="T retorno" stroke={PAL.primary} fill={PAL.primary} fillOpacity={0.12} strokeWidth={1.8} />
                      <ReferenceLine y={res.Tad} stroke={PAL.bad} strokeDasharray="5 3" label={{ value: `Tad=${res.Tad.toFixed(0)}`, fill: PAL.bad, fontSize: 9 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: 240, display: "grid", placeItems: "center", color: PAL.muted }}>Aguardando cálculo</div>}
              </div>
            </div>
            <div className="tmw-panel">
              <div className="tmw-panel-title">
                <div>
                  <h3>Decomposição de Forças</h3>
                  <p>Componentes resistivas e tensão efetiva</p>
                </div>
                <span className="tmw-badge info">forças</span>
              </div>
              <div style={{ padding: 12 }}>
                {res ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={forceData} margin={{ top: 8, right: 16, left: 6, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={PAL.border} />
                      <XAxis dataKey="n" tick={{ fill: PAL.muted, fontSize: 10 }} stroke={PAL.border} />
                      <YAxis tick={{ fill: PAL.muted, fontSize: 9 }} stroke={PAL.border} />
                      <Tooltip contentStyle={{ background: PAL.panel, border: `1px solid ${PAL.border}`, borderRadius: 8, fontSize: 11 }}
                        formatter={(v: any, _n: any, p: any) => [`${v} kgf`, p.payload.full]} />
                      <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                        {forceData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: 240, display: "grid", placeItems: "center", color: PAL.muted }}>Aguardando cálculo</div>}
              </div>
            </div>
          </section>

          {/* TABELA + EQUAÇÕES */}
          <section className="tmw-bottom">
            <div className="tmw-panel">
              <div className="tmw-panel-title">
                <div>
                  <h3>Saídas e Verificações</h3>
                  <p>Resultados completos do cálculo CEMA</p>
                </div>
              </div>
              <div className="tmw-panel-inner">
                {res ? (
                  <>
                    <table className="tmw-table">
                      <tbody>
                        {[
                          ["Velocidade utilizada (V)", `${fmt(res.V, 3)} m/s`, res.V === inp.vel_ms ? "projeto" : "ajustada"],
                          ["Peso material (Wm)", `${fmt(res.Wm, 2)} kgf/m`, ""],
                          ["Fator Ky", fmt(res.Ky, 4), "interp. CEMA Tab. 6-2"],
                          ["Fator Kx", fmt(res.Kx, 4), "rolete + correia"],
                          ["Resistência total (Ta)", `${fmt(res.Ta, 0)} kgf`, ""],
                          ["Tensão efetiva (Te)", `${fmt(res.Te, 0)} kgf`, "Ta + Ft + Wm·H"],
                          ["Pot. efetiva (Ne)", `${fmt(res.Ne_hp, 2)} HP`, ""],
                          ["Pot. motor total", `${fmt(res.N_hp, 1)} HP`, `${fmt(res.N_kw, 1)} kW`],
                          ["Pot. por acionamento", `${fmt(res.N_per, 1)} HP`, `${inp.n_ac} acion.`],
                          ["Wrap factor (Cw)", fmt(res.Cw, 3), `${inp.ang_abr}° abraç.`],
                          ["T1 (lado tenso)", `${fmt(res.T1, 0)} kgf`, res.tension_ok ? "OK" : "EXCEDE Tad"],
                          ["T2 (lado frouxo)", `${fmt(res.T2, 0)} kgf`, ""],
                          ["Tensão admissível (Tad)", `${fmt(res.Tad, 0)} kgf`, "da correia"],
                          ["T sag (catenária)", `${fmt(res.T_sag, 0)} kgf`, "espaç. roletes"],
                          ["Contrapeso", `${fmt(res.contrapeso, 0)} kgf`, "= 2·T2"],
                          ["Capacidade real", `${fmt(res.cap_real, 0)} t/h`, res.cap_ok ? "atende" : "INSUFICIENTE"],
                          ["Rotação motor", `${fmt(res.n_mot, 0)} rpm`, `${inp.n_polos} polos · ${inp.freq_hz} Hz`],
                          ["Rotação tambor", `${fmt(res.n_tamb, 1)} rpm`, ""],
                          ["Relação redução", `${fmt(res.red, 2)}:1`, ""],
                        ].map((row, i) => (
                          <tr key={i}>
                            <td>{row[0]}</td>
                            <td className="tmw-mono" style={{ fontWeight: 600 }}>{row[1]}</td>
                            <td style={{ color: PAL.muted, fontSize: 11 }}>{row[2]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="tmw-warn-list">
                      {res.warnings.map((w: any, i: number) => (
                        <div key={i} className={`tmw-warn-item ${w.level}`}>{w.text}</div>
                      ))}
                    </div>
                  </>
                ) : <p style={{ color: PAL.muted, textAlign: "center", padding: 20 }}>Execute o cálculo</p>}
              </div>
            </div>

            <div className="tmw-panel">
              <div className="tmw-panel-title">
                <div>
                  <h3>Base de Cálculo — CEMA 7th Ed.</h3>
                  <p>Equações principais do método</p>
                </div>
              </div>
              <div className="tmw-panel-inner">
                <div className="tmw-basis">
                  <div className="tmw-basis-box">
                    <h4>Capacidade e Velocidade</h4>
                    <div className="tmw-eq"><div className="lhs">V mínima</div><div className="rhs">cap_th / (ρ · cap_vol)</div></div>
                    <div className="tmw-eq"><div className="lhs">Wm</div><div className="rhs">cap_th · 1000 / (3600 · V)</div></div>
                    <div className="tmw-eq"><div className="lhs">cap_real</div><div className="rhs">cap_vol · V · ρ / 1000</div></div>
                  </div>

                  <div className="tmw-basis-box">
                    <h4>Forças Resistivas (Cap. 6)</h4>
                    <div className="tmw-eq"><div className="lhs">Ky</div><div className="rhs">interp(L) · Tab. 6-2</div></div>
                    <div className="tmw-eq"><div className="lhs">Kx</div><div className="rhs">0,00068·(Wb+Wm) + Cl</div></div>
                    <div className="tmw-eq"><div className="lhs">Fg (guias)</div><div className="rhs">Cs · Lg · V² · ρ / 1000</div></div>
                    <div className="tmw-eq"><div className="lhs">F1 (limpadores)</div><div className="rhs">n · 100,8</div></div>
                    <div className="tmw-eq"><div className="lhs">Fa (aceleração)</div><div className="rhs">cap_th · V / (3,6 · g)</div></div>
                    <div className="tmw-eq"><div className="lhs">Ta</div><div className="rhs">Ky·L·(Wm+Wb+Wr/Si) + Kx·L + Fg + F1 + Fa</div></div>
                  </div>

                  <div className="tmw-basis-box">
                    <h4>Tensão Efetiva e Potência</h4>
                    <div className="tmw-eq"><div className="lhs">Te</div><div className="rhs">Ta + Ft + Wm · H</div></div>
                    <div className="tmw-eq"><div className="lhs">Ne</div><div className="rhs">Te · V / 76 [HP]</div></div>
                    <div className="tmw-eq"><div className="lhs">N motor</div><div className="rhs">Ne / (η_c · η_r · η_a)</div></div>
                  </div>

                  <div className="tmw-basis-box">
                    <h4>Tensões T1 e T2</h4>
                    <div className="tmw-eq"><div className="lhs">Cw (wrap)</div><div className="rhs">exp(0,35 · θ_rad)</div></div>
                    <div className="tmw-eq"><div className="lhs">T1</div><div className="rhs">Te · Cw / (Cw − 1)</div></div>
                    <div className="tmw-eq"><div className="lhs">T2</div><div className="rhs">T1 − Te</div></div>
                    <div className="tmw-eq"><div className="lhs">Tad</div><div className="rhs">cap_tens · larg_mm / (1000 · g)</div></div>
                    <div className="tmw-eq"><div className="lhs">Contrapeso</div><div className="rhs">2 · T2</div></div>
                  </div>

                  <div style={{ fontSize: 10, color: PAL.muted, marginTop: 4, lineHeight: 1.45 }}>
                    Referência: CEMA — <em>Belt Conveyors for Bulk Materials</em>, 7ª edição. Cap. 6 (forças e tensões), Tab. 6-2 (Ky), Tab. 6-7 (Cs).
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
