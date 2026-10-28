import { describe, it, expect, afterEach } from 'vitest';
import { CRITERIA_DEFINITIONS, RUBRICS_CONFIG } from '../../src/server/decisionRules.js';
import { loadAllEvidenceDatasets } from '../../src/server/evidenceLoader.js';
import { normalizeEvidenceRecords } from '../../src/server/evidenceNormalizer.js';
import { validateEvidenceEligibility } from '../../src/server/evidenceValidator.js';
import { EvidenceRepository } from '../../src/server/evidenceRepository.js';
import { runDecisionEngine } from '../../src/server/decisionEngine.js';
import { CriterionId } from '../../src/server/types.js';

function buildFullPipeline() {
  const loader = loadAllEvidenceDatasets();
  const norm = normalizeEvidenceRecords(loader.allRecordsWithSourceFile);
  const preVal = validateEvidenceEligibility(norm.normalizedRecords);
  const preRepo = new EvidenceRepository(norm.normalizedRecords, preVal.eligibleRecords, preVal.excludedRecords);
  const { conflictedIds } = preRepo.detectConflictsWithIds();
  const val = validateEvidenceEligibility(norm.normalizedRecords, conflictedIds);
  return new EvidenceRepository(norm.normalizedRecords, val.eligibleRecords, val.excludedRecords);
}

/**
 * Metadata contract verification for isFullySpecified + baseScoreFormula.
 *
 * Purpose: Prove that these fields are metadata-only and do NOT drive runtime scoring.
 * This test PASSES today and should continue to pass after documentation cleanup (P1).
 */
describe('Metadata contract — isFullySpecified is dead metadata', () => {
  it('isFullySpecified exists and is boolean for all 7 criteria', () => {
    for (const cid of Object.keys(CRITERIA_DEFINITIONS) as CriterionId[]) {
      expect(RUBRICS_CONFIG[cid]).toBeDefined();
      expect(typeof RUBRICS_CONFIG[cid].isFullySpecified).toBe('boolean');
    }
  });

  it('flipping isFullySpecified has NO runtime effect on decision output', () => {
    const repo = buildFullPipeline();
    const baseline = runDecisionEngine(repo);

    const originals: Record<string, boolean> = {};
    try {
      for (const cid of Object.keys(RUBRICS_CONFIG) as CriterionId[]) {
        originals[cid] = RUBRICS_CONFIG[cid].isFullySpecified;
        RUBRICS_CONFIG[cid].isFullySpecified = false;
      }
      const mutated = runDecisionEngine(repo);
      expect(mutated.overallScore).toBe(baseline.overallScore);
      for (const cid of Object.keys(baseline.criteriaScores) as CriterionId[]) {
        expect(mutated.criteriaScores[cid].score).toBe(baseline.criteriaScores[cid].score);
        expect(mutated.criteriaScores[cid].isRated).toBe(baseline.criteriaScores[cid].isRated);
      }
    } finally {
      for (const cid of Object.keys(originals) as CriterionId[]) {
        RUBRICS_CONFIG[cid].isFullySpecified = originals[cid];
      }
    }
  });

  it('mutating baseScoreFormula has NO runtime effect on decision output', () => {
    const repo = buildFullPipeline();
    const baseline = runDecisionEngine(repo);

    const originalFormula = RUBRICS_CONFIG.price_and_value.baseScoreFormula;
    try {
      RUBRICS_CONFIG.price_and_value.baseScoreFormula = 'MUTATED — should not affect scoring';
      const mutated = runDecisionEngine(repo);
      expect(mutated.overallScore).toBe(baseline.overallScore);
      expect(mutated.criteriaScores.price_and_value.score).toBe(baseline.criteriaScores.price_and_value.score);
    } finally {
      RUBRICS_CONFIG.price_and_value.baseScoreFormula = originalFormula;
    }
  });

  it('mutating rulesDescription has NO runtime effect on decision output', () => {
    const repo = buildFullPipeline();
    const baseline = runDecisionEngine(repo);

    const originalDesc = RUBRICS_CONFIG.price_and_value.rulesDescription;
    try {
      RUBRICS_CONFIG.price_and_value.rulesDescription = ['MUTATED — should not affect scoring'];
      const mutated = runDecisionEngine(repo);
      expect(mutated.overallScore).toBe(baseline.overallScore);
    } finally {
      RUBRICS_CONFIG.price_and_value.rulesDescription = originalDesc;
    }
  });
});