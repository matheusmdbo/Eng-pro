/**
 * Input schema for the CEMA 7 conveyor-power engine
 *
 * Every input is typed and range-checked. The engine never sanitises silently:
 * validation is explicit, so upstream code (UI, API, imported spreadsheets)
 * can present the failure to the engineer.
 *
 * We avoid a hard `zod` runtime import here so the engine stays framework-
 * free; instead we export a minimal validator in the same shape as Zod's
 * `safeParse`. If you want full Zod wiring, add `zod` to package.json and
 * swap `validateConveyorInputs` for a `z.object(...)` call — the type
 * surface is the same.
 */

// ─── Shared enums ────────────────────────────────────────────────────────────

export type TroughAngleStandard = 0 | 15 | 20 | 30 | 35 | 45;
export type SagPercent = 1.5 | 2 | 3;
export type UnitSystem = 'SI' | 'US';
export type Locale = 'en' | 'pt-BR';

// ─── Input record ────────────────────────────────────────────────────────────

export interface ConveyorInputs {
  // ── Project metadata
  projectName: string;
  conveyorTag: string;

  // ── Duty & geometry
  /** Design capacity, t/h (metric). */
  capacityTph: number;
  /** Belt speed, m/s. */
  beltSpeed: number;
  /** Velocity of material at the load point, m/s (V₀ in CEMA). */
  materialEntrySpeed: number;
  /** Centre-to-centre length between terminal pulleys, m. */
  centerLengthM: number;
  /** Vertical lift (+) or drop (-), m. */
  liftM: number;

  // ── Belt and load
  beltWidthMm: number;
  bulkDensity: number; // t/m³
  troughAngleDeg: TroughAngleStandard;
  surchargeAngleDeg: number;
  centerRollFraction: number; // 0 – 1
  edgeFreeboardPct: number;   // % of B, reserved on each side
  useEstimatedBeltWeight: boolean;
  steelCord: boolean;
  beltWeightKgPm: number;
  idlerSpacingM: number;
  sagPercent: SagPercent;

  // ── Kx / Ky / Kt / Cw factors
  idlerFamily: string;
  twoRollVReturn: boolean;
  overrideKx: boolean;
  manualKx: number;     // lb/ft²
  overrideKy: boolean;
  ky: number;           // manual Ky (if overrideKy)
  overrideKt: boolean;
  kt: number;           // manual Kt (if overrideKt)
  ambientTempC: number; // used when Kt is auto
  cwPreset: string;
  cw: number;
  /** Wrap angle (°) used when Cw is computed from μ·θ. */
  wrapAngleDeg: number;
  /** Lagging friction coefficient μ used when Cw is computed from μ·θ. */
  laggingFriction: number;
  overrideCw: boolean;

  // ── Pulleys & accessories
  tightPulleys: number;
  slackPulleys: number;
  otherPulleys: number;
  plainBearings: boolean;
  overrideTp: boolean;
  manualTpLbf: number;
  cleanerBlades: number;
  fullPlows: number;
  partialPlows: number;
  skirtLengthM: number;
  skirtDepthMm: number;
  csFactor: number;
  csMaterialId: string; // 'custom' for manual Cs
  rubberEdging: boolean;
  otherAccessoryKN: number;

  // ── Plugged chute
  pluggedChuteMode: 'off' | 'shear' | 'manual';
  pluggedApplyInFlow: boolean;
  pluggedWidthMm: number;
  pluggedHeightMm: number;
  pluggedLengthM: number;
  pluggedWallFriction: number;
  pluggedShearStressKPa: number;
  pluggedStartupFactor: number;
  manualPluggedFlowKN: number;

  // ── Drive
  driveConfig:
    | 'singleHead'
    | 'singleTail'
    | 'dualHeadTail'
    | 'intermediate';
  driveEfficiencyPct: number;
  serviceFactor: number;
  /** Only used for dual-drive config. */
  dualDriveHeadShare?: number;

