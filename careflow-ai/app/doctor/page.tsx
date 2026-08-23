'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import StatCard from '@/components/app/StatCard';
import AppointmentCard from '@/components/app/AppointmentCard';
import { doctorNavigation } from '@/lib/navigation';
import { mockAppointments } from '@/lib/mock-data';
import { Calendar, Users, Clock, CheckCircle } from 'lucide-react';

export default function DoctorDashboard() {
  const todayAppointments = mockAppointments.filter(a => 
    a.status === 'scheduled' || a.status === 'confirmed'
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={doctorNavigation} role="doctor" userName="Dr. Sarah Johnson" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Doctor Dashboard" />
        
        <main className="p-6 pt-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Today's Appointments"
              value={todayAppointments.length}
              change="3 remaining"
              changeType="neutral"
              icon={Calendar}
              iconColor="text-blue-600"
            />
            <StatCard
              title="Total Patients"
              value="24"
              change="+2 this week"
              changeType="positive"
              icon={Users}
              iconColor="text-green-600"
            />
            <StatCard
              title="Completed Today"
              value="5"
              change="On track"
              changeType="positive"
              icon={CheckCircle}
              iconColor="text-purple-600"
            />
            <StatCard
              title="Avg Consultation"
              value="18"
              change="minutes"
              changeType="neutral"
              icon={Clock}
              iconColor="text-orange-600"
            />
          </div>

          <h2 className="text-xl font-semibold text-slate-900 mb-4">Today's Schedule</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {todayAppointments.map((appointment) => (
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
