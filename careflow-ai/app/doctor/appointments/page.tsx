'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { doctorNavigation } from '@/lib/navigation';
import { mockAppointments } from '@/lib/mock-data';
import { getDemoDoctorName } from '@/lib/config/demo-identity';
import { Calendar, Clock, Video, FileText } from 'lucide-react';

export default function DoctorAppointments() {
  const doctorName = getDemoDoctorName();
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');

  const filteredAppointments = filter === 'all' 
    ? mockAppointments 
    : filter === 'today' || filter === 'upcoming'
    ? mockAppointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed')
    : mockAppointments.filter(a => a.status === 'completed');

  return (
    <DashboardLayout
      navigation={doctorNavigation}
      role="doctor"
      userName={doctorName}
      headerTitle="Appointments"
    >
      <PageHeader 
        title="All Appointments"
        subtitle="Manage your patient appointments"
      />
      
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(['all', 'today', 'upcoming', 'completed'] as const).map((filterType) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {filteredAppointments.map((appointment) => (
          <Card key={appointment.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-slate-900">{appointment.patientName}</h3>
                    <UrgencyBadge urgency={appointment.urgency} />
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-1">{appointment.reason}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar size={16} className="flex-shrink-0" />
                  <span>{appointment.date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock size={16} className="flex-shrink-0" />
                  <span>{appointment.time} ({appointment.duration} min)</span>
                </div>
              </div>

              <div className="flex gap-2">
                {appointment.status === 'confirmed' || appointment.status === 'scheduled' ? (
                  <Link href={`/doctor/consultation/${appointment.id}`} className="flex-1">
                    <Button size="sm" className="w-full">
                      <Video size={16} className="mr-2" />
                      Start
                    </Button>
                  </Link>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1">
                    <FileText size={16} className="mr-2" />
                    Summary
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
