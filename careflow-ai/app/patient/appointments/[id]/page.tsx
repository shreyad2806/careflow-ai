'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { patientNavigation } from '@/lib/navigation';
import { mockAppointments } from '@/lib/mock-data';
import { Calendar, Clock, User, FileText, Phone, Mail } from 'lucide-react';

export default function AppointmentDetail({ params }: { params: { id: string } }) {
  const appointment = mockAppointments.find(a => a.id === params.id) || mockAppointments[0];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={patientNavigation} role="patient" userName="John Smith" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Appointment Details" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Appointment Details"
            subtitle={`Appointment with ${appointment.doctorName}`}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Appointment Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="text-slate-400" size={20} />
                      <div>
                        <p className="text-sm text-slate-500">Doctor</p>
                        <p className="font-medium text-slate-900">{appointment.doctorName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="text-slate-400" size={20} />
                      <div>
                        <p className="text-sm text-slate-500">Date</p>
                        <p className="font-medium text-slate-900">{appointment.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="text-slate-400" size={20} />
                      <div>
                        <p className="text-sm text-slate-500">Time</p>
                        <p className="font-medium text-slate-900">{appointment.time} ({appointment.duration} min)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText className="text-slate-400" size={20} />
                      <div>
                        <p className="text-sm text-slate-500">Reason</p>
                        <p className="font-medium text-slate-900">{appointment.reason}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {appointment.notes && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Notes</h3>
                    <p className="text-slate-600">{appointment.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
            
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Actions</h3>
                  <div className="space-y-3">
                    <Button variant="primary" className="w-full">
                      Reschedule
                    </Button>
                    <Button variant="outline" className="w-full">
                      Cancel Appointment
                    </Button>
                    <Button variant="outline" className="w-full">
                      Add to Calendar
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Contact Support</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={16} />
                      <span>+1 (555) 123-4567</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={16} />
                      <span>support@careflow.ai</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
