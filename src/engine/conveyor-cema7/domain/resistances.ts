/**
 * CEMA 7th Edition — Individual tension components (the "Historical Method")
 *
 * All functions in this module are pure. They take already-converted numeric
 * inputs and return a value in pound-force (lbf), kept consistent with the
 * canonical CEMA formulae. Unit conversions from SI (m, m/s, kN, t/h) are
 * handled once at the compute orchestrator level — never inside these
 * formulae, so audit against any CEMA worked example is a straight
 * side-by-side comparison.
 *
 * Formula references (CEMA 7, chapter 6):
 *   Tx  = L · Kt · Kx
 *   Tyc = L · Ky · Wb · Kt
 *   Tyr = L · 0.015 · Wb · Kt
 *   Tym = L · Ky · Wm
 *   Tm  = H · Wm
 *   Tb  = H · Wb        (used in T2 sag derivation)
 *   Tp  = Σ(wrap × bearing multiplier)   or manual
 *   Tam = 0.00028755 · Q · (V − Vo)
 *   Tbc = 5 · blades · belt width (in)
 *   Tpl = (5 · full + 3 · partial) · belt width (in)
 *   Tsb = Lb · ( Cs · hs² + 6 if rubber edging )
 */

import { V_RETURN_AI_MULTIPLIER, type IdlerFamily } from './tables/ai';

// ─── Kx (idler friction) ─────────────────────────────────────────────────────

export interface KxInput {
  /** Ai value from idler family, lbf. */
  readonly ai: number;
  /** True when idlers are two-roll V-return (adds 5 % to Ai). */
  readonly twoRollVReturn: boolean;
  /** Belt weight per foot, lb/ft. */
  readonly beltWeightLbFt: number;
  /** Material weight per foot, lb/ft. */
  readonly materialWeightLbFt: number;
  /** Idler spacing (carrying side), ft. */
  readonly idlerSpacingFt: number;
}

export interface KxResult {
  readonly aiAdjusted: number;
  readonly kxLbFt2: number;
}

/**
 * Kx = (0.00068 · (Wb + Wm) + Ai) / Si     [lb/ft²]
 * with a +5 % Ai bump when two-roll V-return idlers are specified.
 */
export const computeKx = (input: KxInput): KxResult => {
  const aiAdjusted = input.twoRollVReturn
    ? input.ai * V_RETURN_AI_MULTIPLIER
    : input.ai;
  const kx =
    input.idlerSpacingFt > 0
      ? (0.00068 * (input.beltWeightLbFt + input.materialWeightLbFt) + aiAdjusted) /
        input.idlerSpacingFt
      : NaN;
  return { aiAdjusted, kxLbFt2: kx };
};

export const kxFromIdlerFamily = (
  family: IdlerFamily,
  twoRollVReturn: boolean,
  beltWeightLbFt: number,
  materialWeightLbFt: number,
  idlerSpacingFt: number,
): KxResult =>
  computeKx({
    ai: family.ai,
    twoRollVReturn,
    beltWeightLbFt,
    materialWeightLbFt,
    idlerSpacingFt,
  });

// ─── Individual tension components ───────────────────────────────────────────

export const txLbf = (lengthFt: number, kt: number, kxLbFt2: number): number =>
  lengthFt * kt * kxLbFt2;

export const tycLbf = (
  lengthFt: number,
  ky: number,
  beltWeightLbFt: number,
  kt: number,
): number => lengthFt * ky * beltWeightLbFt * kt;

/** Tyr uses a fixed 0.015 coefficient for return-side belt flexure. */
export const tyrLbf = (
  lengthFt: number,
  beltWeightLbFt: number,
  kt: number,
): number => lengthFt * 0.015 * beltWeightLbFt * kt;

export const tymLbf = (
  lengthFt: number,
  ky: number,
  materialWeightLbFt: number,
): number => lengthFt * ky * materialWeightLbFt;

/** Lift (+) or lower (−) material. */
export const tmLbf = (liftFt: number, materialWeightLbFt: number): number =>
  liftFt * materialWeightLbFt;

/** Lift (+) or lower (−) belt — used in the T2 sag derivation. */
export const tbLbf = (liftFt: number, beltWeightLbFt: number): number =>
  liftFt * beltWeightLbFt;

// ─── Tp — pulley resistance (count method) ───────────────────────────────────

export interface TpInput {
  /** Tight-side pulleys in the 150°–240° wrap range. */
  readonly tightPulleys: number;
  /** Slack-side pulleys in the 150°–240° wrap range. */
  readonly slackPulleys: number;
  /** Other pulleys (< 150° wrap). */
  readonly otherPulleys: number;
  /** Plain bearings on pulley shafts → Tp × 2. */
  readonly plainBearings: boolean;
}

export const tpLbfCount = (input: TpInput): number => {
  const base =
    input.tightPulleys * 200 + input.slackPulleys * 150 + input.otherPulleys * 100;
  return input.plainBearings ? base * 2 : base;
};

// ─── Tam — acceleration of feed ──────────────────────────────────────────────

/** Tam = 0.00028755 · Q (short tph) · (V − Vo)  [lbf], with Q in short tph, V in fpm. */
export const tamLbf = (
  shortTph: number,
  vFpm: number,
  vEntryFpm: number,
): number => 0.00028755 * shortTph * (vFpm - vEntryFpm);

// ─── Accessories (cleaners, plows, skirtboards) ──────────────────────────────

export const tbcLbf = (blades: number, beltWidthIn: number): number =>
  blades * 5 * beltWidthIn;

export const tplLbf = (
  fullPlows: number,
  partialPlows: number,
  beltWidthIn: number,
): number => fullPlows * 5 * beltWidthIn + partialPlows * 3 * beltWidthIn;

/**
 * Tsb = Lb · ( Cs · hs² + 6_if_rubber )    [lbf]
 *     Lb: skirt length (ft)
 *     hs: material depth at skirt (in)
 */
export const tsbLbf = (
  skirtLengthFt: number,
  skirtDepthIn: number,
  csFactor: number,
  rubberEdging: boolean,
): number => {
  if (skirtLengthFt <= 0) return 0;
  return (
    skirtLengthFt *
    (csFactor * skirtDepthIn * skirtDepthIn + (rubberEdging ? 6 : 0))
  );
};

// ─── Material and belt linear loads ──────────────────────────────────────────

/**
 * Material weight per foot (lb/ft):
 *     Wm = Q (short tph) · 2000 / (60 · V)   [with V in fpm]
 */
export const materialWeightLbFt = (shortTph: number, vFpm: number): number =>
  vFpm > 0 ? (shortTph * 2000) / (60 * vFpm) : NaN;
