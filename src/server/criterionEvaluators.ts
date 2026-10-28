import { NormalizedEvidence } from './types.js';

// ============================================================
// Utility helpers — single-match (fixes double-count bug)
// ============================================================

function find(evidence: NormalizedEvidence[], ...attrs: string[]): NormalizedEvidence[] {
  return evidence.filter(e => e.attribute !== null && attrs.includes(e.attribute));
}

/**
 * Strict numeric parser. Rejects ambiguous formats (return null).
 *
 * Accepted:
 *   - number (finite): use directly
 *   - "3999000" (pure integer, no separators): parseInt
 *   - "3.8" or "3,8" (single decimal separator): parseFloat
 *
 * Rejected (return null):
 *   - Multi-separator: "3.999.000", "3,999,000"
 *   - Ambiguous: "1.234" (could be 1234 or 1.234)
 *   - Currency prefixed: "Rp 3.800.000"
 *   - Non-numeric, null, NaN, Infinity, empty
 */
function toNumber(ev: NormalizedEvidence): number | null {
  if (typeof ev.value === 'number') {
    return Number.isFinite(ev.value) ? ev.value : null;
  }
  if (typeof ev.value === 'string') {
    const s = ev.value.trim();
    if (!s) return null;

    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    }

    if (/^\d+[.,]\d{1,2}$/.test(s)) {
      const n = parseFloat(s.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }

    return null;
  }
  return null;
}

function toText(ev: NormalizedEvidence): string {
  return String(ev.attribute_value ?? ev.value ?? '').toLowerCase().trim();
}

function hasText(ev: NormalizedEvidence, needles: string[]): boolean {
  const t = toText(ev);
  return needles.some(n => t.includes(n.toLowerCase()));
}

function clamp(score: number): number {
  return Math.max(0, Math.min(5, score));
}

/** Returns highest numeric value across all matching records (single best match). */
function bestNumeric(
  evidence: NormalizedEvidence[],
  ...attrs: string[]
): { value: number; evidence: NormalizedEvidence } | null {
  let best: { value: number; evidence: NormalizedEvidence } | null = null;
  for (const ev of find(evidence, ...attrs)) {
    const v = toNumber(ev);
    if (v !== null && (best === null || v > best.value)) {
      best = { value: v, evidence: ev };
    }
  }
  return best;
}

/**
 * Deterministic best match — ties broken by evidence_id (lexicographic).
 * NOTE (F2): This changes selection behavior vs previous "first-in-array"
 * when multiple records match the predicate. Audit confirms zero behavior
 * change for current dataset (all matching attributes produce identical pick).
 */
function bestMatch(
  evidence: NormalizedEvidence[],
  attrs: string[],
  predicate: (ev: NormalizedEvidence) => boolean
): NormalizedEvidence | null {
  const matches = find(evidence, ...attrs).filter(predicate);
  if (matches.length === 0) return null;
  return matches.reduce((best, ev) =>
    ev.evidence_id < best.evidence_id ? ev : best
  );
}

/** Returns worst (highest) numeric for penalties. */
function worstNumeric(
  evidence: NormalizedEvidence[],
  ...attrs: string[]
): { value: number; evidence: NormalizedEvidence } | null {
  let worst: { value: number; evidence: NormalizedEvidence } | null = null;
  for (const ev of find(evidence, ...attrs)) {
    const v = toNumber(ev);
    if (v !== null && (worst === null || v > worst.value)) {
      worst = { value: v, evidence: ev };
    }
  }
  return worst;
}

/**
 * @internal — exported for cross-module use within src/server/ only.
 * Not part of public API contract; may change without version bump.
 *
 * Normalize a price value to full Indonesian Rupiah based on declared unit.
 *
 * Accepted units (whitelist — reject everything else):
 *   - "juta", "jt"           → value * 1,000,000
 *   - "ribu", "rb"           → value * 1,000
 *   - "idr", "rupiah", "rp"  → value as-is
 *
 * Rejected:
 *   - null/empty/unknown unit
 *   - Ambiguous aliases: "m", "k", "million", "thousand"
 *   - null/NaN/Infinity value
 *   - Overflow after multiplication (F1)
 */
