/**
 * compute — CEMA 7 conveyor-power orchestrator
 *
 * Pure function. Takes a `ConveyorInputs` record and returns a `ConveyorResults`
 * record. No DOM, no localStorage, no i18n. The UI layer consumes these
 * results directly.
 *
 * The orchestrator:
 *   1. Converts SI inputs to the internal imperial set required by the
 *      Historical Method formulae.
 *   2. Resolves auto/manual modes for Kt, Kx, Ky, Cw, belt weight, Tp.
 *   3. Computes each tension component with the formulas in `resistances.ts`.
 *   4. Computes the drive (T1/T2, counterweight, duty mode) in `drives.ts`.
 *   5. Solves the cross-section fill in `geometry.ts`.
 *   6. Computes the plugged-chute block in `pluggedChute.ts`.
 *   7. Computes the tension profile and vertical-curve checks.
 *
 * Every intermediate is returned so that the UI can render diagnostic tables
 * and so memorial/PDF exports can present a full audit trail.
 */

import {
  FT_PER_M,
  FPM_PER_MPS,
  HP_TO_KW,
  LBFT_PER_KGPM,
  IN_PER_MM,
  KGPM_PER_LBFT,
  beltWidthInches,
  componentKwFromLbf,
  densityLbFt3,
  hpFromTeV,
  knToLbf,
  kgpmToLbft,
  metricTphToShortTph,
} from './constants';

import { getIdlerFamily } from './tables/ai';
import { estimateBeltWeight } from './tables/beltWeight';
import { ktFromTemp } from './tables/kt';
import { kyFromSlope } from './tables/ky';

import {
  materialWeightLbFt,
  kxFromIdlerFamily,
  txLbf,
  tycLbf,
  tyrLbf,
  tymLbf,
  tmLbf,
  tbLbf,
  tpLbfCount,
  tamLbf,
  tbcLbf,
  tplLbf,
  tsbLbf,
} from './resistances';

import {
  cwFromMuTheta,
  computeDrive,
  type DriveConfig,
} from './drives';

import {
  solveCrossSectionFill,
  requiredLiveAreaM2,
  type FillModel,
} from './geometry';

import {
  computePluggedChute,
  type PluggedChuteResult,
} from './pluggedChute';

import {
  computeTensionProfile,
  type ProfileNode,
  type ProfileMarker,
  type TensionProfileResult,
} from './tensionProfile';

import type { ConveyorInputs } from '../schema/inputs';

// ─── Result type ────────────────────────────────────────────────────────────

export interface TensionComponent {
  readonly key: string;
  readonly label: string;
  readonly lbf: number;
  readonly kw: number;
  readonly basis: string;
}

export interface ConveyorResults {
  readonly inputs: ConveyorInputs;

  // Derived primary quantities
  readonly widthIn: number;
  readonly vFpm: number;
  readonly v0Fpm: number;
  readonly qShortTph: number;
  readonly lengthFt: number;
  readonly liftFt: number;
  readonly slopePct: number;
  readonly spacingFt: number;
  readonly densityLbFt3: number;

  // Belt weight resolution
  readonly beltWeightBasis: 'Manual' | 'Estimated';
  readonly beltWeightLbft: number;
  readonly beltWeightKgPm: number;
  readonly beltWeightEstimate: { lbft: number; kgpm: number; basis: string };

  // Material load
  readonly wmLbft: number;
  readonly wmKgPm: number;

  // Factor resolution
  readonly ktUsed: number;
  readonly ktBasis: 'Manual' | 'Curve';
  readonly kyUsed: number;
  readonly kyBasis: 'Manual' | 'Table';
  readonly aiAdjusted: number;
  readonly kxAuto: number;
  readonly kxUsed: number;
  readonly kxBasis: 'Manual' | 'Auto';
  readonly cwUsed: number;
  readonly cwBasis: 'Preset' | 'μ·θ formula' | 'Manual';

