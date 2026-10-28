import express, { Request, Response } from 'express';
import { Pipeline } from './pipeline.js';
import { runDecisionEngine } from './decisionEngine.js';
import { DatasetReport, DecisionResult } from './types.js';
import { RULESET_VERSION, EVIDENCE_DATASET_VERSION } from './decisionRules.js';
import { logger } from './logger.js';

export function createApiRouter(pipeline: Pipeline): express.Router {
  const router = express.Router();
  const { loaderResult, normalizerResult, validatorResult, repository, health } = pipeline;

  // ─── 1. Decision endpoint ───
  router.get('/products/samsung-galaxy-a26-5g/decision', (_req: Request, res: Response) => {
    // §14, §18.15: block if pipeline unhealthy
    if (!health.ok) {
      return res.status(503).json({
        error: 'PIPELINE_UNAVAILABLE',
        message: 'Evidence pipeline tidak sehat. Keputusan tidak dapat dihitung.',
        issues: health.issues,
        failedFiles: health.failedFiles,
      });
    }

    try {
      const decision = runDecisionEngine(repository);

      // §9.3, §18.15: strip score fields when status != PUBLISHED
      const response = decision.decisionStatus === 'PUBLISHED'
        ? decision
        : stripUnpublishedFields(decision);

      res.json(response);
    } catch (err: any) {
      logger.error('decision_engine_error', { message: err.message, stack: err.stack });
      res.status(500).json({
        error: 'DECISION_ENGINE_ERROR',
        message: 'Gagal menghitung keputusan. Silakan coba lagi.',
      });
    }
  });

  // ─── 2. Diagnostics ───
  router.get('/diagnostics/evidence', (_req: Request, res: Response) => {
    try {
      const filesProcessed = loaderResult.datasets.map(ds => {
        const fileNorm = normalizerResult.normalizedRecords.filter(r => r.datasetFile === ds.filename);
        const accepted = fileNorm.filter(r => r.isEligibleForScoring).length;
        const excluded = fileNorm.filter(r => !r.isEligibleForScoring).length;
        return {
          filename: ds.filename,
          source: ds.source,
          reviewId: ds.reviewId,
          totalRecords: ds.records.length,
          acceptedRecords: accepted,
          excludedRecords: excluded,
          status: (
            !ds.error
              ? 'LOADED_SUCCESSFULLY'
              : ds.error === 'Dataset loaded but empty'
                ? 'EMPTY'
                : 'ERROR'
          ) as 'LOADED_SUCCESSFULLY' | 'EMPTY' | 'ERROR',
          error: ds.error,
        };
      });

      const independentReviewSources = loaderResult.datasets.map(ds => {
        const first = ds.records[0];
        return {
          source: ds.source,
          reviewId: ds.reviewId,
          videoTitle: first?.video_title || '',
          videoUrl: first?.video_url || '',
          recordCount: ds.records.length,
        };
      });

      const report: DatasetReport & { health: typeof health } = {
        filesProcessed,
        missingRequiredFiles: loaderResult.missingRequiredFiles,
        totalRecordsLoaded: loaderResult.allRecordsWithSourceFile.length,
        totalNormalizedRecords: normalizerResult.normalizedRecords.length,
        totalAcceptedRecords: validatorResult.eligibleRecords.length,
        totalExcludedRecords: validatorResult.excludedRecords.length,
        duplicateIdsFound: [
          ...new Set([
            ...loaderResult.duplicateIdsFound,
            ...normalizerResult.duplicateIds,
          ]),
        ],
        normalizationErrors: normalizerResult.normalizationErrors,
        exclusionReasonsBreakdown: validatorResult.exclusionBreakdown,
        conflictsDetected: repository.detectConflicts(),
        rulesetVersion: RULESET_VERSION,
        evidenceDatasetVersion: EVIDENCE_DATASET_VERSION,
        independentReviewSources,
        health,
      };

      res.json(report);
    } catch (err: any) {
      logger.error('diagnostics_error', { message: err.message });
      res.status(500).json({ error: 'DIAGNOSTICS_ERROR', message: 'Gagal membuat laporan diagnostik.' });
    }
  });

  // ─── 3. Evidence by ID ───
  router.get('/evidence/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    const record = repository.getById(id);
    if (!record) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Evidence ${id} tidak ditemukan.` });
    }
    res.json({
      ...record,
      isEligibleForScoring: record.isEligibleForScoring,
      exclusionReason: record.exclusionReason ?? null,
    });
  });

  // ─── 4. Evidence list ───
  router.get('/evidence', (req: Request, res: Response) => {
    const { topic, source, eligibleOnly, search } = req.query;
    let list = repository.getAllRecords();

    if (topic && typeof topic === 'string') {
      list = list.filter(r => r.topic.toLowerCase() === topic.toLowerCase());
    }
    if (source && typeof source === 'string') {
      list = list.filter(r => r.source.toLowerCase().includes(source.toLowerCase()));
    }
    if (eligibleOnly === 'true') {
      list = list.filter(r => r.isEligibleForScoring);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.claim.toLowerCase().includes(q) ||
        r.evidence_id.toLowerCase().includes(q) ||
        (r.source_excerpt?.toLowerCase().includes(q) ?? false) ||
        (r.subtopic && r.subtopic.toLowerCase().includes(q))
      );
    }

    res.json({ total: list.length, records: list });
  });

  return router;
}

/**
 * Defense-in-depth stripping of score-bearing fields when decision is not published.
 * The engine itself now strips these fields (§9.3, §18.15) — this is a safety net
 * for any future refactor that might bypass the engine's gating.
 */
function stripUnpublishedFields(d: DecisionResult): DecisionResult {
  const strippedCriteria = Object.fromEntries(
    Object.entries(d.criteriaScores).map(([k, v]) => [
      k,
      { ...v, score: null, isRated: false, unratedReason: 'DECISION_NOT_PUBLISHED' },
    ])
  ) as DecisionResult['criteriaScores'];

  return {
    ...d,
    overallScore: null,
    overallScoreExact: null,
    criteriaScores: strippedCriteria,
    strengths: [],
    tradeoffs: [],
    decisionReasons: [],
  };
}