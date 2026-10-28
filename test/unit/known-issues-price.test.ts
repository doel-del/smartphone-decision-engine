import { describe, it, expect } from 'vitest';
import {
  evaluatePrice,
  normalizePriceValue,
  lowestNormalizedPrice,
} from '../../src/server/criterionEvaluators.js';
import { runDecisionEngine } from '../../src/server/decisionEngine.js';
import { EvidenceRepository } from '../../src/server/evidenceRepository.js';
import { makeNormalizedRecord } from './helpers.js';
import type { DecisionResult } from '../../src/server/types.js';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * BEHAVIOR CHANGE NOTICE (F5):
 * `primaryFindings` / `primaryFindingsDetail` in evaluatePrice output are
 * now sorted by evidence_id (deterministic). This MAY change which
 * findings are displayed when dataset has >2 matching findings.
 * NOT a relevance ranking — deterministic stable order, not quality ranking.
 * Documented in docs/ARCHITECTURE.md changelog (pending).
 * ═══════════════════════════════════════════════════════════════════════
 */

function makePriceRecord(
  id: string,
  value: number | string | null,
  unit: string | null,
  source = 'Test Reviewer'
) {
  return makeNormalizedRecord({
    evidence_id: id,
    topic: 'price',
    attribute: 'purchase_price',
    value,
    unit,
    attribute_value: unit ? `${value} ${unit}` : `${value}`,
    claim: `Harga ${value}${unit ? ' ' + unit : ''}`,
    source,
    review_id: `rev-${source.toLowerCase().replace(/\s/g, '-')}`,
  });
}

// Strip non-deterministic fields before comparison
function stripNonDeterministic(d: DecisionResult): Omit<DecisionResult, 'generatedAt'> {
  const { generatedAt, ...rest } = d;
  return rest;
}

// ─────────────────────────────────────────────────────────────
// A. Structural sanity
// ─────────────────────────────────────────────────────────────
describe('A — EvalResult shape', () => {
  it('evaluatePrice returns expected fields for test fixture', () => {
    const r = makePriceRecord('A', 3.4, 'juta');
    const result = evaluatePrice([r]);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('primaryFindings');
    expect(result).toHaveProperty('primaryFindingsDetail');
    expect(Array.isArray(result.primaryFindingsDetail)).toBe(true);
    expect(result.primaryFindingsDetail[0]).toHaveProperty('evidenceIds');
  });
});

