import React, { useEffect, useState } from 'react';
import { NormalizedEvidence } from '../server/types.js';
import { ExternalLink, X, ShieldCheck, Video, Clock, FileText, AlertCircle } from 'lucide-react';

interface EvidenceModalProps {
  evidenceId: string | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ evidenceId, onClose }) => {
  const [evidence, setEvidence] = useState<NormalizedEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!evidenceId) {
      setEvidence(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/evidence/${encodeURIComponent(evidenceId)}`)
      .then(res => {
        if (!res.ok) throw new Error(`Evidence ${evidenceId} not found`);
        return res.json();
      })
      .then(data => {
        setEvidence(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [evidenceId]);

  if (!evidenceId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-1 bg-blue-100 text-blue-800 rounded">
              {evidenceId}
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Detail Bukti Terverifikasi
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm">Memuat data bukti sumber...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Gagal Mengambil Bukti</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}

          {evidence && !loading && (
            <div className="space-y-5 text-sm">
              {/* Claim */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Klaim / Temuan
                </h4>
                <p className="text-lg font-bold text-slate-900 leading-snug">
                  "{evidence.claim}"
                </p>
              </div>

              {/* Source Excerpt */}
              {evidence.source_excerpt && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Kutipan Transkrip Sumber
                  </h4>
                  <p className="text-slate-700 italic font-medium leading-relaxed">
                    "{evidence.source_excerpt}"
                  </p>
                </div>
              )}

              {/* Grid Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Topik</span>
                  <span className="font-semibold text-slate-800 capitalize">{evidence.topic} {evidence.subtopic ? `(${evidence.subtopic})` : ''}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Tipe Bukti</span>
                  <span className="font-semibold text-blue-700">{evidence.type}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Status Validasi</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {evidence.validation?.finalStatus || 'VALID'}
                  </span>
                </div>

                {evidence.attribute && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase">Atribut</span>
                    <span className="font-semibold text-slate-800">{evidence.attribute}: {evidence.attribute_value || evidence.value || '-'}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Kepastian</span>
                  <span className="font-semibold text-slate-800 capitalize">{evidence.certainty || 'Explicit'}</span>
                </div>

                {evidence.timestamp_start && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase">Timestamp</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1 font-mono text-xs">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {evidence.timestamp_start} {evidence.timestamp_end ? `- ${evidence.timestamp_end}` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Source & Video Link */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Kanal / Reviewer:</span>
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-red-600" />
                    {evidence.source}
                  </p>
                  <p className="text-xs text-slate-500 truncate max-w-sm mt-0.5">
                    {evidence.video_title}
                  </p>
                </div>

                {evidence.video_url && (
                  <a
                    href={evidence.youtubeTimestampUrl || evidence.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
                  >
                    <span>Tonton di YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
