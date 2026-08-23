import React from 'react';
import { Calendar, Clock, User } from 'lucide-react';
import { Appointment } from '@/lib/types';
import Card, { CardContent } from '@/components/ui/Card';
import UrgencyBadge from '@/components/app/UrgencyBadge';

interface AppointmentCardProps {
  appointment: Appointment;
  onViewDetails?: (id: string) => void;
}

export default function AppointmentCard({ appointment, onViewDetails }: AppointmentCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'in-progress': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-slate-100 text-slate-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewDetails?.(appointment.id)}>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-slate-900">{appointment.doctorName}</h3>
                <UrgencyBadge urgency={appointment.urgency} />
              </div>
              <p className="text-sm text-slate-600">{appointment.specialty}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(appointment.status)}`}>
              {appointment.status}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar size={16} />
              <span>{appointment.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock size={16} />
              <span>{appointment.time} ({appointment.duration} min)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User size={16} />
              <span>{appointment.patientName}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-600 line-clamp-2">{appointment.reason}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
