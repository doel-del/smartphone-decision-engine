# Scoring Rubric

## Bobot Kriteria (PRD §9)

| Kriteria | Bobot | Evaluator |
|---|---:|---|
| Harga dan value for money | 20% | `evaluatePrice` |
| Performa dan gaming | 15% | `evaluatePerformance` |
| Baterai dan pengisian daya | 15% | `evaluateBattery` |
| Software dan dukungan keamanan | 15% | `evaluateSoftware` |
| Layar dan desain | 10% | `evaluateDisplay` |
| Kamera | 10% | `evaluateCamera` |
| Durabilitas dan perlindungan | 15% | `evaluateDurability` |
| **Total** | **100%** | |

Assertion di module load: `Σ weight === 1.0` — jika tidak, throw.

## Formula Skor Keseluruhan (PRD §9.2)
S = Σ(wᵢ · sᵢ) / Σ(wᵢ) untuk i ∈ R (kriteria yang rated)


- `overallScore` = hasil rounding 1 desimal
- `overallScoreExact` = presisi penuh
- Jika tidak ada kriteria rated (`R = ∅`) → `null`, bukan 0

## Formula per Kriteria

Setiap evaluator mengembalikan:
- `baseScore` (default 3.0, kecuali dinyatakan lain)
- `positives`: array `{ text, evidenceIds, delta }`
- `negatives`: array `{ text, evidenceIds, delta }`
- `finalScore = clamp(baseScore + Σpositives + Σnegatives, 0, 5)`

**Cap positive sum**:
- Default: `+1.5`
- Software & Durabilitas: `+2.0` (memungkinkan skor 5.0 untuk kriteria exceptional)

## UNRATED (PRD §9.1)

Setiap evaluator mengembalikan `null` score jika tidak ada evidence yang cukup:

| Kriteria | Syarat Minimum |
|---|---|
| Price | Punya evidence `price`/`official_price`/`purchase_price` |
| Performance | Punya `chipset`/`antutu_*`/`geekbench_*`/`game_fps` |
| Battery | Punya `battery_capacity`/`battery_duration`/`charging_wattage` |
| Software | Punya `os_update_years`/`security_patch_years`/`security_feature` |
| Display | Punya `display_panel`/`screen_size`/`refresh_rate` |
| Camera | Punya `main_camera_resolution`/`camera_resolution`/`max_video_resolution` |
| Durability | Punya `certification`/`ip_rating`/`protection_type` |

Ketiadaan evidence **tidak** diberi skor 0 atau 3 — tetapi `null` + `isRated: false`.

## Detail per Kriteria

### Price and value (bobot 20%)
- **Base 3.0**
- **+0.6** jika promo < Rp 3,5 juta
- **+0.3** jika promo < Rp 4 juta
- **+0.2** jika ada microSD
- **−0.3** jika charger tidak disertakan

### Performance and gaming (bobot 15%)
- **Base 3.0**
- **+0.6** AnTuTu ≥700k · **+0.4** ≥600k · **+0.2** ≥500k
- **+0.3** RAM ≥12GB · **+0.15** ≥8GB
- **+0.15** storage ≥256GB
- **+0.3** FPS ≥120 · **+0.2** ≥90
- **−0.4** thermal ≥45°C · **−0.3** ≥43°C

### Battery and charging (bobot 15%)
- **Base 3.0**
- **+0.3** kapasitas ≥5500 mAh (5000 = baseline)
- **+0.4** durasi ≥20 jam · **+0.2** ≥15 jam
- **+0.5** wattage ≥45W (25W = baseline)
- **+0.3** isi penuh ≤45 menit · **−0.3** ≥80 menit
- **+0.2** bypass charging tersedia

### Software and security (bobot 15%, cap +2.0)
- **Base 3.0**
- **+1.0** update OS ≥7 tahun · **+0.7** ≥6 tahun · **+0.4** ≥4 tahun
- **+0.2** security patch ≥4 tahun
- **+0.3** Knox Vault
- **+0.2** ≥5 fitur AI

### Display and design (bobot 10%)
- **Base 3.0**
- **+0.3** panel AMOLED
- **+0.2** refresh rate ≥120Hz · **+0.1** ≥90Hz
- **+0.3** brightness ≥1500 nits · **+0.2** ≥1000 nits
- **+0.3** Victus+ protection
- **+0.1** tebal <8mm
- **−0.5** notch waterdrop

### Camera (bobot 10%)
- **Base 3.0**
- **+0.4** kamera utama ≥108MP · **+0.2** ≥50MP · **+0.1** ≥12MP
- **+0.3** OIS
- **+0.2** video 4K
- **+0.2** ultrawide tersedia
- **−0.1** makro 2MP
- **−0.2** EIS terbatas

### Durability and protection (bobot 15%, cap +2.0)
- **Base 3.0**
- **+1.0** IP68 · **+0.7** IP67 · **+0.3** IP54/53/52
- **+0.3** Victus+ di layar
- **+0.3** Victus+ di punggung

## Golden Baseline

File `test/regression/golden-decision.json` menyimpan baseline skor untuk dataset frozen. Jika skor berubah tanpa perubahan dataset/ruleset, test akan fail dan memaksa justifikasi + bump `rulesetVersion` (PRD §17.3).

