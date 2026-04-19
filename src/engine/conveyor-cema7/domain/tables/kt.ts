/**
 * CEMA 7th Edition — Kt (temperature correction factor)
 *
 * Kt multiplies the idler / belt flexure resistance components (Tx, Tyc, Tyr)
 * to account for increased seal friction and belt stiffness at low ambient
 * temperatures. The curve is dimensionless and equals 1.0 at standard
 * conditions.
 *
 * Source: CEMA 7 — Temperature correction curve (Figure in chapter 6).
 * The nominal breakpoints below follow the published curve; interpolate
 * linearly between adjacent entries.
 */

export interface KtPoint {
  readonly tempF: number;
  readonly kt: number;
}

/**
 * Table values digitized from the CEMA Kt curve.
 * T ≥ +60 °F → Kt = 1.00 (flat).
 * Below +60 °F, Kt rises steeply.
 */
export const KT_CURVE: readonly KtPoint[] = [
  { tempF: -40, kt: 1.65 },
  { tempF: -30, kt: 1.55 },
  { tempF: -20, kt: 1.45 },
  { tempF: -10, kt: 1.35 },
  { tempF:   0, kt: 1.27 },
  { tempF:  10, kt: 1.20 },
  { tempF:  20, kt: 1.14 },
  { tempF:  30, kt: 1.09 },
  { tempF:  40, kt: 1.05 },
  { tempF:  50, kt: 1.02 },
  { tempF:  60, kt: 1.00 },
  { tempF: 120, kt: 1.00 },
];

export const KT_SOURCE = 'CEMA 7 — Kt Temperature Correction Factor curve';

const cToF = (c: number): number => (c * 9) / 5 + 32;

/**
 * Interpolate Kt from ambient temperature.
 * Accepts Celsius by default; pass `{ unit: 'F' }` for Fahrenheit.
 */
export const ktFromTemp = (
  ambient: number,
  opts: { unit?: 'C' | 'F' } = {},
): number => {
  const tF = (opts.unit ?? 'C') === 'F' ? ambient : cToF(ambient);
  const curve = KT_CURVE;
  if (tF <= curve[0].tempF) return curve[0].kt;
  if (tF >= curve[curve.length - 1].tempF) return curve[curve.length - 1].kt;
  for (let i = 0; i < curve.length - 1; i += 1) {
    const a = curve[i];
    const b = curve[i + 1];
    if (tF >= a.tempF && tF <= b.tempF) {
      const t = (tF - a.tempF) / (b.tempF - a.tempF);
      return a.kt + t * (b.kt - a.kt);
    }
  }
  return 1.0;
};