  // Components (lbf)
  readonly txLbf: number;
  readonly tycLbf: number;
  readonly tyrLbf: number;
  readonly tybLbf: number;
  readonly tymLbf: number;
  readonly tmLbf: number;
  readonly tbLbf: number;
  readonly tpLbf: number;
  readonly tpCountLbf: number;
  readonly tpBasis: 'Count' | 'Manual';
  readonly tamLbf: number;
  readonly tbcLbf: number;
  readonly tplLbf: number;
  readonly tsbLbf: number;
  readonly otherAccessoryLbf: number;
  readonly tacLbf: number;

  // Plugged chute
  readonly pluggedChute: PluggedChuteResult;

  // Aggregates
  readonly teBaseLbf: number;
  readonly teLbf: number;
  readonly startupTeLbf: number;

  // Power
  readonly beltHp: number;
  readonly beltKw: number;
  readonly startupBeltHp: number;
  readonly startupBeltKw: number;
  readonly motorKw: number;
  readonly motorHp: number;
  readonly startupMotorKw: number;
  readonly startupMotorHp: number;

  // Drive
  readonly t0Lbf: number;
  readonly t2SlipLbf: number;
  readonly t2SagLbf: number;
  readonly t2Lbf: number;
  readonly t1Lbf: number;
  readonly counterweightLbf: number;
  readonly governingSource: 'Slip' | 'Sag';
  readonly dutyMode: 'Motoring' | 'Regenerative';
  readonly headTeLbf: number;
  readonly tailTeLbf: number;

  // Cross-section
  readonly requiredAreaM2: number;
  readonly fillModel: FillModel;
  readonly occupiedAreaM2: number;
  readonly cemaAvailableAreaM2: number;
  readonly maxAreaM2: number;
  readonly edgeDistanceM: number;
  readonly totalEdgeClearanceM: number;
  readonly fillAreaPct: number;
  readonly fillToMaxPct: number;

  // Components as a list for tables
  readonly components: readonly TensionComponent[];

  // Profile & vertical curves
  readonly profile: TensionProfileResult;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseNodes = (raw: string): ProfileNode[] => {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((n, i) => ({
      id: String(n?.id ?? `N${i}`),
      station: Number(n?.station) || 0,
      elev: Number(n?.elev) || 0,
      curveLengthM: Number(n?.curveLengthM) || 0,
    }));
  } catch {
    return [];
  }
};

const parseMarkers = (raw: string): ProfileMarker[] => {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((m, i) => ({
      id: String(m?.id ?? `M${i}`),
      label: String(m?.label ?? `Marker ${i}`),
      type: (m?.type ?? 'custom') as ProfileMarker['type'],
      station: Number(m?.station) || 0,
    }));
  } catch {
    return [];
  }
};

// ─── The orchestrator ────────────────────────────────────────────────────────

