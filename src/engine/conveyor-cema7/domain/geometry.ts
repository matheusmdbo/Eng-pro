/**
 * Belt cross-section geometry
 *
 * The cross-section is modeled as three straight segments (side-wing /
 * centre / side-wing) for the carrying belt, topped by a material surface
 * defined by the surcharge angle (sloping down from the apex at the centre
 * line to the loaded shoulders). All lengths are in metres; angles in
 * radians internally.
 *
 * The loaded area is obtained by numerical integration; the solver then
 * finds the apex height that matches the required cross-section area from
 * the conveyor capacity and speed (`solveCrossSectionFill`).
 *
 * Nothing in this module touches the DOM — it is pure math, fully testable.
 */

import { clamp } from './constants';
import {
  edgeDistancePerSideM,
  interpolateAvailableAreaM2,
} from './tables/crossSection';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const integrateArea = (
  fn: (x: number) => number,
  xmin: number,
  xmax: number,
  steps = 600,
): number => {
  const dx = (xmax - xmin) / steps;
  let area = 0;
  for (let i = 0; i < steps; i += 1) {
    const x1 = xmin + i * dx;
    const x2 = x1 + dx;
    area += 0.5 * (fn(x1) + fn(x2)) * dx;
  }
  return area;
};

/** Heuristic centre-roll projected width as a fraction of belt width B. */
const BELT_SECTION_GEOMETRY_PRESETS: Readonly<Record<number, { centerFrac: number }>> = {
  0:  { centerFrac: 0.58 },
  15: { centerFrac: 0.61 },
  20: { centerFrac: 0.63 },
  30: { centerFrac: 0.65 },
  35: { centerFrac: 0.66 },
  45: { centerFrac: 0.69 },
};

const interpolateGeometryPreset = (troughAngleDeg: number): { centerFrac: number } => {
  const keys = Object.keys(BELT_SECTION_GEOMETRY_PRESETS)
    .map(Number)
    .sort((a, b) => a - b);
  const trough = clamp(troughAngleDeg, keys[0], keys[keys.length - 1]);
  let low = keys[0];
  let high = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (trough >= keys[i] && trough <= keys[i + 1]) {
      low = keys[i];
      high = keys[i + 1];
      break;
    }
  }
  const a = BELT_SECTION_GEOMETRY_PRESETS[low];
  const b = BELT_SECTION_GEOMETRY_PRESETS[high];
  if (high === low) return a;
  const t = (trough - low) / (high - low);
  return { centerFrac: a.centerFrac + t * (b.centerFrac - a.centerFrac) };
};

// ─── Geometry record ─────────────────────────────────────────────────────────

export interface BeltSectionGeometry {
  /** Belt width (m), guard-floored to 0.05 m. */
  readonly widthM: number;
  /** Trough angle λ (rad). */
  readonly troughRad: number;
  /** Edge-distance per side (m), per CEMA edge-allowance rule. */
  readonly edgeDistanceM: number;
  /** Half-width carrying material, i.e. (B/2 − edge) (m). */
  readonly usableHalfWidth: number;
  /** Half-length of the centre segment (m). */
  readonly centerHalf: number;
  /** Horizontal run of each side-wing (m). */
  readonly sideRun: number;
  /** Belt-edge height above the centre plane (m). */
  readonly edgeY: number;
  /** Belt profile y(x) — centre at x=0, positive outward. */
  readonly beltY: (x: number) => number;
}

export const beltSectionGeometry = (
  widthM: number,
  troughAngleDeg: number,
): BeltSectionGeometry => {
  const B = Math.max(widthM, 0.05);
  const lambda = clamp(troughAngleDeg, 0, 60) * (Math.PI / 180);
  const preset = interpolateGeometryPreset(troughAngleDeg);
  const edgeDistance = edgeDistancePerSideM(B);
  const usableHalfWidth = Math.max(B / 2 - edgeDistance, 0.001);
  const centerFrac = clamp(preset.centerFrac, 0.2, 0.85);
  const centerHalf = Math.min((B * centerFrac) / 2, usableHalfWidth * 0.95);
  const sideRun = Math.max(usableHalfWidth - centerHalf, 0.0001);
  const edgeY = sideRun * Math.tan(lambda);
  const beltY = (x: number): number => {
    const ax = Math.abs(x);
    if (ax <= centerHalf) return 0;
    return (ax - centerHalf) * Math.tan(lambda);
  };
  return {
    widthM: B,
    troughRad: lambda,
    edgeDistanceM: edgeDistance,
    usableHalfWidth,
    centerHalf,
    sideRun,
    edgeY,
    beltY,
  };
};

// ─── Cross-section fill solver ───────────────────────────────────────────────

