'use client';

import React from 'react';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import CareTimeline from '@/components/app/CareTimeline';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { patientNavigation } from '@/lib/navigation';
import { mockCareTimeline } from '@/lib/mock-data';
import { getDemoPatientName } from '@/lib/config/demo-identity';

export default function PatientTimeline() {
  const patientName = getDemoPatientName();
  const completedEvents = mockCareTimeline.filter(e => e.status === 'completed');
  const upcomingEvents = mockCareTimeline.filter(e => e.status === 'upcoming' || e.status === 'pending');

  return (
    <DashboardLayout
      navigation={patientNavigation}
      role="patient"
      userName={patientName}
      headerTitle="Care Timeline"
    >
      <PageHeader 
        title="Care Timeline"
        subtitle="Your complete health journey timeline"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>All Events</CardTitle>
            </CardHeader>
            <CardContent>
              <CareTimeline events={mockCareTimeline} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.map(event => (
                    <div key={event.id} className="p-3 bg-blue-50 rounded-lg">
                      <p className="font-medium text-slate-900 text-sm">{event.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{event.description}</p>
                      <p className="text-xs text-blue-600 mt-1">{event.date}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No upcoming events</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total Events</span>
                  <span className="font-medium text-slate-900">{mockCareTimeline.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Completed</span>
                  <span className="font-medium text-green-600">{completedEvents.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Upcoming</span>
                  <span className="font-medium text-blue-600">{upcomingEvents.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
