import React from 'react';
import { DecisionResult } from '../server/types.js';
import { EvidenceRefButton } from './common/EvidenceRefButton.js';

interface StrengthsAndTradeoffsProps {
  decision: DecisionResult | null;
  onOpenEvidence: (id: string) => void;
}

export const StrengthsAndTradeoffs: React.FC<StrengthsAndTradeoffsProps> = ({ decision, onOpenEvidence }) => {
  if (!decision) return null;

  const { strengths, tradeoffs } = decision;

  if (strengths.length === 0 && tradeoffs.length === 0) return null;

  return (
    <section id="transparansi" className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-xs space-y-8">
      <header className="border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
          Pendorong Skor Naik vs Faktor Pemangkas Skor
        </h2>
        <p className="text-xs font-semibold text-gray-500 mt-1">
          {strengths.length} faktor pendorong · {tradeoffs.length} faktor pemangkas · seluruh poin berdasar evidence
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8 md:gap-10">
        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 border-b border-emerald-100 pb-2">
              <span className="text-lg">📈</span>
              <h3 className="text-sm font-black text-emerald-800 uppercase tracking-wider">
                Kelebihan Utama
              </h3>
            </div>

            <div className="space-y-4">
              {strengths.map((str, idx) => (
                <div key={idx} className="flex gap-3 items-start p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100/80">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-base leading-none">
                    +
                  </span>
                  <div className="w-full space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900 leading-snug">
                        {str.title}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                        {str.impactCategory}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium leading-relaxed">
                      {str.description}
                    </p>
                    <div className="pt-1 flex flex-wrap gap-1">
                      {str.evidenceIds.map(id => (
                        <EvidenceRefButton
                          key={id}
                          evidenceId={id}
                          onOpenEvidence={onOpenEvidence}
                          variant="chip"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tradeoffs */}
        {tradeoffs.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 border-b border-red-100 pb-2">
              <span className="text-lg">📉</span>
              <h3 className="text-sm font-black text-red-800 uppercase tracking-wider">
                Kekurangan Nyata
              </h3>
            </div>

            <div className="space-y-4">
              {tradeoffs.map((trd, idx) => (
                <div key={idx} className="flex gap-3 items-start p-3.5 rounded-2xl bg-red-50/40 border border-red-100/80">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-black text-base leading-none">
                    −
                  </span>
                  <div className="w-full space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900 leading-snug">
                        {trd.title}
                      </p>
                      {trd.scoreDeduction !== undefined && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700 shrink-0 tabular-nums font-mono">
                          {trd.scoreDeduction.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 font-medium leading-relaxed">
                      {trd.description}
                    </p>
                    {trd.mitigation && (
                      <p className="text-[11px] text-blue-700 font-semibold bg-blue-50/60 p-2 rounded-lg mt-1 border border-blue-100">
                        💡 Solusi / Catatan: {trd.mitigation}
                      </p>
                    )}
                    <div className="pt-1 flex flex-wrap gap-1">
                      {trd.evidenceIds.map(id => (
                        <EvidenceRefButton
                          key={id}
                          evidenceId={id}
                          onOpenEvidence={onOpenEvidence}
                          variant="chip"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};