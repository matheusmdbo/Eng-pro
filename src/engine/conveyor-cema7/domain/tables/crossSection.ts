/**
 * CEMA 7th Edition — Available belt cross-section area (m²)
 *
 * Source: CEMA 7 chapter 4 (Belt Load). The engineering "available area" is
 * CEMA's usable cross-section at 20° surcharge angle, assuming the standard
 * edge-distance allowance (0.05·B + 25 mm per side). Values here are
 * digitized from the published chart for common belt widths at the four
 * standard trough angles (0°, 15°, 35°, 45°).
 *
 * For surcharge angles other than 20°, a small linear correction is applied
 * (see `surchargeCorrection`). The geometric model in `geometry.ts` is
 * preferred for design intent; this table is kept for:
 *   (a) validation against CEMA capacity charts,
 *   (b) a conservative fallback, and
 *   (c) presenting the "CEMA available" value side-by-side with the
 *       geometric value in the UI.
 */

/** Indexed by trough angle, then by width in inches. */
export const CEMA_AVAILABLE_AREA_M2_20_SURCHARGE: Readonly<
  Record<number, Readonly<Record<number, number>>>
> = {
  0: {
    18: 0.0097, 24: 0.0180, 30: 0.0290, 36: 0.0426, 42: 0.0587,
    48: 0.0774, 54: 0.0987, 60: 0.1226, 72: 0.1781, 84: 0.2439,
    96: 0.3202,
  },
  15: {
    18: 0.0178, 24: 0.0329, 30: 0.0531, 36: 0.0780, 42: 0.1075,
    48: 0.1418, 54: 0.1808, 60: 0.2245, 72: 0.3263, 84: 0.4468,
    96: 0.5868,
  },
  35: {
    18: 0.0279, 24: 0.0516, 30: 0.0833, 36: 0.1223, 42: 0.1686,
    48: 0.2224, 54: 0.2836, 60: 0.3522, 72: 0.5119, 84: 0.7010,
    96: 0.9204,
  },
  45: {
    18: 0.0310, 24: 0.0574, 30: 0.0925, 36: 0.1358, 42: 0.1871,
    48: 0.2468, 54: 0.3147, 60: 0.3906, 72: 0.5681, 84: 0.7776,
    96: 1.0214,
  },
};

export const AREA_TABLE_SOURCE =
  'CEMA 7 chapter 4 — Belt conveyor capacity at 20° surcharge (standard edge allowance).';

/**
 * Edge-distance per side (m) for the standard CEMA edge allowance:
 *     edge = 0.05·B + 25 mm per side
 * where B is belt width in metres. Returns metres.
 */
export const edgeDistancePerSideM = (widthM: number): number =>
  0.05 * widthM + 0.025;

const interpolateSeriesValue = (
  series: Readonly<Record<number, number>>,
  widthIn: number,
): number => {
  const keys = Object.keys(series)
    .map(Number)
    .sort((a, b) => a - b);
  if (widthIn <= keys[0]) return series[keys[0]];
  if (widthIn >= keys[keys.length - 1]) {
    const k0 = keys[keys.length - 2];
    const k1 = keys[keys.length - 1];
    const y0 = series[k0];
    const y1 = series[k1];
    return y1 + ((widthIn - k1) / (k1 - k0)) * (y1 - y0);
  }
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k0 = keys[i];
    const k1 = keys[i + 1];
    if (widthIn >= k0 && widthIn <= k1) {
      const y0 = series[k0];
      const y1 = series[k1];
      return y0 + ((widthIn - k0) / (k1 - k0)) * (y1 - y0);
    }
  }
  return series[keys[0]];
};

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Interpolate the CEMA available area (m²) for any belt width (m),
 * trough angle (°) and surcharge angle (°). Uses a linear correction on
 * surcharge in the range 10°–30° anchored at 20° → 1.00.
 */
export const interpolateAvailableAreaM2 = (
  widthM: number,
  troughAngleDeg: number,
  surchargeAngleDeg: number,
): number => {
  const widthIn = widthM / 0.0254;
  const troughKeys = Object.keys(CEMA_AVAILABLE_AREA_M2_20_SURCHARGE)
    .map(Number)
    .sort((a, b) => a - b);
  const trough = clampNumber(
    troughAngleDeg,
    troughKeys[0],
    troughKeys[troughKeys.length - 1],
  );
  let low = troughKeys[0];
  let high = troughKeys[troughKeys.length - 1];
  for (let i = 0; i < troughKeys.length - 1; i += 1) {
    if (trough >= troughKeys[i] && trough <= troughKeys[i + 1]) {
      low = troughKeys[i];
      high = troughKeys[i + 1];
      break;
    }
  }
  const areaLow = interpolateSeriesValue(
    CEMA_AVAILABLE_AREA_M2_20_SURCHARGE[low],
    widthIn,
  );
  const areaHigh = interpolateSeriesValue(
    CEMA_AVAILABLE_AREA_M2_20_SURCHARGE[high],
    widthIn,
  );
  const troughArea =
    high === low
      ? areaLow
      : areaLow + ((trough - low) / (high - low)) * (areaHigh - areaLow);
  const surchargeCorrection = clampNumber(
    1 + 0.004 * (surchargeAngleDeg - 20),
    0.88,
    1.16,
  );
  return troughArea * surchargeCorrection;
};
