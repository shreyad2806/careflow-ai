'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import CareTimeline from '@/components/app/CareTimeline';
import { patientNavigation } from '@/lib/navigation';
import { mockCareTimeline } from '@/lib/mock-data';
import { cancelAppointment } from '@/lib/actions/appointments';
import {
  Calendar, Clock, User, FileText, Phone, Mail,
  AlertTriangle, CheckCircle, Video, Trash2, RefreshCw,
  Loader2, XCircle, AlertCircle,
} from 'lucide-react';
import type { Appointment } from '@/lib/types';

// ============================================================
// Props
// ============================================================

interface AppointmentDetailContentProps {
  appointment: Appointment;
  patientId: string;
  userName: string;
}

// ============================================================
// Component
// ============================================================

export default function AppointmentDetailContent({
  appointment,
  patientId,
  userName,
}: AppointmentDetailContentProps) {
  const router = useRouter();

  // --- Cancellation state ---
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelResult, setCancelResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // --- Local appointment state (for optimistic UI after cancel) ---
  const [currentAppointment, setCurrentAppointment] = useState(appointment);
  const isCancellable =
    currentAppointment.status === 'scheduled' || currentAppointment.status === 'confirmed';

  // --- Cancel handler ---
  const handleCancel = useCallback(async () => {
    setCancelLoading(true);
    setCancelResult(null);

    try {
      const result = await cancelAppointment(currentAppointment.id, patientId);

      if (result.ok) {
        setCancelResult({ type: 'success', message: result.message });
        // Optimistic update — mark as cancelled locally
        setCurrentAppointment(prev => ({ ...prev, status: 'cancelled' as const }));
        setShowCancelModal(false);
        // Refresh the page data after a short delay
        setTimeout(() => {
          router.refresh();
        }, 500);
      } else {
        setCancelResult({ type: 'error', message: result.message });
      }
    } catch {
      setCancelResult({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setCancelLoading(false);
    }
  }, [currentAppointment.id, patientId, router]);

  // --- Reschedule handler — navigate to booking in reschedule mode ---
  const handleReschedule = useCallback(() => {
    router.push(
      `/patient/booking?reschedule=${currentAppointment.id}`
    );
  }, [currentAppointment.id, router]);

  // --- Timeline data ---
  const appointmentTimeline = mockCareTimeline.slice(0, 5);

  // --- AI Pre-Visit Summary (mock) ---
  const aiPreVisitSummary = {
    chiefComplaint: currentAppointment.reason || 'No reason provided',
    suggestedQuestions: [
      'Do the symptoms occur at a specific time of day?',
      'Have you noticed any triggers like certain foods or stress?',
      'Is there any family history related to this condition?',
    ],
    recommendations:
      'Consider keeping a symptom diary to track patterns and triggers before your appointment.',
  };

  return (
    <DashboardLayout
      navigation={patientNavigation}
      role="patient"
      userName={userName}
      headerTitle="Appointment Details"
      showSearch={false}
    >
      <PageHeader
        title="Appointment Details"
        subtitle={`Appointment with ${currentAppointment.doctorName}`}
      />

      {/* Cancellation result banner */}
      {cancelResult && (
        <div
          className={`mb-6 flex items-center gap-3 p-4 rounded-lg border ${
            cancelResult.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {cancelResult.type === 'success' ? (
            <CheckCircle size={20} className="flex-shrink-0" />
          ) : (
            <AlertCircle size={20} className="flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{cancelResult.message}</span>
          <button
            onClick={() => setCancelResult(null)}
            className="ml-auto flex-shrink-0"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Appointment Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Appointment Information</CardTitle>
                <UrgencyBadge urgency={currentAppointment.urgency} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="text-slate-400 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-sm text-slate-500">Doctor</p>
                    <p className="font-medium text-slate-900">
                      {currentAppointment.doctorName}
                    </p>
                    <p className="text-sm text-slate-600">
                      {currentAppointment.specialty}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="text-slate-400 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-sm text-slate-500">Date</p>
                    <p className="font-medium text-slate-900">
                      {currentAppointment.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="text-slate-400 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-sm text-slate-500">Time</p>
                    <p className="font-medium text-slate-900">
                      {currentAppointment.time} ({currentAppointment.duration} min)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="text-slate-400 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-sm text-slate-500">Reason</p>
                    <p className="font-medium text-slate-900">
                      {currentAppointment.reason || 'No reason provided'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Status:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                      currentAppointment.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : currentAppointment.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-700'
                        : currentAppointment.status === 'completed'
                        ? 'bg-slate-100 text-slate-700'
                        : currentAppointment.status === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {currentAppointment.status}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Pre-Visit Summary — only for active appointments */}
          {currentAppointment.status !== 'completed' &&
            currentAppointment.status !== 'cancelled' && (
              <Card className="border-purple-200">
                <CardHeader>
                  <CardTitle>AI Pre-Visit Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-slate-900 mb-2">
                      Chief Complaint
                    </h4>
                    <p className="text-sm text-slate-700">
                      {aiPreVisitSummary.chiefComplaint}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">
                      Suggested Questions for Your Doctor
                    </h4>
                    <div className="space-y-2">
                      {aiPreVisitSummary.suggestedQuestions.map(
                        (question, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                          >
                            <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                              {index + 1}
                            </span>
                            <p className="text-sm text-slate-700">{question}</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        size={16}
                        className="text-blue-600 flex-shrink-0 mt-0.5"
                      />
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-1">
                          Recommendation
                        </h4>
                        <p className="text-sm text-blue-800">
                          {aiPreVisitSummary.recommendations}
                        </p>
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
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isCancellable ? (
                <>
                  <Button className="w-full">
                    <Video size={18} className="mr-2" />
                    Join Consultation
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleReschedule}
                  >
                    <RefreshCw size={18} className="mr-2" />
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:text-red-700 hover:border-red-300"
                    onClick={() => {
                      setShowCancelModal(true);
                      setCancelResult(null);
                    }}
                  >
                    <Trash2 size={18} className="mr-2" />
                    Cancel Appointment
                  </Button>
                </>
              ) : currentAppointment.status === 'completed' ? (
                <>
                  <Button className="w-full">
                    <CheckCircle size={18} className="mr-2" />
                    Book Follow-up
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => router.push('/patient/booking')}
                >
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

      {/* ===== Cancel Confirmation Modal ===== */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Cancel Appointment
                </h3>
                <p className="text-sm text-slate-500">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to cancel your appointment with{' '}
              <strong>{currentAppointment.doctorName}</strong> on{' '}
              <strong>{currentAppointment.date}</strong> at{' '}
              <strong>{currentAppointment.time}</strong>?
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelResult(null);
                }}
                disabled={cancelLoading}
              >
                Keep Appointment
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCancel}
                disabled={cancelLoading}
              >
                {cancelLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Cancelling...
                  </span>
                ) : (
                  'Yes, Cancel'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
