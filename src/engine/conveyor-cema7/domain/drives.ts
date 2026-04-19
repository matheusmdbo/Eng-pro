/**
 * Drive sizing — T1/T2, traction check, counterweight, and Cw calculation
 *
 * CEMA 7 gives:
 *     T2_slip ≥ |Te| · Cw
 * where Cw depends on the drive wrap angle θ and the lagging friction
 * coefficient μ via
 *     Cw = 1 / ( e^(μ·θ) − 1 )
 *
 * The T2 sag criterion is
 *     T2_sag ≥ Kw · Si · ( Wb + Wm )
 * with Kw = 8.4 / 6.25 / 4.2 for 1.5 % / 2 % / 3 % sag respectively (CEMA 7).
 *
 * T0 (the sag tension at the tail, unloaded return) is included in T2 via
 *     T2_sag = max( 0, T0 + Tb − Tyr )
 */

// ─── Cw from μ and wrap angle ────────────────────────────────────────────────

export const cwFromMuTheta = (mu: number, wrapAngleDeg: number): number => {
  const theta = (wrapAngleDeg * Math.PI) / 180;
  const denom = Math.exp(Math.max(mu, 0) * theta) - 1;
  if (denom <= 0) return Infinity;
  return 1 / denom;
};

// ─── T2 sag tension constant (Kw) ────────────────────────────────────────────

export const sagFactor = (sagPercent: number): number => {
  const p = Number(sagPercent);
  if (Math.abs(p - 1.5) < 1e-9) return 8.4;
  if (Math.abs(p - 2) < 1e-9) return 6.25;
  return 4.2; // 3 % default
};

// ─── Drive configuration ────────────────────────────────────────────────────

export type DriveConfig =
  /** Classical single head-end drive. */
  | 'singleHead'
  /** Single tail drive (decline). */
  | 'singleTail'
  /** Dual drive — head + tail, power split per `dualDriveHeadShare`. */
  | 'dualHeadTail'
  /** Single intermediate booster drive (treated as single-head for T1/T2 here). */
  | 'intermediate';

export interface DriveInput {
  readonly config: DriveConfig;
  /** Effective tension Te (lbf). Negative values are regenerative. */
  readonly teLbf: number;
  /** Wrap factor Cw (dimensionless). */
  readonly cw: number;
  /** Sag percent — 1.5 | 2 | 3. */
  readonly sagPercent: number;
  /** Idler spacing (ft, carrying side). */
  readonly idlerSpacingFt: number;
  /** Belt weight (lb/ft). */
  readonly beltWeightLbFt: number;
  /** Material weight (lb/ft). */
  readonly materialWeightLbFt: number;
  /** Tb = H · Wb (lbf). */
  readonly tbLbf: number;
  /** Tyr = L · 0.015 · Wb · Kt (lbf). */
  readonly tyrLbf: number;
  /**
   * Share of Te carried by the head drive when `config === 'dualHeadTail'`.
   * Typical values: 0.60 – 0.80. Ignored otherwise.
   */
  readonly dualDriveHeadShare?: number;
}

export interface DriveResult {
  readonly t0Lbf: number;
  readonly t2SlipLbf: number;
  readonly t2SagLbf: number;
  readonly t2Lbf: number;
  readonly t1Lbf: number;
  readonly governingSource: 'Slip' | 'Sag';
  readonly counterweightLbf: number;
  readonly dutyMode: 'Motoring' | 'Regenerative';
  readonly headTeLbf: number;
  readonly tailTeLbf: number;
  /**
   * Minimum tension in the belt (informational). For a single head drive this
   * is T2. For dual-drive arrangements the minimum may occur between drives.
   */
  readonly tMinLbf: number;
}

export const computeDrive = (input: DriveInput): DriveResult => {
  const kw = sagFactor(input.sagPercent);
  const t0 =
    kw *
    input.idlerSpacingFt *
    (input.beltWeightLbFt + input.materialWeightLbFt);

  const absTe = Math.abs(input.teLbf);
  const t2Slip = absTe * input.cw;
  const t2Sag = Math.max(0, t0 + input.tbLbf - input.tyrLbf);
  const governingSource: 'Slip' | 'Sag' = t2Sag >= t2Slip ? 'Sag' : 'Slip';
  const t2 = Math.max(t2Slip, t2Sag, 0);
  const t1 = absTe + t2;
  const counterweight = 2 * t2;
  const dutyMode: 'Motoring' | 'Regenerative' =
    input.teLbf >= 0 ? 'Motoring' : 'Regenerative';

  let headTe = input.teLbf;
  let tailTe = 0;
  let tMin = t2;

  if (input.config === 'dualHeadTail') {
    const share = Math.min(
      Math.max(input.dualDriveHeadShare ?? 0.67, 0.1),
      0.9,
    );
    headTe = input.teLbf * share;
    tailTe = input.teLbf * (1 - share);
    // With power taken at both ends, the tension between drives may dip
    // below T2 of either end; flag an approximate minimum for reporting.
    tMin = Math.max(0, t2 - Math.abs(tailTe) * 0.5);
  } else if (input.config === 'singleTail') {
    headTe = 0;
    tailTe = input.teLbf;
  }

  return {
    t0Lbf: t0,
    t2SlipLbf: t2Slip,
    t2SagLbf: t2Sag,
    t2Lbf: t2,
    t1Lbf: t1,
    governingSource,
    counterweightLbf: counterweight,
    dutyMode,
    headTeLbf: headTe,
    tailTeLbf: tailTe,
    tMinLbf: tMin,
  };
};
