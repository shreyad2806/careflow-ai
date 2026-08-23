'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import { patientNavigation } from '@/lib/navigation';
import { mockDoctors } from '@/lib/mock-data';
import { Calendar, Clock, User, Languages, CheckCircle, AlertCircle, Timer } from 'lucide-react';

const TIME_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', 
  '11:00 AM', '11:30 AM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM'
];

const getNext7Days = () => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      date: date.toISOString().split('T')[0],
      display: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    });
  }
  return days;
};

export default function PatientBooking() {
  const router = useRouter();
  const [selectedDoctor, setSelectedDoctor] = useState(mockDoctors[0]);
  const [selectedDate, setSelectedDate] = useState(getNext7Days()[0].date);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [slotHeld, setSlotHeld] = useState(false);
  const [holdTimeRemaining, setHoldTimeRemaining] = useState(300);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const availableDates = getNext7Days();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (slotHeld && holdTimeRemaining > 0) {
      interval = setInterval(() => {
        setHoldTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (holdTimeRemaining === 0 && slotHeld) {
      setSlotHeld(false);
      setSelectedSlot('');
    }
    return () => clearInterval(interval);
  }, [slotHeld, holdTimeRemaining]);

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    setSlotHeld(true);
    setHoldTimeRemaining(300);
  };

  const handleConfirmBooking = () => {
    setBookingConfirmed(true);
    setTimeout(() => {
      router.push('/patient/appointments');
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (bookingConfirmed) {
    return (
      <DashboardLayout navigation={patientNavigation} role="patient" userName="John Smith" headerTitle="Book Appointment">
        <div className="max-w-2xl mx-auto">
          <Card className="border-2 border-green-200">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h2>
              <p className="text-slate-600 mb-6">Your appointment has been successfully scheduled.</p>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-800">Redirecting to your appointments...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigation={patientNavigation} role="patient" userName="John Smith" headerTitle="Book Appointment">
      <PageHeader 
        title="Book an Appointment"
        subtitle="Select a doctor and choose your preferred time"
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doctor Selection & Date/Time */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Doctor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockDoctors.slice(0, 5).map((doctor) => (
                  <div 
                    key={doctor.id}
                    onClick={() => setSelectedDoctor(doctor)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedDoctor.id === doctor.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">
                            {doctor.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{doctor.name}</p>
                          <p className="text-sm text-slate-600">{doctor.specialty}</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-slate-700 flex-shrink-0">${doctor.consultationFee}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Select Date</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableDates.map((day) => (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDate(day.date)}
                      className={`p-2 sm:p-3 rounded-lg text-center transition-colors ${
                        selectedDate === day.date
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <p className="text-xs font-medium">{day.display.split(',')[0]}</p>
                      <p className="text-xs sm:text-sm">{day.display.split(' ')[1]} {day.display.split(' ')[2]}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Available Time Slots</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleSlotSelect(slot)}
                      disabled={slotHeld && selectedSlot !== slot}
                      className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        selectedSlot === slot
                          ? 'bg-green-600 text-white'
                          : slotHeld && selectedSlot !== slot
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {slotHeld && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Timer size={16} className="text-amber-600" />
                  <span className="text-sm text-amber-800">
                    Slot temporarily reserved - {formatTime(holdTimeRemaining)} remaining
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Reason for Visit</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your symptoms or reason for visit..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Urgency Level</label>
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
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">
                    {selectedDoctor.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{selectedDoctor.name}</p>
                  <p className="text-sm text-slate-600">{selectedDoctor.specialty}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-600">Date:</span>
                  <span className="font-medium text-slate-900 truncate">
                    {availableDates.find(d => d.date === selectedDate)?.display}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-600">Time:</span>
                  <span className="font-medium text-slate-900">{selectedSlot || 'Not selected'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Consultation Fee</span>
                  <span className="font-semibold text-slate-900">${selectedDoctor.consultationFee}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Urgency</span>
                  <UrgencyBadge urgency={urgency} />
                </div>
              </div>

              <Button
                onClick={handleConfirmBooking}
                disabled={!selectedSlot || !reason.trim()}
                className="w-full"
              >
                Confirm Appointment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