export function normalizePriceValue(
  value: number | null,
  unit: string | null
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (unit === null || typeof unit !== 'string') return null;

  const u = unit.toLowerCase().trim();
  if (!u) return null;

  let normalized: number;
  if (u === 'juta' || u === 'jt') normalized = value * 1_000_000;
  else if (u === 'ribu' || u === 'rb') normalized = value * 1_000;
  else if (u === 'idr' || u === 'rupiah' || u === 'rp') normalized = value;
  else return null;

  if (!Number.isFinite(normalized)) return null;
  return normalized;
}

/**
 * @internal
 * Normalize-first, then pick lowest. Deterministic tie-break by evidence_id.
 */
export function lowestNormalizedPrice(
  evidence: NormalizedEvidence[],
  ...attrs: string[]
): { normalizedValue: number; evidence: NormalizedEvidence } | null {
  let lowest: { normalizedValue: number; evidence: NormalizedEvidence } | null = null;

  for (const ev of find(evidence, ...attrs)) {
    const raw = toNumber(ev);
    const normalized = normalizePriceValue(raw, ev.unit);
    if (normalized === null) continue;

    if (lowest === null || normalized < lowest.normalizedValue) {
      lowest = { normalizedValue: normalized, evidence: ev };
    } else if (
      normalized === lowest.normalizedValue &&
      ev.evidence_id < lowest.evidence.evidence_id
    ) {
      lowest = { normalizedValue: normalized, evidence: ev };
    }
  }
  return lowest;
}

/**
 * Parse a duration claim like "17 jam 42 menit" or "88 menit" into total minutes.
 */
function parseDurationMinutes(claim: string): number | null {
  const lower = claim.toLowerCase();
  const hoursMatch = lower.match(/(\d+)\s*jam/);
  const minMatch = lower.match(/(\d+)\s*menit/);
  if (!hoursMatch && !minMatch) return null;
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
  return hours * 60 + mins;
}

/**
 * Parse a duration claim into decimal hours (e.g., "17 jam 42 menit" → 17.7).
 */
function parseDurationHours(claim: string): number | null {
  const mins = parseDurationMinutes(claim);
  return mins === null ? null : mins / 60;
}

/**
 * Robustly extract duration in minutes from any of claim / attribute_value / value.
 * Handles "1 jam 28 menit", "88 menit", "88mnt", numeric value=88.
 */
function extractDurationMinutes(ev: NormalizedEvidence): number | null {
  // 1. Claim text
  const fromClaim = parseDurationMinutes(ev.claim ?? '');
  if (fromClaim !== null) return fromClaim;

  // 2. attribute_value
  if (ev.attribute_value) {
    const fromAttr = parseDurationMinutes(String(ev.attribute_value));
    if (fromAttr !== null) return fromAttr;
  }

  // 3. Numeric value (assume minutes when unit mentions menit or when attribute is *_time_*)
  if (typeof ev.value === 'number' && Number.isFinite(ev.value)) {
    const unit = String(ev.unit ?? '').toLowerCase();
    if (unit.includes('menit') || unit.includes('minute') || unit === 'min' ||
        (ev.attribute ?? '').includes('time')) {
      return ev.value;
    }
  }

  // 4. String value
  if (typeof ev.value === 'string') {
    const fromVal = parseDurationMinutes(ev.value);
    if (fromVal !== null) return fromVal;
  }

  return null;
}

// ============================================================
// Types
// ============================================================

export interface EvaluatedFinding {
  text: string;
  evidenceIds: string[];
  delta: number;
}

export interface EvalResult {
  score: number | null;
  isRated: boolean;
  unratedReason?: string;
  evidenceIdsUsed: string[];
  primaryFindings: string[];
  primaryFindingsDetail: { text: string; evidenceIds: string[] }[];
  positiveDrivers: EvaluatedFinding[];
  negativeDeductions: EvaluatedFinding[];
}

function unrated(reason: string): EvalResult {
  return {
    score: null,
    isRated: false,
    unratedReason: reason,
    evidenceIdsUsed: [],
    primaryFindings: [],
    primaryFindingsDetail: [],
    positiveDrivers: [],
    negativeDeductions: [],
  };
}

