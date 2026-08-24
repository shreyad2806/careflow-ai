'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { adminNavigation } from '@/lib/navigation';
import { Calendar, Clock, AlertTriangle, CheckCircle, XCircle, Loader2, BrainCircuit } from 'lucide-react';
import type { Doctor, LeaveRequest } from '@/lib/types';

// ============================================================
// Props
// ============================================================

interface Props {
  doctors: Doctor[];
  leaves: LeaveRequest[];
  userName: string;
}

// ============================================================
// Affected appointment type (from API)
// ============================================================

interface AffectedAppointment {
  appointmentId: string;
  patientId: string;
  date: string;
  time: string;
  status: string;
}

// ============================================================
// Component
// ============================================================

export default function AdminLeavesContent({ doctors, leaves, userName }: Props) {
  const router = useRouter();

  // --- Form state ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // --- Conflict check state ---
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflictResult, setConflictResult] = useState<{
    checked: boolean;
    appointments: AffectedAppointment[];
  }>({ checked: false, appointments: [] });

  // --- Leave creation state ---
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{
    success: boolean;
    message: string;
    affectedCount?: number;
    notificationsCreated?: number;
  } | null>(null);

  // ============================================================
  // Check conflicts (preview affected appointments)
  // ============================================================

  const handleCheckConflicts = useCallback(async () => {
    if (!selectedDoctor || !startDate || !endDate) return;

    setCheckingConflicts(true);
    setConflictResult({ checked: false, appointments: [] });
    setCreateResult(null);

    try {
      const params = new URLSearchParams({
        doctorId: selectedDoctor,
        startDate,
        endDate,
      });

      const response = await fetch(`/api/admin/leaves/affected?${params}`);
      const json = await response.json();

      if (json.ok) {
        setConflictResult({ checked: true, appointments: json.appointments });
        console.log(`[LeaveConflict] ✅ Conflict check: ${json.appointments.length} affected appointments`);
      } else {
        setConflictResult({ checked: true, appointments: [] });
        console.error(`[LeaveConflict] ❌ Conflict check failed: ${json.message}`);
      }
    } catch (err) {
      setConflictResult({ checked: true, appointments: [] });
      console.error(`[LeaveConflict] ❌ Conflict check error: ${err}`);
    } finally {
      setCheckingConflicts(false);
    }
  }, [selectedDoctor, startDate, endDate]);

  // ============================================================
  // Create leave
  // ============================================================

  const handleCreateLeave = useCallback(async () => {
    if (!selectedDoctor || !startDate || !endDate) return;

    setCreating(true);
    setCreateResult(null);

    try {
      const response = await fetch('/api/admin/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctor,
          startDate,
          endDate,
          reason: reason.trim() || undefined,
          status: 'approved',
        }),
      });

      const json = await response.json();

      if (json.ok) {
        setCreateResult({
          success: true,
          message: `Leave created successfully. ${json.affectedAppointments} appointment(s) affected, ${json.notificationsCreated} notification(s) created.`,
          affectedCount: json.affectedAppointments,
          notificationsCreated: json.notificationsCreated,
        });
        console.log(
          `[LeaveConflict] ✅ Leave created: id=${json.leaveId} ` +
            `affected=${json.affectedAppointments} notifications=${json.notificationsCreated} ` +
            `holdsReleased=${json.holdsReleased}`
        );

        // Reset form
        setSelectedDoctor('');
        setStartDate('');
        setEndDate('');
        setReason('');
        setConflictResult({ checked: false, appointments: [] });
        setShowAddForm(false);

        // Refresh server data
        router.refresh();
      } else {
        setCreateResult({
          success: false,
          message: json.message || 'Failed to create leave.',
        });
        console.error(`[LeaveConflict] ❌ Leave creation failed: ${json.error}`);
      }
    } catch (err) {
      setCreateResult({
        success: false,
        message: 'An unexpected error occurred.',
      });
      console.error(`[LeaveConflict] ❌ Leave creation error: ${err}`);
    } finally {
      setCreating(false);
    }
  }, [selectedDoctor, startDate, endDate, reason, router]);

  // ============================================================
  // Close form
  // ============================================================

  const handleCloseForm = useCallback(() => {
    setShowAddForm(false);
    setConflictResult({ checked: false, appointments: [] });
    setCreateResult(null);
    setSelectedDoctor('');
    setStartDate('');
    setEndDate('');
    setReason('');
  }, []);

  // ============================================================
  // Render
  // ============================================================

  const selectedDoctorName = doctors.find(d => d.id === selectedDoctor)?.name || '';

  return (
    <DashboardLayout
      navigation={adminNavigation}
      role="admin"
      userName={userName}
      headerTitle="Leave Management"
    >
      <PageHeader
        title="Leave Management"
        subtitle="Manage doctor leave periods and view affected appointments"
        action={{ label: 'Add Leave', onClick: () => setShowAddForm(true) }}
      />

      {/* --- Create Result Banner --- */}
      {createResult && (
        <div
          className={`mb-6 flex items-center gap-3 p-4 rounded-lg border ${
            createResult.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {createResult.success ? (
            <CheckCircle size={20} className="flex-shrink-0" />
          ) : (
            <AlertTriangle size={20} className="flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">{createResult.message}</p>
            {createResult.success && createResult.affectedCount !== undefined && createResult.affectedCount > 0 && (
              <p className="text-xs mt-1 opacity-75">
                Affected patients have been notified. Appointments are NOT automatically cancelled.
              </p>
            )}
          </div>
          <button onClick={() => setCreateResult(null)} className="flex-shrink-0">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* --- Add Leave Form --- */}
      {showAddForm && (
        <Card className="mb-6 border-2 border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Add Doctor Leave</CardTitle>
              <button onClick={handleCloseForm} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Doctor</label>
                <select
                  value={selectedDoctor}
                  onChange={e => {
                    setSelectedDoctor(e.target.value);
                    setConflictResult({ checked: false, appointments: [] });
                  }}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Choose a doctor...</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialty}
                    </option>
                  ))}
                </select>
                {doctors.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No doctors found in the database.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value);
                    setConflictResult({ checked: false, appointments: [] });
                  }}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => {
                    setEndDate(e.target.value);
                    setConflictResult({ checked: false, appointments: [] });
                  }}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Reason (optional)</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Reason for leave..."
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              {!conflictResult.checked ? (
                <>
                  <Button
                    onClick={handleCheckConflicts}
                    disabled={!selectedDoctor || !startDate || !endDate || checkingConflicts}
                  >
                    {checkingConflicts ? (
                      <><Loader2 size={16} className="mr-2 animate-spin" />Checking...</>
                    ) : (
                      'Check Conflicts'
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleCloseForm}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleCreateLeave}
                    disabled={creating}
                  >
                    {creating ? (
                      <><Loader2 size={16} className="mr-2 animate-spin" />Creating...</>
                    ) : (
                      <><CheckCircle size={16} className="mr-2" />Approve Leave</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setConflictResult({ checked: false, appointments: [] })}>
                    Back
                  </Button>
                  <Button variant="outline" onClick={handleCloseForm}>Cancel</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- Conflict Preview --- */}
      {conflictResult.checked && conflictResult.appointments.length > 0 && (
        <Card className="mb-6 border-2 border-orange-200">
          <CardHeader>
            <CardTitle className="text-orange-900 flex items-center gap-2">
              <AlertTriangle size={20} className="text-orange-600" />
              Conflict Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-orange-900 font-medium">
                {conflictResult.appointments.length} existing appointment(s) will be affected
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Patients will be notified. Appointments will NOT be automatically cancelled.
              </p>
            </div>
            <div className="space-y-2">
              {conflictResult.appointments.map(apt => (
                <div key={apt.appointmentId} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Patient {apt.patientId.slice(0, 8)}...</p>
                    <p className="text-xs text-slate-600">{apt.date} at {apt.time}</p>
                  </div>
                  <span className="text-xs text-slate-500 capitalize">{apt.status.toLowerCase()}</span>
                </div>
              ))}
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <BrainCircuit size={16} className="text-blue-600" />
                <p className="text-sm text-blue-800">
                  Click &quot;Approve Leave&quot; to confirm. Notifications will be sent to {conflictResult.appointments.length} patient(s).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {conflictResult.checked && conflictResult.appointments.length === 0 && (
        <Card className="mb-6 border-2 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle size={24} className="text-green-600" />
              <div>
                <p className="font-medium text-green-900">No Conflicts Found</p>
                <p className="text-sm text-green-700">
                  The selected leave period does not conflict with any existing appointments.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- Existing Leaves List --- */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Existing Leave Records</h2>
        <p className="text-sm text-slate-600">{leaves.length} leave record(s)</p>
      </div>

      {leaves.length > 0 ? (
        <div className="space-y-4">
          {leaves.map(leave => (
            <Card key={leave.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">
                        {leave.doctorName.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{leave.doctorName}</h3>
                      <div className="flex items-center gap-1 mt-1 text-sm text-slate-600">
                        <Calendar size={14} />
                        <span>{leave.startDate} — {leave.endDate}</span>
                      </div>
                      {leave.reason && (
                        <p className="text-sm text-slate-600 mt-2">{leave.reason}</p>
                      )}
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                        <Clock size={12} />
                        <span>Created: {leave.requestedAt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-start sm:items-end">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        leave.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : leave.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {leave.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No leave records</h3>
            <p className="text-slate-600">Click &quot;Add Leave&quot; to create a doctor leave period.</p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
