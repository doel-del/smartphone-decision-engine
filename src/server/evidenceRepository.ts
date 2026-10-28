import {
  NormalizedEvidence,
  ConflictItem,
} from './types.js';
import { CONFLICT_RULES, ConflictRule } from './decisionRules.js';

interface ConflictDetectionResult {
  conflicts: ConflictItem[];
  conflictedIds: Set<string>;
}

export class EvidenceRepository {
  private allRecords: NormalizedEvidence[] = [];
  private eligibleRecords: NormalizedEvidence[] = [];
  private excludedRecords: { evidence: NormalizedEvidence; reason: string }[] = [];
  private recordsById = new Map<string, NormalizedEvidence>();
  private recordsByTopic = new Map<string, NormalizedEvidence[]>();
  private recordsBySource = new Map<string, NormalizedEvidence[]>();
  private recordsByReview = new Map<string, NormalizedEvidence[]>();

  constructor(
    allRecords: NormalizedEvidence[],
    eligible: NormalizedEvidence[],
    excluded: { evidence: NormalizedEvidence; reason: string }[]
  ) {
    this.allRecords = allRecords;
    this.eligibleRecords = eligible;
    this.excludedRecords = excluded;

    for (const r of allRecords) {
      if (!this.recordsById.has(r.evidence_id)) {
        this.recordsById.set(r.evidence_id, r);
      }

      const topic = r.topic.toLowerCase();
      if (!this.recordsByTopic.has(topic)) this.recordsByTopic.set(topic, []);
      this.recordsByTopic.get(topic)!.push(r);

      if (!this.recordsBySource.has(r.source)) this.recordsBySource.set(r.source, []);
      this.recordsBySource.get(r.source)!.push(r);

      if (!this.recordsByReview.has(r.review_id)) this.recordsByReview.set(r.review_id, []);
      this.recordsByReview.get(r.review_id)!.push(r);
    }
  }

  // ─── Accessors ───
  getAllRecords(): NormalizedEvidence[] { return this.allRecords; }
  getEligibleRecords(): NormalizedEvidence[] { return this.eligibleRecords; }
  getExcludedRecords(): { evidence: NormalizedEvidence; reason: string }[] { return this.excludedRecords; }
  getById(id: string, opts: { onlyEligible?: boolean } = {}): NormalizedEvidence | undefined {
    const rec = this.recordsById.get(id);
    if (!rec) return undefined;
    if (opts.onlyEligible && !rec.isEligibleForScoring) return undefined;
    return rec;
  }

  getByTopic(topic: string, onlyEligible = true): NormalizedEvidence[] {
    const list = this.recordsByTopic.get(topic.toLowerCase()) || [];
    return onlyEligible ? list.filter(r => r.isEligibleForScoring) : list;
  }

  getBySource(source: string, onlyEligible = true): NormalizedEvidence[] {
    const list = this.recordsBySource.get(source) || [];
    return onlyEligible ? list.filter(r => r.isEligibleForScoring) : list;
  }

  /** §10.3, §11.1: Independent sources are (source, review_id) pairs */
  getIndependentSources(): { source: string; reviewId: string; count: number }[] {
    return Array.from(this.recordsByReview.entries()).map(([reviewId, records]) => ({
      source: records[0]?.source ?? 'unknown',
      reviewId,
      count: records.length,
    }));
  }

  // ─── Conflict Detection (data-driven via CONFLICT_RULES) ───
  detectConflicts(): ConflictItem[] {
    return this.detectConflictsWithIds().conflicts;
  }

  /** Returns both conflicts and IDs — use before scoring to block evidence */
  detectConflictsWithIds(): ConflictDetectionResult {
    const conflicts: ConflictItem[] = [];
    const conflictedIds = new Set<string>();

    for (const rule of CONFLICT_RULES) {
      const matching = this.eligibleRecords.filter(r => r.attribute === rule.attribute);
      if (matching.length < 2) continue;

      const conflict = this.assessConflict(rule, matching);
      if (!conflict) continue;

      conflicts.push(conflict.conflict);
      if (!conflict.conflict.resolved) {
        for (const c of conflict.conflict.claims) {
          conflictedIds.add(c.evidenceId);
        }
      }
    }

    return { conflicts, conflictedIds };
  }

  private assessConflict(
    rule: ConflictRule,
    records: NormalizedEvidence[]
  ): { conflict: ConflictItem } | null {
    // Group by value (for EXACT/PERCENT_5) or by context (for CONTEXT_AWARE)
    if (rule.tolerance === 'CONTEXT_AWARE') {
      // Different contexts are valid separate data points (e.g., SRP vs promo price)
      const byContext = new Map<string, NormalizedEvidence[]>();
      for (const r of records) {
        const ctx = (r.context ?? '').toLowerCase().trim() || '__default__';
        if (!byContext.has(ctx)) byContext.set(ctx, []);
        byContext.get(ctx)!.push(r);
      }
      // Within each context, check for duplicate values
      for (const [ctx, ctxRecords] of byContext) {
        if (ctxRecords.length < 2) continue;
        const distinct = new Set(ctxRecords.map(r => String(r.value ?? r.attribute_value ?? '')));
        if (distinct.size > 1) {
          return { conflict: this.buildConflict(rule, ctxRecords, false, `${ctxRecords.length} conflicting values within context "${ctx}"`) };
        }
      }
      return null;
    }

    if (rule.tolerance === 'PERCENT_5') {
      const numeric = records
        .map(r => (typeof r.value === 'number' ? r.value : parseFloat(String(r.value ?? ''))))
        .filter(v => Number.isFinite(v));
      if (numeric.length < 2) return null;
      const min = Math.min(...numeric);
      const max = Math.max(...numeric);
      const variance = max === 0 ? 0 : (max - min) / max;
      if (variance <= 0.05) return null; // within tolerance — normal variance, not a conflict
      return { conflict: this.buildConflict(rule, records, false, `Variance ${(variance * 100).toFixed(1)}% exceeds 5% threshold`) };
    }

    // EXACT
    const distinct = new Set(records.map(r => String(r.attribute_value ?? r.value ?? '').toLowerCase().trim()));
    if (distinct.size <= 1) return null;
    return { conflict: this.buildConflict(rule, records, false, `Contradictory ${rule.attribute} values across reviewers`) };
  }

  private buildConflict(
    rule: ConflictRule,
    records: NormalizedEvidence[],
    resolved: boolean,
    autoNote: string
  ): ConflictItem {
    return {
      id: `conflict-${rule.attribute}`,
      attribute: rule.attribute,
      topic: rule.topic,
      claims: [...records]
      .sort((a, b) => a.evidence_id.localeCompare(b.evidence_id))
      .map(r => ({
        source: r.source,
        claim: r.claim,
        value: r.attribute_value ?? r.value,
        evidenceId: r.evidence_id,
      })),
      isCritical: rule.isCritical,
      resolved,
      resolutionNote: autoNote,  // auto-generated from data, not hard-coded
    };
  }
}