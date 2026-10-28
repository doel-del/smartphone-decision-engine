import React from 'react';

interface EvidenceRefButtonProps {
  evidenceId: string;
  onOpenEvidence: (id: string) => void;
  variant?: 'inline' | 'chip';
  className?: string;
}

/**
 * Standard evidence reference button.
 * Replaces all `[cite: EXXX]`, `[EXXX]`, `[Verifikasi Bukti: EXXX]` formats
 * that violate PRD §6.3.
 *
 * - `inline`: for prose ("📎 Bukti")
 * - `chip`: for lists/badges (compact "📎")
 */
export const EvidenceRefButton: React.FC<EvidenceRefButtonProps> = ({
  evidenceId,
  onOpenEvidence,
  variant = 'inline',
  className = '',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenEvidence(evidenceId);
  };

  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center text-[10px] font-mono font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 transition-colors cursor-pointer ${className}`}
        title={`Buka bukti: ${evidenceId}`}
        aria-label={`Lihat bukti ${evidenceId}`}
      >
        📎
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium underline hover:no-underline cursor-pointer ${className}`}
      title={`Buka bukti: ${evidenceId}`}
      aria-label={`Lihat bukti ${evidenceId}`}
    >
      📎 Bukti
    </button>
  );
};