## Price and value — evidence semantics (v1.0.1)

### Price attributes

The price evaluator recognizes three price-related attributes, each with
a distinct role:

| Attribute | Semantics (from evidence) | Used for |
|---|---|---|
| `price` | A reported selling price. | Stage 1–3 classification of the price criterion. Does **not** trigger the promotional bonus. |
| `official_price` | The official / MSRP price. | `pricingSummary.officialPrice` (display). Does **not** trigger the promotional bonus. |
| `purchase_price` | The actual purchase or promotional price. | Promotional bonus tier + `pricingSummary.promoPrice`. |

**Bonus rule:**
- Promotional bonus is evaluated **only** from `purchase_price`.
- If the dataset has no valid `purchase_price`, the price criterion is still
  rated (base 3.0) but no promotional bonus fires.
- No fallback to `price` or `official_price`.

**Bonus tiers (using normalized `purchase_price`):**
- `normalized < 3_500_000` → **+0.6**
- `3_500_000 ≤ normalized < 4_000_000` → **+0.3**
- `normalized ≥ 4_000_000` → **no bonus**

### Unit normalization (`normalizePriceValue`)

Price values must have a **supported, explicit unit** before they can be
converted to Indonesian Rupiah. A numeric value alone is not interpreted as
a specific currency amount.

| Unit (case-insensitive, trimmed) | Normalization |
|---|---|
| `juta`, `jt` | value × 1,000,000 |
| `ribu`, `rb` | value × 1,000 |
| `idr`, `rupiah`, `rp` | value as-is |

**Rejected units:** empty, missing, `null`, or any unknown alias including
`m`, `k`, `million`, `thousand`. Rejected records are **skipped**, not
guessed.

**Additional rejections:**
- `null` / `NaN` / `Infinity` value.
- Overflow after multiplication (result not finite).

### Numeric parsing (`toNumber`)

Separate from unit normalization, `toNumber` parses the `value` field into
a numeric primitive. **This is not a currency interpretation.**

Accepted:
- Finite numeric `value` (e.g., `3800000` or `3.8`)
- Integer strings without separators (e.g., `"3999000"`)
- Single decimal separator with 1–2 decimal digits (e.g., `"3.8"`, `"3,8"`)

Rejected (return `null`):
- Multiple separators: `"3.999.000"`, `"3,999,000"`
- Ambiguous: `"1.234"` (could be 1.234 or 1234)
- Currency-prefixed: `"Rp 3.800.000"`
- Empty, non-numeric, `null`, `NaN`, `Infinity`

**Distinction:** `"3.8"` parses to numeric `3.8` via `toNumber`. It becomes
Rp3,800,000 **only after** `normalizePriceValue(3.8, "juta")` is applied.
Without a unit, the numeric `3.8` remains `3.8` and would be compared
against thresholds as `3.8`, not `3,800,000`. Strict parsing and unit
normalization are two separate steps.

### Unrated reasons

| Reason | Meaning |
|---|---|
| `NO_PRICE_EVIDENCE` | No records with `attribute ∈ {price, official_price, purchase_price}`. |
| `PRICE_VALUES_INVALID` | Price records exist, but none has a valid numeric `value`. |
| `PRICE_NOT_NORMALIZABLE` | Numeric values exist, but none can be normalized to rupiah (missing/unknown unit). |

### Selection and ordering

- `lowestNormalizedPrice` normalizes each candidate first, then picks the
  lowest normalized value. If two candidates normalize to the same value,
  the lexicographically smaller `evidence_id` wins (using `<` operator
  on strings).
- `bestMatch` returns `null` if no record matches; otherwise returns the
  match with the lexicographically smallest `evidence_id` (using `<`
  operator on strings).
- `evaluatePrice` `primaryFindings` are ordered by `evidence_id` using
  `String.localeCompare()`. This is a deterministic ordering; it is
  **not** a relevance ranking.

**Implementation note:** The three ordering paths use different string
comparison primitives (`<` vs `localeCompare`). For ASCII `evidence_id`
values these produce identical orderings, but the code does not guarantee
identical behavior for arbitrary non-ASCII IDs. Documentation treats them
as "lexicographic by `evidence_id`" without claiming implementation
identity.

### Example (dataset A26 `v1.0.0-multi-source-indonesia`)

The records below were observed in the v1.0.0-multi-source-indonesia dataset.
If the dataset is updated, verify record values locally before relying on
this example.

| Evidence | Attribute | Raw | Normalized | Role in scoring |
|---|---|---|---:|---|
| `lzeD_sBrCB0-E005` | `purchase_price` | `3.8` (`unit: "juta"`) | 3,800,000 | Promo bonus → **+0.3** (4M tier, not 3.5M tier) |
| `45hfkSE5DvA-E178` | `price` | `3999000` (`unit: "IDR"`) | 3,999,000 | Rated contribution only; no bonus |
| `lzeD_sBrCB0-E004` | `official_price` | `4` (`unit: "juta"`) | 4,000,000 | `pricingSummary.officialPrice` only; no bonus |

Result for A26 v1.0.1: `price_and_value.score = 3.2`
(base 3.0 + promo 0.3 + microSD 0.2 − charger 0.3).