/**
 * Tension profile along the conveyor station and vertical-curve checks
 *
 * The local tension is interpolated linearly from T2 at the tail to T1 at
 * the drive (single head-drive). Each profile node between segments is
 * checked against the CEMA vertical-curve criteria:
 *
 *   • Concave curves:
 *       R11 — lift-off prevention (belt stiffness vs. tension)
 *       R12 — bending tension at belt edges
 *       R13 — acceleration of belt mass
 *
 *   • Convex curves:
 *       R21 — edge-stress limit
 *       R22 — buckle limit (min centre tension)
 *       R23 — practical idler-angle rule: R ≥ 114 · idler spacing
 *
 * The formulas below use:
 *     Tlocal        — local tension at curve (kN)
 *     E             — belt modulus (kN/m)
 *     tr            — rated belt tension (kN/m)
 *     tmin          — minimum centre tension (kN/m)
 *     B             — belt width (m)
 *     α             — trough angle (rad)
 *     Wm+Wb         — total load (kg/m)
 */

import { clamp } from './constants';

export interface ProfileNode {
  readonly id: string;
  readonly station: number;   // m
  readonly elev: number;      // m
  readonly curveLengthM: number; // m, for the vertical curve at this node
}

export interface ProfileMarker {
  readonly id: string;
  readonly label: string;
  readonly type: 'drive' | 'tail' | 'takeup' | 'return' | 'feed' | 'custom';
  readonly station: number;
}

export interface ProfileSegment {
  readonly start: ProfileNode;
  readonly end: ProfileNode;
  readonly lengthM: number;
  readonly riseM: number;
  readonly angleRad: number;
}

export interface VerticalCurveCheck {
  readonly nodeId: string;
  readonly station: number;
  readonly kind: 'concave' | 'convex';
  readonly deltaRad: number;
  readonly curveLengthM: number;
  readonly actualR: number;
  readonly requiredR: number;
  readonly marginPct: number;
  readonly fitsWithinSegments: boolean;
  readonly localTensionKN: number;
  readonly constraints: Readonly<Record<string, number>>;
}

export interface TensionProfileInput {
  readonly nodes: readonly ProfileNode[];
  readonly markers: readonly ProfileMarker[];
  readonly t1Lbf: number;
  readonly t2Lbf: number;
  readonly teLbf: number;
  readonly beltWidthM: number;
  readonly troughAngleDeg: number;
  readonly beltModulusKNpm: number;
  readonly beltRatedTensionKNpm: number;
  readonly minBuckleTensionKNpm: number;
  readonly autoCurveShare: number;
  readonly beltWeightKgPm: number;
  readonly materialWeightKgPm: number;
}

export interface TensionProfileResult {
  readonly segments: readonly ProfileSegment[];
  readonly totalLengthM: number;
  readonly drivePos: number;
  readonly curves: readonly VerticalCurveCheck[];
  readonly tensionAtStationKN: (station: number) => number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const lbfToKn = (lbf: number): number => (lbf * 4.4482216152605) / 1000;

export const interpolateProfileElevation = (
  nodes: readonly ProfileNode[],
  station: number,
): number => {
  if (nodes.length === 0) return 0;
  const s = clamp(station, nodes[0].station, nodes[nodes.length - 1].station);
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (s >= a.station && s <= b.station) {
      const span = Math.max(b.station - a.station, 1e-6);
      const t = (s - a.station) / span;
      return a.elev + t * (b.elev - a.elev);
    }
  }
  return nodes[nodes.length - 1].elev;
};

// ─── Profile analysis ────────────────────────────────────────────────────────

