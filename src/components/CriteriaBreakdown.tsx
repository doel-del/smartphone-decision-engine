import React, { useState } from 'react';
import { DecisionResult, CriterionId } from '../server/types.js';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { EvidenceRefButton } from './common/EvidenceRefButton.js';

interface CriteriaBreakdownProps {
  decision: DecisionResult | null;
  onOpenEvidence: (id: string) => void;
}

export const CriteriaBreakdown: React.FC<CriteriaBreakdownProps> = ({ decision, onOpenEvidence }) => {
  const [expandedCriterion, setExpandedCriterion] = useState<CriterionId | null>(null);

  if (!decision) return null;

  const toggleExpand = (id: CriterionId) => {
    setExpandedCriterion(prev => prev === id ? null : id);
  };

  const criterionIds = Object.keys(decision.criteriaScores) as CriterionId[];

  return (
    <section id="kriteria" className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-xs space-y-6">
      <header className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            Breakdown 7 Kriteria Keputusan
          </h2>
          <p className="text-xs font-semibold text-gray-500 mt-1">
            Bobot tetap: Harga 20% · Performa 15% · Baterai 15% · Software 15% · Layar 10% · Kamera 10% · Durabilitas 15%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            Cakupan: {decision.coveragePercent}%
          </span>
        </div>
      </header>

      <div className="space-y-4">
        {criterionIds.map((cid) => {
          const item = decision.criteriaScores[cid];
          const isExpanded = expandedCriterion === cid;
          const weightPercent = Math.round(item.weight * 100);
          const percentage = item.score !== null ? (item.score / 5) * 100 : 0;

          const barColor = item.score === null
            ? 'bg-gray-300'
            : item.score >= 4.0
              ? 'bg-emerald-500'
              : item.score >= 3.0
                ? 'bg-blue-500'
                : 'bg-amber-500';

          return (
            <div
              key={cid}
              className="border border-gray-200 rounded-2xl overflow-hidden transition-all hover:border-gray-300"
            >
              <div
                onClick={() => toggleExpand(cid)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer bg-white hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-gray-900 text-base">
                      {item.criterionNameId}
                    </h3>
                    <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      Bobot: {weightPercent}%
                    </span>
                    {!item.isRated && (
                      <span className="text-[10px] font-mono font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                        UNRATED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    {item.criterionName} · Rubric {item.rubricVersion}
                  </p>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-center">
                  <div className="w-32 sm:w-40 flex flex-col gap-1 text-right">
                    <span className="text-xl font-black text-gray-900 tabular-nums">
                      {item.score !== null ? item.score.toFixed(1) : '—'}
                      <span className="text-xs text-gray-500 font-medium"> / 5.0</span>
                    </span>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="p-5 border-t border-gray-100 bg-slate-50/60 space-y-4 text-xs">
                  {/* UNRATED reason */}
                  {!item.isRated && item.unratedReason && (
                    <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
                      <strong>Kriteria ini tidak dapat dinilai:</strong> {item.unratedReason}
                    </div>
                  )}

                  {/* Primary findings with per-finding evidence IDs */}
                  {item.primaryFindingsDetail.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Temuan Utama Berdasarkan Bukti
                      </h4>
                      <ul className="space-y-1.5 text-gray-700 font-medium">
                        {item.primaryFindingsDetail.map((finding, fi) => (
                          <li key={fi} className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span className="flex-1">
                              {finding.text}
                              <span className="ml-2 inline-flex gap-1 align-middle">
                                {finding.evidenceIds.map(id => (
                                  <EvidenceRefButton
                                    key={id}
                                    evidenceId={id}
                                    onOpenEvidence={onOpenEvidence}
                                    variant="chip"
                                  />
                                ))}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Positive drivers with deltas */}
                  {item.positiveDrivers.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-emerald-800 uppercase tracking-wider">
                        Faktor Pendorong Skor Naik
                      </h4>
                      {item.positiveDrivers.map((p, pi) => (
                        <div
                          key={pi}
                          className="flex items-start justify-between gap-2 p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-950 font-medium"
                        >
                          <span className="flex-1">{p.text}</span>
                          <span className="shrink-0 flex items-center gap-1.5">
                            {p.delta !== undefined && (
                              <span className="font-mono font-bold text-emerald-700">
                                +{p.delta.toFixed(1)}
                              </span>
                            )}
                            {p.evidenceIds.map(id => (
                              <EvidenceRefButton
                                key={id}
                                evidenceId={id}
                                onOpenEvidence={onOpenEvidence}
                                variant="chip"
                              />
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Negative deductions with deltas */}
                  {item.negativeDeductions.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-red-800 uppercase tracking-wider">
                        Faktor Pengurang Skor
                      </h4>
                      {item.negativeDeductions.map((n, ni) => (
                        <div
                          key={ni}
                          className="flex items-start justify-between gap-2 p-2 bg-red-50/70 border border-red-200 rounded-lg text-red-950 font-medium"
                        >
                          <span className="flex-1">{n.text}</span>
                          <span className="shrink-0 flex items-center gap-1.5">
                            {n.delta !== undefined && (
                              <span className="font-mono font-bold text-red-700">
                                {n.delta.toFixed(1)}
                              </span>
                            )}
                            {n.evidenceIds.map(id => (
                              <EvidenceRefButton
                                key={id}
                                evidenceId={id}
                                onOpenEvidence={onOpenEvidence}
                                variant="chip"
                              />
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* All evidence IDs (deduped) */}
                  {item.evidenceIdsUsed.length > 0 && (
                    <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-gray-500">
                        {item.evidenceIdsUsed.length} evidence digunakan:
                      </span>
                      {Array.from(new Set(item.evidenceIdsUsed)).map(id => (
                        <button
                          key={id}
                          onClick={() => onOpenEvidence(id)}
                          className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-white text-blue-700 border border-gray-200 hover:border-blue-400 rounded-md transition-colors cursor-pointer"
                          title={`Buka bukti ${id}`}
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};