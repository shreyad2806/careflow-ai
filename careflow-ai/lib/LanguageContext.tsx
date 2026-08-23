'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Language } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Lazy import to avoid circular deps
let _translations: Record<string, Record<Language, string>> | null = null;

function getTranslations() {
  if (!_translations) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _translations = require('@/lib/translations').translations;
  }
  return _translations!;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = useCallback((key: string): string => {
    const all = getTranslations();
    return all[key]?.[language] || all[key]?.['en'] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
