'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import DoctorCard from '@/components/app/DoctorCard';
import { patientNavigation } from '@/lib/navigation';
import { mockDoctors } from '@/lib/mock-data';

export default function PatientDoctors() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={patientNavigation} role="patient" userName="John Smith" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Find Doctors" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Find Doctors"
            subtitle="Browse our network of healthcare professionals"
            action={{
              label: 'Filter',
              onClick: () => console.log('Filter clicked'),
            }}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockDoctors.map((doctor) => (
              <DoctorCard 
                key={doctor.id} 
                doctor={doctor}
                onBook={(id) => console.log('Book doctor:', id)}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
