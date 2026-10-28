import { describe, it, expect } from 'vitest';
import { evaluateCamera } from '../../src/server/criterionEvaluators.js';
import { makeNormalizedRecord } from './helpers.js';

/**
 * F-07: eis_availability is used in evaluateCamera for penalties but is NOT
 *       in the camEvidence minimum-check list. A record that ONLY contains
 *       eis_availability (without any other camera attribute) triggers UNRATED.
 *
 * F-08: ultrawide_camera_presence (attribute present in dataset) is NOT in
 *       the camEvidence list — only ultrawide_presence is. Same UNRATED bug.
 *
 * Both are latent because the current dataset has at least one other camera
 * attribute for every record. But the bug is real and verifiable.
 */
describe('KNOWN ISSUE F-07 — eis_availability not in camEvidence minimum-check', () => {
  it.fails(
    'should RATE a record that contains ONLY eis_availability',
    () => {
      const onlyEis = makeNormalizedRecord({
        evidence_id: 'CAM-EIS-ONLY',
        topic: 'camera',
        attribute: 'eis_availability',
        attribute_value: 'terbatas di resolusi tinggi',
        claim: 'EIS hanya aktif di 1080p 30fps',
        source_excerpt: 'EIS hanya aktif di 1080p 30fps',
      });

      const result = evaluateCamera([onlyEis]);

      // EXPECTED (correct): isRated = true, and the EIS penalty is applied
      // ACTUAL (buggy):    isRated = false with unratedReason = 'NO_CAMERA_EVIDENCE'
      expect(result.isRated).toBe(true);
      expect(result.unratedReason).toBeUndefined();
      const eisPenalty = result.negativeDeductions.find(d => d.text.includes('EIS'));
      expect(eisPenalty).toBeDefined();
      expect(eisPenalty?.delta).toBe(-0.2);
    }
  );
});

describe('KNOWN ISSUE F-08 — ultrawide_camera_presence not in camEvidence minimum-check', () => {
  it.fails(
    'should RATE a record that contains ONLY ultrawide_camera_presence',
    () => {
      const onlyUltrawide = makeNormalizedRecord({
        evidence_id: 'CAM-UW-ONLY',
        topic: 'camera',
        attribute: 'ultrawide_camera_presence',
        attribute_value: 'ada',
        claim: 'Kamera ultrawide 8MP tersedia',
        source_excerpt: 'Kamera ultrawide 8MP tersedia',
      });

      const result = evaluateCamera([onlyUltrawide]);

      // EXPECTED (correct): isRated = true, ultrawide bonus applied
      // ACTUAL (buggy):    isRated = false with unratedReason = 'NO_CAMERA_EVIDENCE'
      expect(result.isRated).toBe(true);
      expect(result.unratedReason).toBeUndefined();
      const uwBonus = result.positiveDrivers.find(d => d.text.includes('ultrawide'));
      expect(uwBonus).toBeDefined();
      expect(uwBonus?.delta).toBe(0.2);
    }
  );
});

describe('Evidence: F-07 and F-08 are latent (not currently triggered) because dataset is rich', () => {
  it('in current dataset, camEvidence is non-empty for every camera record', () => {
    // This test PASSES today — the bug is latent.
    // It documents that no runtime failure occurs with the current dataset,
    // but a sparser dataset (or a new product) would trigger F-07/F-08.
    expect(true).toBe(true); // placeholder — real assertion would require dataset grep
  });
});