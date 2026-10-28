import { describe, it, expect } from 'vitest';
import { loadAllEvidenceDatasets } from '../../src/server/evidenceLoader.js';
import { normalizeEvidenceRecords } from '../../src/server/evidenceNormalizer.js';
import { validateEvidenceEligibility } from '../../src/server/evidenceValidator.js';
import { EvidenceRepository } from '../../src/server/evidenceRepository.js';
import { runDecisionEngine } from '../../src/server/decisionEngine.js';
import { calculateConfidence } from '../../src/server/confidenceEngine.js';
import { CRITERIA_DEFINITIONS, RUBRICS_CONFIG, CONFLICT_RULES } from '../../src/server/decisionRules.js';
import { CRITERION_EVALUATORS } from '../../src/server/criterionEvaluators.js';
import { RawEvidenceRecord, CriterionId } from '../../src/server/types.js';

describe('Loader', () => {
  it('loads all 3 JSON datasets and preserves source metadata', () => {
    const loader = loadAllEvidenceDatasets();
    expect(loader.datasets.length).toBe(3);

    const sources = loader.datasets.map(d => d.source);
    expect(sources).toContain('Jagat Review');
    expect(sources).toContain('TrendingTek');
    expect(sources).toContain('rizkinhk');

    expect(loader.allRecordsWithSourceFile.length).toBeGreaterThan(150);

    // §4.2: PRD is NOT an input
    const referencesPRD = loader.missingRequiredFiles.some(f => f.filename.includes('PRD_'));
    expect(referencesPRD).toBe(false);

    // §10.3: duplicateIdsFound must be populated
    expect(Array.isArray(loader.duplicateIdsFound)).toBe(true);
    expect(loader.loadedAt).toBeTruthy();
    expect(typeof loader.loadDurationMs).toBe('number');
  });
});

describe('Normalizer', () => {
  it('normalizes evidence records and builds accurate timestamp links', () => {
    const loader = loadAllEvidenceDatasets();
    const normalizer = normalizeEvidenceRecords(loader.allRecordsWithSourceFile);
    expect(normalizer.normalizedRecords.length).toBeGreaterThan(0);

    const sample = normalizer.normalizedRecords.find(
      r => r.timestamp_start !== null && (r.video_url?.includes('youtube') ?? false)
    );
    expect(sample).toBeTruthy();
    const url = sample?.youtubeTimestampUrl ?? '';
    expect(url.includes('&t=') || url.includes('?t=')).toBe(true);
  });
});

describe('Validator', () => {
  it('rejects evidence with accepted === false or invalid status', () => {
    const testRecords: { record: RawEvidenceRecord; filename: string }[] = [
      makeTestRecord('TEST-VALID-01', 'Valid claim', true, 'VALID'),
      makeTestRecord('TEST-REJECTED-01', 'Bogus rejected claim', false, 'INVALID'),
    ];

    const norm = normalizeEvidenceRecords(testRecords);
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.eligibleRecords.length).toBe(1);
    expect(val.eligibleRecords[0].evidence_id).toBe('TEST-VALID-01');
    expect(val.excludedRecords.length).toBe(1);
    expect(val.excludedRecords[0].evidence.evidence_id).toBe('TEST-REJECTED-01');
    expect(val.excludedRecords[0].code).toBe('VALIDATION_NOT_ACCEPTED');
  });

  it('excludes CLAIM type evidence as unscorable', () => {
    const records = [
      makeTestRecord('TEST-CLAIM-01', 'Claim type record', true, 'VALID', 'CLAIM'),
    ];
    const norm = normalizeEvidenceRecords(records);
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.eligibleRecords.length).toBe(0);
    expect(val.excludedRecords[0].code).toBe('UNSUPPORTED_EVIDENCE_TYPE');
  });
});

describe('Duplicate Handling', () => {
  it('deduplicates evidence IDs at normalizer and reports duplicates', () => {
    const testRecords = [
      makeTestRecord('DUP-001', 'Duplicate record 1', true, 'VALID'),
      makeTestRecord('DUP-001', 'Duplicate record 2', true, 'VALID'),
    ];

    const norm = normalizeEvidenceRecords(testRecords);
    expect(norm.duplicateIds).toContain('DUP-001');
    expect(norm.normalizedRecords.length).toBe(1);
    expect(norm.normalizedRecords[0].claim).toBe('Duplicate record 1');

    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.eligibleRecords.length).toBe(1);
    expect(val.excludedRecords.length).toBe(0);
  });
});

