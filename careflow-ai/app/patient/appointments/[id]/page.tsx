'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import CareTimeline from '@/components/app/CareTimeline';
import { patientNavigation } from '@/lib/navigation';
import { mockAppointments, mockCareTimeline } from '@/lib/mock-data';
import { Calendar, Clock, User, FileText, Phone, Mail, AlertTriangle, CheckCircle, Video, CalendarPlus } from 'lucide-react';

export default function AppointmentDetail({ params }: { params: { id: string } }) {
  const appointment = mockAppointments.find(a => a.id === params.id) || mockAppointments[0];

  const aiPreVisitSummary = {
    chiefComplaint: 'Persistent headaches with associated symptoms',
    urgency: appointment.urgency,
    suggestedQuestions: [
      'Do the headaches occur at a specific time of day?',
      'Have you noticed any triggers like certain foods or stress?',
      'Is there any family history of migraines or headaches?'
    ],
    recommendations: 'Consider keeping a headache diary to track patterns and triggers before your appointment.'
  };

  const appointmentTimeline = mockCareTimeline.slice(0, 5);

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
              {/* Appointment Information */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Appointment Information</CardTitle>
                    <UrgencyBadge urgency={appointment.urgency} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="text-slate-400" size={20} />
                      <div>
                        <p className="text-sm text-slate-500">Doctor</p>
                        <p className="font-medium text-slate-900">{appointment.doctorName}</p>
                        <p className="text-sm text-slate-600">{appointment.specialty}</p>
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Status:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        appointment.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        appointment.status === 'completed' ? 'bg-slate-100 text-slate-700' :
                        appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {appointment.status}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Pre-Visit Summary */}
              {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
                <Card className="border-purple-200">
                  <CardHeader>
                    <CardTitle>AI Pre-Visit Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-semibold text-slate-900 mb-2">Chief Complaint</h4>
                      <p className="text-sm text-slate-700">{aiPreVisitSummary.chiefComplaint}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3">Suggested Questions for Your Doctor</h4>
                      <div className="space-y-2">
                        {aiPreVisitSummary.suggestedQuestions.map((question, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                            <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                              {index + 1}
                            </span>
                            <p className="text-sm text-slate-700">{question}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-blue-900 mb-1">Recommendation</h4>
                          <p className="text-sm text-blue-800">{aiPreVisitSummary.recommendations}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Care Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Care Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <CareTimeline events={appointmentTimeline} />
                </CardContent>
              </Card>

              {/* Appointment Notes */}
              {appointment.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Appointment Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600">{appointment.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Actions Sidebar */}
            <div className="space-y-6">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {appointment.status === 'confirmed' || appointment.status === 'scheduled' ? (
                    <>
                      <Button className="w-full">
                        <Video size={18} className="mr-2" />
                        Join Consultation
                      </Button>
                      <Button variant="outline" className="w-full">
                        Reschedule
                      </Button>
                      <Button variant="outline" className="w-full">
                        <CalendarPlus size={18} className="mr-2" />
                        Add to Calendar
                      </Button>
                      <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:border-red-300">
                        Cancel Appointment
                      </Button>
                    </>
                  ) : appointment.status === 'completed' ? (
                    <>
                      <Button className="w-full">
                        <CheckCircle size={18} className="mr-2" />
                        Book Follow-up
                      </Button>
                      <Button variant="outline" className="w-full">
                        View Summary
                      </Button>
                      <Button variant="outline" className="w-full">
                        <CalendarPlus size={18} className="mr-2" />
                        Add to Calendar
                      </Button>
                    </>
                  ) : (
                    <Button className="w-full">
                      Book New Appointment
                    </Button>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Contact Support</CardTitle>
                </CardHeader>
                <CardContent>
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
