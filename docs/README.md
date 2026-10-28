# Evidence-Based Smartphone Decision Engine — Documentation

Mesin keputusan smartphone deterministik berbasis evidence untuk Samsung Galaxy A26 5G. Seluruh skor, rekomendasi, dan confidence diturunkan dari evidence JSON yang telah tervalidasi — tanpa LLM, tanpa nilai rekaan.

## Dokumen

- **[SCHEMA.md](./SCHEMA.md)** — Kontrak data: input evidence, format internal, output decision
- **[RUBRIC.md](./RUBRIC.md)** — 7 kriteria evaluasi, bobot, formula, ambang batas
- **[VALIDATION.md](./VALIDATION.md)** — Aturan kelayakan evidence, kode eksklusi, deteksi konflik
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Pipeline, modul, jaminan determinisme

## Versi

| Komponen | Versi | File |
|---|---|---|
| Ruleset | `v1.0.0-deterministic-prd` | `src/server/decisionRules.ts` |
| Evidence Dataset | `v1.0.0-multi-source-indonesia` | `src/server/decisionRules.ts` |
| Aplikasi | `1.0.0` | `package.json` |

## Prinsip

1. **Deterministik** — input + ruleset sama → output sama (kecuali `generatedAt`)
2. **Traceable** — setiap klaim terhubung ke `evidenceId` yang bisa diperiksa
3. **Jujur** — tidak ada nilai rekaan; ketiadaan data = `null`, bukan sentinel
4. **Testable** — unit + integration + regression test (golden baseline)
5. **No LLM** — skor dihitung oleh kode, bukan model bahasa

## Struktur Proyek
src/server/
├── evidenceLoader.ts # Baca JSON dari disk
├── evidenceNormalizer.ts # Normalisasi shape + dedup
├── evidenceValidator.ts # Filter eligibility
├── evidenceRepository.ts # Akses terpusat + conflict detection
├── criterionEvaluators.ts # 7 fungsi evaluasi kriteria
├── decisionEngine.ts # Orkestrasi + skor keseluruhan
├── confidenceEngine.ts # Perhitungan confidence
├── decisionRules.ts # Bobot, rubrik, conflict rules, spec rows
└── routes.ts # HTTP API

src/components/
├── common/
│ ├── EvidenceRefButton.tsx # Tombol referensi evidence standar
│ └── DecisionStatusBanner.tsx # Banner untuk INSUFFICIENT/CONFLICT
├── HeroScore.tsx # Skor utama
├── QuickDecision.tsx # Rekomendasi segmen
├── SpecTable.tsx # Tabel spesifikasi
├── CriteriaBreakdown.tsx # Detail per kriteria
├── StrengthsAndTradeoffs.tsx # Kelebihan/kekurangan
├── ReviewerEvidence.tsx # Kutipan reviewer
├── PricingAside.tsx # Sidebar harga + ringkasan
├── EvidenceModal.tsx # Detail evidence
└── DiagnosticsView.tsx # Audit trail
