import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import Button from './ui/Button';

export default function FinalCTA() {
  return (
    <section className="py-20 px-4 md:px-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <Sparkles size={16} />
          <span>Start Your Journey</span>
        </div>
        
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
          Ready to Transform Healthcare?
        </h2>
        
        <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
          Join thousands of healthcare providers and patients already experiencing the future of intelligent healthcare delivery.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Link href="/patient/symptoms">
            <Button variant="primary" size="lg" className="bg-white text-slate-900 hover:bg-slate-100 group">
              Start Free Trial
              <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/doctor">
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
              Schedule Demo
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-8 text-slate-400 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>14-day free trial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </section>
  );
}
