'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import AppointmentCard from '@/components/app/AppointmentCard';
import { adminNavigation } from '@/lib/navigation';
import { mockAppointments } from '@/lib/mock-data';

export default function AdminAppointments() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={adminNavigation} role="admin" userName="Admin User" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="All Appointments" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Appointment Management"
            subtitle="View and manage all appointments"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockAppointments.map((appointment) => (
              <AppointmentCard 
                key={appointment.id} 
                appointment={appointment}
                onViewDetails={(id) => console.log('View details:', id)}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
