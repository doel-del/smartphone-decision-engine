# Evidence Validation Rules

## Pipeline
Raw JSON → Loader → Normalizer → Validator → Repository → Engine


Setiap tahap punya aturan eksklusi sendiri, dengan alasan yang dicatat.

## 1. Loader — Structure Validation

- File wajib: 3 dataset (94, 98, 100)
- JSON harus array
- Setiap record harus punya `evidence_id` (string non-empty) dan `validation` (object)
- Duplikat `evidence_id` dilaporkan (tidak otomatis di-dedup di sini)
- Ketiadaan file → `health.ok = false` → decision endpoint return 503

## 2. Normalizer — Shape Normalization

### Wajib (FATAL → record di-skip)
- `evidence_id` string non-empty
- `source` string non-empty
- `review_id` string non-empty
- `topic` string non-empty

### Wajib (WARNING → record tetap di-include)
- `type` harus dalam enum {FACT, MEASUREMENT, OBSERVATION, OPINION, RECOMMENDATION, COMPARISON, CLAIM}
  - Jika tidak valid → fallback ke `CLAIM` (akan ditolak validator)
- `validation` harus ada (jika tidak, validator akan menolak)
- Duplikat `evidence_id` → **skip** (hanya first occurrence disimpan)

### Normalisasi
- `topic`, `subtopic` → lowercase
- `attribute` → lowercase
- `related_evidence_ids` → trim each
- `youtubeTimestampUrl` → dibangun dari `video_url` + `timestamp_start`

## 3. Validator — Eligibility Gate

### Alur keputusan (berurutan)

1. **`validation` hilang** → `NO_VALIDATION_METADATA`
2. **`accepted !== true`** → `VALIDATION_NOT_ACCEPTED`
3. **`finalStatus = INVALID/REJECTED`** → `STATUS_INVALID`
4. **`finalStatus = SUSPECT`** → `STATUS_SUSPECT`
5. **`finalStatus = VALID_WITH_NORMALIZATION`** → verifikasi `results`:
   - Jika `results` kosong → `VALID_WITH_NORMALIZATION_UNVERIFIED`
   - Jika ada `pass: false` → `VALID_WITH_NORMALIZATION_INCONSISTENT`
   - Jika semua `pass: true` → ✅
6. **`finalStatus` tidak dikenal** → `STATUS_UNSUPPORTED`
7. **`type` bukan salah satu dari {FACT, MEASUREMENT, OBSERVATION, OPINION, RECOMMENDATION, COMPARISON}** → `UNSUPPORTED_EVIDENCE_TYPE`
   - `CLAIM` di-exclude (bukan tipe scorable)
8. **`claim` kosong** → `EMPTY_CLAIM`
9. **`source` atau `review_id` hilang** → `MISSING_PROVENANCE`
10. **Evidence ID ada di `conflictIds`** → `CONFLICT_UNRESOLVED`
11. ✅ **Eligible**

### Kode Eksklusi

| Kode | Deskripsi | Dampak |
|---|---|---|
| `DUPLICATE_ID` | ID sudah ada (defense-in-depth, normalizer sudah handle) | Record di-skip |
| `NO_VALIDATION_METADATA` | Tidak ada `validation` object | Excluded |
| `VALIDATION_NOT_ACCEPTED` | `accepted: false` | Excluded |
| `STATUS_INVALID` | `finalStatus = INVALID/REJECTED` | Excluded |
| `STATUS_SUSPECT` | `finalStatus = SUSPECT` | Excluded |
| `STATUS_UNSUPPORTED` | Status tidak dikenal | Excluded |
| `VALID_WITH_NORMALIZATION_UNVERIFIED` | `results` kosong | Excluded |
| `VALID_WITH_NORMALIZATION_INCONSISTENT` | `results` mengandung `pass: false` | Excluded |
| `EMPTY_CLAIM` | Claim kosong | Excluded |
| `MISSING_PROVENANCE` | `source`/`review_id` hilang | Excluded |
| `UNSUPPORTED_EVIDENCE_TYPE` | Tipe tidak scorable | Excluded |
| `CONFLICT_UNRESOLVED` | Ada di `conflictIds` dari conflict detection | Excluded |

## 4. Conflict Detection — `CONFLICT_RULES`

Didefinisikan di `src/server/decisionRules.ts`:

| Attribute | Critical | Tolerance |
|---|---|---|
| `chipset` | ✅ | EXACT |
| `battery_capacity` | ✅ | EXACT |
| `price`, `official_price`, `purchase_price` | ❌ | CONTEXT_AWARE |
| `antutu_score`, `antutu_10_score` | ❌ | PERCENT_5 |

### Tolerance Modes

- **EXACT**: setiap perbedaan = konflik
- **PERCENT_5**: perbedaan <5% dianggap variance normal (bukan konflik)
- **CONTEXT_AWARE**: perbedaan `context` = data poin terpisah, bukan konflik

### Alur

1. Repository kumpulkan evidence per attribute
2. `assessConflict` menerapkan tolerance
3. Jika konflik → `ConflictItem` dengan auto-generated `resolutionNote` (dari data, bukan hard-code)
4. Jika critical + unresolved → evidence ID masuk `conflictedIds`
5. Validator ulang → exclude evidence dengan `CONFLICT_UNRESOLVED`
6. Engine: `hasCriticalConflict` → `decisionStatus = UNRESOLVED_CRITICAL_CONFLICT`

## 5. Determinisme

- Rule order tidak bergantung pada map iteration (semua explicit)
- Tidak ada `Math.random`, tidak ada `Date.now` di jalur scoring
- Hash duplicate detection: `Set<string>` — deterministic
- Golden baseline di `test/regression/golden-decision.json`