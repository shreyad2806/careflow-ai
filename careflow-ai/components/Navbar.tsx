'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import Button from './ui/Button';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="text-xl font-semibold text-slate-900">CareFlow AI</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-slate-600 hover:text-slate-900 transition-colors">How it Works</a>
            <a href="#trust" className="text-slate-600 hover:text-slate-900 transition-colors">Trust & Privacy</a>
            <Link href="/patient">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link href="/patient/symptoms">
              <Button variant="primary" size="sm">Get Started</Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">Features</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-slate-900 transition-colors">How it Works</a>
              <a href="#trust" className="text-slate-600 hover:text-slate-900 transition-colors">Trust & Privacy</a>
              <Link href="/patient">
                <Button variant="outline" size="sm" className="w-full">Sign In</Button>
              </Link>
              <Link href="/patient/symptoms">
                <Button variant="primary" size="sm" className="w-full">Get Started</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
