import React, { useEffect, useState, useCallback } from 'react';
import { DecisionResult } from './server/types.js';
import { Navbar } from './components/Navbar.js';
import { HeroScore } from './components/HeroScore.js';
import { QuickDecision } from './components/QuickDecision.js';
import { SpecTable } from './components/SpecTable.js';
import { CriteriaBreakdown } from './components/CriteriaBreakdown.js';
import { StrengthsAndTradeoffs } from './components/StrengthsAndTradeoffs.js';
import { ReviewerEvidence } from './components/ReviewerEvidence.js';
import { PricingAside } from './components/PricingAside.js';
import { EvidenceModal } from './components/EvidenceModal.js';
import { DiagnosticsView } from './components/DiagnosticsView.js';
import { DecisionStatusBanner } from './components/common/DecisionStatusBanner.js';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type AppState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; decision: DecisionResult };

export default function App() {
  const [state, setState] = useState<AppState>({ kind: 'loading' });
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const fetchDecision = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/products/samsung-galaxy-a26-5g/decision');

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        let msg = `Kesalahan server (${res.status})`;
        if (res.status === 503) {
          msg = body.message || 'Server sedang memuat ulang data. Coba beberapa saat lagi.';
        } else if (body.message) {
          msg = body.message;
        }
        throw new Error(msg);
      }

      const decision: DecisionResult = await res.json();
      setState({ kind: 'success', decision });
    } catch (err: any) {
      setState({
        kind: 'error',
        message: err.message || 'Gagal memuat hasil evaluasi keputusan dari backend',
      });
    }
  }, []);

  useEffect(() => {
    fetchDecision();
  }, [fetchDecision]);

  const handleOpenEvidence = useCallback((id: string) => {
    setActiveEvidenceId(id);
  }, []);

  const decision = state.kind === 'success' ? state.decision : null;
  const isPublished = decision?.decisionStatus === 'PUBLISHED';
  const showStatusBanner = decision !== null && decision.decisionStatus !== 'PUBLISHED';

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900">
      <Navbar onOpenDiagnostics={() => setIsDiagnosticsOpen(true)} />

      <main className="grow">
        {/* Loading state */}
        {state.kind === 'loading' && (
          <div className="max-w-6xl mx-auto px-4 mt-12">
            <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-semibold">Memuat hasil evaluasi keputusan...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {state.kind === 'error' && (
          <div className="max-w-6xl mx-auto px-4 mt-6">
            <div className="bg-red-50 border border-red-200 text-red-900 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm">Gagal Mengambil Data Evaluasi dari Backend</h3>
                  <p className="text-xs text-red-700 mt-0.5 font-medium">{state.message}</p>
                </div>
              </div>
              <button
                onClick={fetchDecision}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          </div>
        )}

        {/* Status banner (insufficient / conflict) */}
        {showStatusBanner && (
          <div className="max-w-6xl mx-auto px-4 mt-6">
            <DecisionStatusBanner decision={decision} />
          </div>
        )}

        {/* Hero — only when published */}
        {isPublished && decision && (
          <HeroScore decision={decision} onOpenEvidence={handleOpenEvidence} />
        )}

        {/* Content body */}
        {state.kind === 'success' && decision && (
          <div className="max-w-6xl mx-auto px-4 mt-8 pb-24 grid gap-8 lg:grid-cols-[2fr_1fr] items-start">
            <div className="space-y-8">
              {isPublished && (
                <QuickDecision decision={decision} onOpenEvidence={handleOpenEvidence} />
              )}

              <SpecTable decision={decision} onOpenEvidence={handleOpenEvidence} />

              {isPublished && (
                <StrengthsAndTradeoffs decision={decision} onOpenEvidence={handleOpenEvidence} />
              )}

              {isPublished && (
                <CriteriaBreakdown decision={decision} onOpenEvidence={handleOpenEvidence} />
              )}

              <ReviewerEvidence decision={decision} onOpenEvidence={handleOpenEvidence} />
            </div>

            <PricingAside decision={decision} onOpenEvidence={handleOpenEvidence} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-10 text-center text-xs text-gray-500 font-medium">
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-gray-700">
            Evidence-Based Smartphone Decision Engine © 2026 GripAndReview
          </p>
          {decision && (
            <p className="text-[11px] text-gray-400 font-mono">
              Engine Ruleset: {decision.rulesetVersion} · Dataset: {decision.evidenceDatasetVersion}
            </p>
          )}
          {state.kind === 'error' && (
            <p className="text-[11px] text-gray-400 italic">
              Versi pipeline tidak tersedia (data belum dimuat)
            </p>
          )}
          <div className="pt-2">
            <button
              onClick={() => setIsDiagnosticsOpen(true)}
              className="text-blue-600 hover:text-blue-800 underline font-semibold text-xs"
            >
              Buka Laporan Audit Diagnostik Dataset
            </button>
          </div>
        </div>
      </footer>

      <EvidenceModal evidenceId={activeEvidenceId} onClose={() => setActiveEvidenceId(null)} />
      <DiagnosticsView isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} />
    </div>
  );
}