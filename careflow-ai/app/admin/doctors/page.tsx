'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { adminNavigation } from '@/lib/navigation';
import { mockDoctors } from '@/lib/mock-data';
import { User, MapPin, Star } from 'lucide-react';

export default function AdminDoctors() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={adminNavigation} role="admin" userName="Admin User" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Manage Doctors" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Doctor Management"
            subtitle="View and manage healthcare providers"
            action={{
              label: 'Add Doctor',
              onClick: () => console.log('Add doctor'),
            }}
          />
          
          <div className="space-y-4">
            {mockDoctors.map((doctor) => (
              <Card key={doctor.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                        <User size={24} className="text-slate-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{doctor.name}</h3>
                        <p className="text-sm text-slate-600">{doctor.specialty}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            <span>{doctor.rating} ({doctor.reviewCount})</span>
                          </div>
                          <span>{doctor.experience} years exp</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <MapPin size={14} />
                            <span>{doctor.location}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
                        Remove
                      </Button>
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
