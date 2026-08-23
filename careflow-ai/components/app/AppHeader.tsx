'use client';

import React from 'react';
import { Search, Menu } from 'lucide-react';
import Button from '@/components/ui/Button';
import NotificationCenter from '@/components/app/NotificationCenter';
import LanguageToggle from '@/components/app/LanguageToggle';
import { useLanguage } from '@/lib/LanguageContext';

interface AppHeaderProps {
  title?: string;
  showSearch?: boolean;
  onMenuToggle?: () => void;
  children?: React.ReactNode;
}

export default function AppHeader({ title, showSearch = true, onMenuToggle, children }: AppHeaderProps) {
  const { t } = useLanguage();

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 z-30">
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>

        {title && (
          <h1 className="text-lg lg:text-xl font-semibold text-slate-900 truncate">{title}</h1>
        )}

        {showSearch && (
          <div className="relative max-w-md flex-1 ml-4 hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder={t('common.search')}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        {children}

        <NotificationCenter />

        <LanguageToggle />

        <Button variant="outline" size="sm" className="hidden sm:inline-flex">
          {t('common.help')}
        </Button>
      </div>
    </header>
  );
}