export const compute = (inputs: ConveyorInputs): ConveyorResults => {
  // 1. Conversions
  const widthIn = beltWidthInches(inputs.beltWidthMm);
  const qShortTph = metricTphToShortTph(inputs.capacityTph);
  const vFpm = inputs.beltSpeed * FPM_PER_MPS;
  const v0Fpm = inputs.materialEntrySpeed * FPM_PER_MPS;
  const lengthFt = inputs.centerLengthM * FT_PER_M;
  const liftFt = inputs.liftM * FT_PER_M;
  const slopePct = lengthFt > 0 ? (liftFt / lengthFt) * 100 : 0;
  const spacingFt = inputs.idlerSpacingM * FT_PER_M;
  const density = densityLbFt3(inputs.bulkDensity);

  // 2. Belt weight (manual or estimated)
  const estimate = estimateBeltWeight(
    inputs.beltWidthMm,
    inputs.bulkDensity,
    inputs.steelCord,
  );
  const beltWeightLbft = inputs.useEstimatedBeltWeight
    ? estimate.lbft
    : kgpmToLbft(inputs.beltWeightKgPm);
  const beltWeightKgPm = inputs.useEstimatedBeltWeight
    ? estimate.kgpm
    : inputs.beltWeightKgPm;

  // 3. Material linear load
  const wmLbft = materialWeightLbFt(qShortTph, vFpm);
  const wmKgPm = Number.isFinite(wmLbft) ? wmLbft * KGPM_PER_LBFT : NaN;

  // 4. Kt — auto from ambient temperature or manual override
  const ktAuto = ktFromTemp(inputs.ambientTempC, { unit: 'C' });
  const ktUsed = inputs.overrideKt ? inputs.kt : ktAuto;
  const ktBasis: 'Manual' | 'Curve' = inputs.overrideKt ? 'Manual' : 'Curve';

  // 5. Ky — auto from slope/weight/spacing or manual override
  const kyAuto = kyFromSlope(slopePct, beltWeightLbft + wmLbft, spacingFt);
  const kyUsed = inputs.overrideKy ? inputs.ky : kyAuto;
  const kyBasis: 'Manual' | 'Table' = inputs.overrideKy ? 'Manual' : 'Table';

  // 6. Kx — auto from Ai, spacing and loads or manual override
  const family = getIdlerFamily(inputs.idlerFamily);
  const kxResult = kxFromIdlerFamily(
    family,
    inputs.twoRollVReturn,
    beltWeightLbft,
    wmLbft,
    spacingFt,
  );
  const kxUsed = inputs.overrideKx ? inputs.manualKx : kxResult.kxLbFt2;
  const kxBasis: 'Manual' | 'Auto' = inputs.overrideKx ? 'Manual' : 'Auto';

  // 7. Cw — preset, μ·θ formula, or manual
  let cwUsed = inputs.cw;
  let cwBasis: 'Preset' | 'μ·θ formula' | 'Manual' = 'Preset';
  if (inputs.overrideCw) {
    cwUsed = inputs.cw;
    cwBasis = 'Manual';
  } else if (inputs.wrapAngleDeg > 0 && inputs.laggingFriction > 0) {
    cwUsed = cwFromMuTheta(inputs.laggingFriction, inputs.wrapAngleDeg);
    cwBasis = 'μ·θ formula';
  }

  // 8. Components
  const tx = txLbf(lengthFt, ktUsed, kxUsed);
  const tyc = tycLbf(lengthFt, kyUsed, beltWeightLbft, ktUsed);
  const tyr = tyrLbf(lengthFt, beltWeightLbft, ktUsed);
  const tyb = tyc + tyr;
  const tym = tymLbf(lengthFt, kyUsed, wmLbft);
  const tm = tmLbf(liftFt, wmLbft);
  const tb = tbLbf(liftFt, beltWeightLbft);

  const tpCount = tpLbfCount({
    tightPulleys: inputs.tightPulleys,
    slackPulleys: inputs.slackPulleys,
    otherPulleys: inputs.otherPulleys,
    plainBearings: inputs.plainBearings,
  });
  const tpUsed = inputs.overrideTp ? inputs.manualTpLbf : tpCount;
  const tpBasis: 'Count' | 'Manual' = inputs.overrideTp ? 'Manual' : 'Count';

  const tam = tamLbf(qShortTph, vFpm, v0Fpm);
  const tbc = tbcLbf(inputs.cleanerBlades, widthIn);
  const tpl = tplLbf(inputs.fullPlows, inputs.partialPlows, widthIn);
  const skirtLengthFt = inputs.skirtLengthM * FT_PER_M;
  const skirtDepthIn = inputs.skirtDepthMm * IN_PER_MM;
  const tsb = tsbLbf(skirtLengthFt, skirtDepthIn, inputs.csFactor, inputs.rubberEdging);
  const otherAccessory = knToLbf(inputs.otherAccessoryKN);
  const tac = tbc + tpl + tsb + otherAccessory;

  // 9. Plugged chute
  const plugged = computePluggedChute({
    mode: inputs.pluggedChuteMode,
    applyInFlow: inputs.pluggedApplyInFlow,
    widthMm: inputs.pluggedWidthMm,
    heightMm: inputs.pluggedHeightMm,
    lengthM: inputs.pluggedLengthM,
    wallFriction: inputs.pluggedWallFriction,
    shearStressKPa: inputs.pluggedShearStressKPa,
    bulkDensityTm3: inputs.bulkDensity,
    startupFactor: inputs.pluggedStartupFactor,
    manualFlowKN: inputs.manualPluggedFlowKN,
  });
  const pluggedFlowLbf = knToLbf(plugged.flowKN);
  const pluggedStartupLbf = knToLbf(plugged.startupKN);

  // 10. Aggregates (sign convention: Tm and Tb carry sign from liftFt)
  const teBaseLbf = tx + tyb + tym + tm + tpUsed + tam + tac;
  const teLbf = teBaseLbf + (inputs.pluggedApplyInFlow ? pluggedFlowLbf : 0);

  // Startup Te always includes the breakaway value (regardless of steady
  // flow inclusion), so the motor can crack the plug even if we decided
  // not to size Te against flow plug resistance.
  const startupTeLbf = Math.max(teBaseLbf + pluggedStartupLbf, teLbf);

  // 11. Power
  const beltHp = hpFromTeV(teLbf, vFpm);
  const beltKw = beltHp * HP_TO_KW;
  const startupBeltHp = hpFromTeV(startupTeLbf, vFpm);
  const startupBeltKw = startupBeltHp * HP_TO_KW;
  const eff = Math.max(inputs.driveEfficiencyPct / 100, 0.0001);
  const motorKw = (beltKw * inputs.serviceFactor) / eff;
  const motorHp = motorKw / HP_TO_KW;
  const startupMotorKw = (startupBeltKw * inputs.serviceFactor) / eff;
  const startupMotorHp = startupMotorKw / HP_TO_KW;

  // 12. Drive (T1/T2/counterweight)
  const drive = computeDrive({
    config: inputs.driveConfig as DriveConfig,
    teLbf,
    cw: cwUsed,
    sagPercent: inputs.sagPercent,
    idlerSpacingFt: spacingFt,
    beltWeightLbFt: beltWeightLbft,
    materialWeightLbFt: wmLbft,
    tbLbf: tb,
    tyrLbf: tyr,
    dualDriveHeadShare: inputs.dualDriveHeadShare,
  });

  // 13. Cross-section
  const requiredAreaM2 = requiredLiveAreaM2(
    inputs.capacityTph,
    inputs.bulkDensity,
    inputs.beltSpeed,
  );
  const fillModel = solveCrossSectionFill(
    inputs.beltWidthMm / 1000,
    inputs.troughAngleDeg,
    inputs.surchargeAngleDeg,
    requiredAreaM2,
  );

  // 14. Tension profile
  const profile = computeTensionProfile({
    nodes: parseNodes(inputs.profileNodesJson),
    markers: parseMarkers(inputs.profileMarkersJson),
    t1Lbf: drive.t1Lbf,
    t2Lbf: drive.t2Lbf,
    teLbf,
    beltWidthM: inputs.beltWidthMm / 1000,
    troughAngleDeg: inputs.troughAngleDeg,
    beltModulusKNpm: inputs.beltModulusKNpm,
    beltRatedTensionKNpm: inputs.beltRatedTensionKNpm,
    minBuckleTensionKNpm: inputs.minBuckleTensionKNpm,
    autoCurveShare: inputs.autoCurveShare,
    beltWeightKgPm,
    materialWeightKgPm: wmKgPm,
  });

  // 15. Components list
  const components: TensionComponent[] = (
    [
      { key: 'Tx', label: 'Tx · Idler friction', lbf: tx, basis: 'L × Kt × Kx' },
      { key: 'Tyc', label: 'Tyc · Belt flexure on carrying idlers', lbf: tyc, basis: 'L × Ky × Wb × Kt' },
      { key: 'Tyr', label: 'Tyr · Belt flexure on return idlers', lbf: tyr, basis: 'L × 0.015 × Wb × Kt' },
      { key: 'Tym', label: 'Tym · Material flexure', lbf: tym, basis: 'L × Ky × Wm' },
      { key: 'Tm',  label: 'Tm · Lift / lower material', lbf: tm, basis: 'H × Wm' },
      { key: 'Tp',  label: 'Tp · Pulley resistance', lbf: tpUsed, basis: 'Table 6-5 count method' },
      { key: 'Tam', label: 'Tam · Accelerate feed', lbf: tam, basis: '0.00028755 × Q × (V − Vo)' },
      { key: 'Tbc', label: 'Tbc · Belt cleaners', lbf: tbc, basis: '5 lb/in × blades × belt width' },
      { key: 'Tpl', label: 'Tpl · Plows', lbf: tpl, basis: '5 or 3 lb/in × belt width' },
      { key: 'Tsb', label: 'Tsb · Skirtboards', lbf: tsb, basis: 'Lb × (Cs × hs² + 6)' },
      { key: 'Tother', label: 'Other accessory tension', lbf: otherAccessory, basis: 'Manual kN adder' },
      { key: 'TplugFlow', label: 'Tplug(flow) · Plugged chute resistance during flow', lbf: pluggedFlowLbf, basis: plugged.methodBasis },
      { key: 'TplugStartX', label: 'Tplug(start extra) · Additional breakout above flow', lbf: knToLbf(plugged.startupExtraKN), basis: `Startup factor ${inputs.pluggedStartupFactor.toFixed(2)} × flow resistance` },
    ] as const
  ).map((item) => ({ ...item, kw: componentKwFromLbf(item.lbf, vFpm) }));

  return {
    inputs,
    widthIn,
    vFpm,
    v0Fpm,
    qShortTph,
    lengthFt,
    liftFt,
    slopePct,
    spacingFt,
    densityLbFt3: density,

    beltWeightBasis: inputs.useEstimatedBeltWeight ? 'Estimated' : 'Manual',
    beltWeightLbft,
    beltWeightKgPm,
    beltWeightEstimate: estimate,

    wmLbft,
    wmKgPm,

    ktUsed,
    ktBasis,
    kyUsed,
    kyBasis,
    aiAdjusted: kxResult.aiAdjusted,
    kxAuto: kxResult.kxLbFt2,
    kxUsed,
    kxBasis,
    cwUsed,
    cwBasis,

    txLbf: tx,
    tycLbf: tyc,
    tyrLbf: tyr,
    tybLbf: tyb,
    tymLbf: tym,
    tmLbf: tm,
    tbLbf: tb,
    tpLbf: tpUsed,
    tpCountLbf: tpCount,
    tpBasis,
    tamLbf: tam,
    tbcLbf: tbc,
    tplLbf: tpl,
    tsbLbf: tsb,
    otherAccessoryLbf: otherAccessory,
    tacLbf: tac,

    pluggedChute: plugged,

    teBaseLbf,
    teLbf,
    startupTeLbf,

    beltHp,
    beltKw,
    startupBeltHp,
    startupBeltKw,
    motorKw,
    motorHp,
    startupMotorKw,
    startupMotorHp,

    t0Lbf: drive.t0Lbf,
    t2SlipLbf: drive.t2SlipLbf,
    t2SagLbf: drive.t2SagLbf,
    t2Lbf: drive.t2Lbf,
    t1Lbf: drive.t1Lbf,
    counterweightLbf: drive.counterweightLbf,
    governingSource: drive.governingSource,
    dutyMode: drive.dutyMode,
    headTeLbf: drive.headTeLbf,
    tailTeLbf: drive.tailTeLbf,

    requiredAreaM2,
    fillModel,
    occupiedAreaM2: fillModel.occupiedAreaM2,
    cemaAvailableAreaM2: fillModel.cemaAvailableAreaM2,
    maxAreaM2: fillModel.maxAreaM2,
    edgeDistanceM: fillModel.edgeDistanceM,
    totalEdgeClearanceM: fillModel.totalEdgeClearanceM,
    fillAreaPct: fillModel.fillToAvailableRatio * 100,
    fillToMaxPct: fillModel.fillToMaxRatio * 100,

    components,
    profile,
  };
};
