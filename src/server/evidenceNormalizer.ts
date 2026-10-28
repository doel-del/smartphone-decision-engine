import {
  RawEvidenceRecord,
  NormalizedEvidence,
  EvidenceType,
} from './types.js';

export interface NormalizerResult {
  normalizedRecords: NormalizedEvidence[];
  duplicateIds: string[];
  normalizationErrors: { id?: string; issue: string; severity: 'FATAL' | 'WARNING' }[];
}

const KNOWN_EVIDENCE_TYPES: ReadonlyArray<EvidenceType> = [
  'FACT',
  'MEASUREMENT',
  'OBSERVATION',
  'OPINION',
  'RECOMMENDATION',
  'COMPARISON',
  'CLAIM',
];

export function timestampToSeconds(ts: string | null | undefined): number | null {
  if (!ts) return null;
  try {
    const clean = ts.replace(',', '.').trim();
    const parts = clean.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) {
      if (parts[1] >= 60 || parts[2] >= 60) return null;
      return Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
    if (parts.length === 2) {
      if (parts[1] >= 60) return null;
      return Math.floor(parts[0] * 60 + parts[1]);
    }
    if (parts.length === 1) {
      return Math.floor(parts[0]);
    }
  } catch {
    return null;
  }
  return null;
}

export function buildYoutubeTimestampUrl(
  baseUrl: string,
  tsStart: string | null | undefined
): string | undefined {
  if (!baseUrl) return undefined;
  const seconds = timestampToSeconds(tsStart);
  if (seconds === null || seconds < 0) return baseUrl;
  return baseUrl.includes('?')
    ? `${baseUrl}&t=${seconds}s`
    : `${baseUrl}?t=${seconds}s`;
}

function normalizeType(raw: unknown): EvidenceType | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return (KNOWN_EVIDENCE_TYPES as ReadonlyArray<string>).includes(upper)
    ? (upper as EvidenceType)
    : null;
}

/**
 * @param rawList - records with filename origin
 * @param datasetVersion - version string from loader/metadata (§12, §15)
 */
export function normalizeEvidenceRecords(
  rawList: { record: RawEvidenceRecord; filename: string }[],
  datasetVersion: string = 'unknown'
): NormalizerResult {
  const normalizedRecords: NormalizedEvidence[] = [];
  const duplicateIds: string[] = [];
  const normalizationErrors: NormalizerResult['normalizationErrors'] = [];
  const seenIds = new Set<string>();

  for (const { record: r, filename } of rawList) {
    // ─── 1. Basic shape ───
    if (!r || typeof r !== 'object') {
      normalizationErrors.push({
        issue: `Malformed record in ${filename}: not an object`,
        severity: 'FATAL',
      });
      continue;
    }

    // ─── 2. Valid evidence_id required (declare trimmedId HERE) ───
    if (!r.evidence_id || typeof r.evidence_id !== 'string' || !r.evidence_id.trim()) {
      normalizationErrors.push({
        issue: `Record in ${filename} missing valid evidence_id`,
        severity: 'FATAL',
      });
      continue;
    }
    const trimmedId = r.evidence_id.trim();

    // ─── 3. Provenance guards (trimmedId now available) ───
    if (!r.source || typeof r.source !== 'string' || !r.source.trim()) {
      normalizationErrors.push({
        id: trimmedId,
        issue: `Missing source — record excluded (cannot prove provenance)`,
        severity: 'FATAL',
      });
      continue;
    }
    if (!r.review_id || typeof r.review_id !== 'string' || !r.review_id.trim()) {
      normalizationErrors.push({
        id: trimmedId,
        issue: `Missing review_id — record excluded (cannot prove provenance)`,
        severity: 'FATAL',
      });
      continue;
    }
    if (!r.topic || typeof r.topic !== 'string' || !r.topic.trim()) {
      normalizationErrors.push({
        id: trimmedId,
        issue: `Missing topic — record excluded (cannot map to criterion)`,
        severity: 'FATAL',
      });
      continue;
    }

    // ─── 4. Duplicate check ───
    if (seenIds.has(trimmedId)) {
      duplicateIds.push(trimmedId);
      normalizationErrors.push({
        id: trimmedId,
        issue: `Duplicate evidence_id "${trimmedId}" skipped`,
        severity: 'WARNING',
      });
      continue;
    }
    seenIds.add(trimmedId);

    // ─── 5. Type validation ───
    const normalizedType = normalizeType(r.type);
    if (normalizedType === null) {
      normalizationErrors.push({
        id: trimmedId,
        issue: `Unsupported evidence type "${String(r.type)}" — record excluded from scoring eligibility`,
        severity: 'WARNING',
      });
    }

    // ─── 6. Validation metadata (preserve absence) ───
    if (!r.validation || typeof r.validation !== 'object') {
      normalizationErrors.push({
        id: trimmedId,
        issue: `Evidence ${trimmedId} lacks validation metadata`,
        severity: 'WARNING',
      });
    }

    // ─── 7. Safe trims (guards above guarantee non-null) ───
    const trimmedSource = r.source.trim();
    const trimmedReviewId = r.review_id.trim();
    const trimmedTopic = r.topic.trim().toLowerCase();
    const trimmedSubtopic = r.subtopic ? String(r.subtopic).trim().toLowerCase() : null;

    const normalized: NormalizedEvidence = {
      // Raw fields preserved
      evidence_id: trimmedId,
      topic: trimmedTopic,
      subtopic: trimmedSubtopic,
      type: normalizedType ?? 'CLAIM',
      claim: (r.claim ?? '').trim(),
      value: r.value !== undefined ? r.value : null,
      unit: r.unit ? String(r.unit).trim() : null,
      attribute: r.attribute ? String(r.attribute).trim().toLowerCase() : null,
      attribute_value: r.attribute_value ? String(r.attribute_value).trim() : null,
      context: r.context ? String(r.context).trim() : null,
      comparison_target: r.comparison_target ? String(r.comparison_target).trim() : null,
      reviewer_assessment: r.reviewer_assessment ?? null,

      // Nullable metadata — absence preserved as null (no fabrication)
      certainty: r.certainty ? String(r.certainty).trim() : null,
      source_excerpt: r.source_excerpt ? String(r.source_excerpt).trim() : null,

      related_evidence_ids: Array.isArray(r.related_evidence_ids)
        ? r.related_evidence_ids.map(s => String(s).trim()).filter(Boolean)
        : null,
      source_coordinates: r.source_coordinates || undefined,
      validation: r.validation ?? undefined,
      timestamp_start: r.timestamp_start ?? null,
      timestamp_end: r.timestamp_end ?? null,
      source: trimmedSource,
      review_id: trimmedReviewId,
      video_url: r.video_url ? String(r.video_url).trim() : null,
      video_title: r.video_title ? String(r.video_title).trim() : null,
      merged_subtopics: r.merged_subtopics,
      merged_from_evidence_ids: r.merged_from_evidence_ids,

      // Normalized metadata
      datasetFile: filename,
      datasetVersion,
      sourceReviewer: trimmedSource,
      youtubeTimestampUrl: buildYoutubeTimestampUrl(r.video_url || '', r.timestamp_start),
      isEligibleForScoring: false,
      rawRecord: r,
    };

    normalizedRecords.push(normalized);
  }

  return { normalizedRecords, duplicateIds, normalizationErrors };
}