function finalize(
  baseScore: number,
  positives: EvaluatedFinding[],
  negatives: EvaluatedFinding[],
  findings: { text: string; evidenceIds: string[] }[],
  opts: { capPositive?: number } = {}
): EvalResult {
  const capPositive = opts.capPositive ?? 1.5;

  // Enforce positive sum cap (defense-in-depth against future regression)
  let positiveSum = 0;
  const effectivePositives: EvaluatedFinding[] = [];
  for (const p of [...positives].sort((a, b) => b.delta - a.delta)) {
    const remaining = capPositive - positiveSum;
    if (remaining <= 0.05) break;
    if (p.delta <= remaining) {
      effectivePositives.push(p);
      positiveSum += p.delta;
    } else {
      effectivePositives.push({ ...p, delta: +remaining.toFixed(2) });
      positiveSum = capPositive;
      break;
    }
  }

  const negativeSum = negatives.reduce((s, n) => s + n.delta, 0);
  const finalScore = clamp(Math.round((baseScore + positiveSum + negativeSum) * 100) / 100);

  const evidenceIdsUsed = Array.from(new Set([
    ...effectivePositives.flatMap(p => p.evidenceIds),
    ...negatives.flatMap(n => n.evidenceIds),
    ...findings.flatMap(f => f.evidenceIds),
  ]));

  return {
    score: finalScore,
    isRated: true,
    evidenceIdsUsed,
    primaryFindings: findings.map(f => f.text),
    primaryFindingsDetail: findings,
    positiveDrivers: effectivePositives,
    negativeDeductions: negatives,
  };
}

// ============================================================
// EVALUATORS
// ============================================================

/**
 * Price and value for money.
 * Base 3.0. Differentiators: promo price, expandable storage.
 * Deficiency: charger not included.
 */
export function evaluatePrice(evidence: NormalizedEvidence[]): EvalResult {
  const priceEvidence = find(evidence, 'price', 'official_price', 'purchase_price');

  // Stage 1: any price records at all?
  if (priceEvidence.length === 0) {
    return unrated('NO_PRICE_EVIDENCE');
  }

  // Stage 2: any valid numeric value?
  const recordsWithValidValue = priceEvidence
    .map(ev => ({ ev, numericValue: toNumber(ev) }))
    .filter(x => x.numericValue !== null);

  if (recordsWithValidValue.length === 0) {
    return unrated('PRICE_VALUES_INVALID');
  }

  // Stage 3: any record that normalizes to rupiah?
  const normalizedFindings = recordsWithValidValue
    .map(x => ({
      ev: x.ev,
      normalized: normalizePriceValue(x.numericValue, x.ev.unit),
    }))
    .filter(x => x.normalized !== null);

  if (normalizedFindings.length === 0) {
    return unrated('PRICE_NOT_NORMALIZABLE');
  }

  const findings: { text: string; evidenceIds: string[] }[] = [];
  const positives: EvaluatedFinding[] = [];
  const negatives: EvaluatedFinding[] = [];

  // F5: findings sorted by evidence_id (deterministic; NOT by relevance)
  const sortedForFindings = normalizedFindings
    .map(x => x.ev)
    .sort((a, b) => a.evidence_id.localeCompare(b.evidence_id));

  for (const ev of sortedForFindings.slice(0, 2)) {
    findings.push({ text: ev.claim, evidenceIds: [ev.evidence_id] });
  }

  // F3: bonus promo ONLY from purchase_price (not price/official_price)
  const promo = lowestNormalizedPrice(evidence, 'purchase_price');
  if (promo) {
    if (promo.normalizedValue < 3_500_000) {
      positives.push({
        text: 'Harga promo di bawah Rp 3,5 juta',
        evidenceIds: [promo.evidence.evidence_id],
        delta: 0.6,
      });
    } else if (promo.normalizedValue < 4_000_000) {
      positives.push({
        text: 'Harga promo di bawah Rp 4 juta',
        evidenceIds: [promo.evidence.evidence_id],
        delta: 0.3,
      });
    }
  }

  const sd = bestMatch(evidence, ['expandable_storage'], ev =>
    hasText(ev, ['ya', 'ada', 'yes', 'true', 'microsd'])
  );
  if (sd) positives.push({ text: 'Dukungan microSD', evidenceIds: [sd.evidence_id], delta: 0.2 });

  const chargerNotInc = bestMatch(evidence, ['charger_included'], ev =>
    hasText(ev, ['false', 'tidak', 'no'])
  );
  if (chargerNotInc) {
    negatives.push({
      text: 'Charger tidak disertakan dalam kotak',
      evidenceIds: [chargerNotInc.evidence_id],
      delta: -0.3,
    });
  }

  return finalize(3.0, positives, negatives, findings);
}

