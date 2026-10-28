import { loadAllEvidenceDatasets, LoaderResult } from './evidenceLoader.js';
import { normalizeEvidenceRecords, NormalizerResult } from './evidenceNormalizer.js';
import { validateEvidenceEligibility, ValidatorResult } from './evidenceValidator.js';
import { EvidenceRepository } from './evidenceRepository.js';
import { EVIDENCE_DATASET_VERSION } from './decisionRules.js';
import { logger } from './logger.js';

export interface PipelineHealth {
  ok: boolean;
  issues: string[];
  failedFiles: string[];
  emptyDatasets: string[];
  conflictedIdsCount: number;
  missingRequiredFilesCount: number;
}

export interface Pipeline {
  loaderResult: LoaderResult;
  normalizerResult: NormalizerResult;
  validatorResult: ValidatorResult;
  repository: EvidenceRepository;
  health: PipelineHealth;
  initializedAt: string;
  durationMs: number;
}

/**
 * Initialize the full evidence pipeline once at server startup.
 * Never throws — always returns a Pipeline with health status set.
 */
export function initializePipeline(): Pipeline {
  const start = Date.now();
  const initializedAt = new Date().toISOString();

  const loaderResult = loadAllEvidenceDatasets();
  const normalizerResult = normalizeEvidenceRecords(
    loaderResult.allRecordsWithSourceFile,
    EVIDENCE_DATASET_VERSION
  );

  // Pass 1: pre-validate without conflict blocking
  const preValidatorResult = validateEvidenceEligibility(normalizerResult.normalizedRecords);
  const preRepository = new EvidenceRepository(
    normalizerResult.normalizedRecords,
    preValidatorResult.eligibleRecords,
    preValidatorResult.excludedRecords
  );

  // Detect conflicts to block
  const { conflictedIds } = preRepository.detectConflictsWithIds();

  // Pass 2: re-validate with conflict blocking
  const validatorResult = validateEvidenceEligibility(
    normalizerResult.normalizedRecords,
    conflictedIds
  );

  const repository = new EvidenceRepository(
    normalizerResult.normalizedRecords,
    validatorResult.eligibleRecords,
    validatorResult.excludedRecords
  );

  // Health assessment
  const failedFiles: string[] = [];
  const emptyDatasets: string[] = [];
  for (const ds of loaderResult.datasets) {
    if (ds.error === 'Dataset loaded but empty') emptyDatasets.push(ds.filename);
    else if (ds.error) failedFiles.push(`${ds.filename}: ${ds.error}`);
  }

  const issues: string[] = [];
  if (failedFiles.length > 0) issues.push(`${failedFiles.length} dataset gagal dimuat`);
  if (normalizerResult.normalizedRecords.length === 0) issues.push('Tidak ada evidence normalized');
  if (validatorResult.eligibleRecords.length === 0) issues.push('Tidak ada evidence eligible');
  if (loaderResult.missingRequiredFiles.length > 0) issues.push(`${loaderResult.missingRequiredFiles.length} file wajib hilang`);

  const health: PipelineHealth = {
    ok: failedFiles.length === 0 && validatorResult.eligibleRecords.length > 0,
    issues,
    failedFiles,
    emptyDatasets,
    conflictedIdsCount: conflictedIds.size,
    missingRequiredFilesCount: loaderResult.missingRequiredFiles.length,
  };

  const durationMs = Date.now() - start;

  logger.info('pipeline_initialized', {
    ok: health.ok,
    durationMs,
    loadedRecords: loaderResult.allRecordsWithSourceFile.length,
    normalizedRecords: normalizerResult.normalizedRecords.length,
    eligibleRecords: validatorResult.eligibleRecords.length,
    excludedRecords: validatorResult.excludedRecords.length,
    conflictedIdsCount: conflictedIds.size,
    duplicateIdsCount: loaderResult.duplicateIdsFound.length + normalizerResult.duplicateIds.length,
    failedFiles,
    issues,
  });

  return {
    loaderResult,
    normalizerResult,
    validatorResult,
    repository,
    health,
    initializedAt,
    durationMs,
  };
}