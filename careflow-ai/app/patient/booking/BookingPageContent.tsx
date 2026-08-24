'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import { patientNavigation } from '@/lib/navigation';
import { fetchAvailableSlots, requestHold, releaseHold } from '@/lib/actions/slots';
import { confirmAppointment } from '@/lib/actions/bookings';
import { cancelAppointment } from '@/lib/actions/appointments';
import type { SlotGenerationResult, AvailableSlot } from '@/lib/services/availability';
import type { HoldResult } from '@/lib/services/slot-holds';
import type { Doctor } from '@/lib/types';
import {
  Calendar, Clock, User, CheckCircle, AlertCircle, Timer,
  Loader2, ShieldCheck, ShieldAlert,
} from 'lucide-react';

// ============================================================
// Props
// ============================================================

interface BookingPageContentProps {
  userName: string;
  patientId: string;
  doctors: Doctor[];
  rescheduleAppointment?: {
    id: string;
    doctorId: string;
    doctorName: string;
    date: string;
    time: string;
    reason: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  } | null;
}

// ============================================================
// Helpers
// ============================================================

const getNext7Days = () => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      date: date.toISOString().split('T')[0],
      display: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    });
  }
  return days;
};

function formatSlotTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatHoldTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Seconds remaining until the given ISO timestamp */
function secondsUntil(isoTimestamp: string): number {
  const diff = new Date(isoTimestamp).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

// ============================================================
// Component
// ============================================================

export default function BookingPageContent({
  userName,
  patientId,
  doctors,
  rescheduleAppointment,
}: BookingPageContentProps) {
  const router = useRouter();
  const availableDates = getNext7Days();
  const isReschedule = !!rescheduleAppointment;

  // --- Pre-select doctor for reschedule mode ---
  const initialDoctor = isReschedule
    ? doctors.find(d => d.id === rescheduleAppointment.doctorId) ?? doctors[0] ?? null
    : doctors[0] ?? null;

  // --- State ---
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(initialDoctor);
  const [selectedDate, setSelectedDate] = useState(availableDates[0].date);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [reason, setReason] = useState(isReschedule ? rescheduleAppointment.reason : '');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>(
    (isReschedule ? rescheduleAppointment.urgency : 'medium') as 'low' | 'medium' | 'high'
  );
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Slot data from server
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Hold state
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [holdTimeRemaining, setHoldTimeRemaining] = useState(0);
  const [holdLoading, setHoldLoading] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const holdIdRef = useRef<string | null>(null);

  // --- Fetch slots when doctor or date changes ---
  const loadSlots = useCallback(async () => {
    if (!selectedDoctor) return;

    setSlotsLoading(true);
    setSlotsError(null);
    // Don't clear hold here — we handle that in handleDateSelect/handleDoctorSelect

    try {
      const result: SlotGenerationResult = await fetchAvailableSlots(
        selectedDoctor.id,
        selectedDate
      );

      if (result.ok) {
        setSlots(result.slots);
        setSlotsError(null);
      } else {
        setSlots([]);
        setSlotsError(result.message);
      }
    } catch {
      setSlots([]);
      setSlotsError('Failed to load available slots. Please try again.');
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedDoctor, selectedDate]);

  // Trigger slot loading when doctor/date changes
  // Using setTimeout to avoid synchronous setState in effect
  useEffect(() => {
    const id = setTimeout(() => {
      loadSlots();
    }, 0);
    return () => clearTimeout(id);
  }, [loadSlots]);

  // --- Hold countdown timer (driven by real expiresAt) ---
  useEffect(() => {
    if (!holdExpiresAt) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    // Defer initial setState to avoid synchronous update in effect
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      const remaining = secondsUntil(holdExpiresAt);
      setHoldTimeRemaining(remaining);

      if (remaining <= 0) {
        setHoldId(null);
        setHoldExpiresAt(null);
        setSelectedSlot(null);
        loadSlots();
        return;
      }

      intervalId = setInterval(() => {
        if (cancelled) return;
        const r = secondsUntil(holdExpiresAt);
        setHoldTimeRemaining(r);
        if (r <= 0) {
          clearInterval(intervalId);
          setHoldId(null);
          setHoldExpiresAt(null);
          setSelectedSlot(null);
          loadSlots();
        }
      }, 1000);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [holdExpiresAt, loadSlots]);

  // --- Cleanup hold on unmount ---
  useEffect(() => {
    return () => {
      const currentHoldId = holdIdRef.current;
      if (currentHoldId && patientId) {
        // Fire-and-forget release on unmount
        releaseHold(currentHoldId, patientId).catch(() => {});
      }
    };
  }, [patientId]);

  // --- Handlers ---

  const releaseCurrentHold = useCallback(async () => {
    const currentHoldId = holdIdRef.current;
    if (currentHoldId && patientId) {
      await releaseHold(currentHoldId, patientId).catch(() => {});
      holdIdRef.current = null;
      setHoldId(null);
      setHoldExpiresAt(null);
    }
  }, [patientId]);

  const handleDoctorSelect = useCallback(async (doctor: Doctor) => {
    if (doctor.id === selectedDoctor?.id) return;
    await releaseCurrentHold();
    setSelectedDoctor(doctor);
    setSelectedSlot(null);
  }, [selectedDoctor, releaseCurrentHold]);

  const handleDateSelect = useCallback(async (date: string) => {
    if (date === selectedDate) return;
    await releaseCurrentHold();
    setSelectedDate(date);
    setSelectedSlot(null);
  }, [selectedDate, releaseCurrentHold]);

  const handleSlotSelect = useCallback(async (slot: AvailableSlot) => {
    if (!patientId) {
      setHoldError('Patient identity not loaded. Please refresh the page.');
      return;
    }
    if (!selectedDoctor) return;

    // Release previous hold if any
    await releaseCurrentHold();

    setHoldLoading(true);
    setHoldError(null);

    try {
      const result: HoldResult = await requestHold(
        selectedDoctor.id,
        patientId,
        selectedDate,
        slot.startTime + ':00',
        slot.endTime + ':00'
      );

      if (result.ok) {
        setSelectedSlot(slot);
        setHoldId(result.holdId);
        holdIdRef.current = result.holdId;
        setHoldExpiresAt(result.expiresAt);
        setHoldError(null);
        // Refresh slots to show this one is now held
        loadSlots();
      } else {
        setSelectedSlot(null);
        setHoldId(null);
        holdIdRef.current = null;
        setHoldExpiresAt(null);
        // Map domain errors to user-friendly messages
        switch (result.error) {
          case 'SLOT_ALREADY_HELD':
            setHoldError('This slot is already held by another patient. Please choose a different time.');
            break;
          case 'SLOT_NOT_AVAILABLE':
            setHoldError('This slot is no longer available. It may have been booked.');
            break;
          case 'HOLD_ALREADY_EXISTS':
            setHoldError('You already have an active hold on this slot.');
            break;
          case 'DOCTOR_ON_LEAVE':
            setHoldError('This doctor is on leave for this date.');
            break;
          default:
            setHoldError(result.message);
        }
        // Refresh slots to show updated availability
        loadSlots();
      }
    } catch {
      setHoldError('Failed to reserve slot. Please try again.');
    } finally {
      setHoldLoading(false);
    }
  }, [patientId, selectedDoctor, selectedDate, releaseCurrentHold, loadSlots]);

  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const handleConfirmBooking = useCallback(async () => {
    if (!holdId) {
      setHoldError('No active hold. Please select a slot again.');
      return;
    }
    if (!patientId) {
      setHoldError('Patient identity not loaded. Please refresh the page.');
      return;
    }

    setConfirmLoading(true);
    setConfirmError(null);

    try {
      // Server-side validation + atomic confirmation
      const result = await confirmAppointment(
        holdId,
        patientId,
        reason.trim() || 'No reason provided',
        urgency
      );

      if (result.ok) {
        // If rescheduling, cancel the old appointment after new booking succeeds
        if (isReschedule && rescheduleAppointment && patientId) {
          await cancelAppointment(rescheduleAppointment.id, patientId).catch((err) => {
            console.error('[Booking] Failed to cancel old appointment during reschedule:', err);
          });
        }
        // Success — show confirmation and redirect
        setBookingConfirmed(true);
        holdIdRef.current = null;
        setHoldId(null);
        setHoldExpiresAt(null);
        setTimeout(() => {
          router.push('/patient/appointments');
        }, 3000);
      } else {
        // Map domain errors to user-friendly messages
        switch (result.error) {
          case 'HOLD_EXPIRED':
            setConfirmError('Your hold has expired. Please select a new slot.');
            break;
          case 'HOLD_NOT_FOUND':
            setConfirmError('Your hold was not found. Please select a new slot.');
            break;
          case 'UNAUTHORIZED_HOLD':
            setConfirmError('This hold belongs to another patient. Please select a new slot.');
            break;
          case 'SLOT_ALREADY_BOOKED':
            setConfirmError('This slot was just booked by someone else. Please choose a different time.');
            break;
          case 'DOCTOR_UNAVAILABLE':
            setConfirmError('The doctor is no longer available for this time.');
            break;
          case 'BOOKING_CONFLICT':
            setConfirmError('A scheduling conflict was detected. Please choose a different time.');
            break;
          default:
            setConfirmError(result.message || 'Booking failed. Please try again.');
        }
        // Release the failed hold and reset
        if (holdId) {
          await releaseHold(holdId, patientId).catch(() => {});
        }
        holdIdRef.current = null;
        setHoldId(null);
        setHoldExpiresAt(null);
        setSelectedSlot(null);
        loadSlots();
      }
    } catch {
      setConfirmError('An unexpected error occurred. Please try again.');
    } finally {
      setConfirmLoading(false);
    }
  }, [holdId, patientId, reason, urgency, loadSlots, router, isReschedule, rescheduleAppointment]);

  // --- Confirmed state ---
  if (bookingConfirmed) {
    return (
      <DashboardLayout
        navigation={patientNavigation}
        role="patient"
        userName={userName}
        headerTitle={isReschedule ? 'Reschedule Appointment' : 'Book Appointment'}
      >
        <div className="max-w-2xl mx-auto">
          <Card className="border-2 border-green-200">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {isReschedule ? 'Reschedule Complete!' : 'Booking Confirmed!'}
              </h2>
              <p className="text-slate-600 mb-6">
                {isReschedule
                  ? 'Your appointment has been successfully rescheduled.'
                  : 'Your appointment has been successfully scheduled.'}
              </p>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-800">Redirecting to your appointments...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // --- Main render ---
  return (
    <DashboardLayout
      navigation={patientNavigation}
      role="patient"
      userName={userName}
      headerTitle="Book Appointment"
    >
      <PageHeader
        title={isReschedule ? 'Reschedule Appointment' : 'Book an Appointment'}
        subtitle={isReschedule ? `Select a new time for your appointment with ${rescheduleAppointment?.doctorName}` : 'Select a doctor and choose your preferred time'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doctor Selection & Date/Time */}
        <div className="lg:col-span-2 space-y-6">
          {/* Doctor List */}
          <Card>
            <CardHeader>
              <CardTitle>Select Doctor</CardTitle>
            </CardHeader>
            <CardContent>
              {doctors.length === 0 ? (
                <div className="text-center py-8">
                  <User size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No doctors available at this time.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {doctors.map((doctor) => (
                    <div
                      key={doctor.id}
                      onClick={() => handleDoctorSelect(doctor)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedDoctor?.id === doctor.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">
                              {doctor.name.split(' ').map((n) => n[0]).join('')}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{doctor.name}</p>
                            <p className="text-sm text-slate-600">{doctor.specialty}</p>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-slate-700 flex-shrink-0">
                          ${doctor.consultationFee}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Date & Time Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Select Date
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableDates.map((day) => (
                    <button
                      key={day.date}
                      onClick={() => handleDateSelect(day.date)}
                      className={`p-2 sm:p-3 rounded-lg text-center transition-colors ${
                        selectedDate === day.date
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <p className="text-xs font-medium">{day.display.split(',')[0]}</p>
                      <p className="text-xs sm:text-sm">
                        {day.display.split(' ')[1]} {day.display.split(' ')[2]}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Available Time Slots
                </label>

                {slotsLoading ? (
                  <div className="flex items-center gap-3 p-6 bg-slate-50 rounded-lg">
                    <Loader2 size={20} className="animate-spin text-blue-600" />
                    <span className="text-sm text-slate-600">Loading available slots...</span>
                  </div>
                ) : slotsError ? (
                  <div className="flex items-center gap-3 p-6 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">No slots available</p>
                      <p className="text-xs text-amber-600 mt-1">{slotsError}</p>
                    </div>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-lg">
                    <Clock size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No time slots available for this date.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.startTime}
                        onClick={() => handleSlotSelect(slot)}
                        disabled={holdLoading || (holdId !== null && selectedSlot?.startTime !== slot.startTime)}
                        className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                          selectedSlot?.startTime === slot.startTime
                            ? 'bg-green-600 text-white'
                            : holdLoading
                            ? 'bg-slate-100 text-slate-400 cursor-wait'
                            : holdId !== null && selectedSlot?.startTime !== slot.startTime
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {formatSlotTime(slot.startTime)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hold Error */}
              {holdError && (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <ShieldAlert size={16} className="text-red-600 flex-shrink-0" />
                  <span className="text-sm text-red-800">{holdError}</span>
                </div>
              )}

              {/* Active Hold Timer — driven by real server-side expiration */}
              {holdId && holdTimeRemaining > 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex-shrink-0">
                    {holdTimeRemaining > 60 ? (
                      <ShieldCheck size={18} className="text-green-600" />
                    ) : (
                      <Timer size={18} className="text-amber-600 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm text-amber-800">
                      Slot reserved for you —{' '}
                      <span className="font-mono font-bold">{formatHoldTimer(holdTimeRemaining)}</span>
                      {' '}remaining
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-20 h-2 bg-amber-200 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        holdTimeRemaining > 60 ? 'bg-green-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${(holdTimeRemaining / 300) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Hold expired message */}
              {!holdId && selectedSlot && !holdLoading && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <AlertCircle size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-600">
                    Your hold expired. Click the slot again to reserve it.
                  </span>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Reason for Visit
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your symptoms or reason for visit..."
                />
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Urgency Level
                </label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setUrgency(level)}
                      className={`flex-1 p-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                        urgency === level
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Booking Summary */}
        <div>
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDoctor && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {selectedDoctor.name.split(' ').map((n) => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{selectedDoctor.name}</p>
                    <p className="text-sm text-slate-600">{selectedDoctor.specialty}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-600">Date:</span>
                  <span className="font-medium text-slate-900 truncate">
                    {availableDates.find((d) => d.date === selectedDate)?.display}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-600">Time:</span>
                  <span className="font-medium text-slate-900">
                    {selectedSlot ? formatSlotTime(selectedSlot.startTime) : 'Not selected'}
                  </span>
                </div>
                {holdId && holdTimeRemaining > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck size={16} className="text-green-600 flex-shrink-0" />
                    <span className="text-green-700 font-medium">Slot reserved</span>
                  </div>
                )}
              </div>

              {selectedDoctor && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Consultation Fee</span>
                    <span className="font-semibold text-slate-900">
                      ${selectedDoctor.consultationFee}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Urgency</span>
                  <UrgencyBadge urgency={urgency} />
                </div>
              </div>

              {/* Confirmation Error */}
              {confirmError && (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <ShieldAlert size={16} className="text-red-600 flex-shrink-0" />
                  <span className="text-sm text-red-800">{confirmError}</span>
                </div>
              )}

              <Button
                onClick={handleConfirmBooking}
                disabled={!holdId || !reason.trim() || holdTimeRemaining <= 0 || confirmLoading}
                className="w-full"
              >
                {confirmLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Confirming...
                  </span>
                ) : holdLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Reserving...
                  </span>
                ) : !holdId ? (
                  'Select a Time Slot'
                ) : (
                  isReschedule ? 'Confirm Reschedule' : 'Confirm Appointment'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
