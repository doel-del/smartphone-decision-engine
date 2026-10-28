import { RawEvidenceRecord, NormalizedEvidence, EvidenceValidation } from '../../src/server/types.js';

export function makeRawRecord(overrides: Partial<RawEvidenceRecord> = {}): RawEvidenceRecord {
  const base: RawEvidenceRecord = {
    evidence_id: 'TEST-E001',
    topic: 'battery',
    subtopic: 'capacity',
    type: 'FACT',
    claim: 'Default test claim',
    value: 5000,
    unit: 'mAh',
    attribute: 'battery_capacity',
    attribute_value: '5000 mAh',
    context: 'test',
    certainty: 'explicit',
    source_excerpt: 'default excerpt',
    validation: {
      accepted: true,
      finalStatus: 'VALID',
      results: [
        { rule: 'GROUNDING', pass: true, status: 'PASS', severity: 'LOW' },
      ],
    },
    timestamp_start: '00:01:00',
    timestamp_end: '00:01:05',
    source: 'Reviewer Test',
    review_id: 'rev-test',
    video_url: 'https://youtube.com/watch?v=test',
    video_title: 'Test Video',
  };
  return { ...base, ...overrides };
}

export function makeNormalizedRecord(
  overrides: Partial<NormalizedEvidence> = {}
): NormalizedEvidence {
  const raw = makeRawRecord(overrides as Partial<RawEvidenceRecord>);
  const base: NormalizedEvidence = {
    ...raw,
    datasetFile: 'test.json',
    datasetVersion: 'test-version',
    isEligibleForScoring: false,
    sourceReviewer: raw.source,
    youtubeTimestampUrl: raw.video_url && raw.timestamp_start
      ? `${raw.video_url}?t=60s`
      : undefined,
    rawRecord: raw,
  };
  return { ...base, ...overrides };
}

export function withValidation(
  record: RawEvidenceRecord,
  validation: EvidenceValidation
): RawEvidenceRecord {
  return { ...record, validation };
}

export function withFiles(
  ...records: RawEvidenceRecord[]
): { record: RawEvidenceRecord; filename: string }[] {
  return records.map(r => ({ record: r, filename: 'test.json' }));
}