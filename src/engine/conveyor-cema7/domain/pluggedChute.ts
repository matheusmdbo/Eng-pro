/**
 * Supplemental plugged-chute resistance
 *
 * Two engineering methods are supported:
 *   • 'shear'  — τ·A (bulk-shear at plug cross-section) plus μ·W (wall
 *                friction of the full plug weight against the side walls).
 *                Returns the larger of the two forces as the resistance, in kN.
 *   • 'manual' — user-supplied force in kN.
 *
 * A startup / breakout multiplier is applied on top of the flow value to
 * obtain the startup force used by the acceleration check.
 */

import { G_MPS2 } from './constants';

export type PluggedChuteMode = 'off' | 'shear' | 'manual';

export interface PluggedChuteInput {
  readonly mode: PluggedChuteMode;
  /** Include the flow resistance in steady-state Te. */
  readonly applyInFlow: boolean;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly lengthM: number;
  /** Wall friction coefficient μ. */
  readonly wallFriction: number;
  /** Bulk shear stress τ (kPa). */
  readonly shearStressKPa: number;
  /** Bulk density (t/m³). */
  readonly bulkDensityTm3: number;
  /** Startup / breakout factor (e.g. 1.6). */
  readonly startupFactor: number;
  /** Manual force when mode = 'manual' (kN). */
  readonly manualFlowKN: number;
}

export interface PluggedChuteResult {
  readonly methodBasis: string;
  readonly crossAreaM2: number;
  readonly volumeM3: number;
  readonly weightN: number;
  readonly wallContactM2: number;
  readonly frictionN: number;
  readonly shearN: number;
  readonly flowKN: number;
  readonly startupKN: number;
  readonly startupExtraKN: number;
}

export const computePluggedChute = (
  input: PluggedChuteInput,
): PluggedChuteResult => {
  const widthM = input.widthMm / 1000;
  const heightM = input.heightMm / 1000;
  const lengthM = input.lengthM;
  const crossAreaM2 = Math.max(widthM * heightM, 0);
  const volumeM3 = Math.max(crossAreaM2 * lengthM, 0);
  const weightN = volumeM3 * Math.max(input.bulkDensityTm3, 0) * 1000 * G_MPS2;
  const wallContactM2 = Math.max(lengthM * (widthM + 2 * heightM), 0);
  const frictionN = Math.max(input.wallFriction, 0) * weightN;
  const shearN = Math.max(input.shearStressKPa, 0) * 1000 * crossAreaM2;

  let flowKN = 0;
  let methodBasis = 'Off';

  switch (input.mode) {
    case 'shear': {
      const combinedN = Math.max(frictionN, shearN);
      flowKN = combinedN / 1000;
      methodBasis = `Shear + wall friction (max of τ·A and μ·W)`;
      break;
    }
    case 'manual': {
      flowKN = Math.max(input.manualFlowKN, 0);
      methodBasis = 'Manual force entry';
      break;
    }
    case 'off':
    default: {
      flowKN = 0;
      methodBasis = 'Off';
    }
  }

  const startupKN = Math.max(input.startupFactor, 0) * flowKN;
  const startupExtraKN = Math.max(startupKN - flowKN, 0);

  return {
    methodBasis,
    crossAreaM2,
    volumeM3,
    weightN,
    wallContactM2,
    frictionN,
    shearN,
    flowKN,
    startupKN,
    startupExtraKN,
  };
};
