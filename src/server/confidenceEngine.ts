import { ConfidenceLabel, ConflictItem, CriterionId, CriterionScoreResult, NormalizedEvidence } from './types.js';
import { CRITERIA_DEFINITIONS } from './decisionRules.js';

export interface ConfidenceCalculationResult {
  confidenceLabel: ConfidenceLabel;
  coveragePercent: number;
  totalWeightRated: number;
  independentSourceCount: number;
  independentSources: string[];      // (source::review_id) tuples — §11.2
  independentReviewers: string[];    // unique reviewer names (for display)
  criteriaWithTwoPlusSources: CriterionId[];
  weightWithTwoPlusSources: number;  // 0..1
  sourcesCovering70PercentWeight: boolean;
  hasUnresolvedCriticalConflict: boolean;
  hasProvenanceIssue: boolean;
  provenanceIssues: string[];
  reasons: string[];
}

const PROVENANCE_ISSUE_THRESHOLD = 0.20;  // >20% of used evidence with inadequate provenance → LOW

export function calculateConfidence(
  criteriaScores: Record<CriterionId, CriterionScoreResult>,
  eligibleEvidence: NormalizedEvidence[],
  unresolvedConflicts: ConflictItem[]
): ConfidenceCalculationResult {
  const reasons: string[] = [];

  // ─── 1. Coverage ───
  let totalRatedWeight = 0;
  let totalPossibleWeight = 0;
  for (const cid of Object.keys(CRITERIA_DEFINITIONS) as CriterionId[]) {
    const def = CRITERIA_DEFINITIONS[cid];
    totalPossibleWeight += def.weight;
    if (criteriaScores[cid]?.isRated) totalRatedWeight += def.weight;
  }
  const coveragePercent = totalPossibleWeight > 0
    ? Math.round((totalRatedWeight / totalPossibleWeight) * 100)
    : 0;

  // ─── 2. Independence per (source, review_id) ───
  const evidenceIdsInScoring = new Set<string>();
  for (const cs of Object.values(criteriaScores)) {
    if (cs.isRated) cs.evidenceIdsUsed.forEach(id => evidenceIdsInScoring.add(id));
  }

  const sourceReviewKeys = new Set<string>();
  const reviewerNames = new Set<string>();
  const criteriaBySourceReview = new Map<string, Set<CriterionId>>();
  const provenanceIssues: string[] = [];

  for (const ev of eligibleEvidence) {
    if (!evidenceIdsInScoring.has(ev.evidence_id)) continue;

    const sourceKey = `${ev.source}::${ev.review_id}`;
    sourceReviewKeys.add(sourceKey);
    reviewerNames.add(ev.source);

    for (const [cid, cs] of Object.entries(criteriaScores)) {
      if (cs.evidenceIdsUsed.includes(ev.evidence_id)) {
        if (!criteriaBySourceReview.has(sourceKey)) {
          criteriaBySourceReview.set(sourceKey, new Set());
        }
        criteriaBySourceReview.get(sourceKey)!.add(cid as CriterionId);
      }
    }

    // Provenance adequacy check (§11.1 "kelengkapan provenance dan keterlacakan sumber")
    const hasSource = !!(ev.source && ev.review_id);
    const hasTraceability = !!(ev.video_url || ev.source_excerpt);
    if (!hasSource || !hasTraceability) {
      provenanceIssues.push(
        `Evidence ${ev.evidence_id}: ${!hasSource ? 'missing source/review_id' : 'missing video_url & source_excerpt'}`
      );
    }
  }

  const independentSources = Array.from(sourceReviewKeys);
  const independentSourceCount = independentSources.length;
  const independentReviewers = Array.from(reviewerNames);

  // ─── 3. Per-criterion independence (per §11.2 "kriteria yang mencakup minimal 70% bobot") ───
  const sourcesPerCriterion = new Map<CriterionId, Set<string>>();
  for (const [sourceKey, criteriaSet] of criteriaBySourceReview) {
    for (const cid of criteriaSet) {
      if (!sourcesPerCriterion.has(cid)) sourcesPerCriterion.set(cid, new Set());
      sourcesPerCriterion.get(cid)!.add(sourceKey);
    }
  }

  const criteriaWithTwoPlusSources: CriterionId[] = [];
  let weightWithTwoPlusSources = 0;
  for (const [cid, sources] of sourcesPerCriterion) {
    if (sources.size >= 2) {
      criteriaWithTwoPlusSources.push(cid);
      weightWithTwoPlusSources += CRITERIA_DEFINITIONS[cid].weight;
    }
  }
  // Round to avoid float drift (0.7000000001)
  weightWithTwoPlusSources = Math.round(weightWithTwoPlusSources * 100) / 100;
  const sourcesCovering70PercentWeight = weightWithTwoPlusSources >= 0.70;

  // ─── 4. Conflict & provenance thresholds ───
  const hasUnresolvedCriticalConflict = unresolvedConflicts.some(c => c.isCritical && !c.resolved);

  const provenanceIssueRatio = evidenceIdsInScoring.size > 0
    ? provenanceIssues.length / evidenceIdsInScoring.size
    : 0;
  const hasProvenanceIssue = provenanceIssueRatio > PROVENANCE_ISSUE_THRESHOLD;

  // ─── 5. Derive confidence (§11.2) ───
  let confidenceLabel: ConfidenceLabel;

  if (hasUnresolvedCriticalConflict) {
    confidenceLabel = 'INSUFFICIENT';
    reasons.push('Terdapat konflik kritis yang belum terselesaikan antar sumber review.');
  } else if (coveragePercent === 0) {
    confidenceLabel = 'INSUFFICIENT';
    reasons.push('Tidak ada kriteria yang dapat dinilai secara defensibel.');
  } else if (hasProvenanceIssue) {
    confidenceLabel = 'LOW';
    reasons.push(
      `Provenance evidence tidak memadai (${provenanceIssues.length}/${evidenceIdsInScoring.size} evidence, ${(provenanceIssueRatio * 100).toFixed(0)}% > ${(PROVENANCE_ISSUE_THRESHOLD * 100).toFixed(0)}% threshold).`
    );
    if (coveragePercent >= 60) {
      reasons.push(`Meskipun coverage ${coveragePercent}%, masalah provenance menurunkan confidence ke LOW.`);
    }
  } else if (
    coveragePercent >= 80 &&
    independentSourceCount >= 2 &&
    sourcesCovering70PercentWeight
  ) {
    confidenceLabel = 'HIGH';
    reasons.push(
      `Coverage ${coveragePercent}% (≥80%), ${independentSourceCount} sumber independen (${independentReviewers.join(', ')}) mencakup ${(weightWithTwoPlusSources * 100).toFixed(0)}% bobot (≥70%).`
    );
  } else if (coveragePercent >= 60) {
    confidenceLabel = 'MEDIUM';
    const failedChecks: string[] = [];
    if (coveragePercent < 80) failedChecks.push(`coverage ${coveragePercent}% < 80%`);
    if (independentSourceCount < 2) failedChecks.push(`hanya ${independentSourceCount} sumber independen (<2)`);
    if (!sourcesCovering70PercentWeight) {
      failedChecks.push(`hanya ${(weightWithTwoPlusSources * 100).toFixed(0)}% bobot punya ≥2 sumber (<70%)`);
    }
    reasons.push(`MEDIUM: ${failedChecks.join('; ')}.`);

    // Enriched: which criteria are multi-source vs single-source (§11.2 transparency)
    const singleSourceCriteria = (Object.keys(CRITERIA_DEFINITIONS) as CriterionId[])
      .filter(cid => !criteriaWithTwoPlusSources.includes(cid) && criteriaScores[cid]?.isRated);
    if (criteriaWithTwoPlusSources.length > 0) {
      reasons.push(
        `Kriteria dengan ≥2 sumber: ${criteriaWithTwoPlusSources.map(cid => CRITERIA_DEFINITIONS[cid].nameId).join(', ')}.`
      );
    }
    if (singleSourceCriteria.length > 0) {
      reasons.push(
        `Kriteria single-source: ${singleSourceCriteria.map(cid => CRITERIA_DEFINITIONS[cid].nameId).join(', ')}.`
      );
    }
  } else {
    confidenceLabel = 'LOW';
    reasons.push(`Coverage rendah (${coveragePercent}% < 60%).`);
    if (provenanceIssues.length > 0) {
      reasons.push(`Catatan: ${provenanceIssues.length} evidence juga memiliki masalah provenance.`);
    }
  }

  return {
    confidenceLabel,
    coveragePercent,
    totalWeightRated: totalRatedWeight,
    independentSourceCount,
    independentSources,
    independentReviewers,
    criteriaWithTwoPlusSources,
    weightWithTwoPlusSources,
    sourcesCovering70PercentWeight,
    hasUnresolvedCriticalConflict,
    hasProvenanceIssue,
    provenanceIssues,
    reasons,
  };
}