'use client';

import React from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import { doctorNavigation } from '@/lib/navigation';
import { mockPatients, mockAppointments } from '@/lib/mock-data';
import { getDemoDoctorName } from '@/lib/config/demo-identity';
import { Phone, Calendar, Clock, FileText } from 'lucide-react';

export default function DoctorPatients() {
  const doctorName = getDemoDoctorName();
  const getPatientAppointments = (patientId: string) => {
    return mockAppointments.filter(a => a.patientId === patientId);
  };

  return (
    <DashboardLayout
      navigation={doctorNavigation}
      role="doctor"
      userName={doctorName}
      headerTitle="Patients"
    >
      <PageHeader 
        title="Patient Records"
        subtitle="View and manage patient information"
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {mockPatients.map((patient) => {
          const patientAppointments = getPatientAppointments(patient.id);
          const latestAppointment = patientAppointments[0];
          
          return (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">
                        {patient.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate">{patient.name}</CardTitle>
                      <p className="text-sm text-slate-600 truncate">{patient.email}</p>
                    </div>
                  </div>
                  {latestAppointment && <UrgencyBadge urgency={latestAppointment.urgency} />}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={14} className="flex-shrink-0" />
                    <span className="truncate">{patient.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar size={14} className="flex-shrink-0" />
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
                    <p className="text-sm text-slate-900 line-clamp-1">{latestAppointment.reason}</p>
                    <p className="text-xs text-slate-600">{latestAppointment.date} at {latestAppointment.time}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {latestAppointment ? (
                    <Link href={`/doctor/consultation/${latestAppointment.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <FileText size={16} className="mr-2" />
                        View Details
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" size="sm" className="flex-1" disabled>
                      <FileText size={16} className="mr-2" />
                      No Appointments
                    </Button>
                  )}
                  {latestAppointment && (latestAppointment.status === 'confirmed' || latestAppointment.status === 'scheduled') && (
                    <Link href={`/doctor/consultation/${latestAppointment.id}`} className="flex-1">
                      <Button size="sm" className="w-full">
                        Start Consultation
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
