import React from 'react';
import { DecisionResult } from '../server/types.js';
import { ExternalLink, Video, Quote } from 'lucide-react';
import { EvidenceRefButton } from './common/EvidenceRefButton.js';

interface ReviewerEvidenceProps {
  decision: DecisionResult | null;
  onOpenEvidence: (id: string) => void;
}

export const ReviewerEvidence: React.FC<ReviewerEvidenceProps> = ({ decision, onOpenEvidence }) => {
  if (!decision || decision.reviewerQuotes.length === 0) return null;

  return (
    <section className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-xs space-y-6">
      <header className="border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
          Testimoni Reviewer
        </h2>
        <p className="text-xs font-semibold text-gray-500 mt-1">
          Kutipan verbatim dari {decision.reviewerQuotes.length} sumber — setiap klaim terhubung ke evidence
        </p>
      </header>

      <div className="grid md:grid-cols-3 gap-5">
        {decision.reviewerQuotes.map((q, idx) => (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-4 hover:border-blue-300 transition-colors"
          >
            <div className="space-y-3">
              <div className="relative pt-1">
                <Quote className="w-5 h-5 text-blue-300 mb-1" />
                <p className="text-xs text-slate-700 font-medium italic leading-relaxed line-clamp-6">
                  "{q.quote}"
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-red-600" />
                  {q.source}
                </p>
                <div className="mt-0.5 flex items-center gap-1">
                  <EvidenceRefButton
                    evidenceId={q.evidenceId}
                    onOpenEvidence={onOpenEvidence}
                    variant="chip"
                  />
                  <span className="text-[10px] text-slate-500 truncate max-w-[120px]" title={q.videoTitle}>
                    {q.videoTitle}
                  </span>
                </div>
              </div>

              {q.youtubeTimestampUrl && (
                <a
                  href={q.youtubeTimestampUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 transition-colors shrink-0"
                  title={`Tonton ${q.source} di YouTube`}
                  aria-label={`Tonton ${q.source}`}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};