  // ── Vertical-curve inputs
  beltModulusKNpm: number;
  beltRatedTensionKNpm: number;
  minBuckleTensionKNpm: number;
  autoCurveShare: number;
  profileNodesJson: string;
  profileMarkersJson: string;

  // ── Presentation
  unitSystem: UnitSystem;
  locale: Locale;
  theme: 'light' | 'dark';
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationIssue = {
  readonly field: keyof ConveyorInputs | '(root)';
  readonly message: string;
};

export type ValidationResult =
  | { readonly success: true; readonly data: ConveyorInputs }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] };

const positive = (v: number): boolean => Number.isFinite(v) && v > 0;
const nonNegative = (v: number): boolean => Number.isFinite(v) && v >= 0;
const inRange = (v: number, lo: number, hi: number): boolean =>
  Number.isFinite(v) && v >= lo && v <= hi;

export const validateConveyorInputs = (
  input: ConveyorInputs,
): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (!positive(input.capacityTph))
    issues.push({ field: 'capacityTph', message: 'Capacity must be positive (t/h).' });
  if (!positive(input.beltSpeed))
    issues.push({ field: 'beltSpeed', message: 'Belt speed must be positive (m/s).' });
  if (input.materialEntrySpeed < 0 || input.materialEntrySpeed > input.beltSpeed + 1e-6)
    issues.push({
      field: 'materialEntrySpeed',
      message: 'Entry speed must be between 0 and belt speed.',
    });
  if (!positive(input.centerLengthM))
    issues.push({ field: 'centerLengthM', message: 'Length must be positive (m).' });
  if (!inRange(input.liftM, -10000, 10000))
    issues.push({ field: 'liftM', message: 'Lift must be within ±10 000 m.' });

  if (!positive(input.beltWidthMm))
    issues.push({ field: 'beltWidthMm', message: 'Belt width must be positive (mm).' });
  if (!positive(input.bulkDensity))
    issues.push({ field: 'bulkDensity', message: 'Bulk density must be positive (t/m³).' });
  if (![0, 15, 20, 30, 35, 45].includes(input.troughAngleDeg))
    issues.push({ field: 'troughAngleDeg', message: 'Trough angle must be one of 0°, 15°, 20°, 30°, 35°, 45°.' });
  if (!inRange(input.surchargeAngleDeg, 0, 45))
    issues.push({ field: 'surchargeAngleDeg', message: 'Surcharge angle must be 0–45°.' });
  if (!positive(input.idlerSpacingM))
    issues.push({ field: 'idlerSpacingM', message: 'Idler spacing must be positive (m).' });
  if (![1.5, 2, 3].includes(input.sagPercent))
    issues.push({ field: 'sagPercent', message: 'Sag percent must be 1.5, 2 or 3.' });

  if (!input.useEstimatedBeltWeight && !positive(input.beltWeightKgPm))
    issues.push({ field: 'beltWeightKgPm', message: 'Enter a positive belt weight (kg/m) or enable the estimate.' });

  if (!inRange(input.driveEfficiencyPct, 50, 100))
    issues.push({ field: 'driveEfficiencyPct', message: 'Drive efficiency must be 50–100 %.' });
  if (!positive(input.serviceFactor))
    issues.push({ field: 'serviceFactor', message: 'Service factor must be positive.' });

  if (input.overrideCw && !positive(input.cw))
    issues.push({ field: 'cw', message: 'Cw must be positive when override is on.' });

  if (!nonNegative(input.tightPulleys))
    issues.push({ field: 'tightPulleys', message: 'Pulley counts must be non-negative.' });
  if (!nonNegative(input.slackPulleys))
    issues.push({ field: 'slackPulleys', message: 'Pulley counts must be non-negative.' });
  if (!nonNegative(input.otherPulleys))
    issues.push({ field: 'otherPulleys', message: 'Pulley counts must be non-negative.' });

  if (issues.length > 0) return { success: false, issues };
  return { success: true, data: input };
};
