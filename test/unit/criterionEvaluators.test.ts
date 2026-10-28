import { describe, it, test, expect } from 'vitest';
import assert from 'node:assert/strict';
import type { NormalizedEvidence } from '../../src/server/types.js';
import {
  evaluateCamera,
  evaluateDurability,
  evaluateDisplay,
  evaluatePerformance,
  evaluatePrice,
  evaluateSoftware,
} from '../../src/server//criterionEvaluators.js';

/** Minimal fixture; fields not used by these evaluators are supplied by the app's NormalizedEvidence type. */
function ev(
  evidence_id: string,
  attribute: string,
  value: string | number | boolean,
  options: Partial<NormalizedEvidence> = {},
): NormalizedEvidence {
  return {
    evidence_id,
    attribute,
    value,
    attribute_value: typeof value === 'string' ? value : String(value),
    claim: `${attribute}: ${String(value)}`,
    ...options,
  } as NormalizedEvidence;
}

test('price uses the lowest valid purchase_price and parses Indonesian thousands separators', () => {
  const result = evaluatePrice([
    ev('official', 'price', 'Rp 4.000.000'),
    ev('promo-high', 'purchase_price', '3.800.000'),
    ev('promo-low', 'purchase_price', '3.400.000'),
  ]);

  assert.equal(result.score, 3.6);
  assert.deepEqual(result.positiveDrivers.map(x => x.delta), [0.6]);
  assert.deepEqual(result.positiveDrivers[0]?.evidenceIds, ['promo-low']);
});

test('decimal RAM value 8.0 remains 8 rather than being parsed as 80', () => {
  const result = evaluatePerformance([
    ev('ram-8', 'ram_capacity', '8.0', { unit: 'GB', attribute_value: '8.0 GB' }),
  ]);

  assert.equal(result.score, 3.15);
  assert.equal(result.positiveDrivers[0]?.delta, 0.15);
});

test('negative ultrawide claim "tidak ada" does not trigger the positive bonus', () => {
  const result = evaluateCamera([
    ev('uw-no', 'ultrawide_presence', 'tidak ada'),
  ]);

  assert.equal(result.score, 3);
  assert.equal(result.positiveDrivers.length, 0);
});

test('positive ultrawide claim still earns the rubric bonus', () => {
  const result = evaluateCamera([
    ev('uw-yes', 'ultrawide_presence', 'tersedia'),
  ]);

  assert.equal(result.score, 3.2);
  assert.equal(result.positiveDrivers[0]?.delta, 0.2);
});

test('duplicate AI evidence for one feature does not count as five distinct features', () => {
  const evidence = Array.from({ length: 5 }, (_, i) => ev(
    `ai-dup-${i}`,
    'ai_feature',
    'Circle to Search',
    { attribute_value: 'Circle to Search', claim: `Mendukung Circle to Search (sumber ${i})` },
  ));

  const result = evaluateSoftware(evidence);
  assert.equal(result.score, 3);
  assert.equal(result.positiveDrivers.length, 0);
});

test('five distinct AI features earn exactly one AI bonus', () => {
  const evidence = ['Circle to Search', 'Object Eraser', 'Edit Suggestions', 'AI Select', 'Transcript Assist']
    .map((feature, i) => ev(`ai-${i}`, 'ai_feature', feature, { attribute_value: feature }));

  const result = evaluateSoftware(evidence);
  assert.equal(result.score, 3.2);
  assert.equal(result.positiveDrivers.filter(x => x.text.includes('fitur AI')).length, 1);
});

test('IP rating selection uses the highest recognized rating instead of the first record', () => {
  const result = evaluateDurability([
    ev('ip67', 'certification', 'IP67'),
    ev('ip68', 'ip_rating', 'IP68'),
  ]);

  assert.equal(result.score, 4);
  assert.deepEqual(result.positiveDrivers.map(x => x.evidenceIds[0]), ['ip68']);
});

test('missing evidence stays unrated (null), not zero or baseline three', () => {
  const result = evaluatePrice([]);
  assert.equal(result.score, null);
  assert.equal(result.isRated, false);
  assert.equal(result.unratedReason, 'NO_PRICE_EVIDENCE');
});

test('"tidak disertakan" charger claim applies one penalty without matching positive words', () => {
  const result = evaluatePrice([
    ev('price', 'price', 'Rp 4.000.000'),
    ev('charger-no', 'charger_included', 'tidak disertakan'),
  ]);

  assert.equal(result.score, 2.7);
  assert.equal(result.negativeDeductions.length, 1);
});

test('EIS limitation is penalized only for a negative or explicitly limited claim', () => {
  const available = evaluateCamera([
    ev('main', 'main_camera_resolution', 50),
    ev('eis-yes', 'eis_availability', 'EIS tersedia'),
  ]);
  const unavailable = evaluateCamera([
    ev('main', 'main_camera_resolution', 50),
    ev('eis-no', 'eis_availability', 'EIS tidak tersedia pada 4K'),
  ]);

  assert.equal(available.score, 3.2);
  assert.equal(unavailable.score, 3);
});

test('duplicate notch attributes do not double-apply the same penalty', () => {
  const result = evaluateDisplay([
    ev('notch-type', 'notch_type', 'waterdrop'),
    ev('notch-design', 'notch_design', 'waterdrop'),
  ]);

  assert.equal(result.score, 2.5);
  assert.equal(result.negativeDeductions.length, 1);
});

test('ultrawide_camera_presence=available adds one positive driver', () => {
  const result = evaluateCamera([
    ev('main', 'main_camera_resolution', 50),
    ev('ultrawide', 'ultrawide_camera_presence', 'available'),
  ]);

  expect(result.score).toBe(3.4);
  expect(result.positiveDrivers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: 'Kamera ultrawide tersedia',
        evidenceIds: ['ultrawide'],
        delta: 0.2,
      }),
    ]),
  );
});
