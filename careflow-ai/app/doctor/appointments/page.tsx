'use client';

import React, { useState } from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import AppointmentCard from '@/components/app/AppointmentCard';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { doctorNavigation } from '@/lib/navigation';
import { mockAppointments } from '@/lib/mock-data';
import { Calendar, Clock, User, Video, FileText, Filter } from 'lucide-react';

export default function DoctorAppointments() {
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');

  const todayAppointments = mockAppointments.filter(a => 
    a.status === 'scheduled' || a.status === 'confirmed'
  );

  const upcomingAppointments = mockAppointments.filter(a => 
    a.status === 'scheduled' || a.status === 'confirmed'
  );

  const completedAppointments = mockAppointments.filter(a => a.status === 'completed');

  const filteredAppointments = filter === 'all' 
    ? mockAppointments 
    : filter === 'today' 
    ? todayAppointments 
    : filter === 'upcoming'
    ? upcomingAppointments
    : completedAppointments;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={doctorNavigation} role="doctor" userName="Dr. Sarah Johnson" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Appointments" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="All Appointments"
            subtitle="Manage your patient appointments"
          />
          
          <div className="mb-6 flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
              {(['all', 'today', 'upcoming', 'completed'] as const).map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                    filter === filterType
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {filterType}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAppointments.map((appointment) => (
              <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">{appointment.patientName}</h3>
                        <UrgencyBadge urgency={appointment.urgency} />
                      </div>
                      <p className="text-sm text-slate-600">{appointment.reason}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={16} />
                      <span>{appointment.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock size={16} />
                      <span>{appointment.time} ({appointment.duration} min)</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {appointment.status === 'confirmed' || appointment.status === 'scheduled' ? (
                      <Button size="sm" className="flex-1">
                        <Video size={16} className="mr-2" />
                        Start
                      </Button>
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
        </main>
      </div>
    </div>
  );
}
