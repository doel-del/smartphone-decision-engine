# Architecture

## Pipeline Overview
┌───────────────────────────────────────────────────────────────┐
│ STARTUP (once) │
│ │
│ data/*.json ──▶ Loader ──▶ Normalizer ──▶ Validator ──▶ Repository │
│ │ │
│ └──▶ Conflict Detection │
│ │ │
│ └──▶ Re-validate │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ REQUEST (per call) │
│ │
│ GET /api/products/samsung-galaxy-a26-5g/decision │
│ │ │
│ ▼ │
│ Decision Engine │
│ ├─ 7 evaluators │
│ ├─ Coverage calc │
│ ├─ Confidence calc │
│ ├─ Decision gate (§9.3) │
│ └─ Supplementary (specs, pricing, quotes) │
│ │ │
│ ▼ │
│ DecisionResult ──▶ JSON response │
└───────────────────────────────────────────────────────────────┘

text

**Init sekali**, tidak per-request. Konsekuensi: dataset reload memerlukan restart server (dokumentasi di `README.md`).

## Modul & Tanggung Jawab

| Modul | Tanggung Jawab | Purity |
|---|---|---|
| `evidenceLoader.ts` | Baca file, validasi JSON shape, deteksi missing/empty | Pure (I/O) |
| `evidenceNormalizer.ts` | Normalisasi field, dedup, tanda `rawRecord` | Pure |
| `evidenceValidator.ts` | Filter eligibility via enum codes | Mutates input (eligibility flag) |
| `evidenceRepository.ts` | Index by topic/source/review, conflict detection | Pure queries |
| `criterionEvaluators.ts` | 7 fungsi evaluasi, `bestNumeric` untuk single-match | Pure |
| `decisionEngine.ts` | Orkestrasi, formula §9.2, gate §9.3 | Pure |
| `confidenceEngine.ts` | Coverage, independence, provenance check | Pure |
| `decisionRules.ts` | Konstanta (bobot, rubrik, conflict rules, spec rows) | Pure data |
| `routes.ts` | HTTP routing, error handling, 503 on failure | Side effects |
| `pipeline.ts` | One-time initialization + health assessment | Side effects |
| `logger.ts` | Structured JSON logging | Side effects |

## Determinisme

**Yang deterministik:**
- Semua field `DecisionResult` kecuali `generatedAt`
- Rule order di setiap evaluator (tidak bergantung pada map iteration)
- Conflict detection (Set-based, insertion order tidak matter untuk results)
- Coverage calculation (fixed formula)
- Confidence calculation (fixed formula + thresholds)

**Yang tidak deterministik:**
- `generatedAt` — timestamp per-request (ISO 8601)

**Verifikasi determinisme:**
- Integration test #4 membandingkan dua pipeline run → assert semua field identik kecuali `generatedAt`
- Golden baseline (`test/regression/golden-decision.json`) — fail jika skor berubah tanpa perubahan kode/dataset

## Reproduksibilitas

Setiap `DecisionResult` menyertakan:
- `rulesetVersion` (mis. `v1.0.0-deterministic-prd`)
- `evidenceDatasetVersion` (mis. `v1.0.0-multi-source-indonesia`)

Untuk mereproduksi keputusan lama:
1. Checkout kode pada versi yang sesuai (tag git)
2. Pastikan file evidence JSON sama (hash validation)
3. Jalankan `runDecisionEngine(pipeline.repository)`

## Failure Modes

| Skenario | Perilaku |
|---|---|
| File evidence hilang | Pipeline `health.ok = false` → decision endpoint return 503 |
| Pipeline tidak bisa init | Server tetap start, `/ready` return 503, `/api` return 503 |
| Semua evidence excluded | `decisionStatus = INSUFFICIENT_EVIDENCE`, `overallScore = null` |
| Critical conflict unresolved | `decisionStatus = UNRESOLVED_CRITICAL_CONFLICT`, `overallScore = null` |
| Engine throw saat runtime | Global error handler → 500 JSON (tidak return skor partial) |
| Frontend fetch gagal | `<App>` menampilkan error banner + retry |

## Versi & Rilis

| Versi | Tanggal | Perubahan |
|---|---|---|
| `v1.0.0` | 2026-10-21 | Rilis awal — 7 kriteria, deterministic engine, frontend SPA |
| `v1.0.1` | 2026-10-23 | **Bug fixes**: (F-23) price unit normalization before threshold comparisons; (F-01) `purchase_price` selection uses `lowestNormalizedPrice` instead of highest raw numeric selection; (F-02) `buildPricingSummary` uses `lowestNormalizedPrice` for consistency with `evaluatePrice`; (F2) `bestMatch` tie-break by `evidence_id`; (F5) findings sorted by `evidence_id`; cleanup: removed obsolete `toNumVal`. **Observed impact**: `overallScore` 3.8 to 3.7; `price_and_value.score` 3.5 to 3.2.

## v1.0.1 — Deterministic pricing and selection fixes (2026-10-23)

### Changes

- **F-23 — Price unit normalization:** Price values are normalized to Indonesian
  Rupiah before price-threshold comparisons. `lowestNormalizedPrice` performs
  normalization before selecting the lowest price; `buildPricingSummary` uses
  this helper to select normalized display prices; and `evaluatePrice` normalizes
  price records before evaluating price evidence and promotional thresholds.

  Previously, `value: 3.8, unit: "juta"` was compared against `3_500_000`
  numerically, producing an incorrect bonus tier. After fix, `3.8 × 1,000,000
  = 3_800_000` is compared to thresholds.

- **F-01 — Purchase-price selection:** `purchase_price` selection uses
  `lowestNormalizedPrice` (normalize-first, then pick lowest) rather than
  `bestNumeric` (highest raw numeric).

- **F-02 — Pricing-summary consistency:** `buildPricingSummary` uses
  `lowestNormalizedPrice` for both `official_price` and `purchase_price`, so
  the price displayed matches the price selected by the evaluator.

- **F2 — Deterministic `bestMatch`:** When multiple records match a predicate,
  `bestMatch` selects the record with the lexicographically smallest
  `evidence_id` (using the `<` operator on strings), rather than the
  first matching record in the input array. `bestMatch` is used by several
  categorical evidence-selection paths, including display, protection,
  charging, camera, and security evaluation.

- **F3 — Promo-bonus semantics:** The promotional-price bonus is based only on
  `purchase_price`. `price` and `official_price` do not independently trigger
  that bonus. If the dataset has no `purchase_price`, the price criterion is
  still rated (base 3.0) but no promotional bonus fires.

- **F5 — Stable findings order:** In `evaluatePrice`, `primaryFindings` and
  `primaryFindingsDetail` are ordered by `evidence_id` using
  `String.localeCompare()`. This produces a deterministic but not
  relevance-based ordering. Behavior change: previously, findings were
  ordered by input array position.

- **Cleanup:** Removed obsolete `toNumVal` helper from `decisionEngine.ts`.

### Scoring impact (reported API comparison)

Based on the reported pre-v1.0.1 and post-v1.0.1 API outputs, only
`price_and_value` changed among the seven criterion scores. The values below
describe that observed comparison.

| Field | Pre-v1.0.1 | Post-v1.0.1 | Change |
|---|---:|---:|---|
| `overallScore` | 3.8 | 3.7 | −0.1 |
| `price_and_value.score` | 3.5 | 3.2 | −0.3 |
| `performance_and_gaming.score` | 3.6 | 3.6 | unchanged |
| `battery_and_charging.score` | 3.3 | 3.3 | unchanged |
| `software_and_security.score` | 4.4 | 4.4 | unchanged |
| `display_and_design.score` | 3.6 | 3.6 | unchanged |
| `camera.score` | 3.6 | 3.6 | unchanged |
| `durability_and_protection.score` | 4.3 | 4.3 | unchanged |
| `decisionLabel` | Direkomendasikan dengan pertimbangan | Direkomendasikan dengan pertimbangan | unchanged |
| `decisionStatus` | PUBLISHED | PUBLISHED | unchanged |
| `confidenceLabel` | MEDIUM | MEDIUM | unchanged |

The promotional bonus changed from **+0.6 → +0.3** because the selected
`purchase_price` normalizes to Rp3,800,000, which is below Rp4,000,000
but not below Rp3,500,000.

These values describe the current code, dataset (`v1.0.0-multi-source-indonesia`),
and ruleset (`v1.0.1-deterministic-prd`). They are **reproducible system
outputs**, not universal or objectively definitive judgments about the product.
Score 3.7 is derived from: `evaluatePrice` (v1.0.1 code) applied to
`evidence_data_*.json` (dataset) using thresholds in `decisionRules.ts`
(ruleset), and becomes the new regression baseline.

### Determinism and test scope

Deterministic selection and ordering are implemented for the tested paths.
Reported regression tests verify that:

- `evaluatePrice` produces identical full output across **6 permutations
  of 3 price records** (`test/unit/known-issues-price.test.ts` →
  `evaluatePrice full output identical across permutations`).
- `runDecisionEngine` produces permutation-invariant full output for the
  tested fixtures after excluding `generatedAt`
  (`test/unit/known-issues-price.test.ts` →
  `F2: runDecisionEngine full output permutation-invariant`).
- Findings are ordered by `evidence_id` using `localeCompare`
  (`F5: findings sorted by evidence_id`).
- `bestMatch` multi-match cases resolve deterministically via lexicographic
  `<` on `evidence_id` (`F2: bestMatch selects lowest evidence_id among
  multiple matches`).
- `lowestNormalizedPrice` tie-break by `evidence_id` when normalized prices
  are equal (`tie-break by evidence_id when prices equal`).

**Sorting algorithm note:** The three tie-break mechanisms (`bestMatch` and
`lowestNormalizedPrice` using `<` operator; `evaluatePrice` findings using
`localeCompare`) are functionally similar for ASCII-only IDs but may differ
for non-ASCII characters. This document does not claim the three use
identical string comparison algorithms.

**Scope limitation:** These permutation tests use **targeted fixtures**
(3–4 records). They do not establish permutation invariance for the
entire 379-record dataset, every non-price evaluator, or multi-product
execution. Broader determinism remains to be verified as test coverage
expands.

### Versioning and operational notes

- `RULESET_VERSION`: `v1.0.0-deterministic-prd` → `v1.0.1-deterministic-prd`
- `EVIDENCE_DATASET_VERSION`: unchanged at `v1.0.0-multi-source-indonesia`

**Breaking change:** API output for Samsung Galaxy A26 5G changed
(`overallScore` 3.8 → 3.7; `price_and_value.score` 3.5 → 3.2).
Consumers caching old results must refresh. `primaryFindings` order also
changed (array-order → `evidence_id` order).

Bump versi bila:
- **Patch** (`1.0.x`): bug fix tanpa perubahan skor output
- **Minor** (`1.x.0`): perubahan UI, tambahan fitur non-breaking
- **Major** (`x.0.0`): perubahan skor output / kontrak data / removal

Setiap bump pada `rulesetVersion` **wajib** disertai:
1. Update `RUBRICS_CONFIG[*].version` (jika rubrik berubah)
2. Update golden baseline (`test/regression/golden-decision.json`)
3. Catat di § "Versi & Rilis" ini

