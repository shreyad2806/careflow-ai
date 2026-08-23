'use client';

import React from 'react';
import AppSidebar from '@/components/app/AppSidebar';
import AppHeader from '@/components/app/AppHeader';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { adminNavigation } from '@/lib/navigation';
import { mockLeaveRequests } from '@/lib/mock-data';
import { Calendar, User, Clock } from 'lucide-react';

export default function AdminLeaves() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar navigation={adminNavigation} role="admin" userName="Admin User" />
      
      <div className="flex-1 ml-64">
        <AppHeader title="Leave Management" />
        
        <main className="p-6 pt-20">
          <PageHeader 
            title="Leave Requests"
            subtitle="Review and manage doctor leave requests"
          />
          
          <div className="space-y-4">
            {mockLeaveRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                        <User size={24} className="text-slate-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{request.doctorName}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{request.startDate} - {request.endDate}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mt-2">{request.reason}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                          <Clock size={12} />
                          <span>Requested: {request.requestedAt}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        request.status === 'approved' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {request.status}
                      </span>
                      {request.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <Button variant="primary" size="sm">
                            Approve
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
