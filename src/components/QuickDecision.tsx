import React from 'react';
import { DecisionResult } from '../server/types.js';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { EvidenceRefButton } from './common/EvidenceRefButton.js';

interface QuickDecisionProps {
  decision: DecisionResult;
  onOpenEvidence: (id: string) => void;
}

export const QuickDecision: React.FC<QuickDecisionProps> = ({ decision, onOpenEvidence }) => {
  const { recommendedFor, notRecommendedFor } = decision.quickDecision;

  if (recommendedFor.length === 0 && notRecommendedFor.length === 0) return null;

  return (
    <div id="quick-decision" className="space-y-4">
      {recommendedFor.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 p-6 md:p-7 rounded-3xl shadow-2xs">
          <div className="flex items-center gap-2.5 text-emerald-800 font-black text-lg mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <h3>Direkomendasikan Untuk:</h3>
          </div>

          <ul className="text-emerald-950 space-y-3.5 text-sm font-semibold leading-relaxed">
            {recommendedFor.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-emerald-600 mt-1 text-base leading-none">•</span>
                <div className="w-full">
                  <span>{item.text}</span>
                  <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                    {item.evidenceIds.map(id => (
                      <EvidenceRefButton
                        key={id}
                        evidenceId={id}
                        onOpenEvidence={onOpenEvidence}
                        variant="chip"
                      />
                    ))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notRecommendedFor.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 p-6 md:p-7 rounded-3xl shadow-2xs">
          <div className="flex items-center gap-2.5 text-amber-900 font-black text-lg mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <h3>Kurang Cocok / Perlu Dipertimbangkan Jika:</h3>
          </div>

          <ul className="text-amber-950 space-y-3 text-sm font-semibold leading-relaxed">
            {notRecommendedFor.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-amber-600 mt-1 text-base leading-none">•</span>
                <div className="w-full">
                  <span>{item.text}</span>
                  <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                    {item.evidenceIds.map(id => (
                      <EvidenceRefButton
                        key={id}
                        evidenceId={id}
                        onOpenEvidence={onOpenEvidence}
                        variant="chip"
                      />
                    ))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};