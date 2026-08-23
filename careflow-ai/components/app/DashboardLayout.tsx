'use client';

import React, { useState } from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import { RoleNavigation } from '@/lib/types';

interface DashboardLayoutProps {
  navigation: RoleNavigation;
  role: 'patient' | 'doctor' | 'admin';
  userName: string;
  headerTitle: string;
  children: React.ReactNode;
  showSearch?: boolean;
  headerChildren?: React.ReactNode;
}

export default function DashboardLayout({
  navigation,
  role,
  userName,
  headerTitle,
  children,
  showSearch = true,
  headerChildren,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar
        navigation={navigation}
        role={role}
        userName={userName}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <div className="flex-1 lg:ml-64">
        <AppHeader
          title={headerTitle}
          showSearch={showSearch}
          onMenuToggle={() => setSidebarOpen(true)}
        >
          {headerChildren}
        </AppHeader>
        
        <main className="p-4 sm:p-6 pt-20">
          {children}
        </main>
      </div>
    </div>
  );
}
