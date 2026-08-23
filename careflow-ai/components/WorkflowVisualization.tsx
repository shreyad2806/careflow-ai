import React from 'react';
import { ArrowRight, Brain, FileText, Calendar, UserCheck, Activity } from 'lucide-react';

export default function WorkflowVisualization() {
  return (
    <section className="py-20 px-4 md:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Intelligent Healthcare Workflow
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            From symptom intake to treatment planning, AI powers every step of the patient journey
          </p>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-blue-200 via-blue-500 to-blue-200 transform -translate-y-1/2 z-0"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative z-10">
            <WorkflowStep
              icon={<Brain size={32} />}
              title="AI Symptom Analysis"
              description="Voice-powered intake with intelligent symptom extraction"
              step="1"
            />
            <WorkflowStep
              icon={<FileText size={32} />}
              title="Digital Records"
              description="Automated documentation and EMR integration"
              step="2"
            />
            <WorkflowStep
              icon={<Calendar size={32} />}
              title="Smart Scheduling"
              description="AI-optimized appointment booking and triage"
              step="3"
            />
            <WorkflowStep
              icon={<UserCheck size={32} />}
              title="Doctor Review"
              description="Physician oversight with AI-assisted insights"
              step="4"
            />
            <WorkflowStep
              icon={<Activity size={32} />}
              title="Continuous Care"
              description="Ongoing monitoring and personalized follow-ups"
              step="5"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

interface WorkflowStepProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  step: string;
}

function WorkflowStep({ icon, title, description, step }: WorkflowStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
        {icon}
      </div>
      <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold mb-3">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}
