import React from 'react';
import { DecisionResult } from '../server/types.js';
import { EvidenceRefButton } from './common/EvidenceRefButton.js';

interface SpecTableProps {
  decision: DecisionResult | null;
  onOpenEvidence: (id: string) => void;
}

export const SpecTable: React.FC<SpecTableProps> = ({ decision, onOpenEvidence }) => {
  if (!decision) return null;

  return (
    <section id="spesifikasi" className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-xs">
      <header className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl shadow-inner border border-blue-200">
            📱
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              Spesifikasi Teknis
            </h2>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">
              {decision.specifications.length} kategori · setiap klaim terhubung ke evidence
            </p>
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="py-3.5 px-4 font-bold text-gray-600 w-1/3">Tipe / Model</td>
              <td className="py-3.5 px-4 font-bold text-gray-900">
                {decision.productName}
              </td>
            </tr>

            {decision.specifications.map((spec, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 font-bold text-gray-600">{spec.label}</td>
                <td className="py-3.5 px-4 font-medium text-gray-900">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="flex-1">{spec.value}</span>
                    <span className="flex gap-1 shrink-0">
                      {spec.evidenceIds.map(id => (
                        <EvidenceRefButton
                          key={id}
                          evidenceId={id}
                          onOpenEvidence={onOpenEvidence}
                          variant="chip"
                        />
                      ))}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};