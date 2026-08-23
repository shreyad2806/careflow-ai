import React from 'react';
import { Mic, MessageCircle, BrainCircuit, CheckCircle } from 'lucide-react';

export default function VoiceIntake() {
  return (
    <section className="py-20 px-4 md:px-8 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Mic size={16} />
              <span>Voice-Powered Technology</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Describe Your Symptoms Naturally
            </h2>
            
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              Our advanced AI understands natural language. Simply speak or type your symptoms, and our intelligent system extracts, categorizes, and prioritizes your health concerns automatically.
            </p>

            <div className="space-y-4">
              <IntakeFeature
                icon={<MessageCircle size={24} />}
                title="Natural Conversation"
                description="Speak as you would to a doctor—no complex forms or medical jargon required"
              />
              <IntakeFeature
                icon={<BrainCircuit size={24} />}
                title="AI Analysis"
                description="Advanced NLP extracts key symptoms, severity, and context automatically"
              />
              <IntakeFeature
                icon={<CheckCircle size={24} />}
                title="Instant Triage"
                description="Get immediate assessment and appropriate care recommendations"
              />
            </div>
          </div>

          <div className="relative">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
              <div className="bg-slate-900 rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <Mic size={16} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-slate-700 rounded-full w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-700 rounded-full w-1/2"></div>
                    </div>
                  </div>
                  <div className="bg-blue-500/20 rounded-lg p-4">
                    <p className="text-sm text-blue-200 mb-2">AI Analysis:</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-400" />
                        <span className="text-sm">Headache identified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-400" />
                        <span className="text-sm">Fever severity: Moderate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-400" />
                        <span className="text-sm">Duration: 3 days</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface IntakeFeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function IntakeFeature({ icon, title, description }: IntakeFeatureProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <p className="text-blue-100">{description}</p>
      </div>
    </div>
  );
}
