import { describe, it, expect } from 'vitest';
import { EvidenceRepository } from '../../src/server/evidenceRepository.js';
import { makeNormalizedRecord } from './helpers.js';

function buildRepo(
  records: ReturnType<typeof makeNormalizedRecord>[],
  opts: { forceEligible?: boolean } = {}
) {
  const forceEligible = opts.forceEligible ?? true;
  const list = forceEligible
    ? records.map(r => ({ ...r, isEligibleForScoring: true }))
    : records;
  const eligible = list.filter(r => r.isEligibleForScoring);
  const excluded = list
    .filter(r => !r.isEligibleForScoring)
    .map(r => ({ evidence: r, reason: 'test-excluded' }));
  return new EvidenceRepository(list, eligible, excluded);
}

describe('EvidenceRepository', () => {
  it('indexes by topic (case-insensitive) and filters eligible', () => {
    const r1 = makeNormalizedRecord({ evidence_id: 'A', topic: 'Battery', isEligibleForScoring: true });
    const r2 = makeNormalizedRecord({ evidence_id: 'B', topic: 'camera', isEligibleForScoring: false });
    const repo = buildRepo([r1, r2]);
    const batteryAll = repo.getByTopic('battery', false);
    const batteryEligible = repo.getByTopic('battery', true);
    expect(batteryAll.length).toBe(1);
    expect(batteryEligible.length).toBe(1);
    expect(batteryEligible[0].evidence_id).toBe('A');
  });

  it('getBySource filters by source string', () => {
    const r1 = makeNormalizedRecord({ evidence_id: 'A', source: 'Reviewer X', isEligibleForScoring: true });
    const r2 = makeNormalizedRecord({ evidence_id: 'B', source: 'Reviewer Y', isEligibleForScoring: true });
    const repo = buildRepo([r1, r2]);
    const x = repo.getBySource('Reviewer X', false);
    expect(x.length).toBe(1);
    expect(x[0].evidence_id).toBe('A');
  });

  it('getIndependentSources groups by (source, review_id)', () => {
    const r1 = makeNormalizedRecord({ evidence_id: 'A', source: 'Reviewer X', review_id: 'vid-1' });
    const r2 = makeNormalizedRecord({ evidence_id: 'B', source: 'Reviewer X', review_id: 'vid-2' });
    const r3 = makeNormalizedRecord({ evidence_id: 'C', source: 'Reviewer Y', review_id: 'vid-3' });
    const repo = buildRepo([r1, r2, r3]);
    const sources = repo.getIndependentSources();
    expect(sources.length).toBe(3);  // 3 distinct (source, review_id) pairs
    expect(sources.every(s => s.count === 1)).toBe(true);
  });

  it('getById respects onlyEligible option', () => {
    const r1 = makeNormalizedRecord({ evidence_id: 'A', isEligibleForScoring: false });
    const repo = buildRepo([r1], { forceEligible: false });
    // Full lookup returns record
    expect(repo.getById('A')).toBeDefined();
    // Only-eligible lookup returns undefined
    expect(repo.getById('A', { onlyEligible: true })).toBeUndefined();
    });

    it('getById returns eligible record when forceEligible and isEligible', () => {
    const r1 = makeNormalizedRecord({ evidence_id: 'B', isEligibleForScoring: true });
    const repo = buildRepo([r1]);
    expect(repo.getById('B')).toBeDefined();
    expect(repo.getById('B', { onlyEligible: true })).toBeDefined();
    });

    it('getById returns undefined for unknown ID', () => {
    const repo = buildRepo([makeNormalizedRecord({ evidence_id: 'X' })]);
    expect(repo.getById('NONEXISTENT')).toBeUndefined();
    expect(repo.getById('NONEXISTENT', { onlyEligible: true })).toBeUndefined();
    });

  it('detectConflictsWithIds catches EXACT chipset mismatch', () => {
    const r1 = makeNormalizedRecord({
      evidence_id: 'C1', attribute: 'chipset', attribute_value: 'Exynos 1380',
      source: 'R1', review_id: 'v1', isEligibleForScoring: true,
    });
    const r2 = makeNormalizedRecord({
      evidence_id: 'C2', attribute: 'chipset', attribute_value: 'Snapdragon 7',
      source: 'R2', review_id: 'v2', isEligibleForScoring: true,
    });
    const repo = buildRepo([r1, r2]);
    const { conflicts, conflictedIds } = repo.detectConflictsWithIds();
    const chipsetConflict = conflicts.find(c => c.attribute === 'chipset');
    expect(chipsetConflict).toBeDefined();
    expect(chipsetConflict?.isCritical).toBe(true);
    expect(conflictedIds.has('C1')).toBe(true);
    expect(conflictedIds.has('C2')).toBe(true);
  });

  it('detectConflictsWithIds does NOT flag price with different contexts (CONTEXT_AWARE)', () => {
    const r1 = makeNormalizedRecord({
      evidence_id: 'P1', attribute: 'price', value: 3999000, context: 'official SRP',
      source: 'R1', review_id: 'v1', isEligibleForScoring: true,
    });
    const r2 = makeNormalizedRecord({
      evidence_id: 'P2', attribute: 'price', value: 3399000, context: 'marketplace promo',
      source: 'R2', review_id: 'v2', isEligibleForScoring: true,
    });
    const repo = buildRepo([r1, r2]);
    const { conflicts } = repo.detectConflictsWithIds();
    const priceConflict = conflicts.find(c => c.attribute === 'price');
    expect(priceConflict).toBeUndefined();
  });

  it('detectConflictsWithIds does NOT flag benchmark within 5% variance (PERCENT_5)', () => {
    const r1 = makeNormalizedRecord({
      evidence_id: 'A1', attribute: 'antutu_10_score', value: 608000,
      source: 'R1', review_id: 'v1', isEligibleForScoring: true,
    });
    const r2 = makeNormalizedRecord({
      evidence_id: 'A2', attribute: 'antutu_10_score', value: 609000,
      source: 'R2', review_id: 'v2', isEligibleForScoring: true,
    });
    const repo = buildRepo([r1, r2]);
    const { conflicts } = repo.detectConflictsWithIds();
    const benchConflict = conflicts.find(c => c.attribute === 'antutu_10_score');
    expect(benchConflict).toBeUndefined();  // <5% variance = not a conflict
  });
});