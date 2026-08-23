'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import StatCard from '@/components/app/StatCard';
import Card, { CardContent } from '@/components/ui/Card';
import { adminNavigation } from '@/lib/navigation';
import { mockDoctors, mockAppointments, mockLeaveRequests } from '@/lib/mock-data';
import { Users, Calendar, Clock, AlertCircle } from 'lucide-react';

export default function AdminDashboard() {
  const pendingLeaves = mockLeaveRequests.filter(l => l.status === 'pending').length;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={adminNavigation} role="admin" userName="Admin User" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Admin Dashboard" />
        
        <main className="p-6 pt-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Doctors"
              value={mockDoctors.length}
              change="Active"
              changeType="neutral"
              icon={Users}
              iconColor="text-blue-600"
            />
            <StatCard
              title="Total Appointments"
              value={mockAppointments.length}
              change="This month"
              changeType="neutral"
              icon={Calendar}
              iconColor="text-green-600"
            />
            <StatCard
              title="Pending Leaves"
              value={pendingLeaves}
              change="Needs attention"
              changeType="negative"
              icon={Clock}
              iconColor="text-orange-600"
            />
            <StatCard
              title="System Status"
              value="Healthy"
              change="All systems operational"
              changeType="positive"
              icon={AlertCircle}
              iconColor="text-purple-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
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
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                    <p className="font-medium text-slate-900">Add New Doctor</p>
                    <p className="text-sm text-slate-600">Register a new healthcare provider</p>
                  </button>
                  <button className="w-full px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                    <p className="font-medium text-slate-900">View Reports</p>
                    <p className="text-sm text-slate-600">Generate system reports</p>
                  </button>
                  <button className="w-full px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                    <p className="font-medium text-slate-900">Manage Settings</p>
                    <p className="text-sm text-slate-600">Configure system preferences</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
