# Data Schema

## 1. Input — `RawEvidenceRecord`

Dibaca langsung dari `data/evidence_data_*.json`. Setiap record adalah satu klaim atomik.

| Field | Tipe | Wajib | Deskripsi |
|---|---|---|---|
| `evidence_id` | `string` | ✅ | ID unik, mis. `45hfkSE5DvA-E001` |
| `topic` | `string` | ✅ | Kategori utama, mis. `performance`, `camera` |
| `subtopic` | `string \| null` | — | Subkategori, mis. `ip67` |
| `type` | `FACT \| MEASUREMENT \| OBSERVATION \| OPINION \| RECOMMENDATION \| COMPARISON \| CLAIM` | ✅ | Jenis evidence (§10.2) |
| `claim` | `string` | ✅ | Pernyataan lengkap dari reviewer |
| `value` | `number \| string \| null` | — | Nilai mentah |
| `unit` | `string \| null` | — | Satuan, mis. `mAh`, `inch`, `W` |
| `attribute` | `string \| null` | — | Atribut terstruktur, mis. `battery_capacity` |
| `attribute_value` | `string \| null` | — | Nilai sebagai string terformat, mis. `5000 mAh` |
| `context` | `string \| null` | — | Konteks klaim (untuk conflict tolerance) |
| `comparison_target` | `string \| null` | — | Target perbandingan, mis. `generasi sebelumnya` |
| `reviewer_assessment` | `positive \| negative \| neutral \| null` | — | Penilaian subjektif reviewer |
| `certainty` | `string \| null` | — | Tingkat kepastian, mis. `explicit` |
| `source_excerpt` | `string \| null` | — | Kutipan verbatim dari transkrip |
| `related_evidence_ids` | `string[] \| null` | — | Evidence terkait (untuk grouping) |
| `source_coordinates` | `object \| undefined` | — | Lokasi di transkrip (audit) |
| `validation` | `EvidenceValidation \| null` | ✅ | Hasil validasi extractor |
| `timestamp_start` | `string \| null` | — | Timestamp video, mis. `00:00:20` |
| `timestamp_end` | `string \| null` | — | Timestamp akhir |
| `source` | `string` | ✅ | Nama reviewer, mis. `Jagat Review` |
| `review_id` | `string` | ✅ | ID video YouTube |
| `video_url` | `string \| null` | — | URL YouTube |
| `video_title` | `string \| null` | — | Judul video |

### `EvidenceValidation`

| Field | Tipe | Deskripsi |
|---|---|---|
| `accepted` | `boolean` | Hasil validasi keseluruhan |
| `results` | `ValidationRuleResult[]` | Rincian per rule (GROUNDING, PROVENANCE, dll.) |
| `finalStatus` | `VALID \| VALID_WITH_NORMALIZATION \| INVALID \| SUSPECT` | Status akhir |

## 2. Internal — `NormalizedEvidence`

`RawEvidenceRecord` + metadata tambahan:

| Field | Tipe | Deskripsi |
|---|---|---|
| `datasetFile` | `string` | Asal file, mis. `evidence_data (94).json` |
| `datasetVersion` | `string` | Versi dataset |
| `isEligibleForScoring` | `boolean` | Sudah lolos validator? |
| `exclusionReason` | `string?` | Alasan eksklusi |
| `sourceReviewer` | `string` | Alias untuk `source` |
| `youtubeTimestampUrl` | `string?` | URL dengan parameter `&t=20s` |
| `rawRecord` | `RawEvidenceRecord` | Record asli untuk audit trail |

## 3. Output — `DecisionResult`

Response dari `GET /api/products/samsung-galaxy-a26-5g/decision`:

| Field | Tipe | Deskripsi |
|---|---|---|
| `productId` | `string` | `samsung-galaxy-a26-5g` |
| `productName` | `string` | Nama display |
| `overallScore` | `number \| null` | Skor 0.0–5.0 (1 desimal) |
| `overallScoreExact` | `number \| null` | Presisi penuh |
| `decisionLabel` | `string` | Rekomendasi (§9.3) |
| `decisionStatus` | `PUBLISHED \| INSUFFICIENT_EVIDENCE \| UNRESOLVED_CRITICAL_CONFLICT` | Status keputusan |
| `confidenceLabel` | `HIGH \| MEDIUM \| LOW \| INSUFFICIENT` | Label confidence (§11.2) |
| `confidenceReasons` | `string[]` | Penjelasan confidence |
| `coveragePercent` | `number` | 0–100 |
| `criteriaScores` | `Record<CriterionId, CriterionScoreResult>` | Skor 7 kriteria |
| `strengths` | `StrengthItem[]` | Kelebihan, tiap item punya `evidenceIds` |
| `tradeoffs` | `TradeoffItem[]` | Kekurangan dengan `scoreDeduction` |
| `decisionReasons` | `DecisionReasonItem[]` | Alasan keputusan top-4 |
| `evidenceUsed` | `string[]` | Semua ID evidence yang dipakai |
| `evidenceExcluded` | `{evidenceId, reason, source}[]` | Evidence yang ditolak |
| `unresolvedConflicts` | `ConflictItem[]` | Konflik belum terselesaikan |
| `rulesetVersion` | `string` | Versi aturan |
| `evidenceDatasetVersion` | `string` | Versi dataset |
| `generatedAt` | `string` | ISO 8601 timestamp |
| `quickDecision` | `{recommendedFor, notRecommendedFor}` | Segmen pengguna |
| `specifications` | `SpecItem[]` | Tabel spesifikasi |
| `pricingSummary` | `PricingSummary \| null` | Harga resmi + promo |
| `reviewerQuotes` | `ReviewerQuote[]` | Kutipan verbatim reviewer |