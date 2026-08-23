'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { patientNavigation } from '@/lib/navigation';
import { mockDoctors } from '@/lib/mock-data';

export default function PatientBooking() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={patientNavigation} role="patient" userName="John Smith" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Book Appointment" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Book an Appointment"
            subtitle="Select a doctor and choose your preferred time"
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Select Doctor</h3>
                <div className="space-y-3">
                  {mockDoctors.slice(0, 4).map((doctor) => (
                    <div 
                      key={doctor.id}
                      className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{doctor.name}</p>
                          <p className="text-sm text-slate-600">{doctor.specialty}</p>
                        </div>
                        <span className="text-sm text-slate-500">${doctor.consultationFee}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Select Date & Time</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Time</label>
                    <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>9:00 AM</option>
                      <option>10:00 AM</option>
                      <option>11:00 AM</option>
                      <option>2:00 PM</option>
                      <option>3:00 PM</option>
                      <option>4:00 PM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Reason for Visit</label>
                    <textarea 
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe your symptoms or reason for visit..."
                    />
                  </div>
                  <Button className="w-full">Confirm Booking</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
