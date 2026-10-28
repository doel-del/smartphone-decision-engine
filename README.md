# Evidence-Based Smartphone Decision Engine

Mesin keputusan smartphone **deterministik** berbasis evidence JSON untuk Samsung Galaxy A26 5G. Setiap skor, rekomendasi, dan label confidence diturunkan dari evidence yang telah divalidasi — **tanpa LLM, tanpa hard-code, tanpa nilai rekaan**.

## Fitur Utama

- **7 kriteria evaluasi** dengan bobot tetap (PRD §9): Harga 20% · Performa 15% · Baterai 15% · Software 15% · Layar 10% · Kamera 10% · Durabilitas 15%
- **Formula skor keseluruhan** deterministik (§9.2): `S = Σ(wᵢ·sᵢ) / Σ(wᵢ)`
- **Confidence terpisah** dari skor (§11.2): HIGH / MEDIUM / LOW / INSUFFICIENT
- **Traceability penuh** — setiap klaim terhubung ke `evidenceId`
- **Gate keputusan** (§9.3): tidak menerbitkan skor jika coverage <60% atau konflik kritis unresolved
- **API + SPA frontend** — backend Express, frontend React + Vite

## Prasyarat

- **Node.js ≥20.11.0** (memerlukan `import.meta.dirname`)
- **npm ≥10.0.0**

Verifikasi versi:
```bash
node --version   # harus ≥20.11.0
npm --version
```

## Quick Start
# Install dependencies
npm install

# Development server (backend + Vite HMR di http://localhost:3001)
npm run dev

# Production build
npm run build
npm start

# Lint (TypeScript strict mode)
npm run lint

# Tests
npm test                    # 65 tests (unit + integration + regression)
npm run test:unit           # unit saja
npm run test:integration    # integration saja
npm run test:regression     # golden baseline saja
npm run test:watch          # watch mode
npm run test:coverage       # dengan coverage report

Setelah npm run dev, akses:

URL	Deskripsi
http://localhost:3001	SPA frontend
http://localhost:3001/health	Liveness probe
http://localhost:3001/ready	Readiness probe (pipeline status)
http://localhost:3001/api/products/samsung-galaxy-a26-5g/decision	Decision endpoint
http://localhost:3001/api/diagnostics/evidence	Audit trail dataset
http://localhost:3001/api/evidence	Evidence list
http://localhost:3001/api/evidence/:id	Evidence detail

## Struktur Proyek

```text
evidence-based-smartphone-decision-engine/
├── server.ts                      # Express entry point
├── vite.config.ts                 # Vite config
├── vitest.config.ts               # Test config
├── data/                          # Evidence JSON (sumber klaim)
│   ├── evidence_data_94.json
│   ├── evidence_data_98.json
│   └── evidence_data_100.json
├── src/
│   ├── server/                    # Backend pipeline
│   │   ├── evidenceLoader.ts      # Baca JSON
│   │   ├── evidenceNormalizer.ts  # Normalisasi shape + dedup
│   │   ├── evidenceValidator.ts   # Filter eligibility
│   │   ├── evidenceRepository.ts  # Akses terpusat + conflict
│   │   ├── criterionEvaluators.ts # 7 evaluator kriteria
│   │   ├── decisionEngine.ts      # Orkestrasi + skor
│   │   ├── confidenceEngine.ts    # Confidence calculation
│   │   ├── decisionRules.ts       # Bobot, rubrik, rules
│   │   ├── pipeline.ts            # One-time initialization
│   │   ├── logger.ts              # Structured logging
│   │   └── routes.ts              # HTTP API
│   ├── components/                # React components
│   └── App.tsx                    # Main app
├── test/
│   ├── unit/                      # Unit tests (per modul)
│   ├── integration/               # Integration tests (HTTP)
│   └── regression/                # Golden baseline test
└── docs/                          # Dokumentasi lengkap
    ├── SCHEMA.md                  # Kontrak data
    ├── RUBRIC.md                  # Detail 7 kriteria
    ├── VALIDATION.md              # Aturan kelayakan
    └── ARCHITECTURE.md            # Arsitektur sistem
```