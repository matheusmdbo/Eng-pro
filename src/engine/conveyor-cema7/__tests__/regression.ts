/**
 * Regression test runner — validates the engine against the CEMA worked
 * examples that shipped in the original HTML prototype (Rev11).
 *
 * Usage (Node ≥ 18):
 *   npx tsx engine/__tests__/regression.ts
 *
 * Or via Vitest:
 *   import it from the vitest.config in the host Next.js app.
 */

import { compute } from '../domain/compute';
import { VALIDATION_CASES } from '../validationCases';
import { estimateBeltWeight } from '../domain/tables/beltWeight';
import { ktFromTemp } from '../domain/tables/kt';
import { kyFromSlope } from '../domain/tables/ky';
import {
  edgeDistancePerSideM,
  interpolateAvailableAreaM2,
} from '../domain/tables/crossSection';
import { requiredLiveAreaM2 } from '../domain/geometry';

// ─── Tiny test framework ─────────────────────────────────────────────────────

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

const test = (name: string, fn: () => void): void => {
  try {
    fn();
    results.push({ name, ok: true, detail: '' });
  } catch (err) {
    results.push({
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
};

const nearly = (actual: number, expected: number, tolPct: number, label: string): void => {
  if (!Number.isFinite(actual)) throw new Error(`${label}: actual is not finite (${actual})`);
  if (!Number.isFinite(expected)) throw new Error(`${label}: expected is not finite (${expected})`);
  const diffPct = Math.abs((actual - expected) / expected) * 100;
  if (diffPct > tolPct) {
    throw new Error(
      `${label}: ${actual.toFixed(6)} vs expected ${expected.toFixed(6)} — Δ ${diffPct.toFixed(4)} % > tol ${tolPct} %`,
    );
  }
};

// ─── Unit tests on tables ────────────────────────────────────────────────────

// Note: the CEMA Kt curve is flat (Kt = 1.00) above +60 °F (≈ +15.6 °C).
// So anything from 20 °C (68 °F) up to +50 °C is expected to be 1.00.
test('Kt curve: 20 °C (68 °F, above plateau) → 1.00', () => {
  nearly(ktFromTemp(20), 1.0, 0.01, 'Kt(20 °C)');
});

test('Kt curve: 0 °C (32 °F) → ≈ 1.09', () => {
  // 32 °F sits between the 30 °F (1.09) and 40 °F (1.05) breakpoints.
  nearly(ktFromTemp(0), 1.082, 1.0, 'Kt(0 °C)');
});

test('Kt curve: −20 °C (−4 °F) → ≈ 1.30', () => {
  // −4 °F sits between the −10 °F (1.35) and 0 °F (1.27) breakpoints.
  nearly(ktFromTemp(-20), 1.302, 1.0, 'Kt(-20 °C)');
});

test('Kt curve: −40 °C (−40 °F, low bound) → 1.65', () => {
  nearly(ktFromTemp(-40), 1.65, 0.01, 'Kt(-40 °C)');
});

test('Kt curve — same value via Celsius and Fahrenheit', () => {
  const c = ktFromTemp(-10);
  const f = ktFromTemp(14, { unit: 'F' }); // -10 °C = 14 °F
  nearly(c, f, 0.01, 'Kt(C) vs Kt(F) for the same temperature');
});

test('Ky: level, 100 lb/ft, 4 ft spacing', () => {
  nearly(kyFromSlope(0, 100, 4), 0.0215, 2, 'Ky(level, 100, 4 ft)');
});

test('Ky: steep slope, 200 lb/ft, 4.5 ft spacing', () => {
  nearly(kyFromSlope(6, 200, 4.5), 0.0320, 3, 'Ky(steep, 200, 4.5 ft)');
});

test('Edge distance: 1.2 m belt → 2·(0.05·1200 + 25) mm', () => {
  const expected = 2 * (0.05 * 1200 + 25);
  const calc = 2 * edgeDistancePerSideM(1.2) * 1000;
  nearly(calc, expected, 0.01, 'Edge clearance');
});

test('Belt weight estimate: 1200 mm / light duty', () => {
  const e = estimateBeltWeight(1200, 1.0, false);
  // 48 in column, low row → 14.0 lb/ft
  nearly(e.lbft, 14.0, 1, 'Belt weight 48 in light');
});

test('Belt weight estimate: steel-cord multiplier', () => {
  const e = estimateBeltWeight(1200, 1.0, true);
  nearly(e.lbft, 14.0 * 1.5, 1, 'Belt weight 48 in light + steel-cord');
});

test('CEMA available area — 36 in, 35° trough, 20° surcharge', () => {
  const area = interpolateAvailableAreaM2(36 * 0.0254, 35, 20);
  nearly(area, 0.1223, 0.5, 'A(36, 35°, 20°)');
});

test('CEMA available area — 48 in, 45° trough, 20° surcharge', () => {
  const area = interpolateAvailableAreaM2(48 * 0.0254, 45, 20);
  nearly(area, 0.2468, 0.5, 'A(48, 45°, 20°)');
});

test('Live area identity: Q / (3600 · ρ · v) = 1200 / (3600 · 1.60 · 3.00)', () => {
  const expected = 1200 / (3600 * 1.6 * 3.0);
  nearly(requiredLiveAreaM2(1200, 1.6, 3.0), expected, 0.01, 'Live area');
});

// ─── Regression tests against the published worked examples ──────────────────

for (const v of VALIDATION_CASES) {
  test(`[Case] ${v.label} — Te`, () => {
    const r = compute(v.input);
    nearly(r.teLbf, v.expected.teLbf, v.tolerancePct, `${v.id}.Te`);
  });
  test(`[Case] ${v.label} — Belt HP`, () => {
    const r = compute(v.input);
    nearly(r.beltHp, v.expected.beltHp, v.tolerancePct, `${v.id}.beltHp`);
  });
  test(`[Case] ${v.label} — T2`, () => {
    const r = compute(v.input);
    nearly(r.t2Lbf, v.expected.t2Lbf, v.tolerancePct, `${v.id}.T2`);
  });
  test(`[Case] ${v.label} — T1`, () => {
    const r = compute(v.input);
    nearly(r.t1Lbf, v.expected.t1Lbf, v.tolerancePct, `${v.id}.T1`);
  });
}

// ─── Summary ────────────────────────────────────────────────────────────────

// Extra diagnostic — always prints the AGH breakdown so Wm/T0 can be
// audited against the source workbook even when the test passes.
{
  const agh = VALIDATION_CASES[0];
  const r = compute(agh.input);
  /* eslint-disable no-console */
  console.log('\n┈ AGH/CEMA decomposition (for audit):');
  console.log(`   Wb = ${r.beltWeightLbft.toFixed(3)} lb/ft   (source uses 11.0)`);
  console.log(`   Wm = ${r.wmLbft.toFixed(3)} lb/ft   (source uses 55.0)`);
  console.log(`   T0 = ${r.t0Lbf.toFixed(2)} lbf`);
  console.log(`   T2 slip = ${r.t2SlipLbf.toFixed(2)}  |  T2 sag = ${r.t2SagLbf.toFixed(2)}  → T2 = ${r.t2Lbf.toFixed(2)} (${r.governingSource})`);
  console.log(`   ΔT2 vs expected: ${(r.t2Lbf - agh.expected.t2Lbf).toFixed(2)} lbf  ≈ ${((r.t2Lbf/agh.expected.t2Lbf - 1)*100).toFixed(2)} %`);
  /* eslint-enable no-console */
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - s.length));

/* eslint-disable no-console */
console.log('━'.repeat(80));
console.log(`Conveyor-CEMA7 engine regression — ${passed}/${results.length} passed`);
console.log('━'.repeat(80));
for (const r of results) {
  const tag = r.ok ? '  ✔' : '  ✘';
  console.log(`${tag}  ${pad(r.name, 60)}  ${r.detail}`);
}
console.log('━'.repeat(80));
if (failed.length > 0) {
  console.log(`FAILED ${failed.length} test(s):`);
  for (const f of failed) console.log(`   • ${f.name} — ${f.detail}`);
  // Signal failure via non-zero exit when available (Node).
  (globalThis as { process?: { exit: (code: number) => never } }).process?.exit(1);
  throw new Error(`${failed.length} test(s) failed`);
} else {
  console.log('All tests passed ✔');
  (globalThis as { process?: { exit: (code: number) => never } }).process?.exit(0);
}
