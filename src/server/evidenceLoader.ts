import fs from 'fs';
import path from 'path';
import { RawEvidenceRecord } from './types.js';

export interface LoadedDataset {
  filename: string;
  sourcePath: string;
  records: RawEvidenceRecord[];
  error?: string;
  source: string | null;
  reviewId: string | null;
  loadedAt: string;
  durationMs: number;
}

export interface LoaderResult {
  datasets: LoadedDataset[];
  missingRequiredFiles: { filename: string; reason: string }[];
  allRecordsWithSourceFile: { record: RawEvidenceRecord; filename: string }[];
  duplicateIdsFound: string[];
  loadedAt: string;
  loadDurationMs: number;
}

const TARGET_FILES = [
  { filename: 'evidence_data (94).json', diskFilename: 'evidence_data_94.json' },
  { filename: 'evidence_data (98).json', diskFilename: 'evidence_data_98.json' },
  { filename: 'evidence_data (100).json', diskFilename: 'evidence_data_100.json' },
] as const;

/**
 * Minimal runtime shape check for a single record.
 * Returns null if valid, or an error string describing the violation.
 * NOTE: This does not replace evidenceValidator — it only catches gross malformations.
 */
function validateRecordShape(rec: unknown, index: number): string | null {
  if (!rec || typeof rec !== 'object') {
    return `Record[${index}] is not an object`;
  }
  const r = rec as Record<string, unknown>;
  if (typeof r.evidence_id !== 'string' || r.evidence_id.trim() === '') {
    return `Record[${index}] has invalid evidence_id`;
  }
  if (!r.validation || typeof r.validation !== 'object') {
    return `Record[${index}] (${r.evidence_id}) missing validation object`;
  }
  return null;
}

export function loadAllEvidenceDatasets(
  dataDir: string = path.resolve(process.cwd(), 'data')
): LoaderResult {
  const startTime = Date.now();
  const datasets: LoadedDataset[] = [];
  const missingRequiredFiles: { filename: string; reason: string }[] = [];
  const allRecordsWithSourceFile: { record: RawEvidenceRecord; filename: string }[] = [];
  const duplicateIdsFound: string[] = [];
  const seenIds = new Set<string>();

  for (const item of TARGET_FILES) {
    const fileStart = Date.now();
    const filePath = path.join(dataDir, item.diskFilename);

    if (!fs.existsSync(filePath)) {
      datasets.push({
        filename: item.filename,
        sourcePath: filePath,
        records: [],
        error: `File not found at ${filePath}`,
        source: null,
        reviewId: null,
        loadedAt: new Date().toISOString(),
        durationMs: Date.now() - fileStart,
      });
      missingRequiredFiles.push({
        filename: item.filename,
        reason: `Dataset file ${item.diskFilename} not found.`,
      });
      continue;
    }

    let parsed: unknown;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      parsed = JSON.parse(content);
    } catch (err: any) {
      datasets.push({
        filename: item.filename,
        sourcePath: filePath,
        records: [],
        error: `Failed to parse JSON: ${err.message}`,
        source: null,
        reviewId: null,
        loadedAt: new Date().toISOString(),
        durationMs: Date.now() - fileStart,
      });
      missingRequiredFiles.push({
        filename: item.filename,
        reason: `JSON parse error: ${err.message}`,
      });
      continue;
    }

    if (!Array.isArray(parsed)) {
      datasets.push({
        filename: item.filename,
        sourcePath: filePath,
        records: [],
        error: `Expected JSON array, got ${typeof parsed}`,
        source: null,
        reviewId: null,
        loadedAt: new Date().toISOString(),
        durationMs: Date.now() - fileStart,
      });
      missingRequiredFiles.push({
        filename: item.filename,
        reason: 'Invalid structure: expected array of evidence records.',
      });
      continue;
    }

    if (parsed.length === 0) {
      datasets.push({
        filename: item.filename,
        sourcePath: filePath,
        records: [],
        error: 'Dataset loaded but empty',
        source: null,
        reviewId: null,
        loadedAt: new Date().toISOString(),
        durationMs: Date.now() - fileStart,
      });
      continue;
    }

    const validRecords: RawEvidenceRecord[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const shapeError = validateRecordShape(parsed[i], i);
      if (shapeError) {
        missingRequiredFiles.push({ filename: item.filename, reason: shapeError });
        continue;
      }
      const record = parsed[i] as RawEvidenceRecord;
      if (seenIds.has(record.evidence_id)) {
        if (!duplicateIdsFound.includes(record.evidence_id)) {
          duplicateIdsFound.push(record.evidence_id);
        }
      } else {
        seenIds.add(record.evidence_id);
      }
      validRecords.push(record);
      allRecordsWithSourceFile.push({ record, filename: item.filename });
    }

    // Do NOT fallback to hard-coded source/reviewId (§8.4).
    const firstRecord = validRecords[0];
    datasets.push({
      filename: item.filename,
      sourcePath: filePath,
      records: validRecords,
      source: firstRecord?.source ?? null,
      reviewId: firstRecord?.review_id ?? null,
      loadedAt: new Date().toISOString(),
      durationMs: Date.now() - fileStart,
    });
  }

  return {
    datasets,
    missingRequiredFiles,
    allRecordsWithSourceFile,
    duplicateIdsFound,
    loadedAt: new Date().toISOString(),
    loadDurationMs: Date.now() - startTime,
  };
}