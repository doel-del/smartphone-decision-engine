import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadAllEvidenceDatasets } from '../../src/server/evidenceLoader.js';
import { makeRawRecord } from './helpers.js';

const TMP_DIR = path.resolve(process.cwd(), 'test', '.tmp-data');

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

function writeTmp(file: string, content: string) {
  ensureTmpDir();
  fs.writeFileSync(path.join(TMP_DIR, file), content, 'utf-8');
}

function cleanupTmp() {
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

describe('evidenceLoader', () => {
  beforeEach(cleanupTmp);
  afterEach(cleanupTmp);

  it('loads all 3 files when present in temp dir', () => {
    const sample = JSON.stringify([makeRawRecord({ evidence_id: 'T-1' })]);
    writeTmp('evidence_data_94.json', sample);
    writeTmp('evidence_data_98.json', sample);
    writeTmp('evidence_data_100.json', sample);

    const result = loadAllEvidenceDatasets(TMP_DIR);
    expect(result.datasets.length).toBe(3);
    expect(result.allRecordsWithSourceFile.length).toBe(3);
    expect(result.missingRequiredFiles.length).toBe(0);
  });

  it('reports missing file explicitly (no silent failure)', () => {
    const sample = JSON.stringify([makeRawRecord()]);
    writeTmp('evidence_data_94.json', sample);
    // sengaja tidak buat 98 dan 100

    const result = loadAllEvidenceDatasets(TMP_DIR);
    expect(result.datasets.length).toBe(3);

    const missing = result.datasets.filter(d => d.error);
    expect(missing.length).toBe(2);
    expect(missing.every(d => d.error?.includes('File not found'))).toBe(true);
    expect(result.missingRequiredFiles.length).toBe(2);
  });

  it('reports invalid JSON parse error', () => {
    writeTmp('evidence_data_94.json', '{invalid json');
    writeTmp('evidence_data_98.json', JSON.stringify([makeRawRecord()]));
    writeTmp('evidence_data_100.json', JSON.stringify([makeRawRecord()]));

    const result = loadAllEvidenceDatasets(TMP_DIR);
    const failed = result.datasets.find(d => d.filename === 'evidence_data (94).json');
    expect(failed?.error).toContain('Failed to parse JSON');
  });

  it('reports non-array JSON structure as error', () => {
    writeTmp('evidence_data_94.json', JSON.stringify({ data: [] }));
    writeTmp('evidence_data_98.json', JSON.stringify([makeRawRecord()]));
    writeTmp('evidence_data_100.json', JSON.stringify([makeRawRecord()]));

    const result = loadAllEvidenceDatasets(TMP_DIR);
    const failed = result.datasets.find(d => d.filename === 'evidence_data (94).json');
    expect(failed?.error).toContain('Expected JSON array');
  });

  it('marks empty array as "Dataset loaded but empty"', () => {
    writeTmp('evidence_data_94.json', '[]');
    writeTmp('evidence_data_98.json', JSON.stringify([makeRawRecord()]));
    writeTmp('evidence_data_100.json', JSON.stringify([makeRawRecord()]));

    const result = loadAllEvidenceDatasets(TMP_DIR);
    const empty = result.datasets.find(d => d.filename === 'evidence_data (94).json');
    expect(empty?.error).toBe('Dataset loaded but empty');
    expect(empty?.records.length).toBe(0);
  });

  it('filters out records missing required evidence_id and logs to missingRequiredFiles', () => {
    const invalid = makeRawRecord({ evidence_id: '' });
    const valid = makeRawRecord({ evidence_id: 'VALID-E001' });
    writeTmp('evidence_data_94.json', JSON.stringify([invalid, valid]));
    writeTmp('evidence_data_98.json', JSON.stringify([makeRawRecord()]));
    writeTmp('evidence_data_100.json', JSON.stringify([makeRawRecord()]));

    const result = loadAllEvidenceDatasets(TMP_DIR);
    const ds94 = result.datasets.find(d => d.filename === 'evidence_data (94).json');
    expect(ds94?.records.length).toBe(1);
    expect(ds94?.records[0].evidence_id).toBe('VALID-E001');
  });

  it('detects duplicate IDs across files', () => {
    const dup = makeRawRecord({ evidence_id: 'DUP-X' });
    writeTmp('evidence_data_94.json', JSON.stringify([dup]));
    writeTmp('evidence_data_98.json', JSON.stringify([dup]));
    writeTmp('evidence_data_100.json', JSON.stringify([makeRawRecord()]));

    const result = loadAllEvidenceDatasets(TMP_DIR);
    expect(result.duplicateIdsFound).toContain('DUP-X');
  });
});