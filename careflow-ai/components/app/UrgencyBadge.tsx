import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { UrgencyLevel } from '@/lib/types';

interface UrgencyBadgeProps {
  urgency: UrgencyLevel;
}

export default function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  const getConfig = () => {
    switch (urgency) {
      case 'low':
        return {
          color: 'bg-green-100 text-green-700',
          icon: Info,
          label: 'Low',
        };
      case 'medium':
        return {
          color: 'bg-yellow-100 text-yellow-700',
          icon: AlertCircle,
          label: 'Medium',
        };
      case 'high':
        return {
          color: 'bg-orange-100 text-orange-700',
          icon: AlertTriangle,
          label: 'High',
        };
      case 'critical':
        return {
          color: 'bg-red-100 text-red-700',
          icon: AlertTriangle,
          label: 'Critical',
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}