/**
 * Performance and gaming.
 * Base 3.0. Differentiators: AnTuTu tiers, RAM, storage, esports FPS.
 * Deficiency: thermal throttle.
 */
export function evaluatePerformance(evidence: NormalizedEvidence[]): EvalResult {
  const perfEvidence = find(
    evidence, 'chipset', 'antutu_score', 'antutu_10_score', 'antutu_v10_score',
    'geekbench_6_single_core', 'geekbench_6_multi_core', '3dmark_score',
    'game_fps', 'stability_percentage', 'ram_capacity', 'storage_capacity', 'core_count'
  );
  if (perfEvidence.length === 0) return unrated('NO_PERFORMANCE_EVIDENCE');

  const findings: { text: string; evidenceIds: string[] }[] = [];
  const positives: EvaluatedFinding[] = [];
  const negatives: EvaluatedFinding[] = [];

  const chipset = find(evidence, 'chipset')[0];
  if (chipset) findings.push({ text: chipset.claim, evidenceIds: [chipset.evidence_id] });

  // AnTuTu — single best
  const antutu = bestNumeric(evidence, 'antutu_score', 'antutu_10_score', 'antutu_v10_score');
  if (antutu) {
    if (antutu.value >= 700_000) {
      positives.push({ text: `Skor AnTuTu ${antutu.value.toLocaleString()} (upper mid)`, evidenceIds: [antutu.evidence.evidence_id], delta: 0.6 });
    } else if (antutu.value >= 600_000) {
      positives.push({ text: `Skor AnTuTu ${antutu.value.toLocaleString()}`, evidenceIds: [antutu.evidence.evidence_id], delta: 0.4 });
    } else if (antutu.value >= 500_000) {
      positives.push({ text: `Skor AnTuTu ${antutu.value.toLocaleString()}`, evidenceIds: [antutu.evidence.evidence_id], delta: 0.2 });
    }
  }

  // RAM — single best
  const ram = bestNumeric(evidence, 'ram_capacity');
  if (ram) {
    if (ram.value >= 12) positives.push({ text: `RAM ${ram.value}GB`, evidenceIds: [ram.evidence.evidence_id], delta: 0.3 });
    else if (ram.value >= 8) positives.push({ text: `RAM ${ram.value}GB`, evidenceIds: [ram.evidence.evidence_id], delta: 0.15 });
  }

  // Storage — single best
  const storage = bestNumeric(evidence, 'storage_capacity');
  if (storage) {
    if (storage.value >= 256) positives.push({ text: `Penyimpanan ${storage.value}GB`, evidenceIds: [storage.evidence.evidence_id], delta: 0.15 });
    else if (storage.value >= 128) positives.push({ text: `Penyimpanan ${storage.value}GB`, evidenceIds: [storage.evidence.evidence_id], delta: 0.1 });
  }

  // Best game FPS
  const fps = bestNumeric(evidence, 'game_fps');
  if (fps) {
    if (fps.value >= 120) positives.push({ text: fps.evidence.claim, evidenceIds: [fps.evidence.evidence_id], delta: 0.3 });
    else if (fps.value >= 90) positives.push({ text: fps.evidence.claim, evidenceIds: [fps.evidence.evidence_id], delta: 0.2 });
  }

  // Thermal — worst case
  const temp = worstNumeric(evidence, 'surface_temperature', 'screen_temperature', 'back_cover_temperature');
  if (temp && temp.value >= 45) {
    negatives.push({ text: `Suhu bodi ${temp.value}°C saat beban berat`, evidenceIds: [temp.evidence.evidence_id], delta: -0.4 });
  } else if (temp && temp.value >= 43) {
    negatives.push({ text: `Suhu bodi ${temp.value}°C saat beban berat`, evidenceIds: [temp.evidence.evidence_id], delta: -0.3 });
  }

  return finalize(3.0, positives, negatives, findings);
}