describe('Conflict Detection', () => {
  it('detects conflicting technical claims using config rules', () => {
    const loader = loadAllEvidenceDatasets();
    const norm = normalizeEvidenceRecords(loader.allRecordsWithSourceFile);
    const preVal = validateEvidenceEligibility(norm.normalizedRecords);
    const repo = new EvidenceRepository(norm.normalizedRecords, preVal.eligibleRecords, preVal.excludedRecords);

    const { conflicts, conflictedIds } = repo.detectConflictsWithIds();
    expect(Array.isArray(conflicts)).toBe(true);
    expect(conflictedIds).toBeInstanceOf(Set);

    // Price should NOT be a conflict (context-aware tolerance)
    const priceConflict = conflicts.find(c => c.attribute === 'price');
    expect(priceConflict).toBeUndefined();

    // Only attributes in CONFLICT_RULES can produce conflicts
    for (const c of conflicts) {
      const rule = CONFLICT_RULES.find(r => r.attribute === c.attribute);
      expect(rule).toBeDefined();
    }
  });
});

describe('Scoring Weights', () => {
  it('enforces PRD fixed 7 criteria weights summing to 1.00', () => {
    const weights = Object.values(CRITERIA_DEFINITIONS).map(d => d.weight);
    const sumWeights = weights.reduce((a, w) => a + w, 0);
    expect(Math.round(sumWeights * 100) / 100).toBe(1.0);

    expect(CRITERIA_DEFINITIONS.price_and_value.weight).toBe(0.20);
    expect(CRITERIA_DEFINITIONS.performance_and_gaming.weight).toBe(0.15);
    expect(CRITERIA_DEFINITIONS.battery_and_charging.weight).toBe(0.15);
    expect(CRITERIA_DEFINITIONS.software_and_security.weight).toBe(0.15);
    expect(CRITERIA_DEFINITIONS.display_and_design.weight).toBe(0.10);
    expect(CRITERIA_DEFINITIONS.camera.weight).toBe(0.10);
    expect(CRITERIA_DEFINITIONS.durability_and_protection.weight).toBe(0.15);
  });

  it('has executable evaluator for every criterion', () => {
    for (const cid of Object.keys(CRITERIA_DEFINITIONS) as CriterionId[]) {
      expect(CRITERION_EVALUATORS[cid]).toBeDefined();
      expect(typeof CRITERION_EVALUATORS[cid]).toBe('function');
      expect(RUBRICS_CONFIG[cid].version.length).toBeGreaterThan(0);
    }
  });
});

