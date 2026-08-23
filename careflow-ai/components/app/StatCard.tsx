import React from 'react';
import { LucideIcon } from 'lucide-react';
import Card, { CardContent } from '@/components/ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
}

export default function StatCard({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', 
  icon: Icon,
  iconColor = 'text-blue-600'
}: StatCardProps) {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      default: return 'text-slate-600';
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
            {change && (
              <p className={`text-sm mt-2 ${getChangeColor()}`}>
                {change}
              </p>
            )}
          </div>
          <div className={`p-3 bg-slate-50 rounded-lg ${iconColor}`}>
            <Icon size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
