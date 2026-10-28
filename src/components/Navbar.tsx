import React from 'react';
import { Activity } from 'lucide-react';

interface NavbarProps {
  onOpenDiagnostics: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenDiagnostics }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <a 
          href="#" 
          className="text-lg font-black tracking-tight text-gray-900 whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
            A
          </span>
          <span>GripAndReview</span>
        </a>

        {/* Zone 2: 4-5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-600">
          <a href="#quick-decision" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
            Keputusan
          </a>
          <a href="#spesifikasi" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
            Spesifikasi
          </a>
          <a href="#kriteria" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
            Skor Kriteria
          </a>
          <a href="#klaim-vs-fakta" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
            Klaim vs Fakta
          </a>
          <a href="#transparansi" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
            Transparansi
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenDiagnostics}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200 whitespace-nowrap shrink-0 shadow-2xs"
            aria-label="Buka Diagnostik Dataset"
          >
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Diagnostik Data</span>
            <span className="sm:hidden">Diagnostik</span>
          </button>
        </div>
      </div>
    </header>
  );
};
