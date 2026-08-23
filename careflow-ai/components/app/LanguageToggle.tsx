'use client';

import React, { useState } from 'react';
import { Globe, ChevronDown } from 'lucide-react';

interface LanguageToggleProps {
  currentLanguage?: string;
  onLanguageChange?: (language: string) => void;
}

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
];

export default function LanguageToggle({ currentLanguage = 'en', onLanguageChange }: LanguageToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Globe size={18} className="text-slate-600" />
        <span className="text-sm text-slate-700">{currentLang.name}</span>
        <ChevronDown size={16} className="text-slate-500" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-20">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  onLanguageChange?.(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                  lang.code === currentLanguage ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
