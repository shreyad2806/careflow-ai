import React from 'react';
import { Calendar, CheckCircle, Clock, FileText, Activity, Pill, AlertCircle } from 'lucide-react';
import { CareTimelineEvent } from '@/lib/types';

interface CareTimelineProps {
  events: CareTimelineEvent[];
}

export default function CareTimeline({ events }: CareTimelineProps) {
  const getEventIcon = (type: CareTimelineEvent['type']) => {
    switch (type) {
      case 'appointment': return Calendar;
      case 'medication': return Pill;
      case 'lab-result': return FileText;
      case 'vital-signs': return Activity;
      case 'note': return AlertCircle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-600';
      case 'pending': return 'bg-yellow-100 text-yellow-600';
      case 'upcoming': return 'bg-blue-100 text-blue-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'pending': return Clock;
      case 'upcoming': return Clock;
      default: return Clock;
    }
  };

  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-4">
      {sortedEvents.map((event, index) => {
        const EventIcon = getEventIcon(event.type);
        const StatusIcon = getStatusIcon(event.status);
        
        return (
          <div key={event.id} className="relative pl-8 pb-4 border-l-2 border-slate-200 last:pb-0">
            <div className={`absolute left-0 top-0 w-6 h-6 rounded-full ${getStatusColor(event.status)} flex items-center justify-center -translate-x-[13px]`}>
              <StatusIcon size={14} />
            </div>
            
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <EventIcon size={18} className="text-slate-600" />
                  <h4 className="font-semibold text-slate-900">{event.title}</h4>
                </div>
                <span className="text-xs text-slate-500">{event.date}</span>
              </div>
              
              <p className="text-sm text-slate-600 mb-2">{event.description}</p>
              
              {event.metadata && (
                <div className="text-xs text-slate-500 space-y-1">
                  {event.metadata.doctorName && (
                    <p>Doctor: {event.metadata.doctorName}</p>
                  )}
                  {event.metadata.results && (
                    <p>Results: {event.metadata.results}</p>
                  )}
                  {event.metadata.values && (
                    <p>Values: {event.metadata.values}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
