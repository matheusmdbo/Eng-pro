/**
 * CEMA 7th Edition — Table 6.10: Idler friction constant Ai
 *
 * Ai has units of lbf and is used in the Kx calculation:
 *     Kx = (0.00068 · (Wb + Wm) + Ai) / Si
 *
 * Source: CEMA BELT CONVEYORS FOR BULK MATERIALS, 7th Edition, Table 6.10.
 * Values here capture the common families. Extend by adding entries — each
 * entry must carry a clear source tag for auditability.
 */

export interface IdlerFamily {
  /** Stable id (no spaces). */
  readonly id: string;
  /** Display label. */
  readonly label: string;
  /** Ai value (lbf) per CEMA 7 Table 6.10. */
  readonly ai: number;
  /** Roll diameter in inches (metadata). */
  readonly rollDiameterIn: number;
  /** Series code(s) represented (B4, C5, D6, E7 …). */
  readonly series: readonly string[];
  /** Citation for audit. */
  readonly source: string;
}

export const IDLER_FAMILIES: readonly IdlerFamily[] = [
  {
    id: 'B4_C4_4in',
    label: 'B4 / C4 · 4 in diameter',
    ai: 2.3,
    rollDiameterIn: 4,
    series: ['B4', 'C4'],
    source: 'CEMA 7 Table 6.10',
  },
  {
    id: 'B5_C5_D5_5in',
    label: 'B5 / C5 / D5 · 5 in diameter',
    ai: 1.8,
    rollDiameterIn: 5,
    series: ['B5', 'C5', 'D5'],
    source: 'CEMA 7 Table 6.10',
  },
  {
    id: 'C6_D6_6in',
    label: 'C6 / D6 · 6 in diameter',
    ai: 1.5,
    rollDiameterIn: 6,
    series: ['C6', 'D6'],
    source: 'CEMA 7 Table 6.10',
  },
  {
    id: 'E6_6in',
    label: 'E6 · 6 in diameter',
    ai: 2.8,
    rollDiameterIn: 6,
    series: ['E6'],
    source: 'CEMA 7 Table 6.10',
  },
  {
    id: 'E7_7in',
    label: 'E7 · 7 in diameter',
    ai: 2.4,
    rollDiameterIn: 7,
    series: ['E7'],
    source: 'CEMA 7 Table 6.10',
  },
] as const;

export const getIdlerFamily = (id: string): IdlerFamily => {
  const found = IDLER_FAMILIES.find((f) => f.id === id);
  if (!found) {
    throw new Error(
      `Unknown idler family id '${id}'. Valid ids: ${IDLER_FAMILIES.map((f) => f.id).join(', ')}.`,
    );
  }
  return found;
};

/**
 * Adjustment for two-roll V-return idlers (approximate +5 % Ai).
 * CEMA 7 discusses this adjustment qualitatively; the 1.05 multiplier is the
 * classical practice carried over from the 6th edition.
 */
export const V_RETURN_AI_MULTIPLIER = 1.05;