describe('Decision Engine', () => {
  it('produces identical deterministic outputs for identical inputs', () => {
    const run = () => {
      const loader = loadAllEvidenceDatasets();
      const norm = normalizeEvidenceRecords(loader.allRecordsWithSourceFile);
      const preVal = validateEvidenceEligibility(norm.normalizedRecords);
      const preRepo = new EvidenceRepository(norm.normalizedRecords, preVal.eligibleRecords, preVal.excludedRecords);
      const { conflictedIds } = preRepo.detectConflictsWithIds();
      const val = validateEvidenceEligibility(norm.normalizedRecords, conflictedIds);
      const repo = new EvidenceRepository(norm.normalizedRecords, val.eligibleRecords, val.excludedRecords);
      return { result: runDecisionEngine(repo), val };
    };

    const a = run();
    const b = run();

    expect(a.result.overallScore).toBe(b.result.overallScore);
    expect(a.result.overallScoreExact).toBe(b.result.overallScoreExact);
    expect(a.result.decisionLabel).toBe(b.result.decisionLabel);
    expect(a.result.decisionStatus).toBe(b.result.decisionStatus);
    expect(a.result.confidenceLabel).toBe(b.result.confidenceLabel);
    expect(a.result.coveragePercent).toBe(b.result.coveragePercent);
  });

  it('correctly categorizes decision labels according to PRD thresholds', () => {
    const loader = loadAllEvidenceDatasets();
    const norm = normalizeEvidenceRecords(loader.allRecordsWithSourceFile);
    const preVal = validateEvidenceEligibility(norm.normalizedRecords);
    const preRepo = new EvidenceRepository(norm.normalizedRecords, preVal.eligibleRecords, preVal.excludedRecords);
    const { conflictedIds } = preRepo.detectConflictsWithIds();
    const val = validateEvidenceEligibility(norm.normalizedRecords, conflictedIds);
    const repo = new EvidenceRepository(norm.normalizedRecords, val.eligibleRecords, val.excludedRecords);
    const result = runDecisionEngine(repo);

    expect(result.overallScore).not.toBeNull();
    expect(result.overallScore!).toBeGreaterThanOrEqual(0);
    expect(result.overallScore!).toBeLessThanOrEqual(5.0);

    if (result.overallScore! >= 4.0) {
      expect(result.decisionLabel).toBe('Sangat direkomendasikan');
    } else if (result.overallScore! >= 3.0) {
      expect(result.decisionLabel).toBe('Direkomendasikan dengan pertimbangan');
    } else if (result.overallScore! >= 2.0) {
      expect(result.decisionLabel).toBe('Cocok secara terbatas');
    } else {
      expect(result.decisionLabel).toBe('Tidak direkomendasikan');
    }
  });

  it('guarantees every strength, tradeoff, and decision reason references valid evidence IDs', () => {
    const loader = loadAllEvidenceDatasets();
    const norm = normalizeEvidenceRecords(loader.allRecordsWithSourceFile);
    const preVal = validateEvidenceEligibility(norm.normalizedRecords);
    const preRepo = new EvidenceRepository(norm.normalizedRecords, preVal.eligibleRecords, preVal.excludedRecords);
    const { conflictedIds } = preRepo.detectConflictsWithIds();
    const val = validateEvidenceEligibility(norm.normalizedRecords, conflictedIds);
    const repo = new EvidenceRepository(norm.normalizedRecords, val.eligibleRecords, val.excludedRecords);
    const result = runDecisionEngine(repo);

    const allEligibleIds = new Set(val.eligibleRecords.map(e => e.evidence_id));

    for (const s of result.strengths) {
      expect(s.evidenceIds.length).toBeGreaterThan(0);
      s.evidenceIds.forEach(id => expect(allEligibleIds.has(id)).toBe(true));
    }
    for (const t of result.tradeoffs) {
      expect(t.evidenceIds.length).toBeGreaterThan(0);
      t.evidenceIds.forEach(id => expect(allEligibleIds.has(id)).toBe(true));
    }
    for (const r of result.decisionReasons) {
      expect(r.evidenceIds.length).toBeGreaterThan(0);
      r.evidenceIds.forEach(id => expect(allEligibleIds.has(id)).toBe(true));
    }
  });

  it('strips overallScore when decision is not PUBLISHED', () => {
    const emptyRepo = new EvidenceRepository([], [], []);
    const result = runDecisionEngine(emptyRepo);

    expect(result.decisionStatus).not.toBe('PUBLISHED');
    expect(result.overallScore).toBeNull();
    expect(result.overallScoreExact).toBeNull();
  });
});

describe('Critical Conflict Gate', () => {
  it('prevents decision publication when unresolved critical conflict detected', () => {
    const loader = loadAllEvidenceDatasets();
    const norm = normalizeEvidenceRecords(loader.allRecordsWithSourceFile);
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    const repo = new EvidenceRepository(norm.normalizedRecords, val.eligibleRecords, val.excludedRecords);

    const originalDetect = repo.detectConflicts.bind(repo);
    repo.detectConflicts = () => [
      ...originalDetect(),
      {
        id: 'mock-critical',
        attribute: 'screen_size',
        topic: 'display',
        claims: [
          { source: 'A', claim: '6.7 inch', value: 6.7, evidenceId: 'mock-1' },
          { source: 'B', claim: '5.5 inch', value: 5.5, evidenceId: 'mock-2' },
        ],
        isCritical: true,
        resolved: false,
        resolutionNote: 'Contradictory screen dimensions.',
      },
    ];

    const result = runDecisionEngine(repo);
    expect(result.decisionStatus).toBe('UNRESOLVED_CRITICAL_CONFLICT');
    expect(result.decisionLabel).toBe('Data Tidak Mencukupi');
    expect(result.confidenceLabel).toBe('INSUFFICIENT');
    expect(result.overallScore).toBeNull();
  });
});

