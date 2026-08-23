'use client';

import React, { useState } from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { adminNavigation } from '@/lib/navigation';
import { mockLeaveRequests, mockAppointments, mockDoctors } from '@/lib/mock-data';
import { Calendar, User, Clock, AlertTriangle, Plus, CheckCircle, XCircle, Mail, RefreshCw } from 'lucide-react';

export default function AdminLeaves() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [showConflicts, setShowConflicts] = useState(false);

  const getAffectedAppointments = (doctorId: string, start: string, end: string) => {
    return mockAppointments.filter(appointment => {
      if (appointment.doctorId !== doctorId) return false;
      // Simple date comparison - in real app would be more sophisticated
      return appointment.status === 'scheduled' || appointment.status === 'confirmed';
    });
  };

  const handleAddLeave = () => {
    if (selectedDoctor && startDate && endDate) {
      setShowConflicts(true);
    }
  };

  const affectedAppointments = showConflicts && selectedDoctor && startDate && endDate
    ? getAffectedAppointments(selectedDoctor, startDate, endDate)
    : [];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={adminNavigation} role="admin" userName="Admin User" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Leave Management" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Leave Requests"
            subtitle="Review and manage doctor leave requests"
            action={{
              label: 'Add Leave',
              onClick: () => setShowAddForm(true),
            }}
          />
          
          {/* Add Leave Form */}
          {showAddForm && (
            <Card className="mb-6 border-2 border-blue-200">
              <CardHeader>
                <CardTitle>Add Doctor Leave</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Select Doctor</label>
                    <select
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose a doctor...</option>
                      {mockDoctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Reason</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Reason for leave..."
                    />
                  </div>
                </div>

                {!showConflicts ? (
                  <div className="flex gap-3">
                    <Button onClick={handleAddLeave} disabled={!selectedDoctor || !startDate || !endDate}>
                      Check Conflicts
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowConflicts(false)}>
                      Back
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Conflict Warning */}
          {showConflicts && affectedAppointments.length > 0 && (
            <Card className="mb-6 border-2 border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-900 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-orange-600" />
                  Conflict Detected
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-orange-900 font-medium mb-1">
                    {affectedAppointments.length} existing appointment{affectedAppointments.length !== 1 ? 's' : ''} may be affected
                  </p>
                  <p className="text-sm text-orange-700">
                    The selected leave period conflicts with scheduled appointments. Please choose how to handle these conflicts.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Affected Appointments:</p>
                  {affectedAppointments.map((appointment) => (
                    <div key={appointment.id} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{appointment.patientName}</p>
                        <p className="text-xs text-slate-600">{appointment.date} at {appointment.time}</p>
                      </div>
                      <span className="text-xs text-slate-500">{appointment.specialty}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Choose Action:</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button variant="outline" className="justify-start">
                      <Mail size={18} className="mr-2" />
                      Notify Affected Patients
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <RefreshCw size={18} className="mr-2" />
                      Reschedule Appointments
                    </Button>
                    <Button variant="outline" className="justify-start text-red-600 hover:bg-red-50">
                      <XCircle size={18} className="mr-2" />
                      Cancel Appointments
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <Button className="flex-1">
                    <CheckCircle size={18} className="mr-2" />
                    Approve Leave & Apply Actions
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {showConflicts && affectedAppointments.length === 0 && (
            <Card className="mb-6 border-2 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle size={24} className="text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">No Conflicts Found</p>
                    <p className="text-sm text-green-700">The selected leave period does not conflict with any existing appointments.</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button className="flex-1">
                    <CheckCircle size={18} className="mr-2" />
                    Approve Leave
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Leave Requests */}
          <div className="space-y-4">
            {mockLeaveRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">
                          {request.doctorName.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{request.doctorName}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{request.startDate} - {request.endDate}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mt-2">{request.reason}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                          <Clock size={12} />
                          <span>Requested: {request.requestedAt}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        request.status === 'approved' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {request.status}
                      </span>
                      {request.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <Button variant="primary" size="sm">
                            Approve
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
