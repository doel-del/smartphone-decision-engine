/**
 * Types for Evidence-Based Smartphone Decision Engine
 */

// === TAMBAH di bagian atas types.ts, setelah EvidenceType ===

export type ExclusionReasonCode =
  | 'DUPLICATE_ID'
  | 'NO_VALIDATION_METADATA'
  | 'VALIDATION_NOT_ACCEPTED'
  | 'STATUS_INVALID'
  | 'STATUS_SUSPECT'
  | 'STATUS_UNSUPPORTED'
  | 'VALID_WITH_NORMALIZATION_UNVERIFIED'
  | 'VALID_WITH_NORMALIZATION_INCONSISTENT'
  | 'EMPTY_CLAIM'
  | 'MISSING_PROVENANCE'
  | 'UNSUPPORTED_EVIDENCE_TYPE'
  | 'CONFLICT_UNRESOLVED';

// === UBAH DatasetReport.normalizationErrors ===
// (untuk konsistensi dengan normalizer yang sudah punya severity)
// Sudah di-update sebelumnya. Tidak perlu diubah lagi.

// === UBAH DatasetReport.exclusionReasonsBreakdown comment ===
// Pastikan key-nya adalah ExclusionReasonCode (bukan string alasan lengkap)
// exclusionReasonsBreakdown: Record<string, number>;  // keys = ExclusionReasonCode

export type EvidenceType = 'FACT' | 'MEASUREMENT' | 'OBSERVATION' | 'OPINION' | 'RECOMMENDATION' | 'COMPARISON' | 'CLAIM';

export interface ValidationRuleResult {
  pass: boolean;
  status: 'PASS' | 'SUSPECT' | 'FAIL';
  rule: string;
  reason?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface EvidenceValidation {
  accepted: boolean;
  results?: ValidationRuleResult[];
  finalStatus: 'VALID' | 'VALID_WITH_NORMALIZATION' | 'INVALID' | 'SUSPECT' | string;
}

export interface RawEvidenceRecord {
  evidence_id: string;
  topic: string;
  subtopic: string | null;
  type: EvidenceType | string;
  claim: string;
  value: number | string | null;
  unit: string | null;
  attribute: string | null;
  attribute_value: string | null;
  context: string | null;
  comparison_target?: string | null;
  reviewer_assessment?: 'positive' | 'negative' | 'neutral' | null;

  // ─────────── CHANGED ───────────
  certainty: string | null;                       // ← dari string
  source_excerpt: string | null;                  // ← dari string
  // ───────────────────────────────

  related_evidence_ids?: string[] | null;
  source_coordinates?: {
    chunk_index?: number;
    segment_start_index?: number;
    segment_end_index?: number;
    char_start?: number | null;
    char_end?: number | null;
  };

  // ─────────── CHANGED ───────────
  validation?: EvidenceValidation | null;         // ← dari EvidenceValidation (wajib)
  // ───────────────────────────────

  timestamp_start: string | null;
  timestamp_end: string | null;
  source: string;
  review_id: string;

  // ─────────── CHANGED ───────────
  video_url: string | null;                       // ← dari string
  video_title: string | null;                     // ← dari string
  // ───────────────────────────────

