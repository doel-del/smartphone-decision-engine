import { describe, it, expect } from 'vitest';
import {
  normalizeEvidenceRecords,
  timestampToSeconds,
  buildYoutubeTimestampUrl,
} from '../../src/server/evidenceNormalizer.js';
import { makeRawRecord, withFiles } from './helpers.js';

describe('normalizeEvidenceRecords', () => {
  it('skips records missing source with FATAL error', () => {
    const r = makeRawRecord({ evidence_id: 'A', source: '' });
    const { normalizedRecords, normalizationErrors } = normalizeEvidenceRecords(withFiles(r));
    expect(normalizedRecords.length).toBe(0);
    const fatal = normalizationErrors.find(e => e.severity === 'FATAL');
    expect(fatal?.issue).toContain('Missing source');
  });

  it('skips records missing review_id with FATAL error', () => {
    const r = makeRawRecord({ evidence_id: 'B', review_id: '' });
    const { normalizedRecords, normalizationErrors } = normalizeEvidenceRecords(withFiles(r));
    expect(normalizedRecords.length).toBe(0);
    const fatal = normalizationErrors.find(e => e.severity === 'FATAL');
    expect(fatal?.issue).toContain('Missing review_id');
  });

  it('skips records missing topic with FATAL error', () => {
    const r = makeRawRecord({ evidence_id: 'C', topic: '' });
    const { normalizedRecords, normalizationErrors } = normalizeEvidenceRecords(withFiles(r));
    expect(normalizedRecords.length).toBe(0);
    const fatal = normalizationErrors.find(e => e.severity === 'FATAL');
    expect(fatal?.issue).toContain('Missing topic');
  });

  it('normalizes type to uppercase; unknown type falls back to CLAIM with warning', () => {
    const r1 = makeRawRecord({ evidence_id: 'D1', type: 'fact' });
    const r2 = makeRawRecord({ evidence_id: 'D2', type: 'custom_unknown' });
    const { normalizedRecords, normalizationErrors } = normalizeEvidenceRecords(withFiles(r1, r2));
    const d1 = normalizedRecords.find(r => r.evidence_id === 'D1');
    const d2 = normalizedRecords.find(r => r.evidence_id === 'D2');
    expect(d1?.type).toBe('FACT');
    expect(d2?.type).toBe('CLAIM');
    const warning = normalizationErrors.find(e => e.id === 'D2');
    expect(warning?.severity).toBe('WARNING');
    expect(warning?.issue).toContain('Unsupported evidence type');
  });

  it('deduplicates evidence_id and preserves first occurrence', () => {
    const r1 = makeRawRecord({ evidence_id: 'DUP', claim: 'First' });
    const r2 = makeRawRecord({ evidence_id: 'DUP', claim: 'Second' });
    const { normalizedRecords, duplicateIds } = normalizeEvidenceRecords(withFiles(r1, r2));
    expect(normalizedRecords.length).toBe(1);
    expect(normalizedRecords[0].claim).toBe('First');
    expect(duplicateIds).toContain('DUP');
  });

  it('preserves rawRecord for audit trail', () => {
    const r = makeRawRecord({ evidence_id: 'AUDIT-1' });
    const { normalizedRecords } = normalizeEvidenceRecords(withFiles(r));
    const n = normalizedRecords.find(x => x.evidence_id === 'AUDIT-1');
    expect(n?.rawRecord).toBeDefined();
    expect(n?.rawRecord.evidence_id).toBe('AUDIT-1');
    expect(n?.datasetVersion).toBeTruthy();
  });

  it('trims and lowercases attribute field', () => {
    const r = makeRawRecord({ evidence_id: 'ATTR-1', attribute: '  Battery_Capacity  ' });
    const { normalizedRecords } = normalizeEvidenceRecords(withFiles(r));
    const n = normalizedRecords.find(x => x.evidence_id === 'ATTR-1');
    expect(n?.attribute).toBe('battery_capacity');
  });
});

describe('timestampToSeconds', () => {
  it('parses HH:MM:SS format', () => {
    expect(timestampToSeconds('00:04:16')).toBe(256);
    expect(timestampToSeconds('01:30:00')).toBe(5400);
  });

  it('parses MM:SS format', () => {
    expect(timestampToSeconds('12:05')).toBe(725);
  });

  it('returns null for invalid input', () => {
    expect(timestampToSeconds(null)).toBeNull();
    expect(timestampToSeconds(undefined)).toBeNull();
    expect(timestampToSeconds('')).toBeNull();
    expect(timestampToSeconds('invalid')).toBeNull();
  });

  it('rejects out-of-range minutes/seconds', () => {
    expect(timestampToSeconds('00:75:00')).toBeNull();
    expect(timestampToSeconds('00:30:99')).toBeNull();
  });

  it('handles milliseconds with comma', () => {
    expect(timestampToSeconds('00:00:00,500')).toBe(0);
  });
});

describe('buildYoutubeTimestampUrl', () => {
  it('appends ?t= when URL has no query', () => {
    expect(buildYoutubeTimestampUrl('https://youtube.com/watch?v=x', '00:01:00'))
      .toBe('https://youtube.com/watch?v=x&t=60s');
  });

  it('appends &t= when URL already has query', () => {
    expect(buildYoutubeTimestampUrl('https://youtube.com/watch?v=x&foo=bar', '00:01:00'))
      .toBe('https://youtube.com/watch?v=x&foo=bar&t=60s');
  });

  it('returns undefined when baseUrl is empty', () => {
    expect(buildYoutubeTimestampUrl('', '00:01:00')).toBeUndefined();
  });

  it('returns baseUrl when timestamp invalid', () => {
    expect(buildYoutubeTimestampUrl('https://youtube.com/watch?v=x', null))
      .toBe('https://youtube.com/watch?v=x');
  });
});