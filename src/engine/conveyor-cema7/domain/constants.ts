/**
 * CEMA 7th Edition — Physical constants and unit conversions
 *
 * All conversions are defined here as named, high-precision constants so the
 * engine is fully auditable. Do NOT inline conversion factors elsewhere.
 */

/** Acceleration of gravity (m/s²) — CODATA standard. */
export const G_MPS2 = 9.80665;

// ─── Length ──────────────────────────────────────────────────────────────────
export const FT_PER_M = 3.280839895013123;
export const M_PER_FT = 1 / FT_PER_M;
export const IN_PER_MM = 1 / 25.4;
export const MM_PER_IN = 25.4;

// ─── Velocity ────────────────────────────────────────────────────────────────
export const FPM_PER_MPS = 196.8503937007874;
export const MPS_PER_FPM = 1 / FPM_PER_MPS;

// ─── Mass / linear density ───────────────────────────────────────────────────
/** lb/ft per kg/m → (lb/kg) / (ft/m) */
export const LBFT_PER_KGPM = 2.204622621848776 / FT_PER_M;
export const KGPM_PER_LBFT = 1 / LBFT_PER_KGPM;

// ─── Mass tonnage ────────────────────────────────────────────────────────────
export const SHORT_TON_PER_METRIC_TON = 1.102311310924388;
export const METRIC_TON_PER_SHORT_TON = 1 / SHORT_TON_PER_METRIC_TON;

// ─── Power ───────────────────────────────────────────────────────────────────
export const HP_TO_KW = 0.7456998715822702;
export const KW_TO_HP = 1 / HP_TO_KW;

// ─── Force ───────────────────────────────────────────────────────────────────
export const LBF_TO_N = 4.4482216152605;
export const N_TO_LBF = 1 / LBF_TO_N;

// ─── Bulk density ────────────────────────────────────────────────────────────
/** lb/ft³ per t/m³ = 62.4279605761 (water is 1.000 t/m³ ≈ 62.43 lb/ft³). */
export const LBFT3_PER_TM3 = 62.4279605761;
export const TM3_PER_LBFT3 = 1 / LBFT3_PER_TM3;

// ─── Named scalar helpers ────────────────────────────────────────────────────
export const lbfToKn = (lbf: number): number => (lbf * LBF_TO_N) / 1000;
export const knToLbf = (kn: number): number => (kn * 1000) / LBF_TO_N;
export const lbfToN = (lbf: number): number => lbf * LBF_TO_N;
export const nToLbf = (n: number): number => n / LBF_TO_N;

/**
 * Power at the belt from effective tension and belt speed.
 * hp = Te (lbf) × V (fpm) / 33 000
 */
export const hpFromTeV = (teLbf: number, vFpm: number): number =>
  (teLbf * vFpm) / 33_000;

/** Component kW from a tension component in lbf, at belt speed V (fpm). */
export const componentKwFromLbf = (componentLbf: number, vFpm: number): number =>
  hpFromTeV(componentLbf, vFpm) * HP_TO_KW;

// ─── Direct conversions used throughout ──────────────────────────────────────
export const beltWidthInches = (mm: number): number => mm * IN_PER_MM;
export const densityLbFt3 = (tm3: number): number => tm3 * LBFT3_PER_TM3;
export const metricTphToShortTph = (tph: number): number =>
  tph * SHORT_TON_PER_METRIC_TON;
export const kgpmToLbft = (kgpm: number): number => kgpm * LBFT_PER_KGPM;
export const lbftToKgpm = (lbft: number): number => lbft * KGPM_PER_LBFT;

// ─── Guards ──────────────────────────────────────────────────────────────────
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