/**
 * Battery and charging.
 * Base 3.0. Differentiators: duration tiers, bypass charging.
 * Deficiencies: slow charging, long full-charge time.
 */
export function evaluateBattery(evidence: NormalizedEvidence[]): EvalResult {
  const battEvidence = find(
    evidence, 'battery_capacity', 'battery_duration', 'charging_wattage',
    'charging_speed', 'charging_time_full', 'charging_time_50_percent', 'battery_drain', 'charging_feature'
  );
  if (battEvidence.length === 0) return unrated('NO_BATTERY_EVIDENCE');

  const findings: { text: string; evidenceIds: string[] }[] = [];
  const positives: EvaluatedFinding[] = [];
  const negatives: EvaluatedFinding[] = [];

  // Capacity — single (5000mAh = baseline, no bonus; >=5500 = bonus)
  const capacity = bestNumeric(evidence, 'battery_capacity');
  if (capacity) {
    findings.push({ text: capacity.evidence.claim, evidenceIds: [capacity.evidence.evidence_id] });
    if (capacity.value >= 5500) {
      positives.push({ text: `Baterai ${capacity.value}mAh (di atas standar)`, evidenceIds: [capacity.evidence.evidence_id], delta: 0.3 });
    }
  }

  // Duration — best across claim/value/attribute_value
    const durationBest = find(evidence, 'battery_duration')
    .map(ev => {
        const minutes = extractDurationMinutes(ev);
        if (minutes === null) return null;
        return { hours: minutes / 60, ev };
    })
    .filter((x): x is { hours: number; ev: NormalizedEvidence } => x !== null)
    .sort((a, b) => b.hours - a.hours)[0];

  if (durationBest) {
    if (durationBest.hours >= 20) {
      positives.push({ text: durationBest.ev.claim, evidenceIds: [durationBest.ev.evidence_id], delta: 0.4 });
    } else if (durationBest.hours >= 15) {
      positives.push({ text: durationBest.ev.claim, evidenceIds: [durationBest.ev.evidence_id], delta: 0.2 });
    }
  }

  // Charging wattage — single
  const wattage = bestNumeric(evidence, 'charging_wattage', 'charging_speed', 'charger_wattage');
  if (wattage) {
    findings.push({ text: wattage.evidence.claim, evidenceIds: [wattage.evidence.evidence_id] });
    if (wattage.value >= 45) {
      positives.push({ text: `Charging ${wattage.value}W (cepat)`, evidenceIds: [wattage.evidence.evidence_id], delta: 0.5 });
    } else if (wattage.value >= 25) {
      // 25W = baseline, no bonus
    } else if (wattage.value > 0) {
      negatives.push({ text: `Charging ${wattage.value}W (lambat)`, evidenceIds: [wattage.evidence.evidence_id], delta: -0.2 });
    }
  }

  // Full charge time — robust parse
    const fullCharge = find(evidence, 'charging_time_full')
    .map(ev => {
        const minutes = extractDurationMinutes(ev);
        return minutes !== null ? { minutes, ev } : null;
    })
    .filter((x): x is { minutes: number; ev: NormalizedEvidence } => x !== null)
    .sort((a, b) => b.minutes - a.minutes)[0];

  if (fullCharge && fullCharge.minutes >= 80) {
    negatives.push({ text: `Isi penuh ${fullCharge.minutes} menit`, evidenceIds: [fullCharge.ev.evidence_id], delta: -0.3 });
  } else if (fullCharge && fullCharge.minutes <= 45) {
    positives.push({ text: `Isi penuh ${fullCharge.minutes} menit (cepat)`, evidenceIds: [fullCharge.ev.evidence_id], delta: 0.3 });
  }

  // 50% charge time (contextual — some claims refer to 50% mark)
    const halfCharge = find(evidence, 'charging_time_50_percent')
        .map(ev => {
            const minutes = extractDurationMinutes(ev);
            return minutes !== null ? { minutes, ev } : null;
        })
    .filter((x): x is { minutes: number; ev: NormalizedEvidence } => x !== null)
    .sort((a, b) => b.minutes - a.minutes)[0];

    if (halfCharge && halfCharge.minutes >= 30) {
    // Some reviewers say "50% dalam 33 menit" → full extrapolated ~66+ min, still slow
    // We don't double-penalize; only report if no full-charge data exists
    if (!fullCharge) {
        negatives.push({
        text: `Isi 50% ${halfCharge.minutes} menit`,
        evidenceIds: [halfCharge.ev.evidence_id],
        delta: -0.2,
        });
    }
    }

  // Bypass charging
  const bypass = bestMatch(evidence, ['charging_feature'], ev => hasText(ev, ['bypass', 'pause usb', 'pause']));
  if (bypass) positives.push({ text: 'Bypass charging tersedia', evidenceIds: [bypass.evidence_id], delta: 0.2 });

  return finalize(3.0, positives, negatives, findings);
}

