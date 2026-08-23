'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import { doctorNavigation } from '@/lib/navigation';
import { mockPatients, mockAppointments } from '@/lib/mock-data';
import { User, Mail, Phone, Calendar, AlertTriangle, Clock, FileText } from 'lucide-react';

export default function DoctorPatients() {
  const getPatientAppointments = (patientId: string) => {
    return mockAppointments.filter(a => a.patientId === patientId);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={doctorNavigation} role="doctor" userName="Dr. Sarah Johnson" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Patients" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Patient Records"
            subtitle="View and manage patient information"
            action={{
              label: 'Add Patient',
              onClick: () => console.log('Add patient'),
            }}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {mockPatients.map((patient) => {
              const patientAppointments = getPatientAppointments(patient.id);
              const latestAppointment = patientAppointments[0];
              
              return (
                <Card key={patient.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">
                            {patient.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <CardTitle className="text-lg">{patient.name}</CardTitle>
                          <p className="text-sm text-slate-600">{patient.email}</p>
                        </div>
                      </div>
                      {latestAppointment && <UrgencyBadge urgency={latestAppointment.urgency} />}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone size={14} />
                        <span className="truncate">{patient.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar size={14} />
                        <span>DOB: {patient.dateOfBirth}</span>
                      </div>
                    </div>

                    {patient.chronicConditions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Chronic Conditions</p>
                        <div className="flex flex-wrap gap-1">
                          {patient.chronicConditions.map((condition, i) => (
                            <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs">
                              {condition}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {patient.allergies.length > 0 && patient.allergies[0] !== 'None' && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Allergies</p>
                        <div className="flex flex-wrap gap-1">
                          {patient.allergies.map((allergy, i) => (
                            <span key={i} className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs">
                              {allergy}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {latestAppointment && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock size={14} className="text-slate-500" />
                          <span className="text-xs font-medium text-slate-700">Latest Appointment</span>
                        </div>
                        <p className="text-sm text-slate-900">{latestAppointment.reason}</p>
                        <p className="text-xs text-slate-600">{latestAppointment.date} at {latestAppointment.time}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <FileText size={16} className="mr-2" />
                        View Details
                      </Button>
                      {latestAppointment && (latestAppointment.status === 'confirmed' || latestAppointment.status === 'scheduled') && (
                        <Button size="sm" className="flex-1">
                          Start Consultation
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
