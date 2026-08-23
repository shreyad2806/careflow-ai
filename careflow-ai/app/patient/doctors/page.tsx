'use client';

import React, { useState, useMemo } from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import DoctorCard from '@/components/app/DoctorCard';
import EmptyState from '@/components/app/EmptyState';
import LoadingSkeleton from '@/components/app/LoadingSkeleton';
import Card, { CardContent } from '@/components/ui/Card';
import { patientNavigation } from '@/lib/navigation';
import { mockDoctors } from '@/lib/mock-data';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import Button from '@/components/ui/Button';

const SPECIALTIES = ['All', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology', 'General Practice', 'Internal Medicine', 'Gastroenterology', 'Psychiatry', 'Ophthalmology'];

const LANGUAGES = ['All', 'English', 'Spanish', 'Mandarin', 'Cantonese', 'Korean', 'French'];

const AVAILABILITY = ['All', 'Today', 'This Week', 'Next Week'];

export default function PatientDoctors() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedAvailability, setSelectedAvailability] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const filteredDoctors = useMemo(() => {
    return mockDoctors.filter((doctor) => {
      const matchesSearch = 
        doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSpecialty = selectedSpecialty === 'All' || doctor.specialty === selectedSpecialty;
      
      const matchesLanguage = selectedLanguage === 'All' || doctor.languages.includes(selectedLanguage);
      
      let matchesAvailability = true;
      if (selectedAvailability !== 'All') {
        const today = new Date();
        const nextAvailable = new Date(doctor.nextAvailable);
        const diffDays = Math.ceil((nextAvailable.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (selectedAvailability === 'Today') {
          matchesAvailability = diffDays <= 1;
        } else if (selectedAvailability === 'This Week') {
          matchesAvailability = diffDays <= 7;
        } else if (selectedAvailability === 'Next Week') {
          matchesAvailability = diffDays <= 14;
        }
      }
      
      return matchesSearch && matchesSpecialty && matchesLanguage && matchesAvailability;
    });
  }, [searchQuery, selectedSpecialty, selectedLanguage, selectedAvailability]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedSpecialty('All');
    setSelectedLanguage('All');
    setSelectedAvailability('All');
  };

  const hasActiveFilters = searchQuery || selectedSpecialty !== 'All' || selectedLanguage !== 'All' || selectedAvailability !== 'All';

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <AppSidebar navigation={patientNavigation} role="patient" userName="John Smith" />
        <div className="flex-1 ml-64">
          <AppHeader title="Find Doctors" />
          <main className="p-6 pt-20">
            <LoadingSkeleton />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={patientNavigation} role="patient" userName="John Smith" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Find Doctors" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Find Doctors"
            subtitle="Browse our network of healthcare professionals"
          />
          
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search by doctor name or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                <SlidersHorizontal size={18} />
                Filters
                {hasActiveFilters && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    Active
                  </span>
                )}
              </button>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
                >
                  <X size={14} />
                  Clear all
                </button>
              )}
            </div>

            {showFilters && (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Specialty Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Specialty</label>
                      <select
                        value={selectedSpecialty}
                        onChange={(e) => setSelectedSpecialty(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {SPECIALTIES.map((specialty) => (
                          <option key={specialty} value={specialty}>
                            {specialty}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Language Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {LANGUAGES.map((language) => (
                          <option key={language} value={language}>
                            {language}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Availability Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Availability</label>
                      <select
                        value={selectedAvailability}
                        onChange={(e) => setSelectedAvailability(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {AVAILABILITY.map((availability) => (
                          <option key={availability} value={availability}>
                            {availability}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Results Count */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {/* Doctor Grid */}
          {filteredDoctors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDoctors.map((doctor) => (
                <DoctorCard 
                  key={doctor.id} 
                  doctor={doctor}
                  onBook={(id) => console.log('Book doctor:', id)}
                  onViewProfile={(id) => console.log('View profile:', id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="No doctors found"
              description="Try adjusting your search or filters to find what you're looking for."
              action={{
                label: 'Clear Filters',
                onClick: clearFilters,
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
