import React from 'react';
import { Star, MapPin, Calendar, DollarSign, Languages, Clock } from 'lucide-react';
import { Doctor } from '@/lib/types';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface DoctorCardProps {
  doctor: Doctor;
  onBook?: (id: string) => void;
  onViewProfile?: (id: string) => void;
}

export default function DoctorCard({ doctor, onBook, onViewProfile }: DoctorCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-white">
              {doctor.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">{doctor.name}</h3>
            <p className="text-sm text-slate-600">{doctor.specialty}</p>
            <div className="flex items-center gap-1 mt-1">
              <Star size={14} className="text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium text-slate-900">{doctor.rating}</span>
              <span className="text-xs text-slate-500">({doctor.reviewCount} reviews)</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4 line-clamp-2">{doctor.description}</p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin size={16} />
            <span className="line-clamp-1">{doctor.location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={16} />
            <span>{doctor.experience} years experience</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <DollarSign size={16} />
            <span>${doctor.consultationFee} consultation</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock size={16} />
            <span>Next: {doctor.nextAvailable}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Languages size={16} />
            <span className="line-clamp-1">{doctor.languages.join(', ')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-slate-500">Available:</span>
          {doctor.availability.slice(0, 3).map((day) => (
            <span key={day} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
              {day}
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onViewProfile?.(doctor.id)}
          >
            View Profile
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            className="flex-1"
            onClick={() => onBook?.(doctor.id)}
          >
            Book
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
