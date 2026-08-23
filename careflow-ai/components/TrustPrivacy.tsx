import React from 'react';
import { Shield, Lock, FileCheck, Eye } from 'lucide-react';

export default function TrustPrivacy() {
  const trustItems = [
    {
      icon: <Shield size={32} />,
      title: "HIPAA Compliant",
      description: "Full compliance with healthcare privacy regulations to protect patient data"
    },
    {
      icon: <Lock size={32} />,
      title: "End-to-End Encryption",
      description: "256-bit AES encryption secures all data in transit and at rest"
    },
    {
      icon: <FileCheck size={32} />,
      title: "SOC 2 Type II Certified",
      description: "Rigorous third-party security audits and compliance verification"
    },
    {
      icon: <Eye size={32} />,
      title: "Transparent Privacy",
      description: "Clear data policies with full user control over health information"
    }
  ];

  return (
    <section id="trust" className="py-20 px-4 md:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Shield size={16} />
            <span>Security First</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Your Trust is Our Foundation
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Built with enterprise-grade security to protect what matters most—your health information
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {trustItems.map((item, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mx-auto mb-4">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-semibold text-slate-900 mb-4">
              Data Privacy Commitment
            </h3>
            <p className="text-lg text-slate-600 mb-6">
              We never sell your health data. Your information is used solely to provide better healthcare services. You maintain full control over your personal health information at all times.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                No data selling
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                User-controlled access
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Right to deletion
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
