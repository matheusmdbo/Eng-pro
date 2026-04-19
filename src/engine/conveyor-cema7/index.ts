/**
 * Public API — `import { compute, DEFAULT_INPUTS } from '@/engine/conveyor-cema7'`
 *
 * The UI layer should import only from this barrel; everything else is an
 * implementation detail that may evolve between releases.
 */

// Orchestrator & results
export { compute, type ConveyorResults, type TensionComponent } from './domain/compute';

// Input type & validation
export type {
  ConveyorInputs,
  TroughAngleStandard,
  SagPercent,
  UnitSystem,
  Locale,
  ValidationIssue,
  ValidationResult,
} from './schema/inputs';
export { validateConveyorInputs } from './schema/inputs';

// Defaults & sample
export { DEFAULT_INPUTS, SAMPLE_INPUTS } from './defaults';

// Reference tables (the UI needs these for selects)
export { IDLER_FAMILIES, getIdlerFamily, type IdlerFamily } from './domain/tables/ai';
export { CS_MATERIALS, getCsMaterial, type CsMaterial, CS_SOURCE } from './domain/tables/cs';
export { KT_CURVE, KT_SOURCE, ktFromTemp } from './domain/tables/kt';
export { KY_LEVEL, KY_SLOPE3, KY_STEEP, KY_SPACINGS_FT, KY_SOURCE, kyFromSlope } from './domain/tables/ky';
export { BELT_WEIGHT_TABLE, estimateBeltWeight, STEEL_CORD_MULTIPLIER } from './domain/tables/beltWeight';
export { CEMA_AVAILABLE_AREA_M2_20_SURCHARGE, AREA_TABLE_SOURCE, edgeDistancePerSideM, interpolateAvailableAreaM2 } from './domain/tables/crossSection';

// Geometry & fill solver
export { beltSectionGeometry, solveCrossSectionFill, requiredLiveAreaM2, type BeltSectionGeometry, type FillModel } from './domain/geometry';

// Individual sub-computations (useful for diagnostics / unit tests)
export { computeKx, kxFromIdlerFamily, type KxInput, type KxResult } from './domain/resistances';
export { computeDrive, cwFromMuTheta, sagFactor, type DriveInput, type DriveResult, type DriveConfig } from './domain/drives';
export { computePluggedChute, type PluggedChuteInput, type PluggedChuteResult, type PluggedChuteMode } from './domain/pluggedChute';
export {
  computeTensionProfile,
  interpolateProfileElevation,
  type ProfileNode,
  type ProfileMarker,
  type ProfileSegment,
  type VerticalCurveCheck,
  type TensionProfileInput,
  type TensionProfileResult,
} from './domain/tensionProfile';

// Constants (for tests & UI unit labels)
export * as constants from './domain/constants';

// Validation cases (for regression tests and the Validation panel in the UI)
export { VALIDATION_CASES, type ValidationCase, type AreaValidationCase } from './validationCases';
