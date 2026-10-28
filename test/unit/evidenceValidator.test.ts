import { describe, it, expect } from 'vitest';
import { normalizeEvidenceRecords } from '../../src/server/evidenceNormalizer.js';
import { validateEvidenceEligibility } from '../../src/server/evidenceValidator.js';
import { makeRawRecord, withFiles, withValidation } from './helpers.js';

describe('evidenceValidator', () => {
  it('marks VALID + accepted:true as eligible', () => {
    const r = makeRawRecord({ evidence_id: 'ELIGIBLE-1' });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.eligibleRecords.length).toBe(1);
    expect(val.excludedRecords.length).toBe(0);
  });

  it('excludes accepted:false with VALIDATION_NOT_ACCEPTED', () => {
    const r = withValidation(makeRawRecord({ evidence_id: 'REJ-1' }), {
      accepted: false,
      finalStatus: 'INVALID',
      results: [],
    });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.excludedRecords[0].code).toBe('VALIDATION_NOT_ACCEPTED');
  });

  it('excludes missing validation with NO_VALIDATION_METADATA', () => {
    const r = makeRawRecord({ evidence_id: 'NOVAL-1' });
    delete (r as any).validation;
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.excludedRecords[0].code).toBe('NO_VALIDATION_METADATA');
  });

  it('excludes SUSPECT status with STATUS_SUSPECT', () => {
    const r = withValidation(makeRawRecord({ evidence_id: 'SUSP-1' }), {
      accepted: true,
      finalStatus: 'SUSPECT',
      results: [],
    });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.excludedRecords[0].code).toBe('STATUS_SUSPECT');
  });

  it('accepts VALID_WITH_NORMALIZATION when results are all pass:true', () => {
    const r = withValidation(makeRawRecord({ evidence_id: 'VWN-OK' }), {
      accepted: true,
      finalStatus: 'VALID_WITH_NORMALIZATION',
      results: [{ rule: 'GROUNDING', pass: true, status: 'PASS', severity: 'LOW' }],
    });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.eligibleRecords.length).toBe(1);
    expect(val.excludedRecords.length).toBe(0);
  });

  it('excludes VALID_WITH_NORMALIZATION with empty results as unverified', () => {
    const r = withValidation(makeRawRecord({ evidence_id: 'VWN-EMPTY' }), {
      accepted: true,
      finalStatus: 'VALID_WITH_NORMALIZATION',
      results: [],
    });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.excludedRecords[0].code).toBe('VALID_WITH_NORMALIZATION_UNVERIFIED');
  });

  it('excludes VALID_WITH_NORMALIZATION with inconsistent results', () => {
    const r = withValidation(makeRawRecord({ evidence_id: 'VWN-BAD' }), {
      accepted: true,
      finalStatus: 'VALID_WITH_NORMALIZATION',
      results: [{ rule: 'GROUNDING', pass: false, status: 'FAIL', severity: 'HIGH' }],
    });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.excludedRecords[0].code).toBe('VALID_WITH_NORMALIZATION_INCONSISTENT');
  });

  it('excludes unknown finalStatus as STATUS_UNSUPPORTED', () => {
    const r = withValidation(makeRawRecord({ evidence_id: 'UNK-1' }), {
      accepted: true,
      finalStatus: 'WEIRD_STATUS',
      results: [],
    });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.excludedRecords[0].code).toBe('STATUS_UNSUPPORTED');
  });

  it('excludes CLAIM type as UNSUPPORTED_EVIDENCE_TYPE', () => {
    const r = makeRawRecord({ evidence_id: 'CLAIM-1', type: 'CLAIM' });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.excludedRecords[0].code).toBe('UNSUPPORTED_EVIDENCE_TYPE');
  });

  it('excludes empty claim as EMPTY_CLAIM', () => {
    const r = makeRawRecord({ evidence_id: 'EMPTY-1', claim: '   ' });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.excludedRecords[0].code).toBe('EMPTY_CLAIM');
  });

  it('blocks evidence in conflictIds with CONFLICT_UNRESOLVED', () => {
    const r = makeRawRecord({ evidence_id: 'CONF-1' });
    const norm = normalizeEvidenceRecords(withFiles(r));
    const conflictIds = new Set(['CONF-1']);
    const val = validateEvidenceEligibility(norm.normalizedRecords, conflictIds);
    expect(val.eligibleRecords.length).toBe(0);
    expect(val.excludedRecords[0].code).toBe('CONFLICT_UNRESOLVED');
  });

  it('populates exclusionBreakdown with proper enum codes (aggregable)', () => {
    const r1 = withValidation(makeRawRecord({ evidence_id: 'E1' }), {
      accepted: false, finalStatus: 'INVALID', results: [],
    });
    const r2 = withValidation(makeRawRecord({ evidence_id: 'E2' }), {
      accepted: false, finalStatus: 'INVALID', results: [],
    });
    const norm = normalizeEvidenceRecords(withFiles(r1, r2));
    const val = validateEvidenceEligibility(norm.normalizedRecords);
    expect(val.exclusionBreakdown['VALIDATION_NOT_ACCEPTED']).toBe(2);
  });
});