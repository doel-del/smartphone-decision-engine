import React from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import { DecisionResult } from '../../server/types.js';

interface DecisionStatusBannerProps {
  decision: DecisionResult | null;
  className?: string;
}

/**
 * Renders a prominent banner when the decision is NOT published (§13, §18.9).
 * Returns null for PUBLISHED status (no banner needed).
 */
export const DecisionStatusBanner: React.FC<DecisionStatusBannerProps> = ({
  decision,
  className = '',
}) => {
  if (!decision) return null;

  if (decision.decisionStatus === 'INSUFFICIENT_EVIDENCE') {
    return (
      <div className={`bg-amber-50 border border-amber-300 text-amber-900 p-6 rounded-2xl ${className}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="font-bold text-base">Data Belum Mencukupi untuk Rekomendasi</h3>
            <p className="text-sm leading-relaxed">
              Sistem tidak menerbitkan skor atau rekomendasi karena syarat minimal evidence belum terpenuhi.
            </p>
            {decision.confidenceReasons.length > 0 && (
              <ul className="text-xs space-y-1 pl-4 list-disc">
                {decision.confidenceReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-amber-700 font-mono">
              Coverage: {decision.coveragePercent}% · Confidence: {decision.confidenceLabel}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (decision.decisionStatus === 'UNRESOLVED_CRITICAL_CONFLICT') {
    return (
      <div className={`bg-red-50 border border-red-300 text-red-900 p-6 rounded-2xl ${className}`}>
        <div className="flex items-start gap-3">
          <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="font-bold text-base">Konflik Data Belum Terselesaikan</h3>
            <p className="text-sm leading-relaxed">
              Terdapat {decision.unresolvedConflicts.length} konflik kritis yang belum dapat direkonsiliasi.
              Keputusan ditahan hingga konflik terselesaikan.
            </p>
            <ul className="text-xs space-y-1 pl-4 list-disc">
              {decision.unresolvedConflicts.map((c, i) => (
                <li key={i}>
                  <strong className="font-mono">{c.attribute}:</strong> {c.claims.length} klaim berbeda
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return null;
};