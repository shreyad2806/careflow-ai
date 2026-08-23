'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import { adminNavigation } from '@/lib/navigation';
import { mockAppointments } from '@/lib/mock-data';
import { Search } from 'lucide-react';

export default function AdminAppointments() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAppointments = mockAppointments.filter(appointment => {
    const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus;
    const matchesUrgency = filterUrgency === 'all' || appointment.urgency === filterUrgency;
    const matchesSearch = searchQuery === '' || 
      appointment.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointment.doctorName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesUrgency && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-slate-100 text-slate-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'in-progress': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <DashboardLayout
      navigation={adminNavigation}
      role="admin"
      userName="Admin User"
      headerTitle="All Appointments"
    >
      <PageHeader 
        title="Appointment Management"
        subtitle="View and manage all appointments"
      />
      
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search appointments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value as any)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Urgency</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>All Appointments ({filteredAppointments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Patient</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Doctor</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Date & Time</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Urgency</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appointment) => (
                  <tr key={appointment.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 font-medium text-xs">
                            {appointment.patientName.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{appointment.patientName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{appointment.doctorName}</td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-slate-900">{appointment.date}</div>
                      <div className="text-xs text-slate-600">{appointment.time}</div>
                    </td>
                    <td className="py-3 px-4"><UrgencyBadge urgency={appointment.urgency} /></td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">View</Button>
                        {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
                          <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">Cancel</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {filteredAppointments.map((appointment) => (
          <Card key={appointment.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-xs">
                      {appointment.patientName.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <span className="font-medium text-slate-900">{appointment.patientName}</span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(appointment.status)}`}>
                  {appointment.status}
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-1">Dr. {appointment.doctorName}</p>
              <p className="text-sm text-slate-600">{appointment.date} at {appointment.time}</p>
              <div className="mt-3 flex gap-2">
                <UrgencyBadge urgency={appointment.urgency} />
                <Button variant="outline" size="sm">View</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
