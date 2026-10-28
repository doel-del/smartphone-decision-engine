import { EvidenceRepository } from './evidenceRepository.js';
import {
  CriterionId,
  CriterionScoreResult,
  DecisionLabel,
  DecisionResult,
  DecisionStatus,
  StrengthItem,
  TradeoffItem,
  DecisionReasonItem,
  NormalizedEvidence,
  SpecItem,
  PricingSummary,
  ReviewerQuote,
} from './types.js';
import {
  CRITERIA_DEFINITIONS,
  RUBRICS_CONFIG,
  RULESET_VERSION,
  EVIDENCE_DATASET_VERSION,
  SPEC_ROWS,
} from './decisionRules.js';
import { calculateConfidence } from './confidenceEngine.js';
import {
  CRITERION_EVALUATORS,
  EvaluatedFinding,
  normalizePriceValue,
  lowestNormalizedPrice,
} from './criterionEvaluators.js';

interface GlobalDriver extends EvaluatedFinding {
  criterionId: CriterionId;
  criterionNameId: string;
}

function buildSpecifications(evidence: NormalizedEvidence[]): SpecItem[] {
  const specs: SpecItem[] = [];
  for (const row of SPEC_ROWS) {
    const values: string[] = [];
    const ids: string[] = [];
    for (const attr of row.attributes) {
      const match = evidence.find(e => e.attribute === attr && e.attribute_value);
      if (match && match.attribute_value) {
        const val = String(match.attribute_value).trim();
        if (val && !values.includes(val)) {
          values.push(val);
          ids.push(match.evidence_id);
        }
      }
    }
    if (values.length > 0) {
      specs.push({ label: row.label, value: values.join(' · '), evidenceIds: ids });
    }
  }
  return specs;
}

/**
 * Score quote quality for display purposes.
 * Prefers complete sentences over mid-sentence fragments.
 */
