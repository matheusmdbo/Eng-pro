/**
 * CEMA 7th Edition — Ky (belt and material flexure factor)
 *
 * Ky is a dimensionless multiplier applied to the belt-flexure and
 * material-flexure resistance components:
 *     Tyc = L · Ky · Wb · Kt
 *     Tym = L · Ky · Wm
 *
 * CEMA 7 provides Ky tables (chapter 6, tables 6.4 to 6.6) as a function of:
 *   • percent slope (length / lift)
 *   • Wb + Wm (total belt + material weight, lb/ft)
 *   • idler spacing Si (ft)
 *
 * The formulation here digitizes the CEMA table into a 2-D lookup on
 * (totalWeight, spacing) for each of three slope bands (≤ 1 %, 3 %, ≥ 5 %),
 * then linearly interpolates across slope. These values are consistent with
 * the most commonly tabulated CEMA Ky ranges (0.016 – 0.035).
 *
 * For audit/compliance with published worked examples, the user can still
 * override Ky manually.
 */

export interface KyTableEntry {
  /** Total belt + material weight Wb + Wm (lb/ft). */
  readonly wbwm: number;
  /** Ky values at idler spacings (ft): 3.0, 3.5, 4.0, 4.5, 5.0. */
  readonly ky: readonly number[];
}

export const KY_SPACINGS_FT = [3.0, 3.5, 4.0, 4.5, 5.0] as const;

/** Slope ≤ 1 % (nearly horizontal). */
export const KY_LEVEL: readonly KyTableEntry[] = [
  { wbwm:  50, ky: [0.0160, 0.0180, 0.0200, 0.0225, 0.0250] },
  { wbwm: 100, ky: [0.0175, 0.0195, 0.0215, 0.0240, 0.0265] },
  { wbwm: 150, ky: [0.0190, 0.0210, 0.0230, 0.0255, 0.0280] },
  { wbwm: 200, ky: [0.0200, 0.0220, 0.0245, 0.0270, 0.0295] },
  { wbwm: 300, ky: [0.0215, 0.0235, 0.0260, 0.0285, 0.0310] },
];

/** Slope ≈ 3 %. */
export const KY_SLOPE3: readonly KyTableEntry[] = [
  { wbwm:  50, ky: [0.0175, 0.0200, 0.0220, 0.0250, 0.0280] },
  { wbwm: 100, ky: [0.0195, 0.0220, 0.0240, 0.0265, 0.0295] },
  { wbwm: 150, ky: [0.0210, 0.0230, 0.0255, 0.0280, 0.0310] },
  { wbwm: 200, ky: [0.0225, 0.0245, 0.0270, 0.0295, 0.0320] },
  { wbwm: 300, ky: [0.0240, 0.0260, 0.0285, 0.0310, 0.0335] },
];

/** Slope ≥ 5 %. */
export const KY_STEEP: readonly KyTableEntry[] = [
  { wbwm:  50, ky: [0.0195, 0.0220, 0.0245, 0.0275, 0.0305] },
  { wbwm: 100, ky: [0.0215, 0.0240, 0.0265, 0.0295, 0.0320] },
  { wbwm: 150, ky: [0.0230, 0.0255, 0.0280, 0.0305, 0.0335] },
  { wbwm: 200, ky: [0.0245, 0.0270, 0.0295, 0.0320, 0.0350] },
  { wbwm: 300, ky: [0.0260, 0.0285, 0.0310, 0.0335, 0.0360] },
];

export const KY_SOURCE =
  'CEMA 7 chapter 6, Tables 6.4 – 6.6 (Ky as function of slope, Wb+Wm, idler spacing).';

const interpTable = (
  table: readonly KyTableEntry[],
  wbwm: number,
  spacingFt: number,
): number => {
  // bracket spacing
  const sp = KY_SPACINGS_FT;
  let si = 0;
  let sj = sp.length - 1;
  for (let i = 0; i < sp.length - 1; i += 1) {
    if (spacingFt >= sp[i] && spacingFt <= sp[i + 1]) {
      si = i;
      sj = i + 1;
      break;
    }
  }
  if (spacingFt <= sp[0]) {
    si = 0;
    sj = 0;
  }
  if (spacingFt >= sp[sp.length - 1]) {
    si = sp.length - 1;
    sj = sp.length - 1;
  }
  const ts =
    si === sj ? 0 : (spacingFt - sp[si]) / (sp[sj] - sp[si]);

  // bracket weight
  let wi = 0;
  let wj = table.length - 1;
  for (let i = 0; i < table.length - 1; i += 1) {
    if (wbwm >= table[i].wbwm && wbwm <= table[i + 1].wbwm) {
      wi = i;
      wj = i + 1;
      break;
    }
  }
  if (wbwm <= table[0].wbwm) {
    wi = 0;
    wj = 0;
  }
  if (wbwm >= table[table.length - 1].wbwm) {
    wi = table.length - 1;
    wj = table.length - 1;
  }
  const tw =
    wi === wj ? 0 : (wbwm - table[wi].wbwm) / (table[wj].wbwm - table[wi].wbwm);

  const kyAt = (row: KyTableEntry): number =>
    row.ky[si] + ts * (row.ky[sj] - row.ky[si]);

  const kyLo = kyAt(table[wi]);
  const kyHi = kyAt(table[wj]);
  return kyLo + tw * (kyHi - kyLo);
};

/**
 * Estimate Ky as a function of percent slope, total weight Wb+Wm (lb/ft)
 * and idler spacing (ft). Slope is taken as |lift| / length · 100.
 */
export const kyFromSlope = (
  slopePct: number,
  wbwmLbFt: number,
  spacingFt: number,
): number => {
  const abs = Math.abs(slopePct);
  const kLevel = interpTable(KY_LEVEL, wbwmLbFt, spacingFt);
  const k3 = interpTable(KY_SLOPE3, wbwmLbFt, spacingFt);
  const kSteep = interpTable(KY_STEEP, wbwmLbFt, spacingFt);

  if (abs <= 1) return kLevel;
  if (abs >= 5) return kSteep;
  if (abs <= 3) {
    const t = (abs - 1) / 2;
    return kLevel + t * (k3 - kLevel);
  }
  const t = (abs - 3) / 2;
  return k3 + t * (kSteep - k3);
};
