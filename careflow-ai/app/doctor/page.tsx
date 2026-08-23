'use client';

import React from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/app/DashboardLayout';
import StatCard from '@/components/app/StatCard';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { doctorNavigation } from '@/lib/navigation';
import { mockAppointments } from '@/lib/mock-data';
import { Calendar, Users, Clock, CheckCircle, AlertTriangle, Video, FileText, Stethoscope } from 'lucide-react';

export default function DoctorDashboard() {
  const todayAppointments = mockAppointments.filter(a => 
    a.status === 'scheduled' || a.status === 'confirmed'
  );

  const highUrgencyAppointments = mockAppointments.filter(a => a.urgency === 'high' || a.urgency === 'critical');
  const pendingFollowUps = mockAppointments.filter(a => a.status === 'completed').slice(0, 3);

  return (
    <DashboardLayout
      navigation={doctorNavigation}
      role="doctor"
      userName="Dr. Sarah Johnson"
      headerTitle="Doctor Dashboard"
    >
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Welcome back, Dr. Sarah!</h1>
        <p className="text-base lg:text-lg text-slate-600">
          You have {todayAppointments.length} appointment{todayAppointments.length !== 1 ? 's' : ''} today.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
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
          title="Pending Follow-ups"
          value={pendingFollowUps.length}
          change="Requires attention"
          changeType="neutral"
          icon={CheckCircle}
          iconColor="text-purple-600"
        />
        <StatCard
          title="High Urgency"
          value={highUrgencyAppointments.length}
          change="Needs review"
          changeType="neutral"
          icon={AlertTriangle}
          iconColor="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Today's Schedule */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Today's Schedule</CardTitle>
                <Link href="/doctor/appointments">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayAppointments.slice(0, 3).map((appointment) => (
                  <div key={appointment.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-slate-900">{appointment.patientName}</p>
                        <UrgencyBadge urgency={appointment.urgency} />
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-1">{appointment.reason}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {appointment.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText size={12} />
                          {appointment.specialty}
                        </span>
                      </div>
                    </div>
                    <Link href={`/doctor/consultation/${appointment.id}`}>
                      <Button size="sm">
                        <Video size={16} className="mr-2" />
                        Start
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/doctor/patients" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Users size={18} className="mr-2" />
                View Patients
              </Button>
            </Link>
            <Link href="/doctor/appointments" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Calendar size={18} className="mr-2" />
                All Appointments
              </Button>
            </Link>
            <Link href="/doctor/consultation/1" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Stethoscope size={18} className="mr-2" />
                Start Consultation
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* High Urgency Patients */}
      {highUrgencyAppointments.length > 0 && (
        <Card className="mb-8 border-orange-200">
          <CardHeader>
            <CardTitle className="text-orange-900">High Urgency Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {highUrgencyAppointments.slice(0, 2).map((appointment) => (
                <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-orange-50 rounded-lg">
                  <div className="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={20} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{appointment.patientName}</p>
                    <p className="text-sm text-slate-600 line-clamp-1">{appointment.reason}</p>
                  </div>
                  <UrgencyBadge urgency={appointment.urgency} />
                  <Link href={`/doctor/consultation/${appointment.id}`}>
                    <Button size="sm">Review</Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patient AI Summaries */}
      <Card>
        <CardHeader>
          <CardTitle>Patient AI Summaries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todayAppointments.slice(0, 2).map((appointment) => (
              <div key={appointment.id} className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-slate-900">{appointment.patientName}</p>
                  <span className="text-xs text-purple-600">AI Analysis Ready</span>
                </div>
                <p className="text-sm text-slate-600 mb-2">
                  Chief complaint: {appointment.reason}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">View Summary</Button>
                  <Link href={`/doctor/consultation/${appointment.id}`}>
                    <Button size="sm">Start Consultation</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
