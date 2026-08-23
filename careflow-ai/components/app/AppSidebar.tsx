'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Stethoscope, BrainCircuit, Calendar, CalendarDays, Users, UserCog, CalendarCheck, CalendarX, LogOut, ListOrdered, X } from 'lucide-react';
import { RoleNavigation } from '@/lib/types';

interface AppSidebarProps {
  navigation: RoleNavigation;
  role: 'patient' | 'doctor' | 'admin';
  userName?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const iconMap: Record<string, any> = {
  LayoutDashboard,
  Stethoscope,
  BrainCircuit,
  Calendar,
  ListOrdered,
  CalendarDays,
  Users,
  UserCog,
  CalendarCheck,
  CalendarX,
};

export default function AppSidebar({ navigation, role, userName, isOpen = true, onClose }: AppSidebarProps) {
  const pathname = usePathname();

  const getRoleLabel = () => {
    switch (role) {
      case 'patient': return 'Patient Portal';
      case 'doctor': return 'Doctor Portal';
      case 'admin': return 'Admin Portal';
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case 'patient': return 'from-blue-500 to-blue-700';
      case 'doctor': return 'from-emerald-500 to-emerald-700';
      case 'admin': return 'from-purple-500 to-purple-700';
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 flex flex-col z-40 transition-transform duration-200 lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className={`w-8 h-8 bg-gradient-to-br ${getRoleColor()} rounded-lg flex items-center justify-center`}>
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <div>
              <span className="text-xl font-semibold text-slate-900">CareFlow AI</span>
              <p className="text-xs text-slate-500">{getRoleLabel()}</p>
            </div>
          </Link>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1 hover:bg-slate-100 rounded">
              <X size={20} className="text-slate-400" />
            </button>
          )}
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {navigation.items.map((item) => {
              const Icon = iconMap[item.icon] || LayoutDashboard;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
              <span className="text-slate-600 font-medium">
                {userName?.split(' ').map(n => n[0]).join('') || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{userName || 'User'}</p>
              <p className="text-xs text-slate-500 capitalize">{role}</p>
            </div>
          </div>
          <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
