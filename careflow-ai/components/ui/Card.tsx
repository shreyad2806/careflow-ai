import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: CardProps) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: CardProps) {
  return <h3 className={`text-xl font-semibold text-slate-900 ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: CardProps) {
  return <div className={className}>{children}</div>;
}
