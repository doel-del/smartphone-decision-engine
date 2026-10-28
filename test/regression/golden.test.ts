import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadAllEvidenceDatasets } from '../../src/server/evidenceLoader.js';
import { normalizeEvidenceRecords } from '../../src/server/evidenceNormalizer.js';
import { validateEvidenceEligibility } from '../../src/server/evidenceValidator.js';
import { EvidenceRepository } from '../../src/server/evidenceRepository.js';
import { runDecisionEngine } from '../../src/server/decisionEngine.js';
import { CriterionId } from '../../src/server/types.js';

describe('Golden Baseline (Regression)', () => {
  it('matches golden decision baseline for frozen dataset', () => {
    const goldenPath = path.resolve(process.cwd(), 'test/regression/golden-decision.json');
    expect(fs.existsSync(goldenPath)).toBe(true);

    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));

    const loader = loadAllEvidenceDatasets();
    const norm = normalizeEvidenceRecords(loader.allRecordsWithSourceFile);
    const preVal = validateEvidenceEligibility(norm.normalizedRecords);
    const preRepo = new EvidenceRepository(norm.normalizedRecords, preVal.eligibleRecords, preVal.excludedRecords);
    const { conflictedIds } = preRepo.detectConflictsWithIds();
    const val = validateEvidenceEligibility(norm.normalizedRecords, conflictedIds);
    const repo = new EvidenceRepository(norm.normalizedRecords, val.eligibleRecords, val.excludedRecords);
    const result = runDecisionEngine(repo);

    expect(result.overallScore).toBe(golden.overallScore);
    expect(result.decisionLabel).toBe(golden.decisionLabel);
    expect(result.decisionStatus).toBe(golden.decisionStatus);
    expect(result.coveragePercent).toBe(golden.coveragePercent);

    for (const [cid, expected] of Object.entries(golden.criteriaScores)) {
      const actual = result.criteriaScores[cid as CriterionId];
      expect(actual).toBeDefined();
      expect(actual.isRated).toBe((expected as any).isRated);
      expect(actual.score).toBe((expected as any).score);
    }
  });
});