// ─────────────────────────────────────────────────────────────
// B. normalizePriceValue — whitelist + F1 overflow
// ─────────────────────────────────────────────────────────────
describe('B — normalizePriceValue', () => {
  it('accepts juta/jt → multiply 1M', () => {
    expect(normalizePriceValue(3.8, 'juta')).toBe(3_800_000);
    expect(normalizePriceValue(3.8, 'jt')).toBe(3_800_000);
    expect(normalizePriceValue(3.8, 'JUTA')).toBe(3_800_000);
  });

  it('accepts ribu/rb → multiply 1K', () => {
    expect(normalizePriceValue(500, 'ribu')).toBe(500_000);
    expect(normalizePriceValue(500, 'rb')).toBe(500_000);
  });

  it('accepts IDR/rupiah/rp → as-is', () => {
    expect(normalizePriceValue(3_999_000, 'IDR')).toBe(3_999_000);
    expect(normalizePriceValue(3_999_000, 'rupiah')).toBe(3_999_000);
    expect(normalizePriceValue(3_999_000, 'Rp')).toBe(3_999_000);
  });

  it('rejects ambiguous aliases: m, k, million, thousand', () => {
    expect(normalizePriceValue(3.8, 'm')).toBeNull();
    expect(normalizePriceValue(500, 'k')).toBeNull();
    expect(normalizePriceValue(3.8, 'million')).toBeNull();
    expect(normalizePriceValue(500, 'thousand')).toBeNull();
  });

  it('rejects unknown/empty units', () => {
    expect(normalizePriceValue(3.8, null)).toBeNull();
    expect(normalizePriceValue(3.8, '')).toBeNull();
    expect(normalizePriceValue(3.8, '   ')).toBeNull();
    expect(normalizePriceValue(3.8, 'weird')).toBeNull();
  });

  it('rejects null/NaN/Infinity values', () => {
    expect(normalizePriceValue(null, 'juta')).toBeNull();
    expect(normalizePriceValue(NaN, 'juta')).toBeNull();
    expect(normalizePriceValue(Infinity, 'juta')).toBeNull();
    expect(normalizePriceValue(-Infinity, 'juta')).toBeNull();
  });

  it('F1: rejects overflow on "juta" multiplication', () => {
    expect(normalizePriceValue(1e308, 'juta')).toBeNull();
    expect(normalizePriceValue(Number.MAX_VALUE, 'juta')).toBeNull();
  });

  it('F1: rejects overflow on "ribu" multiplication', () => {
    expect(normalizePriceValue(1e307, 'ribu')).toBeNull();
    expect(normalizePriceValue(Number.MAX_VALUE, 'ribu')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// C. lowestNormalizedPrice — normalize-first + tie-break
// ─────────────────────────────────────────────────────────────
describe('C — lowestNormalizedPrice', () => {
  it('normalizes before comparing (mixed units)', () => {
    const a = makePriceRecord('A', 3.8, 'juta');
    const b = makePriceRecord('B', 3_500_000, 'IDR');
    const result = lowestNormalizedPrice([a, b], 'purchase_price');
    expect(result?.normalizedValue).toBe(3_500_000);
    expect(result?.evidence.evidence_id).toBe('B');
  });

  it('tie-break by evidence_id when prices equal', () => {
    const b = makePriceRecord('B', 3.8, 'juta');
    const a = makePriceRecord('A', 3.8, 'juta');
    const r1 = lowestNormalizedPrice([b, a], 'purchase_price');
    const r2 = lowestNormalizedPrice([a, b], 'purchase_price');
    expect(r1?.evidence.evidence_id).toBe('A');
    expect(r2?.evidence.evidence_id).toBe('A');
  });

  it('skips records with unknown units', () => {
    const valid = makePriceRecord('VALID', 3.8, 'juta');
    const unknown = makePriceRecord('UNK', 3.9, 'unknown_unit');
    const result = lowestNormalizedPrice([valid, unknown], 'purchase_price');
    expect(result?.evidence.evidence_id).toBe('VALID');
  });

  it('returns null if all records have unknown units', () => {
    const a = makePriceRecord('A', 3.8, 'unknown_1');
    const b = makePriceRecord('B', 3.9, 'unknown_2');
    expect(lowestNormalizedPrice([a, b], 'purchase_price')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// D. evaluatePrice — classification + F3 price-only
// ─────────────────────────────────────────────────────────────
describe('D — evaluatePrice unrated classification', () => {
  it('NO_PRICE_EVIDENCE — no price records at all', () => {
    const nonPrice = makeNormalizedRecord({
      evidence_id: 'X', attribute: 'battery_capacity', value: 5000, unit: 'mAh',
    });
    expect(evaluatePrice([nonPrice]).unratedReason).toBe('NO_PRICE_EVIDENCE');
  });

  it('PRICE_VALUES_INVALID — all values null/invalid', () => {
    const a = makePriceRecord('A', null, 'IDR');
    const b = makePriceRecord('B', null, 'juta');
    const result = evaluatePrice([a, b]);
    expect(result.isRated).toBe(false);
    expect(result.unratedReason).toBe('PRICE_VALUES_INVALID');
  });

  it('PRICE_NOT_NORMALIZABLE — valid values but missing unit', () => {
    const a = makePriceRecord('A', 3.8, null);
    const b = makePriceRecord('B', 3.9, null);
    const result = evaluatePrice([a, b]);
    expect(result.unratedReason).toBe('PRICE_NOT_NORMALIZABLE');
  });

  it('mixed invalid value + valid value + missing unit → PRICE_NOT_NORMALIZABLE', () => {
    const a = makeNormalizedRecord({
      evidence_id: 'A', attribute: 'purchase_price',
      value: null, unit: 'IDR',
      claim: 'unknown', source: 'S', review_id: 'R',
    });
    const b = makePriceRecord('B', 3.8, null);
    const result = evaluatePrice([a, b]);
    expect(result.unratedReason).toBe('PRICE_NOT_NORMALIZABLE');
  });

  it('mixed invalid value + valid value + valid unit → evaluated', () => {
    const a = makeNormalizedRecord({
      evidence_id: 'A', attribute: 'purchase_price',
      value: null, unit: 'IDR',
      claim: 'unknown', source: 'S', review_id: 'R',
    });
    const b = makePriceRecord('B', 3.4, 'juta');
    const result = evaluatePrice([a, b]);
    expect(result.isRated).toBe(true);
    expect(result.positiveDrivers.find(d => d.delta === 0.6)?.evidenceIds).toEqual(['B']);
  });

  it('F3: `price` attribute only → rated (base), NO promo bonus', () => {
    const priceOnly = makeNormalizedRecord({
      evidence_id: 'PRICE-ONLY', attribute: 'price',
      value: 3_999_000, unit: 'IDR',
      claim: 'Harga pasar 3.999.000', source: 'S', review_id: 'R',
    });
    const result = evaluatePrice([priceOnly]);
    expect(result.isRated).toBe(true);
    expect(result.positiveDrivers.find(d => d.text.includes('promo'))).toBeUndefined();
  });

  it('F3: `price` attribute only → evaluatePrice rated, engine strips when unpublished', () => {
    const priceOnly = makeNormalizedRecord({
      evidence_id: 'PRICE-ONLY', attribute: 'price',
      value: 3_999_000, unit: 'IDR',
      claim: 'Harga pasar', source: 'S', review_id: 'R',
    });
    // Assert evaluator directly — no engine strip
    const evalResult = evaluatePrice([priceOnly]);
    expect(evalResult.isRated).toBe(true);
    expect(evalResult.score).toBe(3.0);  // base, no bonus
    expect(evalResult.positiveDrivers.find(d => d.text.includes('promo'))).toBeUndefined();

    // Engine with only 1 price record → coverage < 60% → strips (expected)
    const repo = new EvidenceRepository([priceOnly], [priceOnly], []);
    const decision = runDecisionEngine(repo);
    expect(decision.pricingSummary).toBeNull();
    expect(decision.decisionStatus).toBe('INSUFFICIENT_EVIDENCE');
  });
});

// ─────────────────────────────────────────────────────────────
// E. evaluatePrice — bonus calculation
// ─────────────────────────────────────────────────────────────
describe('E — evaluatePrice bonus', () => {
  it('3.4 juta → +0.6 (3,400,000 < 3,500,000)', () => {
    const r = makePriceRecord('A', 3.4, 'juta');
    const result = evaluatePrice([r]);
    expect(result.positiveDrivers.find(d => d.delta === 0.6)?.evidenceIds).toEqual(['A']);
    expect(result.positiveDrivers.find(d => d.delta === 0.3)).toBeUndefined();
  });

  it('3.8 juta → +0.3 (3,800,000 < 4,000,000, NOT < 3,500,000)', () => {
    const r = makePriceRecord('A', 3.8, 'juta');
    const result = evaluatePrice([r]);
    expect(result.positiveDrivers.find(d => d.delta === 0.6)).toBeUndefined();
    expect(result.positiveDrivers.find(d => d.delta === 0.3)?.evidenceIds).toEqual(['A']);
  });

  it('mixed units: 3.4 juta vs 3,450,000 IDR → pick 3.4M, +0.6', () => {
    const a = makePriceRecord('A', 3.4, 'juta');
    const b = makePriceRecord('B', 3_450_000, 'IDR');
    const result = evaluatePrice([b, a]);
    expect(result.positiveDrivers.find(d => d.delta === 0.6)?.evidenceIds).toEqual(['A']);
  });
});

// ─────────────────────────────────────────────────────────────
// F. Determinism
// ─────────────────────────────────────────────────────────────
describe('F — determinism', () => {
  it('evaluatePrice full output identical across permutations', () => {
    const r1 = makePriceRecord('A', 3.4, 'juta');
    const r2 = makePriceRecord('B', 3.8, 'juta');
    const r3 = makePriceRecord('C', 3_900_000, 'IDR');

    const permutations = [
      [r1, r2, r3], [r1, r3, r2], [r2, r1, r3],
      [r2, r3, r1], [r3, r1, r2], [r3, r2, r1],
    ].map(arr => evaluatePrice(arr));

    const baseline = JSON.stringify(permutations[0]);
    for (const p of permutations.slice(1)) {
      expect(JSON.stringify(p)).toBe(baseline);
    }
  });

  it('F5: findings sorted by evidence_id', () => {
    const rZ = makePriceRecord('ZZZ', 3.6, 'juta');
    const rA = makePriceRecord('AAA', 3.7, 'juta');
    const rM = makePriceRecord('MMM', 3.8, 'juta');

    const result = evaluatePrice([rZ, rA, rM]);
    expect(result.primaryFindingsDetail[0].evidenceIds).toEqual(['AAA']);
  });

  it('F5: findings order is by ID, NOT by price relevance (documented behavior)', () => {
    // Highest price has lowest ID — should appear first (NOT by relevance)
    const low = makePriceRecord('AAA', 3.9, 'juta');
    const mid = makePriceRecord('MMM', 3.7, 'juta');
    const high = makePriceRecord('ZZZ', 3.4, 'juta');

    const result = evaluatePrice([low, mid, high]);
    expect(result.primaryFindingsDetail[0].evidenceIds).toEqual(['AAA']);
    expect(result.primaryFindingsDetail[1].evidenceIds).toEqual(['MMM']);
    // ZZZ (best price) not shown — only 2 findings
  });

  it('F2: bestMatch selects lowest evidence_id among multiple matches', () => {
    const storageB = makeNormalizedRecord({
      evidence_id: 'STORAGE-B', attribute: 'expandable_storage',
      value: 'ya', attribute_value: 'ya',
      claim: 'Ya, microSD slot tersedia',
      source: 'S', review_id: 'R',
    });
    const storageA = makeNormalizedRecord({
      evidence_id: 'STORAGE-A', attribute: 'expandable_storage',
      value: 'microSD', attribute_value: 'microSD',
      claim: 'microSD slot',
      source: 'S', review_id: 'R',
    });
    const price = makePriceRecord('PRICE', 3.8, 'juta');

    const result1 = evaluatePrice([storageB, storageA, price]);
    const result2 = evaluatePrice([storageA, storageB, price]);

    const sd1 = result1.positiveDrivers.find(d => d.text.includes('microSD'));
    const sd2 = result2.positiveDrivers.find(d => d.text.includes('microSD'));
    expect(sd1?.evidenceIds).toEqual(['STORAGE-A']);
    expect(sd2?.evidenceIds).toEqual(['STORAGE-A']);
  });

  it('F2: runDecisionEngine full output permutation-invariant (stripped generatedAt)', () => {
    const r1 = makePriceRecord('A', 3.4, 'juta');
    const r2 = makePriceRecord('B', 3.8, 'juta');
    const storageA = makeNormalizedRecord({
      evidence_id: 'STORAGE-A', attribute: 'expandable_storage',
      value: 'ya', claim: 'ya', source: 'S', review_id: 'R',
    });
    const storageB = makeNormalizedRecord({
      evidence_id: 'STORAGE-B', attribute: 'expandable_storage',
      value: 'microSD', claim: 'microSD', source: 'S', review_id: 'R',
    });

    const all1 = [r1, r2, storageA, storageB];
    const all2 = [storageB, r2, r1, storageA];
    const all3 = [r2, storageA, r1, storageB];

    const repo1 = new EvidenceRepository(all1, all1, []);
    const repo2 = new EvidenceRepository(all2, all2, []);
    const repo3 = new EvidenceRepository(all3, all3, []);

    const d1 = stripNonDeterministic(runDecisionEngine(repo1));
    const d2 = stripNonDeterministic(runDecisionEngine(repo2));
    const d3 = stripNonDeterministic(runDecisionEngine(repo3));

    expect(JSON.stringify(d1)).toBe(JSON.stringify(d2));
    expect(JSON.stringify(d1)).toBe(JSON.stringify(d3));
  });
});

// ─────────────────────────────────────────────────────────────
// G. pricingSummary consistency (F-02)
// ─────────────────────────────────────────────────────────────
describe('G — pricingSummary consistency', () => {
  it('pricingSummary.promoPrice matches evaluatePrice selection', () => {
    const low = makePriceRecord('LOW', 3.4, 'juta');
    const high = makePriceRecord('HIGH', 3.8, 'juta');
    const all = [low, high];

    const repo = new EvidenceRepository(all, all, []);
    const decision = runDecisionEngine(repo);
    const evalResult = evaluatePrice(all);

    expect(decision.pricingSummary?.promoPrice).toBe(3_400_000);
    expect(decision.pricingSummary?.evidenceIds).toContain('LOW');
    expect(evalResult.positiveDrivers.find(d => d.delta === 0.6)?.evidenceIds).toEqual(['LOW']);
  });

  it('pricingSummary is order-independent', () => {
    const low = makePriceRecord('LOW', 3.4, 'juta');
    const high = makePriceRecord('HIGH', 3.8, 'juta');
    const repo1 = new EvidenceRepository([low, high], [low, high], []);
    const repo2 = new EvidenceRepository([high, low], [high, low], []);
    expect(runDecisionEngine(repo1).pricingSummary?.promoPrice).toBe(3_400_000);
    expect(runDecisionEngine(repo2).pricingSummary?.promoPrice).toBe(3_400_000);
  });

  it('official + promo with different units → both correct', () => {
    const official = makeNormalizedRecord({
      evidence_id: 'OFFICIAL', attribute: 'official_price',
      value: 4, unit: 'juta',
      claim: 'Harga resmi 4 juta', source: 'S', review_id: 'R',
    });
    const promo = makePriceRecord('PROMO', 3.4, 'juta');
    const all = [official, promo];

    const repo = new EvidenceRepository(all, all, []);
    const decision = runDecisionEngine(repo);
    expect(decision.pricingSummary?.officialPrice).toBe(4_000_000);
    expect(decision.pricingSummary?.promoPrice).toBe(3_400_000);
  });
});

// ─────────────────────────────────────────────────────────────
// H. Strict parser (P-01)
// ─────────────────────────────────────────────────────────────
describe('H — strict parser', () => {
  it('rejects "3.999.000" (multi-separator)', () => {
    const r = makeNormalizedRecord({
      evidence_id: 'A', attribute: 'purchase_price',
      value: '3.999.000', unit: 'IDR',
      claim: 'test', source: 'S', review_id: 'R',
    });
    expect(evaluatePrice([r]).unratedReason).toBe('PRICE_VALUES_INVALID');
  });

  it('rejects "1.234" (ambiguous)', () => {
    const r = makeNormalizedRecord({
      evidence_id: 'A', attribute: 'purchase_price',
      value: '1.234', unit: 'juta',
      claim: 'test', source: 'S', review_id: 'R',
    });
    expect(evaluatePrice([r]).unratedReason).toBe('PRICE_VALUES_INVALID');
  });

  it('accepts "3.8" string', () => {
    const r = makeNormalizedRecord({
      evidence_id: 'A', attribute: 'purchase_price',
      value: '3.8', unit: 'juta',
      claim: 'test', source: 'S', review_id: 'R',
    });
    expect(evaluatePrice([r]).isRated).toBe(true);
  });
});