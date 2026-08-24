import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, HeartPulse } from 'lucide-react';
import Button from './ui/Button';

export default function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 md:px-8 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles size={16} />
            <span>AI-Powered Healthcare Revolution</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 mb-6 leading-tight">
            Transform Healthcare with
            <span className="text-blue-600"> Intelligent Workflows</span>
          </h1>
          
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            CareFlow AI streamlines patient intake, automates symptom analysis, and connects healthcare providers with AI-driven precision. Experience the future of healthcare delivery.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/patient/symptoms">
              <Button variant="primary" size="lg" className="group">
                Start Free Trial
                <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/patient">
              <Button variant="outline" size="lg">
                <HeartPulse size={20} className="mr-2" />
                Watch Demo
              </Button>
            </Link>
          </div>
          
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-slate-500 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>256-bit Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>SOC 2 Certified</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
