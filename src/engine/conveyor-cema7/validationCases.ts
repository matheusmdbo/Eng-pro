/**
 * Validation cases against published CEMA-style worked examples.
 *
 * Each case specifies the exact inputs and the expected values for Te, belt
 * power, T2 and T1. Numerical tolerances are stated so automated tests can
 * flag any regression after a refactor. These are the two cases that
 * shipped in the original HTML prototype (Rev11), kept verbatim.
 */

import {
  FPM_PER_MPS,
  FT_PER_M,
  LBFT_PER_KGPM,
  SHORT_TON_PER_METRIC_TON,
} from './domain/constants';
import { DEFAULT_INPUTS } from './defaults';
import type { ConveyorInputs } from './schema/inputs';

export interface ValidationCase {
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly note: string;
  readonly input: ConveyorInputs;
  readonly expected: {
    readonly teLbf: number;
    readonly beltHp: number;
    readonly t2Lbf: number;
    readonly t1Lbf: number;
  };
  /** Relative tolerance for Te and HP (percentage). */
  readonly tolerancePct: number;
}

export const VALIDATION_CASES: readonly ValidationCase[] = [
  {
    id: 'aghCema',
    label: 'AGH / CEMA worked example',
    source: 'Published CEMA-style worked example',
    note:
      'Source rounds Wm to 55 lb/ft, so very small residual differences are expected when the engine computes Wm from the exact tph and belt speed.',
    input: {
      ...DEFAULT_INPUTS,
      projectName: 'Validation - AGH CEMA 5',
      conveyorTag: 'VAL-AGH',
      capacityTph: 1000 / SHORT_TON_PER_METRIC_TON,
      beltSpeed: 600 / FPM_PER_MPS,
      materialEntrySpeed: 0,
      centerLengthM: 3300 / FT_PER_M,
      liftM: 115 / FT_PER_M,
      beltWidthMm: 42 * 25.4,
      bulkDensity: 0.96,
      useEstimatedBeltWeight: false,
      beltWeightKgPm: 11 / LBFT_PER_KGPM,
      idlerSpacingM: 4.5 / FT_PER_M,
      sagPercent: 2,
      idlerFamily: 'B4_C4_4in',
      twoRollVReturn: false,
      overrideKx: true,
      manualKx: 0.555,
      overrideKy: true,
      ky: 0.0214,
      overrideKt: true,
      kt: 1.0,
      cwPreset: 'manual',
      cw: 0.08,
      overrideCw: true,
      wrapAngleDeg: 220,
      laggingFriction: 0.35,
      tightPulleys: 2,
      slackPulleys: 3,
      otherPulleys: 0,
      plainBearings: false,
      overrideTp: false,
      manualTpLbf: 0,
      cleanerBlades: 0,
      fullPlows: 0,
      partialPlows: 0,
      skirtLengthM: 10 / FT_PER_M,
      skirtDepthMm: 10 * 25.4,
      csFactor: 0.0538,
      csMaterialId: 'custom',
      rubberEdging: true,
      otherAccessoryKN: 0,
      driveEfficiencyPct: 94,
      serviceFactor: 1.0,
    },
    expected: {
      teLbf: 14598.2,
      beltHp: 265.4,
      t2Lbf: 2567.7,
      t1Lbf: 17165.9,
    },
    tolerancePct: 1.0,
  },
  {
    id: 'rulmecaWorkbook',
    label: 'Rulmeca public workbook sample',
    source: 'Public Design-Imperial-7.31 workbook sample',
    note:
      'Manual Tp override is used here to match the workbook sample exactly, because that workbook applies a project-specific pulley-resistance treatment rather than the simple count method used by default in this sheet.',
    input: {
      ...DEFAULT_INPUTS,
      projectName: 'Validation - Rulmeca',
      conveyorTag: 'VAL-RUL',
      capacityTph: 500 / SHORT_TON_PER_METRIC_TON,
      beltSpeed: 300 / FPM_PER_MPS,
      materialEntrySpeed: 0,
      centerLengthM: 100 / FT_PER_M,
      liftM: 0,
      beltWidthMm: 36 * 25.4,
      bulkDensity: 1.0,
      useEstimatedBeltWeight: false,
      beltWeightKgPm: 9 / LBFT_PER_KGPM,
      idlerSpacingM: 4 / FT_PER_M,
      sagPercent: 2,
      idlerFamily: 'B5_C5_D5_5in',
      twoRollVReturn: false,
      overrideKx: true,
      manualKx: 0.493894,
      overrideKy: true,
      ky: 0.035,
      overrideKt: true,
      kt: 1.58855494575869,
      cwPreset: 'manual',
      cw: 0.5,
      overrideCw: true,
      wrapAngleDeg: 180,
      laggingFriction: 0.35,
      tightPulleys: 0,
      slackPulleys: 0,
      otherPulleys: 0,
      plainBearings: false,
      overrideTp: true,
      manualTpLbf: 19.387,
      cleanerBlades: 1,
      fullPlows: 0,
      partialPlows: 0,
      skirtLengthM: 12 / FT_PER_M,
      skirtDepthMm: 3 * 25.4,
      csFactor: 0.128,
      csMaterialId: 'custom',
      rubberEdging: true,
      otherAccessoryKN: 0,
      driveEfficiencyPct: 94,
      serviceFactor: 1.0,
    },
    expected: {
      teLbf: 672.711248197195,
      beltHp: 6.11555680179268,
      t2Lbf: 1592.30450823226,
      t1Lbf: 2265.01575642945,
    },
    tolerancePct: 0.1,
  },
];

export interface AreaValidationCase {
  readonly id: string;
  readonly label: string;
  readonly expected: number;
  readonly calculated: () => number;
  readonly unit: string;
  readonly tolerancePct: number;
}
