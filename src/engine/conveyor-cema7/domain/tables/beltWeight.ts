/**
 * CEMA 7th Edition — Average belt weight estimates (lb/ft)
 *
 * Source: CEMA 7 Table 6.1 (historical guidance). Three load ranges are given
 * versus standard belt width. Values are in lb/ft; convert with
 * `kgpmToLbft`/`lbftToKgpm` as needed.
 *
 * The steel-cord adjustment (+50 %) is the classical carry-over used when a
 * steel-cord belt is specified without a vendor catalog weight.
 */

export interface BeltWeightTable {
  readonly widthsIn: readonly number[];
  readonly low: readonly number[];
  readonly medium: readonly number[];
  readonly high: readonly number[];
  readonly source: string;
}

export const BELT_WEIGHT_TABLE: BeltWeightTable = {
  widthsIn: [18, 24, 30, 36, 42, 48, 54, 60, 72, 84, 96],
  low:    [3.5, 4.5, 6.0,  9.0, 11.0, 14.0, 16.0, 18.0, 21.0, 25.0, 30.0],
  medium: [4.0, 5.5, 7.0, 10.0, 12.0, 15.0, 17.0, 20.0, 24.0, 30.0, 35.0],
  high:   [4.5, 6.0, 8.0, 12.0, 14.0, 17.0, 19.0, 22.0, 26.0, 33.0, 38.0],
  source: 'CEMA 7 Table 6.1 (Average Belt Weight, Multiple- and Reduced-Ply Belts)',
};

export const STEEL_CORD_MULTIPLIER = 1.5;

/** Bulk-density (t/m³) breakpoints for low / medium / high carry-over. */
const DENSITY_LOW_HIGH_TM3 = [1.2, 2.0] as const;

const nearestIndex = (widthIn: number): number => {
  const widths = BELT_WEIGHT_TABLE.widthsIn;
  let bestIndex = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < widths.length; i += 1) {
    const d = Math.abs(widths[i] - widthIn);
    if (d < bestDelta) {
      bestDelta = d;
      bestIndex = i;
    }
  }
  return bestIndex;
};

/**
 * Estimate belt weight (lb/ft and kg/m) for a given belt width and bulk
 * density, using the CEMA 7 Table 6.1 average values. Adds a +50 % factor
 * when `steelCord = true`.
 */
export const estimateBeltWeight = (
  widthMm: number,
  bulkDensityTm3: number,
  steelCord: boolean,
): { lbft: number; kgpm: number; basis: string } => {
  const widthIn = widthMm / 25.4;
  const idx = nearestIndex(widthIn);

  let series: readonly number[] = BELT_WEIGHT_TABLE.low;
  let basis = 'Light duty (ρ < 1.2 t/m³)';
  if (bulkDensityTm3 >= DENSITY_LOW_HIGH_TM3[1]) {
    series = BELT_WEIGHT_TABLE.high;
    basis = 'Heavy duty (ρ ≥ 2.0 t/m³)';
  } else if (bulkDensityTm3 >= DENSITY_LOW_HIGH_TM3[0]) {
    series = BELT_WEIGHT_TABLE.medium;
    basis = 'Medium duty (1.2 ≤ ρ < 2.0 t/m³)';
  }

  let value = series[idx];
  if (steelCord) {
    value *= STEEL_CORD_MULTIPLIER;
    basis = `${basis} · steel-cord +50 %`;
  }

  // kg/m ← lb/ft using the reciprocal of LBFT_PER_KGPM.
  const kgpm = value * (3.280839895013123 / 2.204622621848776);
  return { lbft: value, kgpm, basis };
};
