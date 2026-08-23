'use client';

import React, { useState } from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { adminNavigation } from '@/lib/navigation';
import { mockDoctors } from '@/lib/mock-data';
import { User, MapPin, Star, Clock, Edit, Trash2, Plus } from 'lucide-react';

export default function AdminDoctors() {
  const [showAddForm, setShowAddForm] = useState(false);

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
              onClick: () => setShowAddForm(true),
            }}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockDoctors.map((doctor) => (
              <Card key={doctor.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">
                        {doctor.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{doctor.name}</CardTitle>
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
                      <Clock size={14} />
                      <span>{doctor.experience} years experience</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin size={14} />
                      <span className="line-clamp-1">{doctor.location}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-slate-600">Working Status</span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Working Hours</span>
                      <span className="text-slate-900">9 AM - 5 PM</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-slate-600">Slot Duration</span>
                      <span className="text-slate-900">30 min</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit size={16} className="mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
                      <Trash2 size={16} className="mr-2" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {showAddForm && (
            <Card className="mt-6 border-2 border-blue-200">
              <CardHeader>
                <CardTitle>Add New Doctor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                    <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Dr. John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Specialty</label>
                    <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Cardiology</option>
                      <option>Neurology</option>
                      <option>Pediatrics</option>
                      <option>Orthopedics</option>
                      <option>Dermatology</option>
                      <option>General Practice</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input type="email" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="doctor@careflow.ai" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                    <input type="tel" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+1 (555) 123-4567" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Working Hours</label>
                    <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>9 AM - 5 PM</option>
                      <option>8 AM - 4 PM</option>
                      <option>10 AM - 6 PM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Slot Duration</label>
                    <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>15 min</option>
                      <option>30 min</option>
                      <option>45 min</option>
                      <option>60 min</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1">
                    <Plus size={18} className="mr-2" />
                    Add Doctor
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
