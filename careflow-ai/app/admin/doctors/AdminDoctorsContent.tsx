'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { adminNavigation } from '@/lib/navigation';
import { Star, MapPin, Clock, Edit, Trash2, Plus, X } from 'lucide-react';
import type { Doctor } from '@/lib/types';

interface AdminDoctorsContentProps {
  doctors: Doctor[];
  userName?: string;
}

export default function AdminDoctorsContent({ doctors, userName = 'Admin' }: AdminDoctorsContentProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <DashboardLayout
      navigation={adminNavigation}
      role="admin"
      userName={userName}
      headerTitle="Manage Doctors"
    >
      <PageHeader 
        title="Doctor Management"
        subtitle="View and manage healthcare providers"
        action={{ label: 'Add Doctor', onClick: () => setShowAddForm(true) }}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {doctors.map((doctor) => (
          <Card key={doctor.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {doctor.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{doctor.name}</CardTitle>
                  <p className="text-sm text-slate-600">{doctor.specialty}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                <span>{doctor.rating} ({doctor.reviewCount} reviews)</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock size={14} className="flex-shrink-0" />
                  <span>{doctor.experience} years experience</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin size={14} className="flex-shrink-0" />
                  <span className="line-clamp-1">{doctor.location}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-600">Status</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Active</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Hours</span>
                  <span className="text-slate-900">9 AM - 5 PM</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" disabled title="Coming Soon">
                  <Edit size={16} className="mr-2" />Edit <span className="text-xs text-slate-400">Soon</span>
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" disabled title="Coming Soon">
                  <Trash2 size={16} className="mr-2" />Remove <span className="text-xs text-slate-400">Soon</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowAddForm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Add New Doctor</h2>
              <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Dr. John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Specialty</label>
                <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option>Cardiology</option><option>Neurology</option><option>Pediatrics</option>
                  <option>Orthopedics</option><option>Dermatology</option><option>General Practice</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input type="email" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="doctor@careflow.ai" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                <input type="tel" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="+1 (555) 123-4567" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => setShowAddForm(false)}>
                <Plus size={18} className="mr-2" />Add Doctor
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