/**
 * Software and security.
 * Base 3.0. Exceptional: 6yr+ update, Knox Vault.
 * Cap positive at 2.0 (allows 5.0 for exceptional support like A26).
 */
export function evaluateSoftware(evidence: NormalizedEvidence[]): EvalResult {
  const swEvidence = find(
    evidence, 'os_update_years', 'security_patch_years', 'security_feature',
    'ai_feature', 'ui_feature', 'os_version', 'android_version'
  );
  if (swEvidence.length === 0) return unrated('NO_SOFTWARE_EVIDENCE');

  const findings: { text: string; evidenceIds: string[] }[] = [];
  const positives: EvaluatedFinding[] = [];
  const negatives: EvaluatedFinding[] = [];

  // OS update years — single best
  const updateYears = bestNumeric(evidence, 'os_update_years');
  if (updateYears) {
    findings.push({ text: updateYears.evidence.claim, evidenceIds: [updateYears.evidence.evidence_id] });
    if (updateYears.value >= 7) {
      positives.push({ text: `Update OS ${updateYears.value} tahun (flagship-level)`, evidenceIds: [updateYears.evidence.evidence_id], delta: 1.0 });
    } else if (updateYears.value >= 6) {
      positives.push({ text: `Update OS ${updateYears.value} tahun`, evidenceIds: [updateYears.evidence.evidence_id], delta: 0.7 });
    } else if (updateYears.value >= 4) {
      positives.push({ text: `Update OS ${updateYears.value} tahun`, evidenceIds: [updateYears.evidence.evidence_id], delta: 0.4 });
    }
  }

  // Security patch years
  const patchYears = bestNumeric(evidence, 'security_patch_years');
  if (patchYears && patchYears.value >= 4) {
    positives.push({ text: `Patch keamanan ${patchYears.value} tahun`, evidenceIds: [patchYears.evidence.evidence_id], delta: 0.2 });
  }

  // Knox Vault
  const knox = bestMatch(evidence, ['security_feature'], ev => hasText(ev, ['knox vault', 'knox']));
  if (knox) positives.push({ text: 'Hardware Knox Vault', evidenceIds: [knox.evidence_id], delta: 0.3 });

  // AI features — single bonus if 5+
  const aiFeatures = find(evidence, 'ai_feature');
  if (aiFeatures.length >= 5) {
    positives.push({
      text: `${aiFeatures.length} fitur AI tersedia`,
      evidenceIds: aiFeatures.slice(0, 3).map(e => e.evidence_id),
      delta: 0.2,
    });
  }

  return finalize(3.0, positives, negatives, findings, { capPositive: 2.0 });
}

/**
 * Display and design.
 * Base 3.0. Differentiators: AMOLED+120Hz tier, brightness, protection.
 * Deficiencies: waterdrop notch, non-adaptive refresh.
 */
