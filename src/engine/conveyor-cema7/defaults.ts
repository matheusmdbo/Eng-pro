/**
 * Reference default inputs and worked-example sample.
 *
 * These mirror the values that shipped in the HTML prototype (Rev11) but are
 * typed, normalised, and extended with the new fields (overrideKy, overrideKt,
 * ambientTempC, wrapAngleDeg, laggingFriction, overrideCw, driveConfig,
 * csMaterialId, unitSystem, locale).
 */

import type { ConveyorInputs } from './schema/inputs';

const PROFILE_NODES_JSON =
  '[{"id":"N0","station":0,"elev":0,"curveLengthM":0},{"id":"N1","station":88,"elev":7,"curveLengthM":38},{"id":"N2","station":160,"elev":14,"curveLengthM":32},{"id":"N3","station":220,"elev":18,"curveLengthM":0}]';

const PROFILE_MARKERS_JSON =
  '[{"id":"M1","label":"Tail pulley","type":"tail","station":0},{"id":"M2","label":"Feed point","type":"feed","station":28},{"id":"M3","label":"Take-up","type":"takeup","station":48},{"id":"M4","label":"Return pulley","type":"return","station":200},{"id":"M5","label":"Drive","type":"drive","station":220}]';

export const DEFAULT_INPUTS: ConveyorInputs = {
  projectName: 'Acme Conveyor',
  conveyorTag: 'CV-101',
  capacityTph: 750,
  beltSpeed: 2.5,
  materialEntrySpeed: 0.4,
  centerLengthM: 220,
  liftM: 18,
  beltWidthMm: 1200,
  bulkDensity: 1.85,
  troughAngleDeg: 35,
  surchargeAngleDeg: 20,
  centerRollFraction: 0.33,
  edgeFreeboardPct: 10,
  useEstimatedBeltWeight: false,
  steelCord: false,
  beltWeightKgPm: 28.0,
  idlerSpacingM: 1.2,
  sagPercent: 2,

  idlerFamily: 'D5_5in',
  twoRollVReturn: false,
  overrideKx: false,
  manualKx: 0.45,
  overrideKy: false,
  ky: 0.019,
  overrideKt: false,
  kt: 1.0,
  ambientTempC: 20,
  cwPreset: 'lagged220',
  cw: 0.35,
  wrapAngleDeg: 220,
  laggingFriction: 0.35,
  overrideCw: false,

  tightPulleys: 1,
  slackPulleys: 2,
  otherPulleys: 1,
  plainBearings: false,
  overrideTp: false,
  manualTpLbf: 0,
  cleanerBlades: 2,
  fullPlows: 0,
  partialPlows: 0,
  skirtLengthM: 8,
  skirtDepthMm: 60,
  csFactor: 0.1086,
  csMaterialId: 'coalAnthracite',
  rubberEdging: true,
  otherAccessoryKN: 0,

  pluggedChuteMode: 'off',
  pluggedApplyInFlow: false,
  pluggedWidthMm: 1200,
  pluggedHeightMm: 350,
  pluggedLengthM: 1.8,
  pluggedWallFriction: 0.45,
  pluggedShearStressKPa: 12,
  pluggedStartupFactor: 1.6,
  manualPluggedFlowKN: 0,

  driveConfig: 'singleHead',
  driveEfficiencyPct: 95,
  serviceFactor: 1.15,
  dualDriveHeadShare: 0.67,

  beltModulusKNpm: 12000,
  beltRatedTensionKNpm: 800,
  minBuckleTensionKNpm: 5,
  autoCurveShare: 0.35,
  profileNodesJson: PROFILE_NODES_JSON,
  profileMarkersJson: PROFILE_MARKERS_JSON,

  unitSystem: 'SI',
  locale: 'pt-BR',
  theme: 'light',
};

export const SAMPLE_INPUTS: ConveyorInputs = {
  ...DEFAULT_INPUTS,
  projectName: 'Iron Ore Transfer',
  conveyorTag: 'CV-4201',
  capacityTph: 1800,
  beltSpeed: 4.2,
  materialEntrySpeed: 0.9,
  centerLengthM: 365,
  liftM: 24,
  beltWidthMm: 1400,
  bulkDensity: 2.2,
  useEstimatedBeltWeight: true,
  steelCord: true,
  beltWeightKgPm: 0,
  idlerSpacingM: 1.35,
  idlerFamily: 'D6_6in',
  cwPreset: 'lagged180gravity',
  cw: 0.5,
  wrapAngleDeg: 180,
  csFactor: 0.276,
  csMaterialId: 'ironOre',
  skirtLengthM: 10,
  skirtDepthMm: 80,
  driveEfficiencyPct: 94.5,
};
