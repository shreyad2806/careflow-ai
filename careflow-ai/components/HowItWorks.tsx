import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Sign Up & Onboard",
      description: "Create your account in minutes. Choose your role—patient, doctor, or administrator—and complete your profile setup."
    },
    {
      number: "02",
      title: "Voice or Text Intake",
      description: "Describe your symptoms naturally through voice or text. Our AI understands and processes your input instantly."
    },
    {
      number: "03",
      title: "AI Analysis & Triage",
      description: "Advanced algorithms analyze your symptoms, assess severity, and recommend appropriate care level."
    },
    {
      number: "04",
      title: "Connect with Care",
      description: "Get matched with the right healthcare provider, schedule appointments, or receive immediate guidance."
    }
  ];

  return (
    <section id="how-it-works" className="py-20 px-4 md:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            How CareFlow AI Works
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Simple steps to transform your healthcare experience
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="flex gap-8 items-start">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold">
                    {step.number}
                  </div>
                </div>
                <div className="flex-1 pb-12">
                  <h3 className="text-2xl font-semibold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-lg text-slate-600">{step.description}</p>
                </div>
              </div>
              
              {index < steps.length - 1 && (
                <div className="absolute left-8 top-16 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 to-transparent" style={{ height: 'calc(100% - 4rem)' }}></div>
              )}
            </div>
          ))}

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 text-blue-600 font-medium">
              <span>Ready to get started?</span>
              <ArrowRight size={20} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
