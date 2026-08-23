'use client';

import React from 'react';
import Link from 'next/link';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import StatCard from '@/components/app/StatCard';
import AppointmentCard from '@/components/app/AppointmentCard';
import CareTimeline from '@/components/app/CareTimeline';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import { patientNavigation } from '@/lib/navigation';
import { mockAppointments, mockPatients, mockCareTimeline } from '@/lib/mock-data';
import { Calendar, Users, Clock, Activity, Stethoscope, BrainCircuit, ArrowRight, Pill, Video, CheckCircle, AlertCircle } from 'lucide-react';

export default function PatientDashboard() {
  const patient = mockPatients[0];
  const upcomingAppointments = mockAppointments.filter(a => 
    a.status === 'scheduled' || a.status === 'confirmed'
  ).slice(0, 1);
  
  const nextAppointment = upcomingAppointments[0];
  const recentAppointments = mockAppointments.filter(a => a.status === 'completed').slice(0, 3);
  const recentTimelineEvents = mockCareTimeline.slice(0, 4);
  const nextAppointmentDate = nextAppointment?.date || 'None';

  const medications = [
    { name: 'Lisinopril 10mg', frequency: 'Once daily', nextReminder: '8:00 AM today' },
    { name: 'Metformin 500mg', frequency: 'Twice daily', nextReminder: '12:00 PM today' },
  ];

  const healthInsight = {
    title: 'Blood Pressure Monitoring',
    insight: 'Your blood pressure readings have been stable this week. Continue with your current medication and lifestyle routine.',
    followUp: 'Next check-up: August 26, 2024',
    recommendation: 'Maintain current dosage. Consider increasing daily walking to 30 minutes.',
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={patientNavigation} role="patient" userName={patient.name} />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Patient Dashboard" />
        
        <main className="p-6 pt-20">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome back, {patient.name.split(' ')[0]}!
            </h1>
            <p className="text-lg text-slate-600">
              Your health journey is on track. You have {upcomingAppointments.length} upcoming appointment{upcomingAppointments.length !== 1 ? 's' : ''}.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Upcoming Appointments"
              value={upcomingAppointments.length}
              change={`Next: ${nextAppointmentDate}`}
              changeType="neutral"
              icon={Calendar}
              iconColor="text-blue-600"
            />
            <StatCard
              title="Active Medications"
              value={medications.length}
              change="All on schedule"
              changeType="positive"
              icon={Pill}
              iconColor="text-green-600"
            />
            <StatCard
              title="Care Timeline Events"
              value={mockCareTimeline.length}
              change="2 new this week"
              changeType="positive"
              icon={Activity}
              iconColor="text-purple-600"
            />
            <StatCard
              title="Health Score"
              value="92"
              change="+3 from last month"
              changeType="positive"
              icon={CheckCircle}
              iconColor="text-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Upcoming Appointment Card */}
            <div className="lg:col-span-2">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900 mb-1">Next Appointment</h2>
                      <p className="text-sm text-slate-600">Your upcoming consultation</p>
                    </div>
                    {nextAppointment && <UrgencyBadge urgency={nextAppointment.urgency} />}
                  </div>
                  
                  {nextAppointment ? (
                    <div className="flex items-center gap-6 p-4 bg-blue-50 rounded-lg">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <Stethoscope size={32} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900">{nextAppointment.doctorName}</h3>
                        <p className="text-sm text-slate-600">{nextAppointment.specialty}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {nextAppointment.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {nextAppointment.time}
                          </span>
                        </div>
                      </div>
                      <Button>
                        <Video size={18} className="mr-2" />
                        Join
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-lg text-center">
                      <p className="text-slate-600">No upcoming appointments</p>
                      <Link href="/patient/booking">
                        <Button variant="outline" size="sm" className="mt-2">
                          Book Appointment
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Link href="/patient/doctors">
                    <button className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors text-left">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Stethoscope size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Find a Doctor</p>
                        <p className="text-xs text-slate-600">Browse specialists</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-400" />
                    </button>
                  </Link>
                  
                  <Link href="/patient/symptoms">
                    <button className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-purple-50 rounded-lg transition-colors text-left">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <BrainCircuit size={20} className="text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">AI Symptom Check</p>
                        <p className="text-xs text-slate-600">Get instant insights</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-400" />
                    </button>
                  </Link>
                  
                  <Link href="/patient/appointments">
                    <button className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-green-50 rounded-lg transition-colors text-left">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Calendar size={20} className="text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">View Appointments</p>
                        <p className="text-xs text-slate-600">Manage schedule</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-400" />
                    </button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* AI Care Insights */}
            <Card className="border-purple-200">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BrainCircuit size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>AI Care Insights</CardTitle>
                    <p className="text-sm text-slate-500">Personalized health recommendations</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-2">{healthInsight.title}</h4>
                  <p className="text-sm text-slate-600">{healthInsight.insight}</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Follow-up</p>
                      <p className="text-xs text-slate-600">{healthInsight.followUp}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Recommendation</p>
                      <p className="text-xs text-slate-600">{healthInsight.recommendation}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Medication Reminders */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Pill size={24} className="text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Medication Reminders</CardTitle>
                    <p className="text-sm text-slate-500">Stay on track with your medications</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {medications.map((med, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Pill size={18} className="text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{med.name}</p>
                        <p className="text-xs text-slate-600">{med.frequency}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">{med.nextReminder}</p>
                        <p className="text-xs text-green-600">Next dose</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Appointments */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Appointments</CardTitle>
                  <Link href="/patient/appointments">
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-slate-600">
                          {appointment.doctorName.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{appointment.doctorName}</p>
                        <p className="text-xs text-slate-600">{appointment.specialty}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-900">{appointment.date}</p>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                          {appointment.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Care Timeline Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Care Timeline</CardTitle>
                  <Link href="/patient/timeline">
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <CareTimeline events={recentTimelineEvents} />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