const materialAreaForApexHeight = (
  geom: BeltSectionGeometry,
  surchargeAngleDeg: number,
  apexHeightM: number,
): number => {
  const phi = clamp(surchargeAngleDeg, 0.1, 80) * (Math.PI / 180);
  const tanPhi = Math.tan(phi);
  const ySurf = (x: number): number => apexHeightM - Math.abs(x) * tanPhi;
  const fn = (x: number): number => Math.max(0, ySurf(x) - geom.beltY(x));
  return integrateArea(fn, -geom.usableHalfWidth, geom.usableHalfWidth);
};

const loadedHalfWidthForApex = (
  geom: BeltSectionGeometry,
  surchargeAngleDeg: number,
  apexHeightM: number,
): number => {
  const phi = clamp(surchargeAngleDeg, 0.1, 80) * (Math.PI / 180);
  const tanPhi = Math.tan(phi);
  let lo = 0;
  let hi = geom.usableHalfWidth;
  const diff = (x: number): number =>
    apexHeightM - Math.abs(x) * tanPhi - geom.beltY(x);
  if (diff(lo) <= 0) return 0;
  if (diff(hi) > 0) return hi;
  for (let i = 0; i < 52; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (diff(mid) > 0) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
};

export interface FillModel {
  readonly geom: BeltSectionGeometry;
  readonly cemaAvailableAreaM2: number;
  readonly maxAreaM2: number;
  readonly occupiedAreaM2: number;
  readonly apexHeightM: number;
  readonly loadedHalfWidthM: number;
  readonly fillToAvailableRatio: number;
  readonly fillToMaxRatio: number;
  readonly edgeDistanceM: number;
  readonly totalEdgeClearanceM: number;
}

/**
 * Solve for the material apex height that yields the required loaded area.
 * Uses bisection on a normalised area curve so we honour both the geometric
 * maximum and the CEMA available-area cap.
 */
export const solveCrossSectionFill = (
  widthM: number,
  troughAngleDeg: number,
  surchargeAngleDeg: number,
  requiredAreaM2: number,
): FillModel => {
  const geom = beltSectionGeometry(widthM, troughAngleDeg);
  const phiDeg = clamp(surchargeAngleDeg, 0.1, 80);
  const cemaAvailableAreaM2 = interpolateAvailableAreaM2(widthM, troughAngleDeg, phiDeg);
  // The classical CEMA "available" corresponds to ~70 % of the geometric max.
  // See CEMA 7 chapter 4 loading-factor discussion.
  const maxAreaM2 = cemaAvailableAreaM2 / 0.7;
  const maxApexHeight =
    geom.edgeY + geom.usableHalfWidth * Math.tan(phiDeg * (Math.PI / 180));

  const targetArea = Math.max(requiredAreaM2 || 0, 0);
  let apexHeight = maxApexHeight;

  if (targetArea > 0 && targetArea < maxAreaM2) {
    let lo = 0;
    let hi = maxApexHeight;
    const areaAtMax = materialAreaForApexHeight(geom, phiDeg, maxApexHeight);
    for (let i = 0; i < 56; i += 1) {
      const mid = 0.5 * (lo + hi);
      const midArea =
        areaAtMax > 0
          ? (materialAreaForApexHeight(geom, phiDeg, mid) / areaAtMax) * maxAreaM2
          : 0;
      if (midArea < targetArea) lo = mid;
      else hi = mid;
    }
    apexHeight = 0.5 * (lo + hi);
  } else if (targetArea >= maxAreaM2) {
    apexHeight = maxApexHeight;
  } else {
    apexHeight = 0;
  }

  const occupiedAreaM2 = Math.min(targetArea, maxAreaM2);
  const loadedHalfWidth = loadedHalfWidthForApex(geom, phiDeg, apexHeight);

  return {
    geom,
    cemaAvailableAreaM2,
    maxAreaM2,
    occupiedAreaM2,
    apexHeightM: apexHeight,
    loadedHalfWidthM: loadedHalfWidth,
    fillToAvailableRatio: cemaAvailableAreaM2 > 0 ? occupiedAreaM2 / cemaAvailableAreaM2 : NaN,
    fillToMaxRatio: maxAreaM2 > 0 ? occupiedAreaM2 / maxAreaM2 : NaN,
    edgeDistanceM: geom.edgeDistanceM,
    totalEdgeClearanceM: 2 * geom.edgeDistanceM,
  };
};

/** Material cross-section area required for throughput Q, density ρ and speed v. */
export const requiredLiveAreaM2 = (
  capacityTph: number,
  bulkDensityTm3: number,
  beltSpeedMps: number,
): number => {
  if (bulkDensityTm3 <= 0 || beltSpeedMps <= 0) return NaN;
  return capacityTph / 3600 / (bulkDensityTm3 * beltSpeedMps);
};
