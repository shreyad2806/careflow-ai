'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { doctorNavigation } from '@/lib/navigation';
import { mockPatients } from '@/lib/mock-data';
import { User, Mail, Phone, Calendar } from 'lucide-react';

export default function DoctorPatients() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={doctorNavigation} role="doctor" userName="Dr. Sarah Johnson" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Patients" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Patient Records"
            subtitle="View and manage patient information"
            action={{
              label: 'Add Patient',
              onClick: () => console.log('Add patient'),
            }}
          />
          
          <div className="space-y-4">
            {mockPatients.map((patient) => (
              <Card key={patient.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                        <User size={24} className="text-slate-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{patient.name}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Mail size={14} />
                            <span>{patient.email}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone size={14} />
                            <span>{patient.phone}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>DOB: {patient.dateOfBirth}</span>
                          </div>
                          <span>Blood Type: {patient.bloodType}</span>
                        </div>
                        {patient.chronicConditions.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs font-medium text-slate-500">Conditions: </span>
                            {patient.chronicConditions.map((condition, i) => (
                              <span key={i} className="inline-block px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs ml-1">
                                {condition}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
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
