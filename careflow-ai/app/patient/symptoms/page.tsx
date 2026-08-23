'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import AIInsightCard from '@/components/app/AIInsightCard';
import { patientNavigation } from '@/lib/navigation';
import { mockSymptomAnalysis } from '@/lib/mock-data';

export default function PatientSymptoms() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={patientNavigation} role="patient" userName="John Smith" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="AI Symptom Check" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="AI Symptom Analysis"
            subtitle="Get AI-powered insights about your symptoms"
          />
          
          <div className="max-w-3xl">
            <AIInsightCard analysis={mockSymptomAnalysis} />
          </div>
        </main>
      </div>
    </div>
  );
}
