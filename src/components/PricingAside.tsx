import React from 'react';
import { DecisionResult } from '../server/types.js';
import { ExternalLink, ShoppingCart } from 'lucide-react';
import { EvidenceRefButton } from './common/EvidenceRefButton.js';

interface PricingAsideProps {
  decision: DecisionResult | null;
  onOpenEvidence: (id: string) => void;
}

function formatIDR(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export const PricingAside: React.FC<PricingAsideProps> = ({ decision, onOpenEvidence }) => {
  if (!decision) return null;

  const pricing = decision.pricingSummary;
  const hasPricing = pricing !== null && (pricing.officialPrice !== null || pricing.promoPrice !== null);

  return (
    <aside className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white shadow-xs sticky top-20 overflow-hidden">
        {/* Pricing card */}
        {hasPricing && pricing && (
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Cek Harga Pasaran
            </h3>
            <p className="text-xs text-gray-500 mb-3 font-medium flex items-center gap-1 flex-wrap">
              <span>Estimasi harga marketplace</span>
              {pricing.evidenceIds.map(id => (
                <EvidenceRefButton key={id} evidenceId={id} onOpenEvidence={onOpenEvidence} variant="chip" />
              ))}
            </p>

            {pricing.promoPrice !== null && (
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-3xl font-black text-orange-600 tracking-tight tabular-nums">
                  {formatIDR(pricing.promoPrice)}
                </span>
                {pricing.officialPrice !== null && pricing.officialPrice > pricing.promoPrice && (
                  <span className="text-xs text-gray-400 font-medium line-through tabular-nums">
                    {formatIDR(pricing.officialPrice)}
                  </span>
                )}
              </div>
            )}

            {pricing.promoPrice === null && pricing.officialPrice !== null && (
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-3xl font-black text-orange-600 tracking-tight tabular-nums">
                  {formatIDR(pricing.officialPrice)}
                </span>
                <span className="text-xs text-gray-400 font-medium">harga resmi</span>
              </div>
            )}

            <div className="space-y-2.5">
              <a
                href="https://www.tokopedia.com/find/samsung-galaxy-a26-5g"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs shadow-2xs"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Cek Promo Tokopedia</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
              </a>
              <a
                href="https://shopee.co.id/search?keyword=samsung%20galaxy%20a26%205g"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs shadow-2xs"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Cek Promo Shopee</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
              </a>
            </div>
            <p className="text-[10px] text-gray-400 mt-3 italic text-center leading-tight">
              Harga dapat bervariasi tergantung promo & voucher toko.
            </p>
          </div>
        )}

        {/* Pros/Cons from API */}
        {(decision.strengths.length > 0 || decision.tradeoffs.length > 0) && (
          <div className="p-6 space-y-5 text-xs">
            {decision.strengths.length > 0 && (
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span>👍</span> Kelebihan Utama
                </h4>
                <ul className="space-y-2 text-slate-700 font-medium">
                  {decision.strengths.slice(0, 4).map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold shrink-0">✔</span>
                      <span className="flex-1">
                        {s.title}
                        <span className="ml-1 inline-flex gap-1 align-middle">
                          {s.evidenceIds.slice(0, 2).map(id => (
                            <EvidenceRefButton key={id} evidenceId={id} onOpenEvidence={onOpenEvidence} variant="chip" />
                          ))}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {decision.tradeoffs.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span>👎</span> Catatan Penting
                </h4>
                <ul className="space-y-2 text-slate-700 font-medium">
                  {decision.tradeoffs.slice(0, 4).map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-500 font-bold shrink-0">✘</span>
                      <span className="flex-1">
                        {t.title}
                        <span className="ml-1 inline-flex gap-1 align-middle">
                          {t.evidenceIds.slice(0, 2).map(id => (
                            <EvidenceRefButton key={id} evidenceId={id} onOpenEvidence={onOpenEvidence} variant="chip" />
                          ))}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Sources — derived from decision.reviewerQuotes (real reviewer names from evidence) */}
        {decision.reviewerQuotes.length > 0 && (
          <div className="bg-slate-50 border-t border-gray-200 p-6 text-xs text-slate-600 space-y-3">
            <h5 className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
              🔍 Sumber Bukti Reviewer
            </h5>
            <ul className="space-y-1.5 font-medium">
              {decision.reviewerQuotes.map((q, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Media</span>
                  <span className="flex-1 truncate">{q.source}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 leading-relaxed">
              Sumber diverifikasi dari evidence — tidak ada klaim sponsorship atau bias independen yang diverifikasi
              dalam dataset saat ini.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};