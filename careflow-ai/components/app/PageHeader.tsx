import React from 'react';
import { Plus } from 'lucide-react';
import Button from '@/components/ui/Button';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action, children }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="text-slate-600 mt-1">{subtitle}</p>
          )}
        </div>
        
        {action && (
          <Button onClick={action.onClick}>
            <Plus size={18} className="mr-2" />
            {action.label}
          </Button>
        )}
      </div>
      
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}