export function evaluateDisplay(evidence: NormalizedEvidence[]): EvalResult {
  const dispEvidence = find(
    evidence, 'display_panel', 'screen_size', 'display_size', 'resolution', 'refresh_rate',
    'peak_brightness', 'notch_type', 'notch_design', 'protection_type',
    'thickness', 'back_material'
  );
  if (dispEvidence.length === 0) return unrated('NO_DISPLAY_EVIDENCE');

  const findings: { text: string; evidenceIds: string[] }[] = [];
  const positives: EvaluatedFinding[] = [];
  const negatives: EvaluatedFinding[] = [];

  // Panel type — single
  const panel = bestMatch(evidence, ['display_panel'], ev => hasText(ev, ['amoled', 'oled']));
  if (panel) {
    findings.push({ text: panel.claim, evidenceIds: [panel.evidence_id] });
    positives.push({ text: 'Panel Super AMOLED', evidenceIds: [panel.evidence_id], delta: 0.3 });
  }

  // Refresh rate — single best
  const refresh = bestNumeric(evidence, 'refresh_rate');
  if (refresh) {
    if (refresh.value >= 120) positives.push({ text: `Refresh rate ${refresh.value}Hz`, evidenceIds: [refresh.evidence.evidence_id], delta: 0.2 });
    else if (refresh.value >= 90) positives.push({ text: `Refresh rate ${refresh.value}Hz`, evidenceIds: [refresh.evidence.evidence_id], delta: 0.1 });
  }

  // Peak brightness — single
  const brightness = bestNumeric(evidence, 'peak_brightness');
  if (brightness) {
    if (brightness.value >= 1500) positives.push({ text: `Peak brightness ${brightness.value} nits`, evidenceIds: [brightness.evidence.evidence_id], delta: 0.3 });
    else if (brightness.value >= 1000) positives.push({ text: `Peak brightness ${brightness.value} nits`, evidenceIds: [brightness.evidence.evidence_id], delta: 0.2 });
  }

  // Victus+ protection
  const victus = bestMatch(evidence, ['protection_type'], ev => hasText(ev, ['victus']));
  if (victus) positives.push({ text: 'Proteksi Gorilla Glass Victus+', evidenceIds: [victus.evidence_id], delta: 0.3 });

  // Thin body
  const thickness = bestNumeric(evidence, 'thickness');
  if (thickness && thickness.value < 8) {
    positives.push({ text: `Bodi ramping ${thickness.value}mm`, evidenceIds: [thickness.evidence.evidence_id], delta: 0.1 });
  }

  // Waterdrop notch — penalty
  const notch = bestMatch(evidence, ['notch_type', 'notch_design'], ev => hasText(ev, ['waterdrop', 'infinity-u']));
  if (notch) negatives.push({ text: 'Notch waterdrop (desain lawas)', evidenceIds: [notch.evidence_id], delta: -0.5 });

  return finalize(3.0, positives, negatives, findings);
}

/**
 * Camera.
 * Base 3.0. Differentiators: main resolution tier, OIS, 4K, ultrawide.
 * Deficiencies: macro useless, no EIS at higher resolutions.
 */
export function evaluateCamera(evidence: NormalizedEvidence[]): EvalResult {
  const camEvidence = find(
    evidence, 'main_camera_resolution', 'camera_resolution', 'front_camera_resolution',
    'max_video_resolution', 'sensor_type', 'aperture', 'stabilization_feature',
    'stabilization_type', 'ultrawide_presence', 'macro_camera_presence', 'macro_camera_resolution'
  );
  if (camEvidence.length === 0) return unrated('NO_CAMERA_EVIDENCE');

  const findings: { text: string; evidenceIds: string[] }[] = [];
  const positives: EvaluatedFinding[] = [];
  const negatives: EvaluatedFinding[] = [];

  // Main camera resolution — single
  const mainRes = bestNumeric(evidence, 'main_camera_resolution');
  if (mainRes) {
    findings.push({ text: mainRes.evidence.claim, evidenceIds: [mainRes.evidence.evidence_id] });
    if (mainRes.value >= 108) positives.push({ text: `Kamera utama ${mainRes.value}MP`, evidenceIds: [mainRes.evidence.evidence_id], delta: 0.4 });
    else if (mainRes.value >= 50) positives.push({ text: `Kamera utama ${mainRes.value}MP`, evidenceIds: [mainRes.evidence.evidence_id], delta: 0.2 });
    else if (mainRes.value >= 12) positives.push({ text: `Kamera utama ${mainRes.value}MP`, evidenceIds: [mainRes.evidence.evidence_id], delta: 0.1 });
  }

  // OIS
  const ois = bestMatch(evidence, ['stabilization_feature', 'stabilization_type'], ev => hasText(ev, ['ois', 'optical']));
  if (ois) positives.push({ text: 'OIS (Optical Image Stabilization)', evidenceIds: [ois.evidence_id], delta: 0.3 });

  // 4K video
  const video4k = bestMatch(evidence, ['max_video_resolution'], ev => hasText(ev, ['4k']));
  if (video4k) positives.push({ text: 'Rekaman video 4K', evidenceIds: [video4k.evidence_id], delta: 0.2 });

  // Ultrawide
  const ultrawide = bestMatch(evidence, ['ultrawide_presence'], ev => hasText(ev, ['ada', 'tersedia', 'yes', 'true']));
  if (ultrawide) positives.push({ text: 'Kamera ultrawide tersedia', evidenceIds: [ultrawide.evidence_id], delta: 0.2 });

  // Macro useless
  const macro = bestNumeric(evidence, 'macro_camera_resolution');
  if (macro && macro.value <= 2) {
    negatives.push({ text: 'Kamera makro 2MP kurang berguna', evidenceIds: [macro.evidence.evidence_id], delta: -0.1 });
  }

  // No EIS at 4K/60fps — penalty
  const eisLimit = bestMatch(evidence, ['eis_availability'], ev => hasText(ev, ['tidak', 'tidak ada', 'no', 'limited', 'hanya']));
  if (eisLimit) negatives.push({ text: 'EIS terbatas di resolusi tinggi', evidenceIds: [eisLimit.evidence_id], delta: -0.2 });

  return finalize(3.0, positives, negatives, findings);
}

