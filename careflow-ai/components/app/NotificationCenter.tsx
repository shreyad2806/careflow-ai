'use client';

import React, { useState, useMemo } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Bell, Calendar, Clock, AlertTriangle, CheckCircle, XCircle, User, FileText, X, ChevronRight, Pill, MessageSquare } from 'lucide-react';

export interface Notification {
  id: string;
  type: 'appointment' | 'medication' | 'system' | 'urgent' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'appointment',
    title: 'Appointment Confirmed',
    message: 'Your appointment with Dr. Sarah Johnson (Cardiology) on Aug 26 at 10:00 AM has been confirmed.',
    time: '2h ago',
    read: false,
    actionLabel: 'View Details',
    actionHref: '/patient/appointments/1',
  },
  {
    id: '2',
    type: 'appointment',
    title: 'Upcoming Appointment Reminder',
    message: 'You have an appointment with Dr. Emily Rodriguez tomorrow at 2:00 PM. Please arrive 15 minutes early.',
    time: '5h ago',
    read: false,
    actionLabel: 'View Details',
    actionHref: '/patient/appointments/2',
  },
  {
    id: '3',
    type: 'urgent',
    title: 'Doctor Leave Conflict',
    message: 'Dr. Emily Rodriguez will be on leave from Aug 28-30. Your appointment may need rescheduling.',
    time: '1d ago',
    read: false,
    actionLabel: 'Reschedule',
    actionHref: '/patient/appointments',
  },
  {
    id: '4',
    type: 'system',
    title: 'Appointment Cancelled',
    message: 'Your appointment with Dr. James Wilson on Aug 22 has been cancelled. You may book a new one.',
    time: '2d ago',
    read: true,
    actionLabel: 'Book New',
    actionHref: '/patient/booking',
  },
  {
    id: '5',
    type: 'info',
    title: 'Follow-up Available',
    message: 'Dr. Robert Kim has recommended a follow-up visit. Check your care timeline for details.',
    time: '3d ago',
    read: true,
    actionLabel: 'View Timeline',
    actionHref: '/patient/timeline',
  },
  {
    id: '6',
    type: 'medication',
    title: 'Medication Reminder',
    message: 'Time to take Lisinopril 10mg. Take one tablet by mouth once daily.',
    time: '30m ago',
    read: false,
    actionLabel: 'Mark Taken',
  },
  {
    id: '7',
    type: 'medication',
    title: 'Prescription Refill Needed',
    message: 'Your Metformin 500mg supply is running low. Consider requesting a refill from your doctor.',
    time: '1d ago',
    read: true,
    actionLabel: 'Request Refill',
  },
  {
    id: '8',
    type: 'system',
    title: 'AI Analysis Complete',
    message: 'Your symptom analysis is ready. Dr. Michael Chen has been recommended based on your symptoms.',
    time: '4d ago',
    read: true,
    actionLabel: 'View Results',
    actionHref: '/patient/symptoms',
  },
];

function getRelativeTime(minutesAgo: number): string {
  if (minutesAgo < 1) return 'Just now';
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'appointment':
        return <Calendar size={18} className="text-blue-600" />;
      case 'medication':
        return <Pill size={18} className="text-purple-600" />;
      case 'system':
        return <CheckCircle size={18} className="text-green-600" />;
      case 'urgent':
        return <AlertTriangle size={18} className="text-red-600" />;
      case 'info':
        return <Info size={18} className="text-blue-500" />;
      default:
        return <Bell size={18} className="text-slate-600" />;
    }
  };

  const getNotificationBg = (type: Notification['type']) => {
    switch (type) {
      case 'appointment': return 'bg-blue-50 border-blue-200';
      case 'medication': return 'bg-purple-50 border-purple-200';
      case 'system': return 'bg-green-50 border-green-200';
      case 'urgent': return 'bg-red-50 border-red-200';
      case 'info': return 'bg-sky-50 border-sky-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleDismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Bell size={20} className="text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-12 w-[380px] max-h-[520px] z-50 shadow-2xl rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[430px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell size={48} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No notifications</p>
                  <p className="text-sm text-slate-400 mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                        !notification.read ? 'bg-blue-50/30' : ''
                      }`}
                      onClick={() => {
                        if (!notification.read) handleMarkAsRead(notification.id);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg border flex-shrink-0 mt-0.5 ${getNotificationBg(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-snug ${!notification.read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                              {notification.title}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDismiss(notification.id);
                              }}
                              className="flex-shrink-0 text-slate-300 hover:text-slate-500 p-0.5"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-slate-400">{notification.time}</span>
                            {notification.actionLabel && (
                              <button className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                                {notification.actionLabel}
                                <ChevronRight size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Small Info icon component for the 'info' type
function Info({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
