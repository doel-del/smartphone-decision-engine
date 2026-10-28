import React, { useEffect, useState } from 'react';
import { DatasetReport } from '../server/types.js';
import { Activity, AlertTriangle, CheckCircle2, Database, FileX, RefreshCw, ShieldCheck, X } from 'lucide-react';

interface DiagnosticsViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<DatasetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = () => {
    setLoading(true);
    setError(null);
    fetch('/api/diagnostics/evidence')
      .then(res => {
        if (!res.ok) throw new Error('Gagal mengambil laporan diagnostik backend');
        return res.json();
      })
      .then(data => {
        setReport(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Diagnostik Dataset & Pipeline Bukti
              </h2>
              <p className="text-xs text-slate-400">
                Audit integritas data mentah, normalisasi, aturan validasi, dan konflik sumber.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDiagnostics}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Diagnostik"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-8 text-slate-800">
          {loading && !report && (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-semibold">Menjalankan audit pipeline dataset...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-bold">Kegagalan Diagnostik API</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}

          {report && (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Rekor Dimuat</span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block tabular-nums">{report.totalRecordsLoaded}</span>
                  <span className="text-[11px] text-slate-500 font-medium">Dari 3 file JSON</span>
                </div>

                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Memenuhi Syarat (Eligible)</span>
                  <span className="text-2xl font-black text-emerald-800 mt-1 block tabular-nums">{report.totalAcceptedRecords}</span>
                  <span className="text-[11px] text-emerald-700 font-medium">Masuk perhitungan scoring</span>
                </div>

                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Dieksklusi / Ditolak</span>
                  <span className="text-2xl font-black text-amber-800 mt-1 block tabular-nums">{report.totalExcludedRecords}</span>
                  <span className="text-[11px] text-amber-700 font-medium">Diisolasi dari kalkulasi</span>
                </div>

                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200">
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Sumber Independen</span>
                  <span className="text-2xl font-black text-blue-900 mt-1 block tabular-nums">{report.independentReviewSources.length}</span>
                  <span className="text-[11px] text-blue-700 font-medium">Channel reviewer valid</span>
                </div>
              </div>

              {/* Missing Required Files Status (Crucial PRD requirement) */}
              {report.missingRequiredFiles.length > 0 && (
                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                    <FileX className="w-5 h-5 text-amber-600" />
                    <span>Laporan File Lampiran Proyek:</span>
                  </div>
                  <ul className="text-xs text-amber-900 space-y-1.5 pl-7 list-disc">
                    {report.missingRequiredFiles.map((f, i) => (
                      <li key={i}>
                        <span className="font-mono font-semibold">{f.filename}</span>: {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Datasets Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  Rincian File Dataset per Kanal
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Nama File</th>
                        <th className="py-3 px-4 font-semibold">Kanal Reviewer</th>
                        <th className="py-3 px-4 font-semibold text-right">Total Rekor</th>
                        <th className="py-3 px-4 font-semibold text-right">Diterima</th>
                        <th className="py-3 px-4 font-semibold text-right">Eksklusi</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {report.filesProcessed.map((f, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{f.filename}</td>
                          <td className="py-3 px-4 text-slate-700">{f.source} ({f.reviewId})</td>
                          <td className="py-3 px-4 text-right tabular-nums">{f.totalRecords}</td>
                          <td className="py-3 px-4 text-right tabular-nums text-emerald-700 font-bold">{f.acceptedRecords}</td>
                          <td className="py-3 px-4 text-right tabular-nums text-amber-700 font-bold">{f.excludedRecords}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              {f.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Exclusion Reasons */}
              {Object.keys(report.exclusionReasonsBreakdown).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Alasan Eksklusi Rekor Bukti
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {Object.entries(report.exclusionReasonsBreakdown).map(([reason, count], idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium">{reason}</span>
                        <span className="font-bold text-slate-900 px-2 py-0.5 bg-white rounded border border-slate-200 tabular-nums">
                          {count} rekor
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflict & Reconciliation Audit */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  Audit Deteksi Konflik & Rekonsiliasi Varians
                </h3>
                <div className="space-y-3">
                  {report.conflictsDetected.map((conf, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-2xl border text-xs space-y-2 ${
                        conf.isCritical && !conf.resolved ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-slate-900 uppercase">{conf.attribute}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400">({conf.topic})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          conf.resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {conf.resolved ? 'Terekonsiliasi (Bukan Konflik Kritis)' : 'Belum Terselesaikan'}
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium leading-relaxed">
                        {conf.resolutionNote || 'Varians antar klaim terverifikasi.'}
                      </p>
                      <div className="pt-1 flex flex-wrap gap-2 text-[11px]">
                        {conf.claims.map((c, ci) => (
                          <span key={ci} className="px-2 py-1 bg-white rounded-md border border-slate-200 text-slate-700">
                            <strong>{c.source}:</strong> {String(c.value || c.claim)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Version & Metadata */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 font-medium">
                <div>
                  <span>Versi Ruleset: </span>
                  <span className="font-mono font-bold text-slate-800">{report.rulesetVersion}</span>
                </div>
                <div>
                  <span>Versi Dataset: </span>
                  <span className="font-mono font-bold text-slate-800">{report.evidenceDatasetVersion}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Tutup Diagnostik
          </button>
        </div>
      </div>
    </div>
  );
};