/**
 * Durability and protection.
 * Base 3.0. Exceptional: IP67/IP68 + Victus+ front & back.
 * Cap positive at 2.0 (allows 5.0 for exceptional durability).
 */
export function evaluateDurability(evidence: NormalizedEvidence[]): EvalResult {
  const durEvidence = find(evidence, 'certification', 'ip_rating', 'dust_resistance', 'protection_type', 'back_material');
  if (durEvidence.length === 0) return unrated('NO_DURABILITY_EVIDENCE');

  const findings: { text: string; evidenceIds: string[] }[] = [];
  const positives: EvaluatedFinding[] = [];
  const negatives: EvaluatedFinding[] = [];

  // IP rating — single best
  const ip = bestMatch(evidence, ['certification', 'ip_rating'], ev => hasText(ev, ['ip']));
  if (ip) {
    findings.push({ text: ip.claim, evidenceIds: [ip.evidence_id] });
    if (hasText(ip, ['ip68'])) {
      positives.push({ text: 'Sertifikasi IP68 (flagship-level)', evidenceIds: [ip.evidence_id], delta: 1.0 });
    } else if (hasText(ip, ['ip67'])) {
      positives.push({ text: 'Sertifikasi IP67', evidenceIds: [ip.evidence_id], delta: 0.7 });
    } else if (hasText(ip, ['ip54', 'ip53', 'ip52'])) {
      positives.push({ text: 'Sertifikasi IP5x', evidenceIds: [ip.evidence_id], delta: 0.3 });
    }
  }

  // Victus+ front
  const victusFront = bestMatch(evidence, ['protection_type'], ev => hasText(ev, ['victus']));
  if (victusFront) positives.push({ text: 'Victus+ pada layar', evidenceIds: [victusFront.evidence_id], delta: 0.3 });

  // Victus+ back (different attribute)
  const victusBack = bestMatch(evidence, ['back_material'], ev => hasText(ev, ['victus']));
  if (victusBack) positives.push({ text: 'Victus+ pada punggung', evidenceIds: [victusBack.evidence_id], delta: 0.3 });

  return finalize(3.0, positives, negatives, findings, { capPositive: 2.0 });
}

// ============================================================
// Export registry
// ============================================================

import { CriterionId } from './types.js';

export const CRITERION_EVALUATORS: Record<CriterionId, (evidence: NormalizedEvidence[]) => EvalResult> = {
  price_and_value: evaluatePrice,
  performance_and_gaming: evaluatePerformance,
  battery_and_charging: evaluateBattery,
  software_and_security: evaluateSoftware,
  display_and_design: evaluateDisplay,
  camera: evaluateCamera,
  durability_and_protection: evaluateDurability,
};