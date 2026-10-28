import React from 'react';
import { DecisionResult } from '../server/types.js';
import { ShieldCheck, Star } from 'lucide-react';

interface HeroScoreProps {
  decision: DecisionResult;
  onOpenEvidence: (id: string) => void;
}

export const HeroScore: React.FC<HeroScoreProps> = ({ decision }) => {
  const scoreDisplay = decision.overallScore !== null
    ? decision.overallScore.toFixed(1)
    : '-';

  const topStrengths = decision.strengths.slice(0, 2).map(s => s.title);

  return (
    <section className="bg-white border-b border-gray-200 pt-10 pb-14 shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left: Headline + data-driven summary */}
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 text-xs font-black px-3 py-1 rounded-full mb-4 tracking-wider uppercase bg-blue-50 text-blue-800 border border-blue-200">
            <span>📱 Independent Tech Review</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 leading-tight text-gray-900 tracking-tight">
            Review Samsung Galaxy A26 5G
          </h1>

          {topStrengths.length > 0 && (
            <p className="text-lg text-gray-600 mb-6 leading-relaxed font-medium">
              <span className="font-semibold text-gray-800">Kekuatan utama:</span>{' '}
              {topStrengths.join(' · ')}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              ✓ Berbasis {decision.evidenceUsed.length} evidence tervalidasi
            </span>

            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              📊 {decision.coveragePercent}% cakupan kriteria
            </span>

            {decision.strengths.filter(s => s.impactCategory === 'Keamanan' || s.title.toLowerCase().includes('knox')).length > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                🛡️ {decision.strengths.find(s => s.title.toLowerCase().includes('knox'))?.title || 'Keamanan Hardware'}
              </span>
            )}
          </div>
        </div>

        {/* Right: Score box */}
        <div className="lg:col-span-5 bg-slate-950 text-white p-7 md:p-8 rounded-3xl shadow-2xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="space-y-6 relative z-10">
            {/* Score header */}
            <div className="flex justify-between items-end border-b border-slate-800 pb-5">
              <div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">
                  Editor Decision Score
                </p>
                <div className="flex items-center gap-1 text-yellow-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        decision.overallScore !== null && star <= Math.round(decision.overallScore)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="text-right">
                <div className="text-5xl font-black text-white tabular-nums tracking-tight">
                  {scoreDisplay}
                  <span className="text-lg text-slate-500 font-bold ml-1">/5</span>
                </div>
              </div>
            </div>

            {/* Verdict */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <span className="text-slate-400 font-medium text-sm">Hasil Rekomendasi</span>
              <span className="text-sm font-bold text-emerald-400 text-right">
                {decision.decisionLabel}
              </span>
            </div>

            {/* Confidence + coverage */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <span className="text-slate-400 font-medium text-sm block">Confidence Level</span>
                <span className="text-[11px] text-slate-500">Cakupan: {decision.coveragePercent}%</span>
              </div>
              <span
                className="text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-md flex items-center gap-1.5 cursor-help"
                title={decision.confidenceReasons.join('\n')}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {decision.confidenceLabel}
              </span>
            </div>

            {/* Ruleset */}
            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Ruleset: {decision.rulesetVersion}</span>
              <span>Dataset: {decision.evidenceDatasetVersion}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};