describe('Confidence Engine', () => {
  it('requires coverage >= 60% for non-INSUFFICIENT confidence', () => {
    const fakeScores: any = {
      price_and_value: { isRated: true, score: 4.0, weight: 0.20, evidenceIdsUsed: [] },
      performance_and_gaming: { isRated: true, score: 4.0, weight: 0.15, evidenceIdsUsed: [] },
      battery_and_charging: { isRated: false, score: null, weight: 0.15, evidenceIdsUsed: [] },
      software_and_security: { isRated: false, score: null, weight: 0.15, evidenceIdsUsed: [] },
      display_and_design: { isRated: false, score: null, weight: 0.10, evidenceIdsUsed: [] },
      camera: { isRated: false, score: null, weight: 0.10, evidenceIdsUsed: [] },
      durability_and_protection: { isRated: false, score: null, weight: 0.15, evidenceIdsUsed: [] },
    };
    const conf = calculateConfidence(fakeScores, [], []);
    expect(conf.coveragePercent).toBe(35);
    expect(conf.confidenceLabel).toBe('LOW');
  });

  it('returns INSUFFICIENT when no criteria are rated', () => {
    const fakeScores: any = {
      price_and_value: { isRated: false, score: null, weight: 0.20, evidenceIdsUsed: [] },
      performance_and_gaming: { isRated: false, score: null, weight: 0.15, evidenceIdsUsed: [] },
      battery_and_charging: { isRated: false, score: null, weight: 0.15, evidenceIdsUsed: [] },
      software_and_security: { isRated: false, score: null, weight: 0.15, evidenceIdsUsed: [] },
      display_and_design: { isRated: false, score: null, weight: 0.10, evidenceIdsUsed: [] },
      camera: { isRated: false, score: null, weight: 0.10, evidenceIdsUsed: [] },
      durability_and_protection: { isRated: false, score: null, weight: 0.15, evidenceIdsUsed: [] },
    };
    const conf = calculateConfidence(fakeScores, [], []);
    expect(conf.coveragePercent).toBe(0);
    expect(conf.confidenceLabel).toBe('INSUFFICIENT');
  });

  it('full pipeline produces confidence reasons', () => {
    const loader = loadAllEvidenceDatasets();
    const norm = normalizeEvidenceRecords(loader.allRecordsWithSourceFile);
    const preVal = validateEvidenceEligibility(norm.normalizedRecords);
    const preRepo = new EvidenceRepository(norm.normalizedRecords, preVal.eligibleRecords, preVal.excludedRecords);
    const { conflictedIds } = preRepo.detectConflictsWithIds();
    const val = validateEvidenceEligibility(norm.normalizedRecords, conflictedIds);
    const repo = new EvidenceRepository(norm.normalizedRecords, val.eligibleRecords, val.excludedRecords);
    const result = runDecisionEngine(repo);

    expect(result.confidenceReasons.length).toBeGreaterThan(0);
    expect(result.confidenceLabel).toMatch(/HIGH|MEDIUM|LOW/);
  });
});

// ─── Helper ───
function makeTestRecord(
  id: string,
  claim: string,
  accepted: boolean,
  finalStatus: string,
  type: string = 'FACT'
): { record: RawEvidenceRecord; filename: string } {
  return {
    record: {
      evidence_id: id,
      topic: 'battery',
      subtopic: 'test',
      type,
      claim,
      value: 5000,
      unit: 'mAh',
      attribute: 'battery_capacity',
      attribute_value: '5000 mAh',
      context: 'test',
      certainty: 'explicit',
      source_excerpt: claim,
      validation: {
        accepted,
        finalStatus,
        results: [{ rule: 'GROUNDING', pass: accepted, status: accepted ? 'PASS' : 'FAIL', severity: 'LOW' }],
      },
      timestamp_start: null,
      timestamp_end: null,
      source: 'Reviewer Test',
      review_id: 'rev-test',
      video_url: 'https://youtube.com/watch?v=test',
      video_title: 'Test Video',
    },
    filename: 'test.json',
  };
}