  merged_subtopics?: string[];
  merged_from_evidence_ids?: string[];
}

export interface NormalizedEvidence extends RawEvidenceRecord {
  datasetFile: string;
  datasetVersion: string;            // ← BARU (§12, §16)
  isEligibleForScoring: boolean;
  exclusionReason?: string;
  sourceReviewer: string;
  youtubeTimestampUrl?: string;
  rawRecord: RawEvidenceRecord;      // ← BARU (§7.2 audit trail)
}

export type CriterionId =
  | 'price_and_value'
  | 'performance_and_gaming'
  | 'battery_and_charging'
  | 'software_and_security'
  | 'display_and_design'
  | 'camera'
  | 'durability_and_protection';

export interface CriterionDefinition {
  id: CriterionId;
  name: string;
  nameId: string; // Indonesian title
  weight: number; // 0.0 - 1.0 (Sum = 1.0)
  description: string;
}

export interface CriterionRubric {
  criterionId: CriterionId;
  version: string;
  isFullySpecified: boolean;
  unratedReason?: string;
  baseScoreFormula: string;
  rulesDescription: string[];
}

export interface CriterionScoreResult {
  criterionId: CriterionId;
  criterionName: string;
  criterionNameId: string;
  weight: number;
  score: number | null;
  isRated: boolean;
  unratedReason?: string;
  rubricVersion: string;
  evidenceIdsUsed: string[];
  primaryFindings: string[];   // ← kept for backward compat (text only)
  primaryFindingsDetail: { text: string; evidenceIds: string[] }[];  // ← NEW: traceable per finding
  positiveDrivers: { text: string; evidenceIds: string[]; delta?: number }[];
  negativeDeductions: { text: string; evidenceIds: string[]; delta?: number }[];
}

export type DecisionStatus = 'PUBLISHED' | 'INSUFFICIENT_EVIDENCE' | 'UNRESOLVED_CRITICAL_CONFLICT';
export type DecisionLabel =
  | 'Sangat direkomendasikan'
  | 'Direkomendasikan dengan pertimbangan'
  | 'Cocok secara terbatas'
  | 'Tidak direkomendasikan'
  | 'Data Tidak Mencukupi';

export type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export interface DecisionReasonItem {
  id: string;
  title: string;
  description: string;
  evidenceIds: string[];
  impact: 'positive' | 'negative' | 'neutral';
}

export interface StrengthItem {
  title: string;
  description: string;
  evidenceIds: string[];
  impactCategory: string;
}

export interface TradeoffItem {
  title: string;
  description: string;
  scoreDeduction?: number;
  evidenceIds: string[];
  mitigation?: string;
}

export interface ConflictItem {
  id: string;
  attribute: string;
  topic: string;
  claims: { source: string; claim: string; value: any; evidenceId: string }[];
  isCritical: boolean;
  resolved: boolean;
  resolutionNote?: string;
}

export interface SpecItem {
  label: string;
  value: string;
  evidenceIds: string[];
}

export interface PricingSummary {
  officialPrice: number | null;
  promoPrice: number | null;
  currency: 'IDR';
  evidenceIds: string[];
}

export interface ReviewerQuote {
  source: string;
  reviewId: string;
  videoTitle: string;
  videoUrl: string;
  youtubeTimestampUrl: string;
  quote: string;
  evidenceId: string;
}

export interface DecisionResult {
  productId: string;
  productName: string;
  overallScore: number | null; // Rounded to 1 decimal place (0.0 - 5.0)
  overallScoreExact: number | null; // Full precision internal score
  decisionLabel: DecisionLabel;
  decisionStatus: DecisionStatus;
  confidenceLabel: ConfidenceLabel;
  confidenceReasons: string[];   // ← BARU (§11.2, §12, §16)
  coveragePercent: number; // 0 - 100
  criteriaScores: Record<CriterionId, CriterionScoreResult>;
  strengths: StrengthItem[];
  tradeoffs: TradeoffItem[];
  decisionReasons: DecisionReasonItem[];
  evidenceUsed: string[]; // List of evidence IDs actually used in rated scores & reasons
  evidenceExcluded: { evidenceId: string; reason: string; source: string | null }[];
  unresolvedConflicts: ConflictItem[];
  rulesetVersion: string;
  evidenceDatasetVersion: string;
  generatedAt: string;
  quickDecision: {
    recommendedFor: { text: string; evidenceIds: string[] }[];
    notRecommendedFor: { text: string; evidenceIds: string[] }[];
  };
  specifications: SpecItem[];
  pricingSummary: PricingSummary | null;
  reviewerQuotes: ReviewerQuote[];
}

export interface DatasetReport {
  filesProcessed: {
    filename: string;
    source: string | null;           // ← BARU (sebelumnya string)
    reviewId: string | null;         // ← BARU (sebelumnya string)
    totalRecords: number;
    acceptedRecords: number;
    excludedRecords: number;
    status: 'LOADED_SUCCESSFULLY' | 'MISSING' | 'ERROR' | 'EMPTY';  // ← tambah EMPTY
    error?: string;
  }[];
  missingRequiredFiles: {
    filename: string;
    reason: string;
  }[];
  totalRecordsLoaded: number;
  totalNormalizedRecords: number;
  totalAcceptedRecords: number;
  totalExcludedRecords: number;
  duplicateIdsFound: string[];
  normalizationErrors: { id?: string; issue: string; severity?: 'FATAL' | 'WARNING' }[];  // ← tambah severity
  exclusionReasonsBreakdown: Record<string, number>;
  conflictsDetected: ConflictItem[];
  rulesetVersion: string;
  evidenceDatasetVersion: string;
  independentReviewSources: {
    source: string | null;           // ← BARU (sebelumnya string)
    reviewId: string | null;         // ← BARU (sebelumnya string)
    videoTitle: string;
    videoUrl: string;
    recordCount: number;
  }[];
}