export const computeTensionProfile = (
  input: TensionProfileInput,
): TensionProfileResult => {
  const nodes = input.nodes;
  const totalLen = nodes[nodes.length - 1].station;
  const driveMarker =
    input.markers.find((m) => m.type === 'drive') ?? {
      station: totalLen,
      id: 'auto-drive',
      label: 'Drive',
      type: 'drive' as const,
    };
  const drivePos = clamp(driveMarker.station, 1e-6, totalLen || 1);

  const absTe = Math.abs(input.teLbf);
  const tensionAtStationLbf = (station: number): number => {
    const x = clamp(station, 0, totalLen);
    const t =
      input.t2Lbf + ((Math.abs(drivePos - x)) / Math.max(drivePos, 1e-6)) * absTe * (x <= drivePos ? 1 : -1) * -1;
    // Classical interpretation: linear rise from T2 (tail) to T1 (drive),
    // then decrease back to T2 on the return side — for single head-drive.
    const rising = (input.t1Lbf - input.t2Lbf) * (x / Math.max(drivePos, 1e-6));
    return Math.max(0, input.t2Lbf + rising * (x <= drivePos ? 1 : 0));
  };

  const tensionAtStationKN = (station: number): number =>
    lbfToKn(tensionAtStationLbf(station));

  // Segments
  const segments: ProfileSegment[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const ds = b.station - a.station;
    const de = b.elev - a.elev;
    segments.push({
      start: a,
      end: b,
      lengthM: Math.hypot(ds, de),
      riseM: de,
      angleRad: Math.atan2(de, Math.max(ds, 1e-6)),
    });
  }

  // Vertical curves at each interior node
  const autoShare = clamp(input.autoCurveShare, 0.05, 0.8);
  const widthM = Math.max(input.beltWidthM, 0.1);
  const alpha = (input.troughAngleDeg * Math.PI) / 180;
  const E = Math.max(input.beltModulusKNpm, 0);
  const tr = Math.max(input.beltRatedTensionKNpm, 0.0001);
  const tmin = Math.max(input.minBuckleTensionKNpm, 0);
  const wmTotalKgPm = input.beltWeightKgPm + input.materialWeightKgPm;

  const curves: VerticalCurveCheck[] = [];
  for (let i = 1; i < nodes.length - 1; i += 1) {
    const prev = segments[i - 1];
    const next = segments[i];
    const delta = next.angleRad - prev.angleRad;
    if (Math.abs(delta) < 1e-6) continue;
    const kind: 'concave' | 'convex' = delta > 0 ? 'concave' : 'convex';
    const deltaAbs = Math.abs(delta);
    const node = nodes[i];
    const suggestedLc = autoShare * Math.min(prev.lengthM, next.lengthM);
    const curveLengthM = Math.max(node.curveLengthM || suggestedLc, 0.5);
    const actualR = curveLengthM / Math.max(deltaAbs, 1e-6);
    const setback = actualR * Math.tan(deltaAbs / 2);
    const startStation = node.station - setback;
    const endStation = node.station + setback;
    const fits =
      startStation >= prev.start.station && endStation <= next.end.station;

    const localTensionKN = tensionAtStationKN(node.station);
    const localWidthTension = localTensionKN / widthM; // kN/m

    const req: Record<string, number> = {};

    if (kind === 'concave') {
      // R11 — lift-off: R ≥ (Wb+Wm)·g·L / Tlocal with L = idler pitch (use curveLengthM)
      // Classical CEMA approximation (dimensional):
      const gravityLoadKnPm = (wmTotalKgPm * 9.80665) / 1000;
      req.R11_liftoff =
        localWidthTension > 0
          ? (gravityLoadKnPm * curveLengthM) / localWidthTension
          : Infinity;

      // R12 — edge bending: proportional to E/tr and belt width
      req.R12_edgeBending = E > 0 ? (0.5 * E * widthM) / tr : 0;

      // R13 — acceleration of belt mass
      req.R13_accel =
        wmTotalKgPm > 0
          ? (wmTotalKgPm * 9.80665 * widthM) / (localWidthTension * 1000 + 1e-9)
          : 0;
    } else {
      // R21 — edge-stress limit at convex curve
      req.R21_edgeStress =
        tr > 0
          ? (E * widthM * Math.sin(alpha)) / Math.max(tr - localWidthTension, 1e-6)
          : 0;

      // R22 — minimum-centre (buckle) tension
      req.R22_buckle =
        tmin > 0
          ? (E * widthM) / Math.max(tmin, 1e-6) * 0.01
          : 0;

      // R23 — practical idler-angle rule (CEMA): R ≥ 114 · idler spacing (ft).
      // Here we express it in metres using a nominal 1 m spacing when
      // `curveLengthM` is small, just to keep a sane lower bound.
      req.R23_idlerAngle = 114 * 0.3048 * 1.0;
    }

    const positiveReq = Object.values(req).filter(
      (v) => Number.isFinite(v) && v > 0,
    );
    const requiredR = positiveReq.length ? Math.max(...positiveReq) : NaN;
    const marginPct = Number.isFinite(requiredR)
      ? ((actualR - requiredR) / requiredR) * 100
      : NaN;

    curves.push({
      nodeId: node.id,
      station: node.station,
      kind,
      deltaRad: delta,
      curveLengthM,
      actualR,
      requiredR,
      marginPct,
      fitsWithinSegments: fits,
      localTensionKN,
      constraints: req,
    });
  }

  return {
    segments,
    totalLengthM: totalLen,
    drivePos,
    curves,
    tensionAtStationKN,
  };
};
