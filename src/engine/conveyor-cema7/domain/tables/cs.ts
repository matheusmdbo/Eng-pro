/**
 * CEMA 7th Edition — Cs (skirtboard friction factor)
 *
 * The skirtboard resistance is computed as:
 *     Tsb = Lb · ( Cs · hs² + 6 )        [lb]
 * where Lb is the skirt length (ft), hs the material depth at the skirt (in),
 * and the "+6 lb/ft" is added only when rubber skirtboard edging is used.
 *
 * Source: CEMA 7 chapter 6 — Skirtboard friction factor table (by material).
 */

export interface CsMaterial {
  readonly id: string;
  readonly label: string;
  /** Cs factor (material-specific) per CEMA 7. */
  readonly cs: number;
  /** Typical bulk density range (t/m³) for quick lookup. */
  readonly bulkDensityTm3?: readonly [number, number];
  readonly source: string;
}

export const CS_MATERIALS: readonly CsMaterial[] = [
  { id: 'alumina',        label: 'Alumina',              cs: 0.1210, bulkDensityTm3: [0.88, 1.04], source: 'CEMA 7 Cs table' },
  { id: 'ashesCoal',      label: 'Ashes, coal, dry',     cs: 0.0712, bulkDensityTm3: [0.56, 0.72], source: 'CEMA 7 Cs table' },
  { id: 'cementClinker',  label: 'Cement clinker',       cs: 0.2760, bulkDensityTm3: [1.20, 1.52], source: 'CEMA 7 Cs table' },
  { id: 'cementPortland', label: 'Cement, Portland',     cs: 0.2560, bulkDensityTm3: [1.50, 1.90], source: 'CEMA 7 Cs table' },
  { id: 'coalAnthracite', label: 'Coal, anthracite',     cs: 0.1086, bulkDensityTm3: [0.86, 0.96], source: 'CEMA 7 Cs table' },
  { id: 'coalBituminous', label: 'Coal, bituminous',     cs: 0.0900, bulkDensityTm3: [0.72, 0.88], source: 'CEMA 7 Cs table' },
  { id: 'coke',           label: 'Coke',                 cs: 0.0538, bulkDensityTm3: [0.37, 0.56], source: 'CEMA 7 Cs table' },
  { id: 'gravel',         label: 'Gravel, dry',          cs: 0.1280, bulkDensityTm3: [1.44, 1.70], source: 'CEMA 7 Cs table' },
  { id: 'ironOre',        label: 'Iron ore',             cs: 0.2760, bulkDensityTm3: [2.00, 3.20], source: 'CEMA 7 Cs table' },
  { id: 'limestone',      label: 'Limestone, crushed',   cs: 0.2170, bulkDensityTm3: [1.36, 1.52], source: 'CEMA 7 Cs table' },
  { id: 'sandDry',        label: 'Sand, dry',            cs: 0.1280, bulkDensityTm3: [1.44, 1.76], source: 'CEMA 7 Cs table' },
  { id: 'sandWet',        label: 'Sand, wet',            cs: 0.1650, bulkDensityTm3: [1.76, 2.08], source: 'CEMA 7 Cs table' },
  { id: 'woodChips',      label: 'Wood chips',           cs: 0.0538, bulkDensityTm3: [0.16, 0.48], source: 'CEMA 7 Cs table' },
  { id: 'custom',         label: 'Custom (manual Cs)',   cs: 0.1000, source: 'manual entry' },
] as const;

export const getCsMaterial = (id: string): CsMaterial => {
  const f = CS_MATERIALS.find((m) => m.id === id);
  if (!f) throw new Error(`Unknown Cs material id '${id}'`);
  return f;
};

export const CS_SOURCE =
  'CEMA 7 chapter 6 — Skirtboard friction factor (Cs) table, per handled material.';
