'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import AppointmentCard from '@/components/app/AppointmentCard';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { patientNavigation } from '@/lib/navigation';
import { mockAppointments } from '@/lib/mock-data';
import { Calendar } from 'lucide-react';

export default function PatientAppointments() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  const upcomingAppointments = mockAppointments.filter(a => 
    a.status === 'scheduled' || a.status === 'confirmed'
  );

  const pastAppointments = mockAppointments.filter(a => 
    a.status === 'completed' || a.status === 'cancelled'
  );

  const filteredAppointments = filter === 'all' 
    ? mockAppointments 
    : filter === 'upcoming' 
    ? upcomingAppointments 
    : pastAppointments;

  return (
    <DashboardLayout
      navigation={patientNavigation}
      role="patient"
      userName="John Smith"
      headerTitle="My Appointments"
    >
      <PageHeader 
        title="My Appointments"
        subtitle="Manage your upcoming and past appointments"
      />
      
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(['all', 'upcoming', 'past'] as const).map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === filterType
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {filterType}
          </button>
        ))}
      </div>

      {filteredAppointments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {filteredAppointments.map((appointment) => (
            <Link key={appointment.id} href={`/patient/appointments/${appointment.id}`}>
              <AppointmentCard 
                appointment={appointment}
                onViewDetails={() => {}}
              />
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No appointments found</h3>
            <p className="text-slate-600 mb-6">
              {filter === 'upcoming' ? 'You have no upcoming appointments.' : 
               filter === 'past' ? 'You have no past appointments.' : 
               'You have no appointments yet.'}
            </p>
            <Link href="/patient/booking">
              <Button>Book an Appointment</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