function scoreQuoteQuality(excerpt: string): number {
  if (!excerpt) return 0;
  const t = excerpt.trim();
  let score = 0;
  if (/^[A-Z"""']/.test(t)) score += 3;         // starts with capital/quote
  if (/[.!?""]$/.test(t)) score += 3;            // ends with punctuation
  if (t.length >= 80 && t.length <= 400) score += 2;  // ideal length
  else if (t.length >= 40) score += 1;
  if (/[a-z]/.test(t)) score += 1;               // not all caps
  return score;
}

function buildPricingSummary(evidence: NormalizedEvidence[]): PricingSummary | null {
  // Consistent selection with evaluatePrice (F-02 + F-23)
  const officialMatch = lowestNormalizedPrice(evidence, 'official_price');
  const promoMatch = lowestNormalizedPrice(evidence, 'purchase_price');

  const officialPrice = officialMatch?.normalizedValue ?? null;
  const promoPrice = promoMatch?.normalizedValue ?? null;
  if (officialPrice === null && promoPrice === null) return null;

  // IDs in field order [official, promo] — deterministic
  const ids = [
    officialMatch?.evidence.evidence_id,
    promoMatch?.evidence.evidence_id,
  ].filter((x): x is string => !!x);

  return {
    officialPrice,
    promoPrice,
    currency: 'IDR',
    evidenceIds: ids,
  };
}

function buildReviewerQuotes(evidence: NormalizedEvidence[]): ReviewerQuote[] {
  // Group by (source, review_id), pick highest-quality quote
  const bestByReviewer = new Map<string, { ev: NormalizedEvidence; score: number }>();
  for (const ev of evidence) {
    if (!ev.source_excerpt || ev.source_excerpt.trim().length < 40) continue;
    if (!ev.video_url) continue;
    const key = `${ev.source}::${ev.review_id}`;
    const quality = scoreQuoteQuality(ev.source_excerpt);
    const existing = bestByReviewer.get(key);
    if (!existing || quality > existing.score) {
      bestByReviewer.set(key, { ev, score: quality });
    }
  }
  return Array.from(bestByReviewer.values()).map(({ ev }) => ({
    source: ev.source,
    reviewId: ev.review_id,
    videoTitle: ev.video_title ?? '',
    videoUrl: ev.video_url ?? '',
    youtubeTimestampUrl: ev.youtubeTimestampUrl ?? ev.video_url ?? '',
    quote: ev.source_excerpt ?? '',
    evidenceId: ev.evidence_id,
  }));
}

export function runDecisionEngine(repository: EvidenceRepository): DecisionResult {
  const eligibleEvidence = repository.getEligibleRecords();
  const excludedEvidence = repository.getExcludedRecords();
  const conflicts = repository.detectConflicts();

  // ─── 1. Evaluate all 7 criteria ───
  const criteriaScores = {} as Record<CriterionId, CriterionScoreResult>;
  for (const cid of Object.keys(CRITERIA_DEFINITIONS) as CriterionId[]) {
    const def = CRITERIA_DEFINITIONS[cid];
    const rubric = RUBRICS_CONFIG[cid];
    const evalResult = CRITERION_EVALUATORS[cid](eligibleEvidence);
    criteriaScores[cid] = {
      criterionId: cid,
      criterionName: def.name,
      criterionNameId: def.nameId,
      weight: def.weight,
      rubricVersion: rubric.version,
      score: evalResult.score,
      isRated: evalResult.isRated,
      unratedReason: evalResult.unratedReason,
      evidenceIdsUsed: evalResult.evidenceIdsUsed,
      primaryFindings: evalResult.primaryFindings,
      primaryFindingsDetail: evalResult.primaryFindingsDetail,
      positiveDrivers: evalResult.positiveDrivers,
      negativeDeductions: evalResult.negativeDeductions,
    };
  }

  // ─── 2. Overall weighted score (§9.2) ───
  let weightedSum = 0;
  let ratedWeightSum = 0;
  for (const cid of Object.keys(criteriaScores) as CriterionId[]) {
    const cs = criteriaScores[cid];
    if (cs.isRated && cs.score !== null) {
      weightedSum += cs.weight * cs.score;
      ratedWeightSum += cs.weight;
    }
  }
  const overallScoreExact = ratedWeightSum > 0 ? weightedSum / ratedWeightSum : null;
  const overallScore = overallScoreExact !== null ? Math.round(overallScoreExact * 10) / 10 : null;

  // ─── 3. Confidence & coverage ───
  const confResult = calculateConfidence(criteriaScores, eligibleEvidence, conflicts);

  // ─── 4. Decision gate (§9.3) ───
  let decisionStatus: DecisionStatus = 'PUBLISHED';
  let decisionLabel: DecisionLabel = 'Data Tidak Mencukupi';
  const isPriceRated = criteriaScores.price_and_value?.isRated === true;
  const hasCriticalConflict = conflicts.some(c => c.isCritical && !c.resolved);
  const coverageOk = confResult.coveragePercent >= 60;

  if (!coverageOk || !isPriceRated || hasCriticalConflict) {
    decisionStatus = hasCriticalConflict ? 'UNRESOLVED_CRITICAL_CONFLICT' : 'INSUFFICIENT_EVIDENCE';
    decisionLabel = 'Data Tidak Mencukupi';
  } else if (overallScore !== null) {
    if (overallScore >= 4.0) decisionLabel = 'Sangat direkomendasikan';
    else if (overallScore >= 3.0) decisionLabel = 'Direkomendasikan dengan pertimbangan';
    else if (overallScore >= 2.0) decisionLabel = 'Cocok secara terbatas';
    else decisionLabel = 'Tidak direkomendasikan';
  }
  // §9.3 + §18.15: Engine self-consistency — strip score-bearing fields
  // when decision is not published. Route layer keeps defense-in-depth.
  const isPublished = decisionStatus === 'PUBLISHED';

  // ─── 5. Global strengths/tradeoffs from per-criterion drivers ───
  const allPositives: GlobalDriver[] = [];
  const allNegatives: GlobalDriver[] = [];
    for (const cid of Object.keys(criteriaScores) as CriterionId[]) {
      const cs = criteriaScores[cid];
      if (!cs.isRated) continue;
      for (const p of cs.positiveDrivers) {
        // Narrow delta to number before use (§9.2 — drivers always have delta in evaluator output)
        if (typeof p.delta !== 'number' || p.delta <= 0) continue;
        allPositives.push({
          text: p.text,
          evidenceIds: p.evidenceIds,
          delta: p.delta,
          criterionId: cid,
          criterionNameId: cs.criterionNameId,
        });
      }
      for (const n of cs.negativeDeductions) {
        if (typeof n.delta !== 'number' || n.delta >= 0) continue;
        allNegatives.push({
          text: n.text,
          evidenceIds: n.evidenceIds,
          delta: n.delta,
          criterionId: cid,
          criterionNameId: cs.criterionNameId,
        });
      }
    }
  allPositives.sort((a, b) => b.delta - a.delta);
  allNegatives.sort((a, b) => a.delta - b.delta);

  const strengths: StrengthItem[] = allPositives.slice(0, 5).map(p => ({
    title: p.text,
    description: `${p.text}. Kontribusi +${p.delta.toFixed(1)} poin untuk ${p.criterionNameId}.`,
    evidenceIds: p.evidenceIds,
    impactCategory: p.criterionNameId,
  }));

  const tradeoffs: TradeoffItem[] = allNegatives.slice(0, 5).map(n => ({
    title: n.text,
    description: `${n.text}. Mengurangi ${Math.abs(n.delta).toFixed(1)} poin dari ${n.criterionNameId}.`,
    scoreDeduction: n.delta,
    evidenceIds: n.evidenceIds,
  }));

  // ─── 6. Decision reasons from top drivers ───
  const decisionReasons: DecisionReasonItem[] = [
    ...allPositives.slice(0, 2).map((p, i) => ({
      id: `reason-positive-${i}`,
      title: p.text,
      description: `Kontribusi +${p.delta.toFixed(1)} poin untuk ${p.criterionNameId}.`,
      evidenceIds: p.evidenceIds,
      impact: 'positive' as const,
    })),
    ...allNegatives.slice(0, 2).map((n, i) => ({
      id: `reason-negative-${i}`,
      title: n.text,
      description: `Mengurangi ${Math.abs(n.delta).toFixed(1)} poin dari ${n.criterionNameId}.`,
      evidenceIds: n.evidenceIds,
      impact: 'negative' as const,
    })),
  ];

  // ─── 7. Quick decision derived from strengths/tradeoffs ───
  const quickDecision = {
    recommendedFor: strengths.slice(0, 4).map(s => ({ text: s.title, evidenceIds: s.evidenceIds })),
    notRecommendedFor: tradeoffs.slice(0, 3).map(t => ({ text: t.title, evidenceIds: t.evidenceIds })),
  };

  // ─── 8. Aggregate evidenceUsed ───
  const evidenceUsedSet = new Set<string>();
  for (const cid of Object.keys(criteriaScores) as CriterionId[]) {
    for (const id of criteriaScores[cid].evidenceIdsUsed) evidenceUsedSet.add(id);
  }
  for (const s of strengths) for (const id of s.evidenceIds) evidenceUsedSet.add(id);
  for (const t of tradeoffs) for (const id of t.evidenceIds) evidenceUsedSet.add(id);
  for (const r of decisionReasons) for (const id of r.evidenceIds) evidenceUsedSet.add(id);
  for (const q of quickDecision.recommendedFor) for (const id of q.evidenceIds) evidenceUsedSet.add(id);
  for (const q of quickDecision.notRecommendedFor) for (const id of q.evidenceIds) evidenceUsedSet.add(id);

  const evidenceExcludedFormatted = excludedEvidence.map(ex => ({
    evidenceId: ex.evidence.evidence_id,
    reason: ex.reason,
    source: ex.evidence.source,
  }));

    // ─── 10. Build supplementary fields ───
  const specifications = buildSpecifications(eligibleEvidence);
  const pricingSummary = buildPricingSummary(eligibleEvidence);
  const reviewerQuotes = buildReviewerQuotes(eligibleEvidence);

  // ─── 11. Assemble with publish-status gating ───
  const finalCriteriaScores = isPublished
    ? criteriaScores
    : (Object.fromEntries(
        Object.entries(criteriaScores).map(([k, v]) => [
          k,
          {
            ...v,
            score: null,
            isRated: false,
            unratedReason: 'DECISION_NOT_PUBLISHED' as const,
          },
        ])
      ) as Record<CriterionId, CriterionScoreResult>);

  return {
    productId: 'samsung-galaxy-a26-5g',
    productName: 'Samsung Galaxy A26 5G',
    overallScore: isPublished ? overallScore : null,
    overallScoreExact: isPublished ? overallScoreExact : null,
    decisionLabel,
    decisionStatus,
    confidenceLabel: confResult.confidenceLabel,
    confidenceReasons: confResult.reasons,
    coveragePercent: confResult.coveragePercent,
    criteriaScores: finalCriteriaScores,
    strengths: isPublished ? strengths : [],
    tradeoffs: isPublished ? tradeoffs : [],
    decisionReasons: isPublished ? decisionReasons : [],
    evidenceUsed: isPublished ? Array.from(evidenceUsedSet) : [],
    evidenceExcluded: evidenceExcludedFormatted,
    unresolvedConflicts: conflicts.filter(c => !c.resolved),
    rulesetVersion: RULESET_VERSION,
    evidenceDatasetVersion: EVIDENCE_DATASET_VERSION,
    generatedAt: new Date().toISOString(),
    quickDecision: isPublished
      ? quickDecision
      : { recommendedFor: [], notRecommendedFor: [] },
    specifications: isPublished ? specifications : [],
    pricingSummary,
    reviewerQuotes,
  };
}