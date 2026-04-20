'use client';

/**
 * ConveyorCalculator.tsx
 * CEMA 7th Edition — Belt Conveyor Power Worksheet
 *
 * Arquivo TSX único autocontido. Contém:
 *  - Toda a lógica de cálculo (engine CEMA 7 Historical Method)
 *  - Todos os dados de tabelas (Ai, beltWeight, available area, Ky, Kt, Cs)
 *  - Todos os renderizadores SVG (esquemático 2D, breakdown, fill, fill curve,
 *    traction, profile editor)
 *  - Todos os inputs, outputs, validação e base de cálculo
 *  - Suporte a tema claro/escuro
 *  - Persistência via localStorage
 *
 * Uso no Next.js App Router:
 *   import { ConveyorCalculator } from './ConveyorCalculator';
 *   export default function Page() { return <ConveyorCalculator />; }
 */

import React, {
  useState, useReducer, useEffect, useRef, useCallback, useMemo,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — CONSTANTS & UNIT CONVERSIONS
// ─────────────────────────────────────────────────────────────────────────────

const FT_PER_M = 3.280839895013123;
const FPM_PER_MPS = 196.8503937007874;
const LBFT_PER_KGPM = 2.204622621848776 / FT_PER_M;
const KGPM_PER_LBFT = 1 / LBFT_PER_KGPM;
const SHORT_TON_PER_METRIC_TON = 1.102311310924388;
const HP_TO_KW = 0.7456998715822702;
const LBF_TO_N = 4.4482216152605;
const IN_PER_MM = 1 / 25.4;
const LBFT3_PER_TM3 = 62.4279605761;
const G_MPS2 = 9.80665;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lbfToKn = (lbf: number) => (lbf * LBF_TO_N) / 1000;
const knToLbf = (kn: number) => (kn * 1000) / LBF_TO_N;
const hpFromTeV = (teLbf: number, vFpm: number) => (teLbf * vFpm) / 33000;
const componentKwFromLbf = (lbf: number, vFpm: number) => hpFromTeV(lbf, vFpm) * HP_TO_KW;
const kgpmToLbft = (kgpm: number) => kgpm * LBFT_PER_KGPM;
const fmt = (v: number, d = 2) =>
  Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtFixed = (v: number, d = 2) =>
  Number.isFinite(v) ? v.toFixed(d) : '—';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — LOOKUP TABLES
// ─────────────────────────────────────────────────────────────────────────────

const IDLER_FAMILIES = [
  { id: 'B4_C4_4in',      label: 'B4 / C4 · 4 in idlers',     ai: 2.3 },
  { id: 'B5_C5_D5_5in',   label: 'B5 / C5 / D5 · 5 in idlers', ai: 1.8 },
  { id: 'D5_5in',         label: 'D5 · 5 in idlers',           ai: 1.8 },
  { id: 'C6_D6_6in',      label: 'C6 / D6 · 6 in idlers',     ai: 1.5 },
  { id: 'D6_6in',         label: 'D6 · 6 in idlers',           ai: 1.5 },
  { id: 'E7_7in',         label: 'E7 · 7 in idlers',           ai: 2.4 },
  { id: 'E6_6in',         label: 'E6 · 6 in idlers',           ai: 2.8 },
] as const;

const CW_PRESETS = [
  { id: 'manual',              label: 'Manual entry',                                      value: null },
  { id: 'lagged180gravity',    label: 'Lagged pulley · 180° wrap · gravity take-up',       value: 0.50 },
  { id: 'lagged220',           label: 'Lagged pulley · about 220° wrap',                   value: 0.35 },
  { id: 'dual380lagged',       label: 'Dual drive · about 380° total wrap · lagged',       value: 0.11 },
  { id: 'conservativeSingle',  label: 'Conservative single drive / manual take-up',        value: 1.20 },
] as const;

const PLUGGED_MODES = [
  { id: 'off',    label: 'Off' },
  { id: 'shear',  label: 'Shear + wall friction method' },
  { id: 'manual', label: 'Manual force entry' },
] as const;

const TROUGH_ANGLES = [0, 15, 35, 45] as const;
const SAG_OPTIONS = [3, 2, 1.5] as const;

const BELT_WEIGHT_TABLE = {
  widthsIn: [18, 24, 30, 36, 42, 48, 54, 60, 72, 84, 96],
  low:    [3.5, 4.5, 6.0,  9.0, 11.0, 14.0, 16.0, 18.0, 21.0, 25.0, 30.0],
  medium: [4.0, 5.5, 7.0, 10.0, 12.0, 15.0, 17.0, 20.0, 24.0, 30.0, 35.0],
  high:   [4.5, 6.0, 8.0, 12.0, 14.0, 17.0, 19.0, 22.0, 26.0, 33.0, 38.0],
};

const CEMA_AVAILABLE_AREA: Record<number, Record<number, number>> = {
  0:  { 18:0.0097, 24:0.0180, 30:0.0290, 36:0.0426, 42:0.0587, 48:0.0774, 54:0.0987, 60:0.1226, 72:0.1781, 84:0.2439, 96:0.3202 },
  15: { 18:0.0178, 24:0.0329, 30:0.0531, 36:0.0780, 42:0.1075, 48:0.1418, 54:0.1808, 60:0.2245, 72:0.3263, 84:0.4468, 96:0.5868 },
  35: { 18:0.0279, 24:0.0516, 30:0.0833, 36:0.1223, 42:0.1686, 48:0.2224, 54:0.2836, 60:0.3522, 72:0.5119, 84:0.7010, 96:0.9204 },
  45: { 18:0.0310, 24:0.0574, 30:0.0925, 36:0.1358, 42:0.1871, 48:0.2468, 54:0.3147, 60:0.3906, 72:0.5681, 84:0.7776, 96:1.0214 },
};

const BELT_SECTION_GEOMETRY: Record<number, { centerFrac: number }> = {
  0: { centerFrac: 0.58 }, 15: { centerFrac: 0.61 },
  35: { centerFrac: 0.66 }, 45: { centerFrac: 0.69 },
};

// Kt temperature correction curve (CEMA, digitized in °F)
const KT_CURVE = [
  { tF: -40, kt: 1.65 }, { tF: -20, kt: 1.45 }, { tF: 0, kt: 1.27 },
  { tF: 20, kt: 1.14 }, { tF: 40, kt: 1.05 }, { tF: 60, kt: 1.00 }, { tF: 120, kt: 1.00 },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — STATE TYPES & DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

interface State {
  // Project
  projectName: string; conveyorTag: string;
  // Duty
  capacityTph: number; beltSpeed: number; materialEntrySpeed: number;
  centerLengthM: number; liftM: number;
  // Belt & load
  beltWidthMm: number; bulkDensity: number; troughAngleDeg: number;
  surchargeAngleDeg: number; centerRollFraction: number; edgeFreeboardPct: number;
  useEstimatedBeltWeight: boolean; steelCord: boolean; beltWeightKgPm: number;
  idlerSpacingM: number; sagPercent: number;
  // CEMA factors
  idlerFamily: string; twoRollVReturn: boolean;
  overrideKx: boolean; manualKx: number;
  ky: number; kt: number; cwPreset: string; cw: number;
  // Pulleys & accessories
  tightPulleys: number; slackPulleys: number; otherPulleys: number;
  plainBearings: boolean; overrideTp: boolean; manualTpLbf: number;
  cleanerBlades: number; fullPlows: number; partialPlows: number;
  skirtLengthM: number; skirtDepthMm: number; csFactor: number;
  rubberEdging: boolean; otherAccessoryKN: number;
  // Plugged chute
  pluggedChuteMode: string; pluggedApplyInFlow: boolean;
  pluggedWidthMm: number; pluggedHeightMm: number; pluggedLengthM: number;
  pluggedWallFriction: number; pluggedShearStressKPa: number;
  pluggedStartupFactor: number; manualPluggedFlowKN: number;
  // Drive
  driveEfficiencyPct: number; serviceFactor: number;
  // Profile & vertical curves
  beltModulusKNpm: number; beltRatedTensionKNpm: number;
  minBuckleTensionKNpm: number; autoCurveShare: number;
  profileNodesJson: string; profileMarkersJson: string;
  // UI
  theme: 'light' | 'dark';
}

const DEFAULT_NODES_JSON = '[{"id":"N0","station":0,"elev":0,"curveLengthM":0},{"id":"N1","station":88,"elev":7,"curveLengthM":38},{"id":"N2","station":160,"elev":14,"curveLengthM":32},{"id":"N3","station":220,"elev":18,"curveLengthM":0}]';
const DEFAULT_MARKERS_JSON = '[{"id":"M1","label":"Tail pulley","type":"tail","station":0},{"id":"M2","label":"Feed point","type":"feed","station":28},{"id":"M3","label":"Take-up","type":"takeup","station":48},{"id":"M4","label":"Return pulley","type":"return","station":200},{"id":"M5","label":"Drive","type":"drive","station":220}]';

const DEFAULTS: State = {
  projectName: 'Sample Project', conveyorTag: 'CV-101',
  capacityTph: 1200, beltSpeed: 3.5, materialEntrySpeed: 0.4,
  centerLengthM: 220, liftM: 18,
  beltWidthMm: 1200, bulkDensity: 1.85, troughAngleDeg: 35,
  surchargeAngleDeg: 20, centerRollFraction: 0.33, edgeFreeboardPct: 10,
  useEstimatedBeltWeight: false, steelCord: false, beltWeightKgPm: 28,
  idlerSpacingM: 1.2, sagPercent: 2,
  idlerFamily: 'D5_5in', twoRollVReturn: false,
  overrideKx: false, manualKx: 0.45, ky: 0.019, kt: 1.0,
  cwPreset: 'lagged220', cw: 0.35,
  tightPulleys: 1, slackPulleys: 2, otherPulleys: 1, plainBearings: false,
  overrideTp: false, manualTpLbf: 0,
  cleanerBlades: 2, fullPlows: 0, partialPlows: 0,
  skirtLengthM: 8, skirtDepthMm: 60, csFactor: 0.1086,
  rubberEdging: true, otherAccessoryKN: 0,
  pluggedChuteMode: 'off', pluggedApplyInFlow: false,
  pluggedWidthMm: 1200, pluggedHeightMm: 350, pluggedLengthM: 1.8,
  pluggedWallFriction: 0.45, pluggedShearStressKPa: 12,
  pluggedStartupFactor: 1.6, manualPluggedFlowKN: 0,
  driveEfficiencyPct: 95, serviceFactor: 1.15,
  beltModulusKNpm: 12000, beltRatedTensionKNpm: 800,
  minBuckleTensionKNpm: 5, autoCurveShare: 0.35,
  profileNodesJson: DEFAULT_NODES_JSON, profileMarkersJson: DEFAULT_MARKERS_JSON,
  theme: 'light',
};

const SAMPLE: State = {
  ...DEFAULTS,
  projectName: 'Iron Ore Transfer', conveyorTag: 'CV-4201',
  capacityTph: 1800, beltSpeed: 4.2, materialEntrySpeed: 0.9,
  centerLengthM: 365, liftM: 24,
  beltWidthMm: 1400, bulkDensity: 2.2,
  useEstimatedBeltWeight: true, steelCord: true, beltWeightKgPm: 0,
  idlerSpacingM: 1.35, idlerFamily: 'D6_6in',
  cwPreset: 'lagged180gravity', cw: 0.5,
  tightPulleys: 1, slackPulleys: 3, otherPulleys: 1,
  cleanerBlades: 2, skirtLengthM: 10, skirtDepthMm: 80,
  csFactor: 0.276, rubberEdging: true,
  driveEfficiencyPct: 94.5, ky: 0.0175,
};

const STORAGE_KEY = 'cema7ConveyorPowerWorksheetStateV1';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — CALCULATION ENGINE (CEMA 7 Historical Method)
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileNode { id: string; station: number; elev: number; curveLengthM: number; }
interface ProfileMarker { id: string; label: string; type: string; station: number; }
interface BeltSectionGeom {
  widthM: number; troughRad: number; edgeDistanceM: number;
  usableHalfWidth: number; centerHalf: number; sideRun: number;
  edgeY: number; beltY: (x: number) => number;
}
interface FillModel {
  geom: BeltSectionGeom; cemaAvailableAreaM2: number; maxAreaM2: number;
  occupiedAreaM2: number; apexHeightM: number; loadedHalfWidthM: number;
  fillToAvailableRatio: number; fillToMaxRatio: number;
  edgeDistanceM: number; totalEdgeClearanceM: number;
  surchargeAngleUsedDeg: number; availableAreaFactor: number; maxAreaFactor: number;
}
interface VerticalCurve {
  id: string; type: string; station: number; elev: number;
  startStation: number; endStation: number; deltaDeg: number;
  actualR: number; requiredR: number; marginPct: number;
  curveLengthM: number; status: string;
  localTensionKN: number;
  checks: Record<string, number>;
}
interface ProfileResult {
  nodes: ProfileNode[]; markers: ProfileMarker[];
  totalLen: number; drivePos: number;
  curves: VerticalCurve[];
}
interface CompRow { label: string; lbf: number; kw: number; basis: string }
interface TensionComponent {
  key: string; label: string; lbf: number; kw: number; basis: string;
}
interface CalcResult extends State {
  widthIn: number; vFpm: number; v0Fpm: number; qShortTph: number;
  lengthFt: number; liftFt: number; slopePct: number; spacingFt: number;
  estimate: { lbft: number; kgpm: number; standardWidthIn: number; densityBand: string };
  beltWeightLbft: number; beltWeightKgPm: number;
  wmLbft: number; wmKgPm: number;
  aiAdjusted: number; kxAuto: number; kxUsed: number;
  txLbf: number; tycLbf: number; tyrLbf: number; tybLbf: number;
  tymLbf: number; tmLbf: number; tbLbf: number;
  tpCountLbf: number; tpLbf: number;
  tamLbf: number; tbcLbf: number; tplLbf: number; tsbLbf: number;
  otherAccessoryLbf: number; tacLbf: number;
  pluggedFlowKN: number; pluggedStartupKN: number; pluggedStartupExtraKN: number;
  pluggedFlowLbf: number; pluggedStartupLbf: number; pluggedStartupExtraLbf: number;
  pluggedMethodBasis: string;
  teBaseLbf: number; teLbf: number; startupTeLbf: number;
  beltHp: number; beltKw: number; startupBeltHp: number; startupBeltKw: number;
  motorKw: number; motorHp: number; startupMotorKw: number; startupMotorHp: number;
  t0Lbf: number; t2SlipLbf: number; t2SagLbf: number;
  t2Lbf: number; t1Lbf: number; counterweightLbf: number;
  dutyMode: string; governingSource: string;
  requiredAreaM2: number; fillModel: FillModel;
  occupiedAreaM2: number; cemaAvailableAreaM2: number; maxAreaM2: number;
  edgeDistanceM: number; totalEdgeClearanceM: number;
  fillAreaPct: number; fillToMaxPct: number;
  components: TensionComponent[];
  profile: ProfileResult;
}

// ── Interpolation helpers ─────────────────────────────────────────────────────

function interpSeries(series: Record<number, number>, widthIn: number): number {
  const keys = Object.keys(series).map(Number).sort((a, b) => a - b);
  if (widthIn <= keys[0]) return series[keys[0]];
  if (widthIn >= keys[keys.length - 1]) {
    const k0 = keys[keys.length - 2], k1 = keys[keys.length - 1];
    return series[k1] + ((widthIn - k1) / (k1 - k0)) * (series[k1] - series[k0]);
  }
  for (let i = 0; i < keys.length - 1; i++) {
    if (widthIn >= keys[i] && widthIn <= keys[i + 1]) {
      const k0 = keys[i], k1 = keys[i + 1];
      return series[k0] + ((widthIn - k0) / (k1 - k0)) * (series[k1] - series[k0]);
    }
  }
  return series[keys[0]];
}

function interpolateAvailableAreaM2(widthM: number, troughAngleDeg: number, surchargeAngleDeg: number): number {
  const widthIn = widthM / 0.0254;
  const troughKeys = Object.keys(CEMA_AVAILABLE_AREA).map(Number).sort((a, b) => a - b);
  const trough = clamp(troughAngleDeg, troughKeys[0], troughKeys[troughKeys.length - 1]);
  let low = troughKeys[0], high = troughKeys[troughKeys.length - 1];
  for (let i = 0; i < troughKeys.length - 1; i++) {
    if (trough >= troughKeys[i] && trough <= troughKeys[i + 1]) { low = troughKeys[i]; high = troughKeys[i + 1]; break; }
  }
  const aLow = interpSeries(CEMA_AVAILABLE_AREA[low], widthIn);
  const aHigh = interpSeries(CEMA_AVAILABLE_AREA[high], widthIn);
  const troughArea = high === low ? aLow : aLow + ((trough - low) / (high - low)) * (aHigh - aLow);
  const surchargeCorrection = clamp(1 + 0.004 * (surchargeAngleDeg - 20), 0.88, 1.16);
  return troughArea * surchargeCorrection;
}

function edgeDistancePerSideM(widthM: number): number { return 0.05 * widthM + 0.025; }

function interpolateGeometryPreset(troughAngleDeg: number): { centerFrac: number } {
  const keys = Object.keys(BELT_SECTION_GEOMETRY).map(Number).sort((a, b) => a - b);
  const trough = clamp(troughAngleDeg, keys[0], keys[keys.length - 1]);
  let low = keys[0], high = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (trough >= keys[i] && trough <= keys[i + 1]) { low = keys[i]; high = keys[i + 1]; break; }
  }
  const a = BELT_SECTION_GEOMETRY[low], b = BELT_SECTION_GEOMETRY[high];
  if (high === low) return a;
  const t = (trough - low) / (high - low);
  return { centerFrac: a.centerFrac + t * (b.centerFrac - a.centerFrac) };
}

function beltSectionGeometry(widthM: number, troughAngleDeg: number): BeltSectionGeom {
  const B = Math.max(widthM, 0.05);
  const lambda = clamp(troughAngleDeg, 0, 60) * Math.PI / 180;
  const preset = interpolateGeometryPreset(troughAngleDeg);
  const edgeDist = edgeDistancePerSideM(B);
  const usableHalfWidth = Math.max(B / 2 - edgeDist, 0.001);
  const centerFrac = clamp(preset.centerFrac, 0.2, 0.85);
  const centerHalf = Math.min((B * centerFrac) / 2, usableHalfWidth * 0.95);
  const sideRun = Math.max(usableHalfWidth - centerHalf, 0.0001);
  const edgeY = sideRun * Math.tan(lambda);
  const beltY = (x: number) => {
    const ax = Math.abs(x);
    if (ax <= centerHalf) return 0;
    return (ax - centerHalf) * Math.tan(lambda);
  };
  return { widthM: B, troughRad: lambda, edgeDistanceM: edgeDist, usableHalfWidth, centerHalf, sideRun, edgeY, beltY };
}

function integrateArea(fn: (x: number) => number, xmin: number, xmax: number, steps = 600): number {
  const dx = (xmax - xmin) / steps;
  let area = 0;
  for (let i = 0; i < steps; i++) {
    const x1 = xmin + i * dx, x2 = x1 + dx;
    area += 0.5 * (fn(x1) + fn(x2)) * dx;
  }
  return area;
}

function materialAreaForApexHeight(geom: BeltSectionGeom, phi: number, apexHeightM: number): number {
  const tanPhi = Math.tan(phi);
  const ySurf = (x: number) => apexHeightM - Math.abs(x) * tanPhi;
  const fn = (x: number) => Math.max(0, ySurf(x) - geom.beltY(x));
  return integrateArea(fn, -geom.usableHalfWidth, geom.usableHalfWidth);
}

function loadedHalfWidthForApex(geom: BeltSectionGeom, phi: number, apexHeightM: number): number {
  const tanPhi = Math.tan(phi);
  let lo = 0, hi = geom.usableHalfWidth;
  const diff = (x: number) => apexHeightM - Math.abs(x) * tanPhi - geom.beltY(x);
  if (diff(lo) <= 0) return 0;
  if (diff(hi) > 0) return hi;
  for (let i = 0; i < 52; i++) {
    const mid = 0.5 * (lo + hi);
    if (diff(mid) > 0) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

function solveCrossSectionFill(widthM: number, troughAngleDeg: number, surchargeAngleDeg: number, requiredAreaM2: number): FillModel {
  const geom = beltSectionGeometry(widthM, troughAngleDeg);
  const phiDeg = clamp(surchargeAngleDeg, 0.1, 80);
  const phi = phiDeg * Math.PI / 180;
  const cemaAvailableAreaM2 = interpolateAvailableAreaM2(widthM, troughAngleDeg, phiDeg);
  const maxAreaM2 = cemaAvailableAreaM2 / 0.70;
  const maxApexHeight = geom.edgeY + geom.usableHalfWidth * Math.tan(phi);
  const targetArea = Math.max(requiredAreaM2 || 0, 0);
  let apexHeight = maxApexHeight;
  if (targetArea > 0 && targetArea < maxAreaM2) {
    let lo = 0, hi = maxApexHeight;
    const areaAtMax = materialAreaForApexHeight(geom, phi, maxApexHeight);
    for (let i = 0; i < 56; i++) {
      const mid = 0.5 * (lo + hi);
      const midArea = areaAtMax > 0 ? (materialAreaForApexHeight(geom, phi, mid) / areaAtMax) * maxAreaM2 : 0;
      if (midArea < targetArea) lo = mid; else hi = mid;
    }
    apexHeight = 0.5 * (lo + hi);
  } else if (targetArea >= maxAreaM2) { apexHeight = maxApexHeight; } else { apexHeight = 0; }
  const occupiedAreaM2 = Math.min(targetArea, maxAreaM2);
  const loadedHalfWidthM = loadedHalfWidthForApex(geom, phi, apexHeight);
  const B2 = widthM * widthM;
  return {
    geom, cemaAvailableAreaM2, maxAreaM2, occupiedAreaM2, apexHeightM: apexHeight,
    loadedHalfWidthM, edgeDistanceM: geom.edgeDistanceM, totalEdgeClearanceM: 2 * geom.edgeDistanceM,
    fillToAvailableRatio: cemaAvailableAreaM2 > 0 ? occupiedAreaM2 / cemaAvailableAreaM2 : NaN,
    fillToMaxRatio: maxAreaM2 > 0 ? occupiedAreaM2 / maxAreaM2 : NaN,
    surchargeAngleUsedDeg: phiDeg,
    availableAreaFactor: B2 > 0 ? cemaAvailableAreaM2 / B2 : NaN,
    maxAreaFactor: B2 > 0 ? maxAreaM2 / B2 : NaN,
  };
}

function estimateBeltWeight(widthMm: number, densityTm3: number, steelCord: boolean): { lbft: number; kgpm: number; standardWidthIn: number; densityBand: string } {
  const widthIn = widthMm * IN_PER_MM;
  const widths = BELT_WEIGHT_TABLE.widthsIn;
  let idx = 0; let bestD = Infinity;
  for (let i = 0; i < widths.length; i++) { const d = Math.abs(widths[i] - widthIn); if (d < bestD) { bestD = d; idx = i; } }
  let series: number[] = BELT_WEIGHT_TABLE.low, densityBand = 'light';
  if (densityTm3 >= 2.0) { series = BELT_WEIGHT_TABLE.high; densityBand = 'heavy'; }
  else if (densityTm3 >= 1.2) { series = BELT_WEIGHT_TABLE.medium; densityBand = 'medium'; }
  let lbft = series[idx];
  if (steelCord) lbft *= 1.5;
  const kgpm = lbft * KGPM_PER_LBFT;
  return { lbft, kgpm, standardWidthIn: widths[idx], densityBand };
}

function ktFromTempC(tempC: number): number {
  const tF = tempC * 9 / 5 + 32;
  if (tF <= KT_CURVE[0].tF) return KT_CURVE[0].kt;
  if (tF >= KT_CURVE[KT_CURVE.length - 1].tF) return KT_CURVE[KT_CURVE.length - 1].kt;
  for (let i = 0; i < KT_CURVE.length - 1; i++) {
    const a = KT_CURVE[i], b = KT_CURVE[i + 1];
    if (tF >= a.tF && tF <= b.tF) return a.kt + ((tF - a.tF) / (b.tF - a.tF)) * (b.kt - a.kt);
  }
  return 1.0;
}

function interpolateProfileElevation(nodes: ProfileNode[], station: number): number {
  if (!nodes.length) return 0;
  const s = clamp(station, nodes[0].station, nodes[nodes.length - 1].station);
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    if (s >= a.station && s <= b.station) {
      const span = Math.max(b.station - a.station, 1e-6);
      return a.elev + ((s - a.station) / span) * (b.elev - a.elev);
    }
  }
  return nodes[nodes.length - 1].elev;
}

function parseJsonList<T>(raw: string, fallback: T[]): T[] {
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : fallback; } catch { return fallback; }
}

function sanitizeProfile(nodesRaw: string, markersRaw: string, totalLengthM: number, totalLiftM: number) {
  const L = Math.max(totalLengthM || 1, 1);
  const defaultNodes: ProfileNode[] = [
    { id: 'N0', station: 0, elev: 0, curveLengthM: 0 },
    { id: 'N1', station: L, elev: totalLiftM || 0, curveLengthM: 0 },
  ];
  const defaultMarkers: ProfileMarker[] = [
    { id: 'M1', label: 'Tail', type: 'tail', station: 0 },
    { id: 'M2', label: 'Drive', type: 'drive', station: L },
  ];
  const nodes: ProfileNode[] = parseJsonList<ProfileNode>(nodesRaw, defaultNodes)
    .map((n, i) => ({
      id: String(n.id ?? `N${i}`), station: Number(n.station) || 0,
      elev: Number(n.elev) || 0, curveLengthM: Number(n.curveLengthM) || 0,
    }))
    .sort((a, b) => a.station - b.station)
    .map((node, i, arr) => ({
      ...node,
      station: clamp(node.station, i > 0 ? arr[i - 1].station : 0, L),
    }));
  const markers: ProfileMarker[] = parseJsonList<ProfileMarker>(markersRaw, defaultMarkers)
    .map((m, i) => ({
      id: String(m.id ?? `M${i}`), label: String(m.label ?? `Marker ${i}`),
      type: String(m.type ?? 'custom'), station: Number(m.station) || 0,
    }))
    .map(marker => ({ ...marker, station: clamp(marker.station, 0, L) }));
  return { nodes, markers };
}

function computeProfileAndCurves(s: State, baseResults: { teLbf: number; t2Lbf: number; t1Lbf: number; wmKgPm: number; beltWeightKgPm: number }): ProfileResult {
  const { nodes, markers } = sanitizeProfile(s.profileNodesJson, s.profileMarkersJson, s.centerLengthM, s.liftM);
  const totalLen = nodes[nodes.length - 1]?.station || 1;
  const driveMarker = markers.find(m => m.type === 'drive') || { station: totalLen };
  const drivePos = clamp(driveMarker.station, 1e-6, totalLen);
  const absTe = Math.abs(baseResults.teLbf);
  const tensionAtStationLbf = (station: number) => {
    const x = clamp(station, 0, totalLen);
    if (x <= drivePos) return baseResults.t2Lbf + (x / Math.max(drivePos, 1e-6)) * absTe;
    const returnSpan = Math.max(totalLen - drivePos, 1e-6);
    return baseResults.t1Lbf - ((x - drivePos) / returnSpan) * absTe;
  };
  const wmTotal = baseResults.wmKgPm + baseResults.beltWeightKgPm;
  const alpha = (s.troughAngleDeg || 0) * Math.PI / 180;
  const widthM = Math.max(s.beltWidthMm / 1000, 0.1);
  const E = Math.max(s.beltModulusKNpm, 0);
  const tr = Math.max(s.beltRatedTensionKNpm, 0.0001);
  const tmin = Math.max(s.minBuckleTensionKNpm, 0);
  const autoShare = clamp(s.autoCurveShare, 0.05, 0.8);

  const segments = nodes.slice(0, -1).map((a, i) => {
    const b = nodes[i + 1];
    const ds = b.station - a.station, de = b.elev - a.elev;
    return { start: a, end: b, lengthM: Math.hypot(ds, de), riseM: de, angleRad: Math.atan2(de, Math.max(ds, 1e-6)) };
  });

  const curves: VerticalCurve[] = [];
  for (let i = 1; i < nodes.length - 1; i++) {
    const prev = segments[i - 1], next = segments[i];
    const delta = next.angleRad - prev.angleRad;
    if (Math.abs(delta) < 1e-6) continue;
    const kind = delta > 0 ? 'concave' : 'convex';
    const deltaAbs = Math.abs(delta);
    const node = nodes[i];
    const suggestedLc = autoShare * Math.min(prev.lengthM, next.lengthM);
    const curveLengthM = Math.max(node.curveLengthM || suggestedLc, 0.5);
    const actualR = curveLengthM / Math.max(deltaAbs, 1e-6);
    const setback = actualR * Math.tan(deltaAbs / 2);
    const startStation = node.station - setback;
    const endStation = node.station + setback;
    const fits = startStation >= prev.start.station && endStation <= next.end.station;
    const localTensionLbf = tensionAtStationLbf(node.station);
    const localTensionKN = lbfToKn(localTensionLbf);
    const localWidthTension = localTensionKN / widthM;
    const req: Record<string, number> = {};
    const gravityKnPm = (wmTotal * G_MPS2) / 1000;
    if (kind === 'concave') {
      req['R11_liftoff'] = localWidthTension > 0 ? (gravityKnPm * curveLengthM) / localWidthTension : Infinity;
      req['R12_edgeBending'] = E > 0 ? (0.5 * E * widthM) / tr : 0;
      req['R13_accel'] = wmTotal > 0 ? (wmTotal * G_MPS2 * widthM) / (localWidthTension * 1000 + 1e-9) : 0;
    } else {
      req['R21_edgeStress'] = tr > 0 ? (E * widthM * Math.sin(alpha)) / Math.max(tr - localWidthTension, 1e-6) : 0;
      req['R22_buckle'] = tmin > 0 ? (E * widthM) / Math.max(tmin, 1e-6) * 0.01 : 0;
      req['R23_idlerAngle'] = 114 * Math.max(s.idlerSpacingM, 0.1);
    }
    const positiveReq = Object.values(req).filter(v => Number.isFinite(v) && v > 0);
    const requiredR = positiveReq.length ? Math.max(...positiveReq) : NaN;
    const marginPct = Number.isFinite(requiredR) ? ((actualR - requiredR) / requiredR) * 100 : NaN;
    const status = !fits ? 'No fit' : !Number.isFinite(marginPct) ? 'OK' : marginPct >= 0 ? 'OK' : marginPct >= -20 ? 'Review' : 'Fail';
    curves.push({
      id: `CV-${i}`, type: kind, station: node.station, elev: node.elev,
      startStation, endStation, deltaDeg: delta * 180 / Math.PI,
      actualR, requiredR, marginPct, curveLengthM, status, localTensionKN, checks: req,
    });
  }
  return { nodes, markers, totalLen, drivePos, curves };
}

interface ValRow {
  item: typeof VALIDATION_CASES[number];
  calc: CalcResult;
  deviations: { te: number; hp: number; t2: number; t1: number };
  maxAbs: number;
}
interface AreaValRow {
  id: string; label: string; unit: string; tolerancePct: number;
  expected: number; calculated: number; delta: number; pass: boolean;
}
function compute(s: State): CalcResult {
  const widthIn = s.beltWidthMm * IN_PER_MM;
  const qShortTph = s.capacityTph * SHORT_TON_PER_METRIC_TON;
  const vFpm = s.beltSpeed * FPM_PER_MPS;
  const v0Fpm = s.materialEntrySpeed * FPM_PER_MPS;
  const lengthFt = s.centerLengthM * FT_PER_M;
  const liftFt = s.liftM * FT_PER_M;
  const slopePct = lengthFt > 0 ? liftFt / lengthFt * 100 : NaN;
  const spacingFt = s.idlerSpacingM * FT_PER_M;

  const estimate = estimateBeltWeight(s.beltWidthMm, s.bulkDensity, s.steelCord);
  const beltWeightLbft = s.useEstimatedBeltWeight ? estimate.lbft : kgpmToLbft(s.beltWeightKgPm);
  const beltWeightKgPm = s.useEstimatedBeltWeight ? estimate.kgpm : s.beltWeightKgPm;

  const wmLbft = vFpm > 0 ? (qShortTph * 2000) / (60 * vFpm) : NaN;
  const wmKgPm = Number.isFinite(wmLbft) ? wmLbft * KGPM_PER_LBFT : NaN;

  const idler = IDLER_FAMILIES.find(f => f.id === s.idlerFamily) || IDLER_FAMILIES[0];
  const aiAdjusted = idler.ai * (s.twoRollVReturn ? 1.05 : 1.0);
  const kxAuto = spacingFt > 0 ? (0.00068 * (beltWeightLbft + wmLbft) + aiAdjusted) / spacingFt : NaN;
  const kxUsed = s.overrideKx ? s.manualKx : kxAuto;

  const txLbf = lengthFt * s.kt * kxUsed;
  const tycLbf = lengthFt * s.ky * beltWeightLbft * s.kt;
  const tyrLbf = lengthFt * 0.015 * beltWeightLbft * s.kt;
  const tybLbf = tycLbf + tyrLbf;
  const tymLbf = lengthFt * s.ky * wmLbft;
  const tmLbf = liftFt * wmLbft;
  const tbLbf = liftFt * beltWeightLbft;
  const tpCountLbf = (s.tightPulleys * 200 + s.slackPulleys * 150 + s.otherPulleys * 100) * (s.plainBearings ? 2 : 1);
  const tpLbf = s.overrideTp ? s.manualTpLbf : tpCountLbf;
  const tamLbf = 0.00028755 * qShortTph * (vFpm - v0Fpm);
  const tbcLbf = s.cleanerBlades * 5 * widthIn;
  const tplLbf = s.fullPlows * 5 * widthIn + s.partialPlows * 3 * widthIn;
  const skirtLengthFt = s.skirtLengthM * FT_PER_M;
  const skirtDepthIn = s.skirtDepthMm * IN_PER_MM;
  const tsbLbf = skirtLengthFt > 0 ? skirtLengthFt * (s.csFactor * skirtDepthIn * skirtDepthIn + (s.rubberEdging ? 6 : 0)) : 0;
  const otherAccessoryLbf = knToLbf(s.otherAccessoryKN);
  const tacLbf = tbcLbf + tplLbf + tsbLbf + otherAccessoryLbf;

  // Plugged chute
  const plugWidthM = s.pluggedWidthMm / 1000, plugHeightM = s.pluggedHeightMm / 1000;
  const plugCrossAreaM2 = Math.max(plugWidthM * plugHeightM, 0);
  const plugVolumeM3 = Math.max(plugCrossAreaM2 * s.pluggedLengthM, 0);
  const plugWeightN = plugVolumeM3 * Math.max(s.bulkDensity, 0) * 1000 * G_MPS2;
  const plugFrictionN = Math.max(s.pluggedWallFriction, 0) * plugWeightN;
  const plugShearN = Math.max(s.pluggedShearStressKPa, 0) * 1000 * plugCrossAreaM2;
  let pluggedFlowKN = 0, pluggedMethodBasis = 'Off';
  if (s.pluggedChuteMode === 'shear') {
    pluggedFlowKN = Math.max(plugFrictionN, plugShearN) / 1000;
    pluggedMethodBasis = 'Shear + wall friction method';
  } else if (s.pluggedChuteMode === 'manual') {
    pluggedFlowKN = Math.max(s.manualPluggedFlowKN, 0);
    pluggedMethodBasis = 'Manual force entry';
  }
  const pluggedStartupKN = Math.max(s.pluggedStartupFactor, 0) * pluggedFlowKN;
  const pluggedStartupExtraKN = Math.max(pluggedStartupKN - pluggedFlowKN, 0);
  const pluggedFlowLbf = knToLbf(pluggedFlowKN);
  const pluggedStartupLbf = knToLbf(pluggedStartupKN);
  const pluggedStartupExtraLbf = knToLbf(pluggedStartupExtraKN);

  const teBaseLbf = txLbf + tybLbf + tymLbf + tmLbf + tpLbf + tamLbf + tacLbf;
  const teLbf = teBaseLbf + (s.pluggedApplyInFlow ? pluggedFlowLbf : 0);
  const startupTeLbf = Math.max(teBaseLbf + pluggedStartupLbf, teLbf);

  const beltHp = hpFromTeV(teLbf, vFpm);
  const beltKw = beltHp * HP_TO_KW;
  const startupBeltHp = hpFromTeV(startupTeLbf, vFpm);
  const startupBeltKw = startupBeltHp * HP_TO_KW;
  const efficiency = Math.max(s.driveEfficiencyPct / 100, 0.0001);
  const motorKw = beltKw * s.serviceFactor / efficiency;
  const motorHp = motorKw / HP_TO_KW;
  const startupMotorKw = startupBeltKw * s.serviceFactor / efficiency;
  const startupMotorHp = startupMotorKw / HP_TO_KW;

  const sagFactor = s.sagPercent === 1.5 ? 8.4 : s.sagPercent === 2 ? 6.25 : 4.2;
  const t0Lbf = sagFactor * spacingFt * (beltWeightLbft + wmLbft);
  const t2SlipLbf = Math.abs(teLbf) * s.cw;
  const t2SagLbf = Math.max(0, t0Lbf + tbLbf - tyrLbf);
  const governingSource = t2SagLbf >= t2SlipLbf ? 'Sag' : 'Slip';
  const t2Lbf = Math.max(t2SlipLbf, t2SagLbf, 0);
  const t1Lbf = Math.abs(teLbf) + t2Lbf;
  const counterweightLbf = 2 * t2Lbf;
  const dutyMode = teLbf >= 0 ? 'Motoring' : 'Regenerative';

  const requiredAreaM2 = (s.bulkDensity > 0 && s.beltSpeed > 0) ? (s.capacityTph / 3600) / (s.bulkDensity * s.beltSpeed) : NaN;
  const fillModel = solveCrossSectionFill(s.beltWidthMm / 1000, s.troughAngleDeg, s.surchargeAngleDeg, requiredAreaM2);

  const components: TensionComponent[] = [
    { key: 'Tx',          label: 'Tx · Idler friction',                    lbf: txLbf,               basis: 'L × Kt × Kx' },
    { key: 'Tyc',         label: 'Tyc · Belt flexure on carrying idlers',  lbf: tycLbf,              basis: 'L × Ky × Wb × Kt' },
    { key: 'Tyr',         label: 'Tyr · Belt flexure on return idlers',    lbf: tyrLbf,              basis: 'L × 0.015 × Wb × Kt' },
    { key: 'Tym',         label: 'Tym · Material flexure',                 lbf: tymLbf,              basis: 'L × Ky × Wm' },
    { key: 'Tm',          label: 'Tm · Lift / lower material',             lbf: tmLbf,               basis: 'H × Wm' },
    { key: 'Tp',          label: 'Tp · Pulley resistance',                 lbf: tpLbf,               basis: 'Table 6-5 count method' },
    { key: 'Tam',         label: 'Tam · Accelerate feed',                  lbf: tamLbf,              basis: '0.00028755 × Q × (V − Vo)' },
    { key: 'Tbc',         label: 'Tbc · Belt cleaners',                    lbf: tbcLbf,              basis: '5 lb/in × blades × belt width' },
    { key: 'Tpl',         label: 'Tpl · Plows',                            lbf: tplLbf,              basis: '5 or 3 lb/in × belt width' },
    { key: 'Tsb',         label: 'Tsb · Skirtboards',                      lbf: tsbLbf,              basis: 'Lb × (Cs × hs² + 6)' },
    { key: 'Tother',      label: 'Other accessory tension',                lbf: otherAccessoryLbf,   basis: 'Manual kN adder' },
    { key: 'TplugFlow',   label: 'Tplug(flow) · Plugged chute in flow',   lbf: pluggedFlowLbf,      basis: pluggedMethodBasis },
    { key: 'TplugStartX', label: 'Tplug(start extra) · Extra breakout',   lbf: pluggedStartupExtraLbf, basis: `Startup factor ${fmtFixed(s.pluggedStartupFactor, 2)} × flow` },
  ].map(item => ({ ...item, kw: componentKwFromLbf(item.lbf, vFpm) }));

  const profile = computeProfileAndCurves(s, { teLbf, t2Lbf, t1Lbf, wmKgPm, beltWeightKgPm });

  return {
    ...s, widthIn, vFpm, v0Fpm, qShortTph, lengthFt, liftFt, slopePct, spacingFt,
    estimate, beltWeightLbft, beltWeightKgPm, wmLbft, wmKgPm,
    aiAdjusted, kxAuto, kxUsed,
    txLbf, tycLbf, tyrLbf, tybLbf, tymLbf, tmLbf, tbLbf,
    tpCountLbf, tpLbf, tamLbf, tbcLbf, tplLbf, tsbLbf, otherAccessoryLbf, tacLbf,
    pluggedFlowKN, pluggedStartupKN, pluggedStartupExtraKN,
    pluggedFlowLbf, pluggedStartupLbf, pluggedStartupExtraLbf, pluggedMethodBasis,
    teBaseLbf, teLbf, startupTeLbf,
    beltHp, beltKw, startupBeltHp, startupBeltKw,
    motorKw, motorHp, startupMotorKw, startupMotorHp,
    t0Lbf, t2SlipLbf, t2SagLbf, t2Lbf, t1Lbf, counterweightLbf, dutyMode, governingSource,
    requiredAreaM2, fillModel, occupiedAreaM2: fillModel.occupiedAreaM2,
    cemaAvailableAreaM2: fillModel.cemaAvailableAreaM2, maxAreaM2: fillModel.maxAreaM2,
    edgeDistanceM: fillModel.edgeDistanceM, totalEdgeClearanceM: fillModel.totalEdgeClearanceM,
    fillAreaPct: fillModel.fillToAvailableRatio * 100, fillToMaxPct: fillModel.fillToMaxRatio * 100,
    components, profile,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — VALIDATION CASES (AGH/CEMA + Rulmeca)
// ─────────────────────────────────────────────────────────────────────────────

const VALIDATION_CASES = [
  {
    id: 'aghCema5', label: 'AGH / CEMA worked example',
    source: 'Published CEMA-style worked example',
    note: 'Source rounds Wm to 55 lb/ft, so very small residual differences are expected.',
    input: {
      ...DEFAULTS, projectName: 'Validation - AGH CEMA 5', conveyorTag: 'VAL-AGH',
      capacityTph: 1000 / SHORT_TON_PER_METRIC_TON, beltSpeed: 600 / FPM_PER_MPS,
      materialEntrySpeed: 0, centerLengthM: 3300 / FT_PER_M, liftM: 115 / FT_PER_M,
      beltWidthMm: 42 * 25.4, bulkDensity: 0.96,
      useEstimatedBeltWeight: false, beltWeightKgPm: 11 / LBFT_PER_KGPM,
      idlerSpacingM: 4.5 / FT_PER_M, sagPercent: 2, idlerFamily: 'B4_C4_4in',
      twoRollVReturn: false, overrideKx: true, manualKx: 0.555, ky: 0.0214, kt: 1.0,
      cwPreset: 'manual', cw: 0.08, tightPulleys: 2, slackPulleys: 3, otherPulleys: 0,
      plainBearings: false, overrideTp: false, manualTpLbf: 0,
      cleanerBlades: 0, fullPlows: 0, partialPlows: 0,
      skirtLengthM: 10 / FT_PER_M, skirtDepthMm: 10 * 25.4, csFactor: 0.0538,
      rubberEdging: true, otherAccessoryKN: 0, driveEfficiencyPct: 94, serviceFactor: 1.0,
    },
    expected: { teLbf: 14598.2, beltHp: 265.4, t2Lbf: 2567.7, t1Lbf: 17165.9 },
  },
  {
    id: 'rulmecaWorkbook', label: 'Rulmeca public workbook sample',
    source: 'Public Design-Imperial-7.31 workbook sample',
    note: 'Manual Tp override used to match the workbook project-specific pulley-resistance treatment.',
    input: {
      ...DEFAULTS, projectName: 'Validation - Rulmeca', conveyorTag: 'VAL-RUL',
      capacityTph: 500 / SHORT_TON_PER_METRIC_TON, beltSpeed: 300 / FPM_PER_MPS,
      materialEntrySpeed: 0, centerLengthM: 100 / FT_PER_M, liftM: 0,
      beltWidthMm: 36 * 25.4, bulkDensity: 1.0,
      useEstimatedBeltWeight: false, beltWeightKgPm: 9 / LBFT_PER_KGPM,
      idlerSpacingM: 4 / FT_PER_M, sagPercent: 2, idlerFamily: 'B5_C5_D5_5in',
      twoRollVReturn: false, overrideKx: true, manualKx: 0.493894, ky: 0.035,
      kt: 1.58855494575869, cwPreset: 'manual', cw: 0.5,
      tightPulleys: 0, slackPulleys: 0, otherPulleys: 0, plainBearings: false,
      overrideTp: true, manualTpLbf: 19.387, cleanerBlades: 1,
      fullPlows: 0, partialPlows: 0, skirtLengthM: 12 / FT_PER_M, skirtDepthMm: 3 * 25.4,
      csFactor: 0.128, rubberEdging: true, otherAccessoryKN: 0,
      driveEfficiencyPct: 94, serviceFactor: 1.0,
    },
    expected: { teLbf: 672.711248197195, beltHp: 6.11555680179268, t2Lbf: 1592.30450823226, t1Lbf: 2265.01575642945 },
  },
];

const AREA_VALIDATION_CASES = [
  { id: 'occupiedAreaIdentity', label: 'Occupied area from Q / (3600 × ρ × v)', unit: 'm²', tolerancePct: 0.01, expected: 1200 / (3600 * 1.60 * 3.00), calculated: () => compute({ ...DEFAULTS, capacityTph: 1200, bulkDensity: 1.60, beltSpeed: 3.00 }).occupiedAreaM2 },
  { id: 'available35x36', label: 'Available area · 36 in · 35° trough · 20° surcharge', unit: 'm²', tolerancePct: 0.5, expected: 0.1223, calculated: () => interpolateAvailableAreaM2(36 * 0.0254, 35, 20) },
  { id: 'available45x48', label: 'Available area · 48 in · 45° trough · 20° surcharge', unit: 'm²', tolerancePct: 0.5, expected: 0.2468, calculated: () => interpolateAvailableAreaM2(48 * 0.0254, 45, 20) },
  { id: 'edgeClearance1200', label: 'Edge clearance · 1200 mm belt', unit: 'mm', tolerancePct: 0.01, expected: 2 * (0.05 * 1200 + 25), calculated: () => 2 * edgeDistancePerSideM(1.2) * 1000 },
];

function deviationPct(actual: number, expected: number) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected === 0) return NaN;
  return ((actual - expected) / expected) * 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — SVG RENDERERS (pure functions → string)
// ─────────────────────────────────────────────────────────────────────────────

function svgSchematic(r: CalcResult, w: number, h: number): string {
  const margin = { left: 32, right: 24, top: 24, bottom: 34 };
  const baseY = h - 64;
  const x0 = margin.left + 40, x1 = w - margin.right - 36;
  const maxRise = 110;
  const liftFrac = r.liftM !== 0 ? clamp(Math.abs(r.liftM) / Math.max(Math.abs(r.liftM), 1), 0, 1) : 0;
  const actualHeadY = clamp(baseY - liftFrac * maxRise * (r.liftM >= 0 ? 1 : -1), 80, h - 80);
  const actualTailY = baseY;
  const beltTop = `M ${x0} ${actualTailY} L ${x1} ${actualHeadY}`;
  const beltBottom = `M ${x0} ${actualTailY + 12} L ${x1} ${actualHeadY + 12}`;
  const driveCy = actualHeadY + 6, tailCy = actualTailY + 6;
  const idlers = Array.from({ length: 6 }, (_, i) => {
    const t = i / 5, x = x0 + (x1 - x0) * t, y = actualTailY + (actualHeadY - actualTailY) * t + 16;
    return `<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="#7b715f" stroke-width="3" stroke-linecap="round"/>`;
  }).join('');
  const arrowX = x0 + (x1 - x0) * 0.58, arrowY = actualTailY + (actualHeadY - actualTailY) * 0.58 - 8;
  const modeLabel = r.dutyMode === 'Regenerative' ? 'Regenerative tendency' : 'Head drive motoring duty';
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Conveyor schematic">
    <defs><marker id="arrowGold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#cfac6d"/></marker></defs>
    <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
    <path d="${beltTop}" fill="none" stroke="#8f816b" stroke-width="8" stroke-linecap="round"/>
    <path d="${beltBottom}" fill="none" stroke="#bca98d" stroke-width="5" stroke-linecap="round" opacity="0.75"/>
    ${idlers}
    <circle cx="${x0}" cy="${tailCy}" r="16" fill="rgba(207,172,109,.18)" stroke="#8f816b" stroke-width="2"/>
    <circle cx="${x1}" cy="${driveCy}" r="18" fill="rgba(207,172,109,.22)" stroke="#8f816b" stroke-width="2.4"/>
    <circle cx="${x1}" cy="${driveCy}" r="7" fill="#cfac6d" opacity="0.8"/>
    <line x1="${arrowX - 36}" y1="${arrowY}" x2="${arrowX + 36}" y2="${arrowY + (actualHeadY - actualTailY) * 0.18}" stroke="#cfac6d" stroke-width="3" marker-end="url(#arrowGold)"/>
    <line x1="${x1 + 24}" y1="${actualTailY + 8}" x2="${x1 + 24}" y2="${driveCy}" stroke="#7b715f" stroke-width="1.4" stroke-dasharray="5 4"/>
    <line x1="${x0}" y1="${actualTailY + 46}" x2="${x1}" y2="${actualHeadY + 46}" stroke="#7b715f" stroke-width="1.4"/>
    <polygon points="${x0},${actualTailY + 46} ${x0 + 8},${actualTailY + 42} ${x0 + 8},${actualTailY + 50}" fill="#7b715f"/>
    <polygon points="${x1},${actualHeadY + 46} ${x1 - 8},${actualHeadY + 42} ${x1 - 8},${actualHeadY + 50}" fill="#7b715f"/>
    <text x="${(x0 + x1) / 2}" y="${(actualTailY + actualHeadY) / 2 + 60}" text-anchor="middle" font-size="12" fill="#555">Center length ${fmtFixed(r.centerLengthM, 1)} m</text>
    <text x="${x1 + 28}" y="${(actualTailY + driveCy) / 2}" font-size="12" fill="#555">${fmtFixed(r.liftM, 1)} m</text>
    <text x="${x0}" y="36" font-size="13" font-weight="800" fill="currentColor">${r.projectName || 'Project'} · ${r.conveyorTag || 'Tag'}</text>
    <text x="${x0}" y="56" font-size="12" fill="#666">Capacity ${fmtFixed(r.capacityTph, 0)} t/h · Speed ${fmtFixed(r.beltSpeed, 2)} m/s · Width ${fmtFixed(r.beltWidthMm, 0)} mm</text>
    <text x="${x0}" y="76" font-size="12" fill="#666">Wm ${fmtFixed(r.wmKgPm, 1)} kg/m · Wb ${fmtFixed(r.beltWeightKgPm, 1)} kg/m · Sag ${fmtFixed(r.sagPercent, 1)}%</text>
    <text x="${x0}" y="96" font-size="12" fill="#666">Kt ${fmtFixed(r.kt, 2)} · Ky ${fmtFixed(r.ky, 4)} · Kx ${fmtFixed(r.kxUsed, 4)} · Cw ${fmtFixed(r.cw, 2)}</text>
    <text x="${x0}" y="116" font-size="12" fill="#666">${modeLabel}</text>
    <text x="${x1}" y="${driveCy - 26}" text-anchor="middle" font-size="12" font-weight="700" fill="#555">Drive</text>
    <text x="${x0}" y="${tailCy - 26}" text-anchor="middle" font-size="12" font-weight="700" fill="#555">Tail</text>
  </svg>`;
}

function svgBreakdownChart(r: CalcResult, w: number, h: number): string {
  const margin = { left: 170, right: 26, top: 18, bottom: 28 };
  const rows = r.components;
  const rowH = (h - margin.top - margin.bottom) / Math.max(rows.length, 1);
  const values = rows.map(c => c.lbf);
  const minValue = Math.min(0, ...values), maxValue = Math.max(0, ...values);
  const span = Math.max(maxValue - minValue, 1);
  const barScale = (v: number) => margin.left + ((v - minValue) / span) * (w - margin.left - margin.right);
  const zeroX = barScale(0);
  const lines: string[] = [];
  lines.push(`<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tension breakdown chart"><rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>`);
  [-1, -0.5, 0, 0.5, 1].forEach(f => {
    const v = minValue + (span * (f + 1) / 2), x = barScale(v);
    lines.push(`<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${h - margin.bottom}" stroke="rgba(122,112,94,.18)"/>`);
    lines.push(`<text x="${x}" y="${h - 8}" text-anchor="middle" font-size="11" fill="#777">${fmtFixed(lbfToKn(v), 1)}</text>`);
  });
  lines.push(`<line x1="${zeroX}" y1="${margin.top}" x2="${zeroX}" y2="${h - margin.bottom}" stroke="#8f816b" stroke-width="1.8"/>`);
  rows.forEach((item, index) => {
    const y = margin.top + index * rowH + 6;
    const x = barScale(item.lbf), barX = Math.min(zeroX, x), barW = Math.max(Math.abs(x - zeroX), 1);
    const fill = item.lbf >= 0 ? '#cfac6d' : '#8f4454';
    lines.push(`<text x="${margin.left - 10}" y="${y + rowH / 2 + 4}" text-anchor="end" font-size="12" fill="currentColor">${item.key}</text>`);
    lines.push(`<rect x="${barX}" y="${y}" width="${barW}" height="${rowH - 12}" rx="8" fill="${fill}" opacity="0.82"/>`);
    lines.push(`<text x="${item.lbf >= 0 ? barX + barW + 6 : barX - 6}" y="${y + rowH / 2 + 4}" text-anchor="${item.lbf >= 0 ? 'start' : 'end'}" font-size="11" fill="#666">${fmtFixed(lbfToKn(item.lbf), 2)} kN</text>`);
  });
  lines.push(`<text x="${w / 2}" y="14" text-anchor="middle" font-size="12" fill="#666">Contribution to effective tension, Te (kN at belt line)</text></svg>`);
  return lines.join('');
}

function svgFillSection(r: CalcResult, w: number, h: number): string {
  const padLeft = 36, padRight = 24, padTop = 44, padBottom = 40;
  const { geom, apexHeightM } = r.fillModel;
  const phiDeg = r.surchargeAngleDeg, phi = phiDeg * Math.PI / 180;
  const ySurf = (x: number) => apexHeightM - Math.abs(x) * Math.tan(phi);
  const xMin = -geom.usableHalfWidth, xMax = geom.usableHalfWidth;
  const viewTop = geom.edgeY + geom.usableHalfWidth * Math.tan(60 * Math.PI / 180);
  const plotW = w - padLeft - padRight, plotH = h - padTop - padBottom;
  const scale = Math.min(plotW / (xMax - xMin), plotH / Math.max(viewTop, 0.001));
  const xOrigin = (w - (xMax - xMin) * scale) / 2, yBase = h - padBottom;
  const sx = (x: number) => xOrigin + (x - xMin) * scale;
  const sy = (y: number) => yBase - y * scale;
  const beltPts = [[xMin, geom.edgeY], [-geom.centerHalf, 0], [geom.centerHalf, 0], [xMax, geom.edgeY]];
  const surfacePts = Array.from({ length: 241 }, (_, i) => { const x = xMin + (xMax - xMin) * i / 240; return [x, Math.max(geom.beltY(x), ySurf(x))]; });
  const matPoly = [[xMin, geom.beltY(xMin)], ...surfacePts, [xMax, geom.beltY(xMax)], [geom.centerHalf, geom.beltY(geom.centerHalf)], [-geom.centerHalf, geom.beltY(-geom.centerHalf)]];
  const beltPath = beltPts.map((p, i) => `${i ? 'L' : 'M'} ${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ');
  const matPath = matPoly.map((p, i) => `${i ? 'L' : 'M'} ${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ') + ' Z';
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="belt cross section fill">
    <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
    <path d="${matPath}" fill="rgba(88,138,214,0.68)" stroke="rgba(53,91,156,0.95)" stroke-width="1.5"/>
    <path d="${beltPath}" fill="none" stroke="#8a6d2f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(0)}" y2="${sy(apexHeightM)}" stroke="rgba(0,0,0,.24)" stroke-dasharray="5 4"/>
    <text x="${sx(0) + 8}" y="${sy(apexHeightM) - 6}" font-size="11" fill="currentColor">apex</text>
    <text x="${padLeft}" y="${padTop - 14}" font-size="12" font-weight="800" fill="currentColor">Occupied ${fmtFixed(r.occupiedAreaM2, 4)} m² · CEMA avail ${fmtFixed(r.cemaAvailableAreaM2, 4)} m² · fill ${fmtFixed(r.fillAreaPct, 1)}%</text>
    <text x="${padLeft}" y="${h - 24}" font-size="11" fill="currentColor">Fixed belt trough angle ${fmtFixed(r.troughAngleDeg, 0)}° · surcharge angle ${fmtFixed(r.surchargeAngleDeg, 0)}° · max ${fmtFixed(r.maxAreaM2, 4)} m²</text>
    <text x="${padLeft}" y="${h - 8}" font-size="11" fill="currentColor">Edge distance ${fmtFixed(r.edgeDistanceM * 1000, 0)} mm each side · avail ${fmtFixed(r.fillModel.availableAreaFactor, 5)} × B² · max ${fmtFixed(r.fillModel.maxAreaFactor, 5)} × B²</text>
  </svg>`;
}

function svgFillCurve(r: CalcResult, w: number, h: number): string {
  const margin = { left: 62, right: 18, top: 18, bottom: 40 };
  const fillMax = Math.max(120, Math.ceil(Math.max(r.fillAreaPct, 100) / 10) * 10);
  const yMax = Math.max(r.maxAreaM2 * 1.20, r.occupiedAreaM2 * 1.15, 0.001);
  const xScale = (pct: number) => margin.left + (pct / fillMax) * (w - margin.left - margin.right);
  const yScale = (area: number) => h - margin.bottom - (area / yMax) * (h - margin.top - margin.bottom);
  const pts = Array.from({ length: Math.ceil(fillMax / 2) + 1 }, (_, i) => [i * 2, r.cemaAvailableAreaM2 * (i * 2 / 100)]);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'} ${xScale(p[0]).toFixed(2)} ${yScale(p[1]).toFixed(2)}`).join(' ');
  const reqX = xScale(Math.min(r.fillAreaPct, fillMax)), reqY = yScale(Math.min(r.occupiedAreaM2, yMax));
  const gridLines = [0, 25, 50, 75, 100].map(p => `<g><line x1="${xScale(p)}" y1="${margin.top}" x2="${xScale(p)}" y2="${h - margin.bottom}" stroke="rgba(0,0,0,.08)"/><text x="${xScale(p)}" y="${h - margin.bottom + 16}" text-anchor="middle" font-size="11" fill="#777">${p}%</text></g>`).join('');
  const yGridLines = [0, 0.25, 0.5, 0.75, 1].map(fr => { const a = yMax * fr; return `<g><line x1="${margin.left}" y1="${yScale(a)}" x2="${w - margin.right}" y2="${yScale(a)}" stroke="rgba(0,0,0,.08)"/><text x="${margin.left - 8}" y="${yScale(a) + 4}" text-anchor="end" font-size="11" fill="#777">${fmtFixed(a, 4)}</text></g>`; }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="fill curve">
    ${gridLines}${yGridLines}
    <line x1="${margin.left}" y1="${h - margin.bottom}" x2="${w - margin.right}" y2="${h - margin.bottom}" stroke="#8f816b" stroke-width="1.6"/>
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${h - margin.bottom}" stroke="#8f816b" stroke-width="1.6"/>
    <path d="${path}" fill="none" stroke="#cfac6d" stroke-width="3"/>
    <line x1="${xScale(100)}" y1="${margin.top}" x2="${xScale(100)}" y2="${h - margin.bottom}" stroke="#8a6d2f" stroke-dasharray="3 3" stroke-width="1.8"/>
    <line x1="${margin.left}" y1="${yScale(r.maxAreaM2)}" x2="${w - margin.right}" y2="${yScale(r.maxAreaM2)}" stroke="#8f4454" stroke-dasharray="3 3" stroke-width="1.8"/>
    <line x1="${reqX}" y1="${margin.top}" x2="${reqX}" y2="${h - margin.bottom}" stroke="#355b9c" stroke-dasharray="5 4" stroke-width="2"/>
    <line x1="${margin.left}" y1="${reqY}" x2="${w - margin.right}" y2="${reqY}" stroke="#355b9c" stroke-dasharray="5 4" stroke-width="2"/>
    <circle cx="${reqX}" cy="${reqY}" r="5.5" fill="#355b9c" stroke="#fff" stroke-width="1.4"/>
    <text x="${xScale(100) + 4}" y="${margin.top + 14}" font-size="10" fill="#8a6d2f">CEMA available</text>
    <text x="${w - margin.right - 4}" y="${yScale(r.maxAreaM2) - 4}" text-anchor="end" font-size="10" fill="#8f4454">Maximum area</text>
    <text x="${w / 2}" y="${h - 8}" text-anchor="middle" font-size="12" fill="#555">Section fill relative to CEMA available (%)</text>
    <text x="18" y="${h / 2}" transform="rotate(-90 18 ${h / 2})" text-anchor="middle" font-size="12" fill="#555">Area (m²)</text>
  </svg>`;
}

function svgTraction(r: CalcResult, w: number, h: number): string {
  const maxLbf = Math.max(r.t2SlipLbf, r.t2SagLbf, r.t2Lbf, r.t1Lbf, 1);
  const scale = (v: number) => 110 + (v / maxLbf) * (w - 180);
  const rows = [
    { label: 'T2 slip',       value: r.t2SlipLbf,       color: '#325d88', note: `|Te| × Cw = ${fmtFixed(r.cw, 2)}` },
    { label: 'T2 sag',        value: r.t2SagLbf,        color: '#8a6d2f', note: `T0 + Tb − Tyr · ${fmtFixed(r.sagPercent, 1)}% sag` },
    { label: 'T2 governing',  value: r.t2Lbf,           color: '#216b45', note: `${r.governingSource} governs` },
    { label: 'T1 approx.',    value: r.t1Lbf,           color: '#9b2c2c', note: '|Te| + T2' },
    { label: 'Counterweight', value: r.counterweightLbf, color: '#6f5d3e', note: 'Approx. 2 × T2 for gravity take-up' },
  ];
  const rowH = 52, top = 26;
  const lines = [`<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Traction checks"><rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>`];
  lines.push(`<text x="${w / 2}" y="18" text-anchor="middle" font-size="12" fill="#666">Head-drive interpretation of slip, sag, and take-up checks</text>`);
  rows.forEach((row, i) => {
    const y = top + i * rowH;
    lines.push(`<text x="18" y="${y + 24}" font-size="12" font-weight="700" fill="currentColor">${row.label}</text>`);
    lines.push(`<rect x="110" y="${y + 8}" width="${scale(row.value) - 110}" height="22" rx="11" fill="${row.color}" opacity="0.86"/>`);
    lines.push(`<text x="${scale(row.value) + 8}" y="${y + 24}" font-size="11" fill="#666">${fmtFixed(lbfToKn(row.value), 2)} kN</text>`);
    lines.push(`<text x="18" y="${y + 40}" font-size="11" fill="#777">${row.note}</text>`);
  });
  lines.push(`<line x1="110" y1="${top - 4}" x2="110" y2="${h - 26}" stroke="#8f816b" stroke-width="1.6"/></svg>`);
  return lines.join('');
}

function svgProfile(prof: ProfileResult, w: number, h: number): string {
  const margin = { left: 52, right: 18, top: 26, bottom: 34 };
  const minX = 0, maxX = Math.max(prof.totalLen, 1);
  const elevs = prof.nodes.map(n => n.elev);
  const minY = Math.min(...elevs, 0), maxY = Math.max(...elevs, 1);
  const padY = Math.max((maxY - minY) * 0.15, 3);
  const sx = (x: number) => margin.left + ((x - minX) / Math.max(maxX - minX, 1e-6)) * (w - margin.left - margin.right);
  const sy = (y: number) => h - margin.bottom - ((y - (minY - padY)) / Math.max((maxY + padY) - (minY - padY), 1e-6)) * (h - margin.top - margin.bottom);
  const path = prof.nodes.map((n, i) => `${i ? 'L' : 'M'} ${sx(n.station).toFixed(1)} ${sy(n.elev).toFixed(1)}`).join(' ');
  const curveSvg = prof.curves.map(c => {
    const x1 = sx(c.startStation), x2 = sx(c.endStation), y = sy(c.elev) - 18;
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c.status === 'OK' ? '#216b45' : '#9b6a1d'}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>`;
  }).join('');
  const nodeSvg = prof.nodes.map((node, i) => `<g><circle class="profile-node-dot" data-node-index="${i}" cx="${sx(node.station)}" cy="${sy(node.elev)}" r="7" fill="#355b9c" stroke="#fff" stroke-width="2" style="cursor:grab"/><text x="${sx(node.station) + 10}" y="${sy(node.elev) - 10}" font-size="11" fill="currentColor">${node.id}</text></g>`).join('');
  const markerColors: Record<string, string> = { drive: '#cfac6d', takeup: '#8f4454', tail: '#5c7d5c', return: '#6d6d9a', feed: '#325d88', custom: '#666' };
  const markerSvg = prof.markers.map((m, i) => {
    const x = sx(m.station), y = sy(interpolateProfileElevation(prof.nodes, m.station));
    const color = markerColors[m.type] || '#666';
    return `<g><path class="profile-marker-dot" data-marker-index="${i}" d="M ${x} ${y - 20} L ${x - 8} ${y - 34} L ${x + 8} ${y - 34} Z" fill="${color}" stroke="#fff" stroke-width="1.3" style="cursor:ew-resize"/><line x1="${x}" y1="${y - 20}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="2"/><text x="${x + 8}" y="${y - 26}" font-size="11" fill="currentColor">${m.label}</text></g>`;
  }).join('');
  const gridX = [0, 0.25, 0.5, 0.75, 1].map(fr => { const x = margin.left + fr * (w - margin.left - margin.right); return `<g><line x1="${x}" y1="${margin.top}" x2="${x}" y2="${h - margin.bottom}" stroke="rgba(0,0,0,.08)"/><text x="${x}" y="${h - 10}" text-anchor="middle" font-size="11" fill="#777">${fmtFixed(minX + fr * (maxX - minX), 1)}</text></g>`; }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Conveyor profile editor">
    ${gridX}
    <line x1="${margin.left}" y1="${h - margin.bottom}" x2="${w - margin.right}" y2="${h - margin.bottom}" stroke="#8f816b" stroke-width="1.5"/>
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${h - margin.bottom}" stroke="#8f816b" stroke-width="1.5"/>
    <path d="${path}" fill="none" stroke="#355b9c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${curveSvg}${markerSvg}${nodeSvg}
    <text x="${w / 2}" y="18" text-anchor="middle" font-size="12" fill="#666">Station (m)</text>
    <text x="18" y="${h / 2}" transform="rotate(-90 18 ${h / 2})" text-anchor="middle" font-size="12" fill="#666">Elevation (m)</text>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET'; field: keyof State; value: unknown }
  | { type: 'SET_ALL'; state: State }
  | { type: 'RESET' }
  | { type: 'LOAD_SAMPLE' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET': return { ...state, [action.field]: action.value };
    case 'SET_ALL': return action.state;
    case 'RESET': return { ...DEFAULTS, theme: state.theme };
    case 'LOAD_SAMPLE': return { ...SAMPLE, theme: state.theme };
    default: return state;
  }
}

// SVG panel with resize observer
function SvgPanel({ render, height }: { render: (w: number, h: number) => string; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: height });
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        if (w > 0) setSize({ w, h: height });
      }
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [height]);
  const svg = useMemo(() => render(size.w, size.h), [render, size]);
  return (
    <div ref={ref} style={{ height, overflow: 'hidden', background: 'var(--bg)', padding: '12px' }}
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// Draggable profile SVG
function ProfileSvgPanel({ r, dispatch }: { r: CalcResult; dispatch: React.Dispatch<Action> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 860, h: 420 });
  const dragState = useRef<{ kind: 'node' | 'marker'; index: number } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) { const w = Math.floor(e.contentRect.width); if (w > 0) setSize({ w, h: 420 }); }
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const svg = useMemo(() => svgProfile(r.profile, size.w, size.h), [r.profile, size]);
  const margin = { left: 52, right: 18, top: 26, bottom: 34 };

  const updateProfileJson = useCallback((mutator: (prof: { nodes: ProfileNode[]; markers: ProfileMarker[] }) => void) => {
    const prof = sanitizeProfile(r.profileNodesJson, r.profileMarkersJson, r.centerLengthM, r.liftM);
    mutator(prof);
    dispatch({ type: 'SET', field: 'profileNodesJson', value: JSON.stringify(prof.nodes) });
    dispatch({ type: 'SET', field: 'profileMarkersJson', value: JSON.stringify(prof.markers) });
  }, [r, dispatch]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as Element;
    const node = t.closest('[data-node-index]');
    const marker = t.closest('[data-marker-index]');
    if (node) { dragState.current = { kind: 'node', index: parseInt((node as HTMLElement).dataset.nodeIndex || '0', 10) }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
    else if (marker) { dragState.current = { kind: 'marker', index: parseInt((marker as HTMLElement).dataset.markerIndex || '0', 10) }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const prof = r.profile;
    const maxX = Math.max(prof.totalLen, 1);
    const elevs = prof.nodes.map(n => n.elev);
    const minY = Math.min(...elevs, 0), maxY = Math.max(...elevs, 1);
    const padY = Math.max((maxY - minY) * 0.15, 3);
    const station = clamp(((e.clientX - rect.left - margin.left) / Math.max(size.w - margin.left - margin.right, 1)) * maxX, 0, maxX);
    const elev = (maxY + padY) - ((e.clientY - rect.top - margin.top) / Math.max(size.h - margin.top - margin.bottom, 1)) * ((maxY + padY) - (minY - padY));
    updateProfileJson((ps: { nodes: ProfileNode[]; markers: ProfileMarker[] }) => {
      if (dragState.current!.kind === 'node') {
        const idx = dragState.current!.index;
        if (idx > 0 && idx < ps.nodes.length - 1) {
          const prev = ps.nodes[idx - 1].station + 1, next = ps.nodes[idx + 1].station - 1;
          ps.nodes[idx].station = clamp(station, prev, next);
        }
        ps.nodes[idx].elev = elev;
      } else {
        ps.markers[dragState.current!.index].station = station;
      }
    });
  };

  const handlePointerUp = () => { dragState.current = null; };

  return (
    <div ref={ref} style={{ height: 420, overflow: 'hidden', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'default', userSelect: 'none' }}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function ConveyorCalculator() {
  const [state, dispatch] = useReducer(reducer, DEFAULTS, (d: State) => {
    if (typeof window === 'undefined') return d;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...d, ...JSON.parse(raw) };
    } catch {}
    return d;
  });

  const r: CalcResult = useMemo(() => compute(state), [state]);

  // Sync theme to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  // Sync Cw preset
  useEffect(() => {
    const preset = CW_PRESETS.find(p => p.id === state.cwPreset);
    if (preset && preset.value != null) {
      dispatch({ type: 'SET', field: 'cw', value: preset.value });
    }
  }, [state.cwPreset]);

  const set = (field: keyof State) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const el = e.target;
    const value = el.type === 'checkbox' ? (el as HTMLInputElement).checked
      : el.type === 'number' ? parseFloat(el.value) || 0
      : el.value;
    dispatch({ type: 'SET', field, value });
  };

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  };

  // Validation badge
  const statusLevel = !Number.isFinite(r.teLbf) ? 'bad' : r.dutyMode === 'Regenerative' ? 'warn' : 'ok';

  // Validation results
  const validationResults = useMemo<ValRow[]>(() => VALIDATION_CASES.map(item => {
    const calc = compute(item.input as State);
    const deviations = {
      te: deviationPct(calc.teLbf, item.expected.teLbf),
      hp: deviationPct(calc.beltHp, item.expected.beltHp),
      t2: deviationPct(calc.t2Lbf, item.expected.t2Lbf),
      t1: deviationPct(calc.t1Lbf, item.expected.t1Lbf),
    };
    const maxAbs = Math.max(...Object.values(deviations).map(v => Math.abs(v)));
    return { item, calc, deviations, maxAbs };
  }), []);

  const areaValidationResults = useMemo<AreaValRow[]>(() => AREA_VALIDATION_CASES.map(item => {
    const calculated = item.calculated();
    const delta = deviationPct(calculated, item.expected);
    return { ...item, calculated, delta, pass: Math.abs(delta) <= item.tolerancePct };
  }), []);

  const profileUpdateFns = {
    addNode: () => {
      const prof = sanitizeProfile(state.profileNodesJson, state.profileMarkersJson, state.centerLengthM, state.liftM);
      const nodes = prof.nodes, a = nodes[nodes.length - 2], b = nodes[nodes.length - 1];
      nodes.splice(nodes.length - 1, 0, { id: `N${nodes.length - 1}`, station: +((a.station + b.station) / 2).toFixed(2), elev: +((a.elev + b.elev) / 2).toFixed(2), curveLengthM: +((b.station - a.station) * 0.2).toFixed(2) });
      dispatch({ type: 'SET', field: 'profileNodesJson', value: JSON.stringify(nodes) });
    },
    addMarker: () => {
      const prof = sanitizeProfile(state.profileNodesJson, state.profileMarkersJson, state.centerLengthM, state.liftM);
      const L = prof.nodes[prof.nodes.length - 1].station;
      prof.markers.push({ id: `M${prof.markers.length + 1}`, label: `Marker ${prof.markers.length + 1}`, type: 'custom', station: +(L / 2).toFixed(2) });
      dispatch({ type: 'SET', field: 'profileMarkersJson', value: JSON.stringify(prof.markers) });
    },
    syncFromLengthLift: () => {
      const L = Math.max(state.centerLengthM || 1, 1);
      const defaultNodes = [{ id: 'N0', station: 0, elev: 0, curveLengthM: 0 }, { id: 'N1', station: L, elev: state.liftM || 0, curveLengthM: 0 }];
      const defaultMarkers = [{ id: 'M1', label: 'Tail', type: 'tail', station: 0 }, { id: 'M2', label: 'Drive', type: 'drive', station: L }];
      dispatch({ type: 'SET', field: 'profileNodesJson', value: JSON.stringify(defaultNodes) });
      dispatch({ type: 'SET', field: 'profileMarkersJson', value: JSON.stringify(defaultMarkers) });
    },
  };

  // Warnings list
  const warnings = useMemo<Array<{level: string; text: string}>>(() => {
    const items: Array<{ level: string; text: string }> = [];
    if (!r.overrideKx) items.push({ level: 'ok', text: `Kx is being calculated automatically from Ai = ${fmtFixed(r.aiAdjusted, 2)}, carrying load, belt weight, and idler spacing.` });
    else items.push({ level: 'warn', text: 'Kx is in manual override mode. Verify the custom value against the actual idler design and installation condition.' });
    if (r.useEstimatedBeltWeight) items.push({ level: 'warn', text: `Belt weight is estimated from the CEMA average table using the nearest standard width (${fmtFixed(r.estimate.standardWidthIn, 0)} in) and density band ${r.estimate.densityBand}. Replace with supplier data for final design.` });
    if (r.cwPreset === 'manual') items.push({ level: 'warn', text: 'Cw is in manual mode. Confirm the wrap factor against the selected pulley lagging, take-up arrangement, and belt wrap angle.' });
    if (r.dutyMode === 'Regenerative') items.push({ level: 'bad', text: `Net belt power is negative (${fmtFixed(r.beltKw, 1)} kW). Review braking, controlled regeneration, and holdback requirements before freezing the drive concept.` });
    else items.push({ level: 'ok', text: `Motoring duty is positive. Net belt power is ${fmtFixed(r.beltKw, 1)} kW before drive efficiency and service factor.` });
    if (r.governingSource === 'Sag') items.push({ level: 'warn', text: 'The governing T2 comes from the sag requirement rather than pulley traction. Tension control in the carrying strand is the controlling check for this case.' });
    else items.push({ level: 'ok', text: 'The governing T2 comes from traction / no-slip requirements.' });
    if (r.tsbLbf > 0.2 * Math.abs(r.teLbf)) items.push({ level: 'warn', text: 'Skirtboard friction is a large share of the net effective tension. Check loading-zone length, depth, edging pressure, and the selected Cs factor.' });
    if (r.cleanerBlades > 2) items.push({ level: 'warn', text: 'Multiple cleaner blades are applied. Review actual vendor drag if cleaner design data is available.' });
    if (r.pluggedChuteMode !== 'off') items.push({ level: r.pluggedApplyInFlow ? 'warn' : 'info', text: `Plugged-chute resistance is ${fmtFixed(r.pluggedFlowKN, 2)} kN during flow and ${fmtFixed(r.pluggedStartupKN, 2)} kN at startup using ${r.pluggedMethodBasis}.` });
    if (r.overrideTp) items.push({ level: 'warn', text: `Tp is in manual override mode at ${fmtFixed(r.tpLbf, 1)} lbf. This is appropriate for benchmark matching or vendor-supplied pulley-resistance data.` });
    if (r.driveEfficiencyPct <= 85) items.push({ level: 'warn', text: 'Drive efficiency is set relatively low. Confirm the gearbox / coupling / fluid coupling stack-up assumed in the shaft-power output.' });
    if (r.kt < 1) items.push({ level: 'warn', text: 'Kt is below 1.00. This is unusual for the standard temperature correction treatment and should be verified.' });
    return items;
  }, [r]);

  // Component table (extended)
  const componentTableRows = useMemo<CompRow[]>(() => [
    ...r.components,
    { label: 'Tac · Total accessories', lbf: r.tacLbf, kw: componentKwFromLbf(r.tacLbf, r.vFpm), basis: 'Tbc + Tpl + Tsb + other' },
    { label: 'Tplug(flow)', lbf: r.pluggedFlowLbf, kw: componentKwFromLbf(r.pluggedFlowLbf, r.vFpm), basis: `${r.pluggedApplyInFlow ? 'Included in steady-state Te' : 'Check only'} · ${r.pluggedMethodBasis}` },
    { label: 'Tplug(start)', lbf: r.pluggedStartupLbf, kw: componentKwFromLbf(r.pluggedStartupLbf, r.vFpm), basis: `Startup breakout resistance (${fmtFixed(r.pluggedStartupKN, 2)} kN)` },
    { label: 'Te base', lbf: r.teBaseLbf, kw: componentKwFromLbf(r.teBaseLbf, r.vFpm), basis: 'Historical-method total without plugged chute' },
    { label: 'Te · Effective tension', lbf: r.teLbf, kw: r.beltKw, basis: 'Steady-state total including optional plugged-chute flow resistance' },
    { label: 'Te startup', lbf: r.startupTeLbf, kw: r.startupBeltKw, basis: 'Base Te + plugged-chute startup breakout force' },
    { label: 'T0 · Minimum sag tension', lbf: r.t0Lbf, kw: componentKwFromLbf(r.t0Lbf, r.vFpm), basis: `${fmtFixed(r.sagPercent, 1)}% sag criterion` },
    { label: 'T2 slip', lbf: r.t2SlipLbf, kw: componentKwFromLbf(r.t2SlipLbf, r.vFpm), basis: '|Te| × Cw' },
    { label: 'T2 sag', lbf: r.t2SagLbf, kw: componentKwFromLbf(r.t2SagLbf, r.vFpm), basis: 'T0 + Tb − Tyr' },
    { label: 'T2 governing', lbf: r.t2Lbf, kw: componentKwFromLbf(r.t2Lbf, r.vFpm), basis: `${r.governingSource} governs` },
    { label: 'T1 approx.', lbf: r.t1Lbf, kw: componentKwFromLbf(r.t1Lbf, r.vFpm), basis: '|Te| + T2' },
  ], [r]);

  // Profile node/marker table handlers
  const updateNodeField = (nodeIndex: number, field: string, value: string) => {
    const prof = sanitizeProfile(state.profileNodesJson, state.profileMarkersJson, state.centerLengthM, state.liftM);
    if (field === 'station' || field === 'elev' || field === 'curveLengthM') (prof.nodes[nodeIndex] as unknown as Record<string, unknown>)[field] = parseFloat(value) || 0;
    else (prof.nodes[nodeIndex] as unknown as Record<string, unknown>)[field] = value;
    dispatch({ type: 'SET', field: 'profileNodesJson', value: JSON.stringify(prof.nodes) });
  };
  const removeNode = (i: number) => {
    const prof = sanitizeProfile(state.profileNodesJson, state.profileMarkersJson, state.centerLengthM, state.liftM);
    prof.nodes.splice(i, 1);
    dispatch({ type: 'SET', field: 'profileNodesJson', value: JSON.stringify(prof.nodes) });
  };
  const updateMarkerField = (markerIndex: number, field: string, value: string) => {
    const prof = sanitizeProfile(state.profileNodesJson, state.profileMarkersJson, state.centerLengthM, state.liftM);
    if (field === 'station') (prof.markers[markerIndex] as unknown as Record<string, unknown>)[field] = parseFloat(value) || 0;
    else (prof.markers[markerIndex] as unknown as Record<string, unknown>)[field] = value;
    dispatch({ type: 'SET', field: 'profileMarkersJson', value: JSON.stringify(prof.markers) });
  };
  const removeMarker = (i: number) => {
    const prof = sanitizeProfile(state.profileNodesJson, state.profileMarkersJson, state.centerLengthM, state.liftM);
    prof.markers.splice(i, 1);
    dispatch({ type: 'SET', field: 'profileMarkersJson', value: JSON.stringify(prof.markers) });
  };

  const schematicRender = useCallback((w: number, h: number) => svgSchematic(r, w, h), [r]);
  const breakdownRender = useCallback((w: number, h: number) => svgBreakdownChart(r, w, h), [r]);
  const fillRender = useCallback((w: number, h: number) => svgFillSection(r, w, h), [r]);
  const fillCurveRender = useCallback((w: number, h: number) => svgFillCurve(r, w, h), [r]);
  const tractionRender = useCallback((w: number, h: number) => svgTraction(r, w, h), [r]);

  const worstMargin = r.profile.curves.length ? Math.min(...r.profile.curves.map(c => Number.isFinite(c.marginPct) ? c.marginPct : -999)) : NaN;

  // ── STYLES (injected as a <style> tag) ─────────────────────────────────────
  const css = `
    :root{--bg:#f8f7f3;--panel:#fefdf6;--gold:#e9c168;--gold-dark:#8a6d2f;--text:#333;--muted:#5f5b54;--border:#d9d5cb;--soft:#f4ead3;--ok:#216b45;--warn:#9b6a1d;--bad:#9b2c2c;--shadow:0 12px 30px rgba(0,0,0,0.08);--accent:#cfac6d;--blue:#325d88;--rose:#8f4454}
    html[data-theme="dark"]{--bg:#131923;--panel:#1c2531;--gold:#b48d3d;--gold-dark:#e1b86c;--text:#f3eee4;--muted:#cbc1b1;--border:#3b4656;--soft:#2b3443;--ok:#8cd8ab;--warn:#f0c46a;--bad:#f19696;--shadow:0 14px 34px rgba(0,0,0,0.30);--accent:#d1ae6a;--blue:#88abd4;--rose:#d69aaa}
    *{box-sizing:border-box} html,body{margin:0;padding:0}
    body{font-family:Inter,"Segoe UI",Arial,sans-serif;background:var(--bg);color:var(--text)}
    input,select,button{font:inherit}
    .cema-header{position:sticky;top:0;z-index:20;background:var(--gold);border-bottom:1px solid rgba(0,0,0,0.08);box-shadow:0 2px 8px rgba(0,0,0,0.08)}
    .cema-header-inner{max-width:1580px;margin:0 auto;padding:18px 24px;display:grid;grid-template-columns:280px 1fr auto;gap:16px;align-items:center}
    .cema-brand{display:flex;align-items:center;gap:12px;font-weight:800}
    .cema-brand-mark{width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,0.55);display:grid;place-items:center;border:1px solid rgba(0,0,0,0.08)}
    .cema-header-title{text-align:center;font-family:"Times New Roman",Times,serif;font-size:34px;font-weight:700;line-height:1.05;color:#111;letter-spacing:-0.02em}
    .cema-header-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
    .cema-btn{border:1px solid rgba(0,0,0,0.08);background:#333;color:#cfac6d;border-radius:10px;padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer}
    .cema-btn.secondary{background:rgba(255,255,255,0.55);color:#111}
    .cema-shell{max-width:1580px;margin:0 auto;padding:24px}
    .cema-tool{display:grid;grid-template-columns:410px minmax(0,1fr);gap:22px;align-items:start}
    .cema-left{position:sticky;top:106px;display:grid;gap:18px}
    .cema-panel{background:var(--panel);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:var(--shadow)}
    .cema-panel-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(233,193,104,0.14),rgba(233,193,104,0.03))}
    .cema-panel-title h3{margin:0;font-size:17px;font-weight:800}
    .cema-panel-title p{margin:4px 0 0;font-size:12px;color:var(--muted)}
    .cema-panel-inner{padding:18px}
    .cema-section-heading{margin:0 0 12px;font-size:14px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--gold);padding-bottom:8px}
    .cema-input-row{margin-bottom:14px}
    .cema-input-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px}
    .cema-input-head label{font-size:13px;font-weight:700;color:var(--muted);line-height:1.3}
    .cema-input-wrap{display:flex;gap:8px;align-items:center}
    .cema-input-row input,.cema-input-row select{width:132px;border:1px solid var(--border);background:white;color:var(--text);border-radius:8px;padding:8px 10px;text-align:right}
    html[data-theme="dark"] .cema-input-row input,html[data-theme="dark"] .cema-input-row select{background:#111720;color:var(--text)}
    .cema-input-row input[type="text"]{text-align:left;width:170px}
    .cema-unit-chip{display:inline-flex;align-items:center;justify-content:center;padding:4px 8px;border-radius:999px;background:var(--soft);border:1px solid rgba(0,0,0,0.05);color:var(--text);font-size:11px;font-weight:700;white-space:nowrap}
    .cema-helper{font-size:11px;color:#7c7c7c;line-height:1.4;margin-top:4px}
    .cema-check-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 10px;border:1px dashed var(--border);border-radius:10px;margin-bottom:10px;background:rgba(255,255,255,0.45)}
    html[data-theme="dark"] .cema-check-row{background:rgba(17,23,32,0.5)}
    .cema-check-row label{font-size:13px;font-weight:700;color:var(--muted);display:flex;align-items:center;gap:8px}
    .cema-check-row input[type="checkbox"]{width:16px;height:16px;accent-color:var(--gold-dark)}
    .cema-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border:1px solid rgba(0,0,0,0.08);white-space:nowrap}
    .cema-badge.ok{background:rgba(33,107,69,.1);color:var(--ok)}
    .cema-badge.warn{background:rgba(155,106,29,.12);color:var(--warn)}
    .cema-badge.bad{background:rgba(155,44,44,.12);color:var(--bad)}
    .cema-badge.info{background:rgba(207,172,109,.14);color:var(--text)}
    .cema-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
    .cema-metric-card{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:14px 14px 12px;box-shadow:0 5px 14px rgba(0,0,0,0.05)}
    .cema-metric-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--gold);opacity:.85}
    .cema-metric-card.ok::before{background:var(--ok)}
    .cema-metric-card.warn::before{background:var(--warn)}
    .cema-metric-card.bad::before{background:var(--bad)}
    .cema-metric-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800;margin-bottom:8px}
    .cema-metric-value{font-size:30px;line-height:1;font-weight:900;letter-spacing:-0.03em;font-variant-numeric:tabular-nums}
    .cema-metric-card.primary .cema-metric-value{color:var(--gold-dark)}
    .cema-metric-sub{margin-top:6px;font-size:12px;color:var(--muted)}
    .cema-viz-grid,.cema-bottom-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin-bottom:18px}
    .cema-checks-table{width:100%;border-collapse:collapse;font-size:13px;background:white;border-radius:12px;overflow:hidden;border:1px solid var(--border)}
    html[data-theme="dark"] .cema-checks-table{background:#1b2330}
    .cema-checks-table th,.cema-checks-table td{padding:10px 12px;border-bottom:1px solid #ece8dd;text-align:left;vertical-align:middle}
    html[data-theme="dark"] .cema-checks-table th,html[data-theme="dark"] .cema-checks-table td{border-bottom-color:var(--border)}
    .cema-checks-table th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);background:#faf8f1}
    html[data-theme="dark"] .cema-checks-table th{background:#202937}
    .cema-checks-table tr:last-child td{border-bottom:none}
    .mono{font-variant-numeric:tabular-nums;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .cema-warning-list{display:grid;gap:10px}
    .cema-warning-item{border-left:4px solid var(--gold);background:white;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.45;box-shadow:0 1px 5px rgba(0,0,0,.05)}
    html[data-theme="dark"] .cema-warning-item{background:#1b2330}
    .cema-warning-item.ok{border-left-color:var(--ok)}
    .cema-warning-item.warn{border-left-color:var(--warn)}
    .cema-warning-item.bad{border-left-color:var(--bad)}
    .cema-basis-body{display:grid;gap:14px;font-size:13px;line-height:1.55}
    .cema-basis-box{background:white;border:1px solid var(--border);border-radius:12px;padding:12px 14px}
    html[data-theme="dark"] .cema-basis-box{background:#1b2330}
    .cema-basis-box h4{margin:0 0 8px;font-size:14px;font-weight:800}
    .cema-eq-line{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px dashed #e7dfcf}
    .cema-eq-line:last-child{border-bottom:none}
    .cema-eq-line .lhs{font-weight:700}
    .cema-eq-line .rhs{color:var(--muted);text-align:right}
    .cema-helper-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
    .cema-helper-card{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.55)}
    html[data-theme="dark"] .cema-helper-card{background:#1b2330}
    .cema-helper-card strong{display:block;font-size:12px;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
    .cema-helper-card span{font-size:13px;font-weight:800}
    .cema-profile-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .cema-profile-chip{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.55)}
    html[data-theme="dark"] .cema-profile-chip{background:#1b2330}
    .cema-profile-chip strong{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;margin-bottom:4px}
    .cema-profile-shell{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(340px,0.9fr);gap:18px}
    .cema-toolbar-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
    .cema-mini-btn{border:1px solid rgba(0,0,0,0.08);background:rgba(255,255,255,0.65);color:var(--text);border-radius:8px;padding:7px 10px;font-weight:700;font-size:12px;cursor:pointer}
    html[data-theme="dark"] .cema-mini-btn{background:#202937}
    .cema-mini-btn.danger{color:var(--bad)}
    .cema-mini-btn.primary{background:var(--gold);color:#111}
    .cema-profile-table{width:100%;border-collapse:collapse;font-size:12px;background:white;border:1px solid var(--border);border-radius:10px;overflow:hidden}
    html[data-theme="dark"] .cema-profile-table{background:#1b2330}
    .cema-profile-table th,.cema-profile-table td{padding:8px;border-bottom:1px solid #ece8dd;text-align:left;vertical-align:middle}
    html[data-theme="dark"] .cema-profile-table th,html[data-theme="dark"] .cema-profile-table td{border-bottom-color:var(--border)}
    .cema-profile-table th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:#faf8f1}
    html[data-theme="dark"] .cema-profile-table th{background:#202937}
    .cema-profile-table td input,.cema-profile-table td select{width:100%;min-width:0;border:1px solid var(--border);background:white;color:var(--text);border-radius:7px;padding:6px 7px;text-align:right}
    html[data-theme="dark"] .cema-profile-table td input,html[data-theme="dark"] .cema-profile-table td select{background:#111720}
    .cema-profile-table td input[type="text"]{text-align:left}
    .cema-curve-table-wrap{max-height:360px;overflow:auto;border:1px solid var(--border);border-radius:12px}
    @media(max-width:1280px){.cema-tool{grid-template-columns:1fr}.cema-left{position:static}.cema-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.cema-viz-grid,.cema-bottom-grid{grid-template-columns:1fr}.cema-header-inner{grid-template-columns:1fr}.cema-profile-shell{grid-template-columns:1fr}.cema-profile-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:720px){.cema-shell{padding:16px}.cema-metrics{grid-template-columns:1fr}.cema-profile-summary{grid-template-columns:1fr}}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ── Header ── */}
      <header className="cema-header">
        <div className="cema-header-inner">
          <div className="cema-brand">
            <div className="cema-brand-mark" aria-hidden>
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" width="36" height="36">
                <rect x="8" y="26" width="48" height="12" rx="6" stroke="#8A6D2F" strokeWidth="4"/>
                <circle cx="16" cy="32" r="6" fill="#8A6D2F" opacity="0.35"/>
                <circle cx="48" cy="32" r="6" fill="#8A6D2F" opacity="0.35"/>
                <path d="M10 22L18 14M54 42L46 50" stroke="#8A6D2F" strokeWidth="3.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <small style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(0,0,0,.66)' }}>Bulk conveyor worksheet</small>
              <strong style={{ display: 'block', fontSize: 18 }}>CEMA 7 power sizing</strong>
            </div>
          </div>
          <div>
            <div className="cema-header-title">CEMA 7th Edition Conveyor Power Worksheet</div>
            <div style={{ textAlign: 'center', fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(0,0,0,.72)', marginTop: 4 }}>Historical method worksheet with metric inputs and English-only interface</div>
          </div>
          <div className="cema-header-actions">
            <button className="cema-btn secondary" onClick={() => dispatch({ type: 'LOAD_SAMPLE' })}>Load sample</button>
            <button className="cema-btn secondary" onClick={() => dispatch({ type: 'RESET' })}>Reset defaults</button>
            <button className="cema-btn secondary" onClick={() => dispatch({ type: 'SET', field: 'theme', value: state.theme === 'dark' ? 'light' : 'dark' })}>{state.theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
            <button className="cema-btn" onClick={save}>Save tool inputs</button>
          </div>
        </div>
      </header>

      <main className="cema-shell">
        <div className="cema-tool">
          {/* ══ LEFT COLUMN — Inputs ══ */}
          <div className="cema-left">
            <section className="cema-panel">
              <div className="cema-panel-title">
                <div><h3>Inputs</h3><p>Metric entry fields, CEMA historical-method logic, and manual hooks for standard lookup factors.</p></div>
                <span className={`cema-badge ${statusLevel}`}>{!Number.isFinite(r.teLbf) ? 'Check inputs' : r.dutyMode === 'Regenerative' ? 'Regenerative duty' : 'Motoring duty'}</span>
              </div>
              <div className="cema-panel-inner">

                {/* Project */}
                <h4 className="cema-section-heading">Project</h4>
                <div className="cema-input-row"><div className="cema-input-head"><label>Project</label><div className="cema-input-wrap"><input type="text" value={state.projectName} onChange={set('projectName')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Conveyor tag</label><div className="cema-input-wrap"><input type="text" value={state.conveyorTag} onChange={set('conveyorTag')} /></div></div></div>

                {/* Duty & geometry */}
                <h4 className="cema-section-heading">Duty &amp; geometry</h4>
                <div className="cema-input-row"><div className="cema-input-head"><label>Capacity</label><div className="cema-input-wrap"><span className="cema-unit-chip">t/h</span><input type="number" step="1" value={state.capacityTph} onChange={set('capacityTph')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Belt speed</label><div className="cema-input-wrap"><span className="cema-unit-chip">m/s</span><input type="number" step="0.01" value={state.beltSpeed} onChange={set('beltSpeed')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Material entry speed</label><div className="cema-input-wrap"><span className="cema-unit-chip">m/s</span><input type="number" step="0.01" value={state.materialEntrySpeed} onChange={set('materialEntrySpeed')} /></div></div><div className="cema-helper">Velocity component in belt travel direction for Tam calculation.</div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Conveyor center length</label><div className="cema-input-wrap"><span className="cema-unit-chip">m</span><input type="number" step="0.1" value={state.centerLengthM} onChange={set('centerLengthM')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Vertical lift (+) or drop (-)</label><div className="cema-input-wrap"><span className="cema-unit-chip">m</span><input type="number" step="0.1" value={state.liftM} onChange={set('liftM')} /></div></div><div className="cema-helper">Positive for lift, negative for decline. Flags regenerative duty if net power is negative.</div></div>

                {/* Belt & load */}
                <h4 className="cema-section-heading">Belt &amp; load</h4>
                <div className="cema-input-row"><div className="cema-input-head"><label>Belt width</label><div className="cema-input-wrap"><span className="cema-unit-chip">mm</span><input type="number" step="1" value={state.beltWidthMm} onChange={set('beltWidthMm')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Bulk density</label><div className="cema-input-wrap"><span className="cema-unit-chip">t/m³</span><input type="number" step="0.01" value={state.bulkDensity} onChange={set('bulkDensity')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Trough angle (idler angle)</label><div className="cema-input-wrap"><span className="cema-unit-chip">deg</span><select value={state.troughAngleDeg} onChange={set('troughAngleDeg')}>{TROUGH_ANGLES.map(a => <option key={a} value={a}>{a}°</option>)}</select></div></div><div className="cema-helper">Standard options: 0°, 15°, 35°, and 45°.</div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Surcharge angle</label><div className="cema-input-wrap"><span className="cema-unit-chip">deg</span><input type="number" step="1" value={state.surchargeAngleDeg} onChange={set('surchargeAngleDeg')} /></div></div><div className="cema-helper">Used in the geometric cross-section model for the live material surface.</div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Center roll fraction</label><div className="cema-input-wrap"><span className="cema-unit-chip">0–1</span><input type="number" step="0.01" value={state.centerRollFraction} onChange={set('centerRollFraction')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Edge freeboard</label><div className="cema-input-wrap"><span className="cema-unit-chip">% B</span><input type="number" step="1" value={state.edgeFreeboardPct} onChange={set('edgeFreeboardPct')} /></div></div></div>
                <div className="cema-check-row"><label><input type="checkbox" checked={state.useEstimatedBeltWeight} onChange={set('useEstimatedBeltWeight')} />Use CEMA average belt-weight estimate</label><span className={`cema-badge ${state.useEstimatedBeltWeight ? 'ok' : 'info'}`}>{state.useEstimatedBeltWeight ? 'Estimated' : 'Manual'}</span></div>
                <div className="cema-check-row"><label><input type="checkbox" checked={state.steelCord} onChange={set('steelCord')} />Steel-cord belt (+50% estimate)</label><span className="cema-unit-chip">optional</span></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Belt weight</label><div className="cema-input-wrap"><span className="cema-unit-chip">kg/m</span><input type="number" step="0.1" value={state.beltWeightKgPm} onChange={set('beltWeightKgPm')} disabled={state.useEstimatedBeltWeight} /></div></div><div className="cema-helper">Manual weight from belt vendor, or auto-filled from the CEMA estimate table when the checkbox is enabled.</div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Carrying idler spacing</label><div className="cema-input-wrap"><span className="cema-unit-chip">m</span><input type="number" step="0.01" value={state.idlerSpacingM} onChange={set('idlerSpacingM')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Sag criterion</label><div className="cema-input-wrap"><span className="cema-unit-chip">%</span><select value={state.sagPercent} onChange={set('sagPercent')}>{SAG_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div></div><div className="cema-helper">Used for the T0 / T2 sag check, assuming a single head drive arrangement.</div></div>

                {/* CEMA factors */}
                <h4 className="cema-section-heading">CEMA factors</h4>
                <div className="cema-input-row"><div className="cema-input-head"><label>Idler family / Ai</label><div className="cema-input-wrap"><span className="cema-unit-chip">CEMA</span><select value={state.idlerFamily} onChange={set('idlerFamily')}>{IDLER_FAMILIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></div></div></div>
                <div className="cema-check-row"><label><input type="checkbox" checked={state.twoRollVReturn} onChange={set('twoRollVReturn')} />Two-roll V-return idlers (+5% Ai)</label><span className="cema-unit-chip">Kx note</span></div>
                <div className="cema-check-row"><label><input type="checkbox" checked={state.overrideKx} onChange={set('overrideKx')} />Override auto Kx</label><span className={`cema-badge ${state.overrideKx ? 'warn' : 'ok'}`}>{state.overrideKx ? 'Manual' : 'Auto'}</span></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Manual Kx</label><div className="cema-input-wrap"><span className="cema-unit-chip">lb/ft²</span><input type="number" step="0.0001" value={state.manualKx} onChange={set('manualKx')} disabled={!state.overrideKx} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Ky</label><div className="cema-input-wrap"><span className="cema-unit-chip">factor</span><input type="number" step="0.0001" value={state.ky} onChange={set('ky')} /></div></div><div className="cema-helper">Enter from the CEMA Ky tables after correcting for length, slope, load, and idler spacing.</div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Kt</label><div className="cema-input-wrap"><span className="cema-unit-chip">factor</span><input type="number" step="0.01" value={state.kt} onChange={set('kt')} /></div></div><div className="cema-helper">Ambient-temperature correction factor from the CEMA temperature curve.</div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Cw preset</label><div className="cema-input-wrap"><span className="cema-unit-chip">wrap</span><select value={state.cwPreset} onChange={set('cwPreset')}>{CW_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Cw</label><div className="cema-input-wrap"><span className="cema-unit-chip">factor</span><input type="number" step="0.01" value={state.cw} onChange={set('cw')} disabled={state.cwPreset !== 'manual'} /></div></div><div className="cema-helper">Wrap factor for the traction / no-slip T2 check.</div></div>

                {/* Pulleys & accessories */}
                <h4 className="cema-section-heading">Pulleys &amp; accessories</h4>
                {([['tightPulleys', 'Tight-side pulleys (150° to 240°)', 'qty'], ['slackPulleys', 'Slack-side pulleys (150° to 240°)', 'qty'], ['otherPulleys', 'Other pulleys (<150° wrap)', 'qty'], ['cleanerBlades', 'Cleaner blades in contact', 'qty'], ['fullPlows', 'Full plows', 'qty'], ['partialPlows', 'Partial plows', 'qty']] as const).map(([f, lbl, u]) => (
                  <div key={f} className="cema-input-row"><div className="cema-input-head"><label>{lbl}</label><div className="cema-input-wrap"><span className="cema-unit-chip">{u}</span><input type="number" step="1" min="0" value={state[f] as number} onChange={set(f)} /></div></div></div>
                ))}
                <div className="cema-check-row"><label><input type="checkbox" checked={state.plainBearings} onChange={set('plainBearings')} />Plain bearings on pulley shafts</label><span className="cema-unit-chip">Tp × 2</span></div>
                <div className="cema-check-row"><label><input type="checkbox" checked={state.overrideTp} onChange={set('overrideTp')} />Override Tp with manual value</label><span className={`cema-badge ${state.overrideTp ? 'warn' : 'ok'}`}>{state.overrideTp ? 'Manual' : 'Count'}</span></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Manual Tp</label><div className="cema-input-wrap"><span className="cema-unit-chip">lbf</span><input type="number" step="0.1" value={state.manualTpLbf} onChange={set('manualTpLbf')} disabled={!state.overrideTp} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Skirtboard length</label><div className="cema-input-wrap"><span className="cema-unit-chip">m</span><input type="number" step="0.1" value={state.skirtLengthM} onChange={set('skirtLengthM')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Material depth at skirtboard</label><div className="cema-input-wrap"><span className="cema-unit-chip">mm</span><input type="number" step="1" value={state.skirtDepthMm} onChange={set('skirtDepthMm')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Cs</label><div className="cema-input-wrap"><span className="cema-unit-chip">factor</span><input type="number" step="0.0001" value={state.csFactor} onChange={set('csFactor')} /></div></div><div className="cema-helper">Skirtboard friction factor for the handled material.</div></div>
                <div className="cema-check-row"><label><input type="checkbox" checked={state.rubberEdging} onChange={set('rubberEdging')} />Rubber skirtboard edging</label><span className="cema-unit-chip">+6 lb/ft</span></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Other accessory tension</label><div className="cema-input-wrap"><span className="cema-unit-chip">kN</span><input type="number" step="0.01" value={state.otherAccessoryKN} onChange={set('otherAccessoryKN')} /></div></div></div>

                {/* Plugged chute */}
                <h4 className="cema-section-heading">Plugged chute resistance</h4>
                <div className="cema-input-row"><div className="cema-input-head"><label>Method</label><div className="cema-input-wrap"><span className="cema-unit-chip">mode</span><select value={state.pluggedChuteMode} onChange={set('pluggedChuteMode')}>{PLUGGED_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div></div></div>
                <div className="cema-check-row"><label><input type="checkbox" checked={state.pluggedApplyInFlow} onChange={set('pluggedApplyInFlow')} />Include plugged chute resistance in steady-state Te</label><span className="cema-unit-chip">flow</span></div>
                {([['pluggedWidthMm','Plug width','mm',1],['pluggedHeightMm','Plug height','mm',1],['pluggedLengthM','Plug length','m',0.01],['pluggedWallFriction','Wall friction coefficient, μ','–',0.01],['pluggedShearStressKPa','Bulk shear stress','kPa',0.1],['pluggedStartupFactor','Startup / breakout factor','×',0.01],['manualPluggedFlowKN','Manual plugged-chute force (flow)','kN',0.01]] as const).map(([f, lbl, u, step]) => (
                  <div key={f} className="cema-input-row"><div className="cema-input-head"><label>{lbl}</label><div className="cema-input-wrap"><span className="cema-unit-chip">{u}</span><input type="number" step={step} value={state[f] as number} onChange={set(f)} /></div></div></div>
                ))}

                {/* Drive */}
                <h4 className="cema-section-heading">Drive</h4>
                <div className="cema-input-row"><div className="cema-input-head"><label>Drive efficiency</label><div className="cema-input-wrap"><span className="cema-unit-chip">%</span><input type="number" step="0.1" value={state.driveEfficiencyPct} onChange={set('driveEfficiencyPct')} /></div></div></div>
                <div className="cema-input-row"><div className="cema-input-head"><label>Service factor</label><div className="cema-input-wrap"><span className="cema-unit-chip">×</span><input type="number" step="0.01" value={state.serviceFactor} onChange={set('serviceFactor')} /></div></div></div>

                <div className="cema-helper" style={{ marginTop: 12 }}>This worksheet is arranged to match the attached reference style, adapted to a CEMA conveyor power use case.</div>
              </div>
            </section>
          </div>

          {/* ══ RIGHT COLUMN — Outputs ══ */}
          <div>
            {/* Metrics grid */}
            <section className="cema-metrics">
              {[
                { id: 'te', label: 'Effective tension, Te', value: `${fmtFixed(lbfToKn(r.teLbf), 2)} kN`, sub: `${fmtFixed(r.teLbf, 0)} lbf effective tension`, cls: `primary ${statusLevel}` },
                { id: 'bp', label: 'Belt power', value: `${fmtFixed(r.beltKw, 1)} kW`, sub: `${fmtFixed(r.beltHp, 1)} hp at belt speed ${fmtFixed(r.beltSpeed, 2)} m/s`, cls: statusLevel },
                { id: 'mp', label: 'Motor shaft power', value: `${fmtFixed(r.motorKw, 1)} kW`, sub: `${fmtFixed(r.motorHp, 1)} hp with η=${fmtFixed(r.driveEfficiencyPct, 1)}% · SF=${fmtFixed(r.serviceFactor, 2)} · startup ${fmtFixed(r.startupMotorKw, 1)} kW`, cls: statusLevel },
                { id: 'mode', label: 'Duty mode', value: r.dutyMode, sub: r.dutyMode === 'Regenerative' ? 'Negative net power; brake or regen review required' : 'Positive net power demand', cls: statusLevel },
                { id: 't2', label: 'Governing T2', value: `${fmtFixed(lbfToKn(r.t2Lbf), 2)} kN`, sub: `${r.governingSource} governs · slip ${fmtFixed(lbfToKn(r.t2SlipLbf), 2)} kN vs sag ${fmtFixed(lbfToKn(r.t2SagLbf), 2)} kN` },
                { id: 't1', label: 'Approx. Tmax / T1', value: `${fmtFixed(lbfToKn(r.t1Lbf), 2)} kN`, sub: `${fmtFixed(r.t1Lbf, 0)} lbf approximate maximum tension` },
                { id: 'wm', label: 'Material load, Wm', value: `${fmtFixed(r.wmKgPm, 1)} kg/m`, sub: `${fmtFixed(r.wmLbft, 1)} lb/ft live load on the belt` },
                { id: 'kx', label: 'Auto Kx', value: fmtFixed(r.kxUsed, 4), sub: `${r.overrideKx ? 'Manual override' : `Auto from Ai ${fmtFixed(r.aiAdjusted, 2)}`} · Ky ${fmtFixed(r.ky, 4)}` },
                { id: 'fa', label: 'Loaded area', value: `${fmtFixed(r.occupiedAreaM2, 4)} m²`, sub: `CEMA avail ${fmtFixed(r.cemaAvailableAreaM2, 4)} m² · max ${fmtFixed(r.maxAreaM2, 4)} m²` },
                { id: 'fp', label: 'Section fill', value: `${fmtFixed(r.fillAreaPct, 1)} %`, sub: `Occupied / CEMA available · edge ${fmtFixed(r.totalEdgeClearanceM * 1000, 0)} mm total (${fmtFixed(r.edgeDistanceM * 1000, 0)} mm/side)` },
                { id: 'pf', label: 'Plugged chute force, flow', value: `${fmtFixed(r.pluggedFlowKN, 2)} kN`, sub: `${r.pluggedApplyInFlow ? 'Included in Te' : 'Shown only as check'} · ${r.pluggedMethodBasis}` },
                { id: 'ps', label: 'Plugged chute force, startup', value: `${fmtFixed(r.pluggedStartupKN, 2)} kN`, sub: `Startup breakout force · extra above flow ${fmtFixed(r.pluggedStartupExtraKN, 2)} kN` },
              ].map(card => (
                <div key={card.id} className={`cema-metric-card ${card.cls || ''}`}>
                  <div className="cema-metric-label">{card.label}</div>
                  <div className="cema-metric-value">{card.value}</div>
                  <div className="cema-metric-sub">{card.sub}</div>
                </div>
              ))}
            </section>

            {/* 2D Schematic + Breakdown */}
            <section className="cema-viz-grid">
              <div className="cema-panel">
                <div className="cema-panel-title"><div><h3>2D conveyor schematic</h3><p>Head-drive side view, slope cue, belt speed, throughput, and selected CEMA factors.</p></div><span className="cema-badge info">layout check</span></div>
                <SvgPanel render={schematicRender} height={320} />
              </div>
              <div className="cema-panel">
                <div className="cema-panel-title"><div><h3>Tension breakdown</h3><p>Positive and negative Te contributors shown at belt line using the historical method components.</p></div><span className={`cema-badge ${r.components.some(c => c.lbf < 0) ? 'warn' : 'ok'}`}>{r.components.some(c => c.lbf < 0) ? 'mixed signs' : 'all positive'}</span></div>
                <SvgPanel render={breakdownRender} height={320} />
              </div>
            </section>

            {/* Fill section + Fill curve */}
            <section className="cema-viz-grid">
              <div className="cema-panel">
                <div className="cema-panel-title"><div><h3>Belt cross-section fill</h3><p>The belt trough geometry stays fixed by the selected idler angle. The material surface varies with surcharge angle.</p></div><span className={`cema-badge ${r.fillAreaPct <= 100 ? 'ok' : 'bad'}`}>{r.fillAreaPct <= 100 ? 'within CEMA' : 'over CEMA'}</span></div>
                <SvgPanel render={fillRender} height={460} />
              </div>
              <div className="cema-panel">
                <div className="cema-panel-title"><div><h3>Fill curve</h3><p>Loaded area requirement versus geometric maximum area for the current belt section.</p></div><span className={`cema-badge ${r.fillAreaPct <= 100 ? 'ok' : 'bad'}`}>{r.fillAreaPct <= 100 ? 'within CEMA' : 'over CEMA'}</span></div>
                <SvgPanel render={fillCurveRender} height={460} />
              </div>
            </section>

            {/* Traction + Component table */}
            <section className="cema-bottom-grid">
              <div className="cema-panel">
                <div className="cema-panel-title"><div><h3>Traction and take-up checks</h3><p>Single head-drive interpretation for T2 slip, T2 sag, counterweight, and associated checks.</p></div><span className={`cema-badge ${r.governingSource === 'Sag' ? 'warn' : 'ok'}`}>{r.governingSource.toLowerCase()} governs</span></div>
                <SvgPanel render={tractionRender} height={320} />
              </div>
              <div className="cema-panel">
                <div className="cema-panel-title"><div><h3>CEMA component table</h3><p>Each contribution listed in both tension and power terms.</p></div></div>
                <div className="cema-panel-inner">
                  <table className="cema-checks-table">
                    <thead><tr><th>Component</th><th>Tension</th><th>Power</th><th>Basis</th></tr></thead>
                    <tbody>
                      {componentTableRows.map((row: CompRow, i: number) => (
                        <tr key={i}>
                          <td>{row.label}</td>
                          <td className="mono">{fmtFixed(lbfToKn(row.lbf), 2)} kN <br /><span style={{ color: 'var(--muted)' }}>{fmtFixed(row.lbf, 0)} lbf</span></td>
                          <td className="mono">{fmtFixed(row.kw, 2)} kW</td>
                          <td>{row.basis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Checks + Basis */}
            <section className="cema-bottom-grid">
              <div className="cema-panel">
                <div className="cema-panel-title"><div><h3>Checks and notes</h3><p>Warnings, assumptions, and things to verify against the final CEMA selection tables.</p></div></div>
                <div className="cema-panel-inner">
                  <div className="cema-warning-list">
                    {warnings.map((item: {level: string; text: string}, i: number) => <div key={i} className={`cema-warning-item ${item.level}`}>{item.text}</div>)}
                  </div>
                  <div className="cema-helper-grid">
                    <div className="cema-helper-card"><strong>Nearest standard width</strong><span>{fmtFixed(r.estimate.standardWidthIn, 0)} in nearest standard ({fmtFixed(r.estimate.standardWidthIn * 25.4, 0)} mm)</span></div>
                    <div className="cema-helper-card"><strong>Estimated belt weight</strong><span>{fmtFixed(r.estimate.kgpm, 1)} kg/m · {r.estimate.densityBand}</span></div>
                    <div className="cema-helper-card"><strong>Slope</strong><span>{fmtFixed(r.slopePct, 2)} %</span></div>
                    <div className="cema-helper-card"><strong>Counterweight approx.</strong><span>{fmtFixed(lbfToKn(r.counterweightLbf), 2)} kN total gravity counterweight</span></div>
                  </div>
                </div>
              </div>
              <div className="cema-panel">
                <div className="cema-panel-title"><div><h3>Calculation basis</h3><p>Equation summary and modeling assumptions used by this worksheet.</p></div></div>
                <div className="cema-panel-inner cema-basis-body">
                  <div className="cema-basis-box">
                    <h4>Core equations</h4>
                    {[
                      ['Material on belt, Wm', 'Q × 2000 / (60 × V)'],
                      ['Kx', '[0.00068 × (Wb + Wm) + Ai] / Si'],
                      ['Te', 'LKt(Kx + KyWb + 0.015Wb) + Wm(LKy + H) + Tp + Tam + Tac'],
                      ['Tam', '0.00028755 × Q × (V − Vo)'],
                      ['Plugged chute during flow', 'μWplug + τ × Aplug, or manual force'],
                      ['Plugged chute at startup', 'Startup factor × plugged-chute flow resistance'],
                      ['Belt power', 'Te × V / 33,000'],
                      ['T2 slip', '|Te| × Cw'],
                      ['T0 sag', '4.20, 6.25, or 8.40 × Si × (Wb + Wm)'],
                      ['T2 sag', 'T0 + Tb − Tyr (single head-drive interpretation)'],
                    ].map(([lhs, rhs]) => (
                      <div key={lhs} className="cema-eq-line"><span className="lhs">{lhs}</span><span className="rhs">{rhs}</span></div>
                    ))}
                  </div>
                  <div className="cema-basis-box">
                    <h4>Modeling assumptions</h4>
                    <p>This worksheet keeps the historical CEMA tension structure and exposes the lookup factors that normally come from the published tables and charts. It uses metric inputs for convenience, then converts internally to the imperial forms used by the historical equations.</p>
                    <p>Occupied area is calculated strictly from throughput, belt speed, and bulk density. Maximum section area uses a CEMA area-factor calibration; CEMA available area is taken as 70% of that maximum area.</p>
                    <p>Tp follows the simple pulley-count allowance method by default, with an optional manual Tp override. Ky, Kt, and Cw remain visible inputs so you can align the sheet with the exact standard lookup used on your project.</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>Current live load: {fmtFixed(r.wmKgPm, 1)} kg/m. Belt weight basis: {r.useEstimatedBeltWeight ? `estimated ${fmtFixed(r.beltWeightKgPm, 1)} kg/m` : `manual ${fmtFixed(r.beltWeightKgPm, 1)} kg/m`}.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Validation */}
            <section className="cema-bottom-grid">
              <div className="cema-panel">
                <div className="cema-panel-title">
                  <div><h3>Validation against reference examples</h3><p>Benchmark comparison using published CEMA-style examples for power/tension and published capacity charts for loaded and available belt section.</p></div>
                  <span className={`cema-badge ${validationResults.every((v: ValRow) => v.maxAbs <= 1.0) && areaValidationResults.every((v: AreaValRow) => v.pass) ? 'ok' : 'warn'}`}>
                    {validationResults.every((v: ValRow) => v.maxAbs <= 1.0) && areaValidationResults.every((v: AreaValRow) => v.pass) ? `${validationResults.length} power + ${areaValidationResults.length} area checks passed` : 'review deviations'}
                  </span>
                </div>
                <div className="cema-panel-inner">
                  <table className="cema-checks-table">
                    <thead><tr><th>Case</th><th>Expected</th><th>Calculated</th><th>Max delta</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {validationResults.map(({ item, calc, deviations, maxAbs }: ValRow) => {
                        const pass = maxAbs <= 1.0;
                        return (
                          <tr key={item.id}>
                            <td><strong>{item.label}</strong><br /><span style={{ color: 'var(--muted)' }}>{item.source}</span></td>
                            <td className="mono">Te {fmtFixed(lbfToKn(item.expected.teLbf), 2)} kN<br />HP {fmtFixed(item.expected.beltHp, 2)}<br />T2 {fmtFixed(lbfToKn(item.expected.t2Lbf), 2)} kN<br />T1 {fmtFixed(lbfToKn(item.expected.t1Lbf), 2)} kN</td>
                            <td className="mono">Te {fmtFixed(lbfToKn(calc.teLbf), 2)} kN<br />HP {fmtFixed(calc.beltHp, 2)}<br />T2 {fmtFixed(lbfToKn(calc.t2Lbf), 2)} kN<br />T1 {fmtFixed(lbfToKn(calc.t1Lbf), 2)} kN</td>
                            <td className="mono">Te {fmtFixed(deviations.te, 2)}%<br />HP {fmtFixed(deviations.hp, 2)}%<br />T2 {fmtFixed(deviations.t2, 2)}%<br />T1 {fmtFixed(deviations.t1, 2)}%</td>
                            <td><span className={`cema-badge ${pass ? 'ok' : 'warn'}`}>{pass ? 'Pass' : 'Review'}</span><br /><span style={{ color: 'var(--muted)', fontSize: 11 }}>max |Δ| {fmtFixed(maxAbs, 2)}%</span></td>
                            <td><button className="cema-btn secondary" style={{ padding: '8px 10px', fontSize: 12 }} onClick={() => dispatch({ type: 'SET_ALL', state: { ...item.input as State, theme: state.theme } })}>Load case</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ height: 12 }} />
                  <table className="cema-checks-table">
                    <thead><tr><th>Area / edge case</th><th>Expected</th><th>Calculated</th><th>Delta</th><th>Status</th></tr></thead>
                    <tbody>
                      {areaValidationResults.map((row: AreaValRow) => (
                        <tr key={row.id}>
                          <td><strong>{row.label}</strong></td>
                          <td className="mono">{fmtFixed(row.expected, row.unit === 'mm' ? 0 : 6)} {row.unit}</td>
                          <td className="mono">{fmtFixed(row.calculated, row.unit === 'mm' ? 0 : 6)} {row.unit}</td>
                          <td className="mono">{fmtFixed(row.delta, 2)}%</td>
                          <td><span className={`cema-badge ${row.pass ? 'ok' : 'warn'}`}>{row.pass ? 'Pass' : 'Review'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="cema-warning-list" style={{ marginTop: 12 }}>
                    {validationResults.map(({ item, maxAbs }: ValRow) => <div key={item.id} className={`cema-warning-item ${maxAbs <= 1.0 ? 'ok' : 'warn'}`}>{item.label}: {item.note}</div>)}
                  </div>
                </div>
              </div>
              <div className="cema-panel">
                <div className="cema-panel-title"><div><h3>Validation scope</h3><p>What was checked in this file and what remains outside the present model.</p></div></div>
                <div className="cema-panel-inner cema-basis-body">
                  <div className="cema-basis-box"><h4>Validated in this file</h4><p>Steady-state historical-method calculations were checked against two external benchmarks: a published CEMA-style worked example and the public Rulmeca calculation workbook sample. The benchmark set covers Wm, Kx/Ky/Kt usage, Te, belt horsepower, T2 slip, T2 sag, and T1.</p></div>
                  <div className="cema-basis-box"><h4>Not covered by the present model</h4><p>This module currently validates the steady-state power and tension sheet only. The belt loading module uses occupied area directly from throughput, speed, and bulk density; maximum section area uses a Belt Analyst-compatible CEMA area-factor calibration; CEMA available area is taken as 70% of maximum; and section fill is reported as occupied divided by CEMA available. Edge distance is then solved from the calibrated cross-section geometry for the occupied area.</p></div>
                </div>
              </div>
            </section>

            {/* Profile editor — full width */}
            <section style={{ marginBottom: 18 }}>
              <div className="cema-panel" style={{ gridColumn: '1 / -1' }}>
                <div className="cema-panel-title">
                  <div><h3>Iterative 2D profile and vertical curve checks</h3><p>Define multiple conveyor segments by station and elevation, place drive / take-up / pulleys / feed markers, and check each vertical curve against admissible radii using CEMA-style local-tension criteria.</p></div>
                  <span className={`cema-badge ${r.profile.curves.filter(c => c.status !== 'OK').length ? 'warn' : 'ok'}`}>{r.profile.curves.filter(c => c.status !== 'OK').length ? `${r.profile.curves.filter(c => c.status !== 'OK').length} review` : 'checked'}</span>
                </div>
                <div className="cema-panel-inner">
                  <div className="cema-profile-summary">
                    <div className="cema-profile-chip"><strong>Profile length</strong>{fmtFixed(r.profile.totalLen, 1)} m</div>
                    <div className="cema-profile-chip"><strong>Highest point</strong>{fmtFixed(Math.max(...r.profile.nodes.map(n => n.elev)), 2)} m</div>
                    <div className="cema-profile-chip"><strong>Curves checked</strong>{r.profile.curves.length}</div>
                    <div className="cema-profile-chip"><strong>Worst margin</strong>{Number.isFinite(worstMargin) ? `${fmtFixed(worstMargin, 1)} %` : '–'}</div>
                  </div>

                  <div className="cema-profile-shell" style={{ marginTop: 14 }}>
                    <div>
                      <div className="cema-toolbar-row">
                        <button className="cema-mini-btn primary" onClick={profileUpdateFns.addNode}>Add node</button>
                        <button className="cema-mini-btn" onClick={profileUpdateFns.addMarker}>Add marker</button>
                        <button className="cema-mini-btn" onClick={profileUpdateFns.syncFromLengthLift}>Sync from length/lift</button>
                      </div>
                      <ProfileSvgPanel r={r} dispatch={dispatch} />
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Drag the blue nodes in the 2D profile to iterate geometry. Drag the gold markers horizontally to reposition drive, take-up, tail/return pulleys, and feed points.</p>
                    </div>

                    <div className="cema-profile-editor" style={{ display: 'grid', gap: 14 }}>
                      <div className="cema-basis-box">
                        <h4>Curve calculation inputs</h4>
                        {([['beltModulusKNpm','Belt modulus, E','kN/m',1],['beltRatedTensionKNpm','Rated belt tension, tr','kN/m',1],['minBuckleTensionKNpm','Minimum centre tension, Tmin','kN/m',0.1],['autoCurveShare','Auto curve share','0–0.8',0.05]] as const).map(([f,lbl,u,step]) => (
                          <div key={f} className="cema-input-row"><div className="cema-input-head"><label>{lbl}</label><div className="cema-input-wrap"><span className="cema-unit-chip">{u}</span><input type="number" step={step} value={state[f] as number} onChange={set(f)} /></div></div></div>
                        ))}
                        <p style={{ fontSize: 11, color: 'var(--muted)' }}>R<sub>11</sub> lift-off, R<sub>12</sub>/R<sub>13</sub> concave tension checks, R<sub>21</sub>/R<sub>22</sub> convex tension checks, and the practical convex idler-angle criterion R<sub>23</sub> = 114 × idler spacing are evaluated with local tension at each curve.</p>
                      </div>

                      <div>
                        <h4 className="cema-section-heading">Profile nodes</h4>
                        <table className="cema-profile-table">
                          <thead><tr><th>Node</th><th>Station (m)</th><th>Elevation (m)</th><th>Curve length (m)</th><th></th></tr></thead>
                          <tbody>
                            {r.profile.nodes.map((node, i) => (
                              <tr key={node.id}>
                                <td>{node.id}</td>
                                <td><input type="number" step="0.1" defaultValue={fmtFixed(node.station, 2)} onBlur={(e: React.FocusEvent<HTMLInputElement>) => updateNodeField(i, 'station', e.target.value)} /></td>
                                <td><input type="number" step="0.1" defaultValue={fmtFixed(node.elev, 2)} onBlur={(e: React.FocusEvent<HTMLInputElement>) => updateNodeField(i, 'elev', e.target.value)} /></td>
                                <td><input type="number" step="0.1" defaultValue={fmtFixed(node.curveLengthM, 2)} onBlur={(e: React.FocusEvent<HTMLInputElement>) => updateNodeField(i, 'curveLengthM', e.target.value)} /></td>
                                <td>{i > 0 && i < r.profile.nodes.length - 1 && <button className="cema-mini-btn danger" onClick={() => removeNode(i)}>Remove</button>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <h4 className="cema-section-heading">Markers</h4>
                        <table className="cema-profile-table">
                          <thead><tr><th>Label</th><th>Type</th><th>Station (m)</th><th></th></tr></thead>
                          <tbody>
                            {r.profile.markers.map((m, i) => (
                              <tr key={m.id}>
                                <td><input type="text" defaultValue={m.label} onBlur={(e: React.FocusEvent<HTMLInputElement>) => updateMarkerField(i, 'label', e.target.value)} /></td>
                                <td><input type="text" defaultValue={m.type} onBlur={(e: React.FocusEvent<HTMLInputElement>) => updateMarkerField(i, 'type', e.target.value)} /></td>
                                <td><input type="number" step="0.1" defaultValue={fmtFixed(m.station, 2)} onBlur={(e: React.FocusEvent<HTMLInputElement>) => updateMarkerField(i, 'station', e.target.value)} /></td>
                                <td><button className="cema-mini-btn danger" onClick={() => removeMarker(i)}>Remove</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <h4 className="cema-section-heading">Vertical curve checks</h4>
                        <div className="cema-curve-table-wrap">
                          <table className="cema-checks-table">
                            <thead><tr><th>Curve</th><th>Type</th><th>Station</th><th>R calc (m)</th><th>R min (m)</th><th>Criteria</th><th>Margin</th><th>Status</th></tr></thead>
                            <tbody>
                              {r.profile.curves.length ? r.profile.curves.map(c => {
                                const checks = Object.entries(c.checks).filter(([, v]) => Number.isFinite(v) && v > 0).map(([k, v]) => `${k} ${fmtFixed(v, 1)} m`).join(', ');
                                const sl = c.status === 'OK' ? 'ok' : c.status === 'Review' ? 'warn' : 'bad';
                                return (
                                  <tr key={c.id}>
                                    <td><strong>{c.id}</strong><br /><span style={{ color: 'var(--muted)' }}>{fmtFixed(c.startStation, 1)}–{fmtFixed(c.endStation, 1)} m</span></td>
                                    <td>{c.type}</td>
                                    <td className="mono">{fmtFixed(c.station, 1)} m<br /><span style={{ color: 'var(--muted)' }}>Δ {fmtFixed(c.deltaDeg, 2)}°</span></td>
                                    <td className="mono">{fmtFixed(c.actualR, 1)}</td>
                                    <td className="mono">{fmtFixed(c.requiredR, 1)}</td>
                                    <td style={{ fontSize: 11 }}>{checks || '–'}</td>
                                    <td className="mono">{fmtFixed(c.marginPct, 1)} %</td>
                                    <td><span className={`cema-badge ${sl}`}>{c.status}</span></td>
                                  </tr>
                                );
                              }) : <tr><td colSpan={8}>No vertical curves are currently defined in the profile.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>{/* end right column */}
        </div>{/* end cema-tool */}
      </main>
    </>
  );
}

export const CONFIG = {
  id: 'transportador',
  name: 'Transportador de Correia',
  subtitle: 'CEMA 7th Edition',
  icon: '=>',
  color: '#58a6ff',
  price: 349.9,
  description:
    'Modulo completo e autocontido para calculo de potencia, tensoes, enchimento e verificacoes de perfil de transportador de correia.',
  norma: 'CEMA 7th Edition',
};

export const GLOSSARY = [
  {
    cat: 'ENTRADA',
    items: [
      { s: 'capacityTph', d: 'Capacidade de transporte na correia.', u: 't/h' },
      { s: 'beltSpeed', d: 'Velocidade linear da correia.', u: 'm/s' },
      { s: 'centerLengthM', d: 'Comprimento entre centros do transportador.', u: 'm' },
      { s: 'liftM', d: 'Elevacao total entre cauda e descarga.', u: 'm' },
      { s: 'beltWidthMm', d: 'Largura nominal da correia.', u: 'mm' },
      { s: 'bulkDensity', d: 'Densidade aparente do material.', u: 't/m3' },
    ],
  },
  {
    cat: 'SAIDA',
    items: [
      { s: 'Te', d: 'Tensao efetiva total requerida.', u: 'lbf / kN' },
      { s: 'power', d: 'Potencia requerida pela correia e acionamento.', u: 'hp / kW' },
      { s: 'fillAreaPct', d: 'Percentual de ocupacao da area util de secao.', u: '%' },
      { s: 'T1 / T2', d: 'Tensoes de lado tenso e frouxo para verificacao de acionamento.', u: 'lbf / kN' },
      { s: 'profile', d: 'Checagens de curvas verticais e geometria do perfil.', u: '-' },
    ],
  },
];

export default function TransportadorMod() {
  return <ConveyorCalculator />;
}
