'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import StatCard from '@/components/app/StatCard';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { adminNavigation } from '@/lib/navigation';
import { mockDoctors, mockAppointments, mockLeaveRequests, mockPatients } from '@/lib/mock-data';
import { Users, Calendar, Clock, AlertCircle, TrendingUp, Activity, XCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const pendingLeaves = mockLeaveRequests.filter(l => l.status === 'pending').length;
  const todayAppointments = mockAppointments.filter(a => 
    a.status === 'scheduled' || a.status === 'confirmed'
  ).length;
  const cancelledAppointments = mockAppointments.filter(a => a.status === 'cancelled').length;
  const completedAppointments = mockAppointments.filter(a => a.status === 'completed').length;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={adminNavigation} role="admin" userName="Admin User" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Admin Dashboard" />
        
        <main className="p-6 pt-20">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
            <p className="text-lg text-slate-600">Overview of CareFlow AI operations</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Patients"
              value={mockPatients.length}
              change="+12 this week"
              changeType="positive"
              icon={Users}
              iconColor="text-blue-600"
            />
            <StatCard
              title="Total Doctors"
              value={mockDoctors.length}
              change="All active"
              changeType="positive"
              icon={Activity}
              iconColor="text-green-600"
            />
            <StatCard
              title="Today's Appointments"
              value={todayAppointments}
              change="On schedule"
              changeType="positive"
              icon={Calendar}
              iconColor="text-purple-600"
            />
            <StatCard
              title="Pending Leaves"
              value={pendingLeaves}
              change="Needs review"
              changeType="negative"
              icon={Clock}
              iconColor="text-orange-600"
            />
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Completed Appointments</p>
                    <p className="text-2xl font-bold text-slate-900">{completedAppointments}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle size={24} className="text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Cancelled Appointments</p>
                    <p className="text-2xl font-bold text-slate-900">{cancelledAppointments}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle size={24} className="text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">AI Analyses</p>
                    <p className="text-2xl font-bold text-slate-900">156</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <TrendingUp size={24} className="text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-slate-600">New appointment booked with Dr. Sarah Johnson</span>
                    <span className="text-slate-400 ml-auto">2m ago</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-600">Dr. Emily Rodriguez requested leave</span>
                    <span className="text-slate-400 ml-auto">1h ago</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-slate-600">Patient John Smith completed care plan</span>
                    <span className="text-slate-400 ml-auto">3h ago</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-slate-600">AI symptom analysis completed for 3 patients</span>
                    <span className="text-slate-400 ml-auto">5h ago</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-slate-600">Appointment cancelled by patient</span>
                    <span className="text-slate-400 ml-auto">6h ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href="/admin/doctors" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <Users size={18} className="mr-2" />
                      Manage Doctors
                    </Button>
                  </Link>
                  <Link href="/admin/appointments" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar size={18} className="mr-2" />
                      View Appointments
                    </Button>
                  </Link>
                  <Link href="/admin/leaves" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <Clock size={18} className="mr-2" />
                      Review Leave Requests
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full justify-start">
                    <Activity size={18} className="mr-2" />
                    View Reports
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cancellation Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Cancellation Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-600 mb-1">This Week</p>
                  <p className="text-2xl font-bold text-red-900">3</p>
                  <p className="text-xs text-red-600">2 by patients, 1 by doctors</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-orange-600 mb-1">This Month</p>
                  <p className="text-2xl font-bold text-orange-900">12</p>
                  <p className="text-xs text-orange-600">8 by patients, 4 by doctors</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Cancellation Rate</p>
                  <p className="text-2xl font-bold text-slate-900">4.2%</p>
                  <p className="text-xs text-slate-600">Below industry average</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
