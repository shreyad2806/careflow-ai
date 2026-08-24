'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Bell, Calendar, AlertTriangle, CheckCircle, X, ChevronRight, Pill, Info } from 'lucide-react';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, getCurrentPatientProfileId } from '@/lib/actions/notifications';

// ============================================================
// Notification type
// ============================================================

interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  channel: string;
  status: string;
}

// ============================================================
// Helpers
// ============================================================

function getRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getNotificationIcon(type: string) {
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
}

function getNotificationBg(type: string) {
  switch (type) {
    case 'appointment': return 'bg-blue-50 border-blue-200';
    case 'medication': return 'bg-purple-50 border-purple-200';
    case 'system': return 'bg-green-50 border-green-200';
    case 'urgent': return 'bg-red-50 border-red-200';
    case 'info': return 'bg-sky-50 border-sky-200';
    default: return 'bg-slate-50 border-slate-200';
  }
}

// ============================================================
// Component
// ============================================================

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.isRead).length,
    [notifications]
  );

  // --- Resolve profile ID on mount ---
  useEffect(() => {
    getCurrentPatientProfileId().then(id => {
      setProfileId(id);
      console.log('[NotificationCenter] profileId:', id);
    });
  }, []);

  // --- Load notifications when dropdown opens ---
  const loadNotifications = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const data = await fetchNotifications(pid);
      setNotifications(data);
      setLoaded(true);
    } catch (err) {
      console.error('[NotificationCenter] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && profileId && !loaded) {
      loadNotifications(profileId);
    }
  }, [isOpen, loaded, profileId, loadNotifications]);

  // --- Mark single notification as read ---
  const handleMarkAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );

    if (profileId) {
      await markNotificationRead(id);
    }
  }, [profileId]);

  // --- Mark all as read ---
  const handleMarkAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

    if (profileId) {
      await markAllNotificationsRead(profileId);
    }
  }, [profileId]);

  // --- Refresh on re-open ---
  const handleToggle = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      setLoaded(false); // Force reload
      setIsOpen(true);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
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
              {loading ? (
                <div className="p-10 text-center">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell size={48} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No notifications</p>
                  <p className="text-sm text-slate-400 mt-1">You&apos;re all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                        !notification.isRead ? 'bg-blue-50/30' : ''
                      }`}
                      onClick={() => {
                        if (!notification.isRead) handleMarkAsRead(notification.id);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg border flex-shrink-0 mt-0.5 ${getNotificationBg(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-snug ${!notification.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                              {notification.title}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-slate-400">
                              {getRelativeTime(notification.createdAt)}
                            </span>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
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
