import { NormalizedEvidence, ExclusionReasonCode } from './types.js';

export interface ValidatorResult {
  eligibleRecords: NormalizedEvidence[];
  excludedRecords: { evidence: NormalizedEvidence; reason: string; code: ExclusionReasonCode }[];
  exclusionBreakdown: Record<string, number>;
}

const SCORABLE_TYPES = new Set(['FACT', 'MEASUREMENT', 'OBSERVATION', 'OPINION', 'RECOMMENDATION', 'COMPARISON']);

/**
 * Validates evidence records for scoring eligibility.
 *
 * @param records - normalized records (already deduplicated by normalizer)
 * @param conflictIds - set of evidence IDs involved in unresolved conflicts
 *                      (populated by repository.detectConflicts() before scoring)
 */
export function validateEvidenceEligibility(
  records: NormalizedEvidence[],
  conflictIds: Set<string> = new Set()
): ValidatorResult {
  const eligibleRecords: NormalizedEvidence[] = [];
  const excludedRecords: ValidatorResult['excludedRecords'] = [];
  const exclusionBreakdown: Record<string, number> = {};

  const exclude = (evidence: NormalizedEvidence, code: ExclusionReasonCode, detail?: string) => {
    const reason = detail ?? code;
    evidence.isEligibleForScoring = false;
    evidence.exclusionReason = reason;
    excludedRecords.push({ evidence, reason, code });
    exclusionBreakdown[code] = (exclusionBreakdown[code] ?? 0) + 1;
  };

  for (const item of records) {
    // 1. Duplicate (defense in depth — normalizer already skips)
    //    No-op here since normalizer dedups; kept for future-proofing.

    // 2. Validation metadata must exist
    if (!item.validation) {
      exclude(item, 'NO_VALIDATION_METADATA', 'Missing validation metadata');
      continue;
    }

    // 3. accepted must be true
    if (item.validation.accepted !== true) {
      exclude(item, 'VALIDATION_NOT_ACCEPTED', 'Rejected by extraction pipeline');
      continue;
    }

    // 4. Final status handling
    const status = item.validation.finalStatus;
    if (!status) {
      exclude(item, 'STATUS_UNSUPPORTED', 'Missing finalStatus');
      continue;
    }
    if (status === 'INVALID' || status === 'REJECTED') {
      exclude(item, 'STATUS_INVALID', `Final status: ${status}`);
      continue;
    }
    if (status === 'SUSPECT') {
      exclude(item, 'STATUS_SUSPECT', 'Evidence marked as suspect');
      continue;
    }
    if (status === 'VALID_WITH_NORMALIZATION') {
      // Verify consistency: results must be present and all passing.
      // Per data findings: extractor rules (GROUNDING/PROVENANCE/etc.) are the approval mechanism.
      const results = item.validation.results ?? [];
      if (results.length === 0) {
        exclude(item, 'VALID_WITH_NORMALIZATION_UNVERIFIED', 'No validation results recorded');
        continue;
      }
      if (results.some(r => r.pass === false)) {
        exclude(item, 'VALID_WITH_NORMALIZATION_INCONSISTENT', 'Contradictory results with VWN status');
        continue;
      }
      // else: accepted
    } else if (status !== 'VALID') {
      exclude(item, 'STATUS_UNSUPPORTED', `Unrecognized status: ${status}`);
      continue;
    }

    // 5. Type must be scorable (not CLAIM fallback from normalizer)
    if (!SCORABLE_TYPES.has(item.type)) {
      exclude(item, 'UNSUPPORTED_EVIDENCE_TYPE', `Type '${item.type}' not scorable`);
      continue;
    }

    // 6. Claim must be non-empty
    if (!item.claim || item.claim.trim().length === 0) {
      exclude(item, 'EMPTY_CLAIM', 'Empty claim text');
      continue;
    }

    // 7. Provenance (defense in depth — normalizer requires these)
    if (!item.source || !item.review_id) {
      exclude(item, 'MISSING_PROVENANCE', 'Missing source or review_id');
      continue;
    }

    // 8. Unresolved conflict block (§10.4 poin 4)
    if (conflictIds.has(item.evidence_id)) {
      exclude(item, 'CONFLICT_UNRESOLVED', 'Evidence involved in unresolved conflict');
      continue;
    }

    // ✅ ELIGIBLE
    item.isEligibleForScoring = true;
    item.exclusionReason = undefined;
    eligibleRecords.push(item);
  }

  return { eligibleRecords, excludedRecords, exclusionBreakdown };
}