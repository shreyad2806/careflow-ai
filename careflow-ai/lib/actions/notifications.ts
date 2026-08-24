/**
 * Server actions for notification management.
 *
 * These run server-side and call Supabase directly.
 * Used by the NotificationCenter client component.
 */

'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDemoPatient } from '@/lib/config/demo-identity';

// ============================================================
// Types
// ============================================================

export interface NotificationRecord {
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
// Resolve current user profile ID (demo mode)
// ============================================================

/**
 * Get the current patient's profile ID from demo identity.
 * In production, this would come from supabase.auth.getUser().
 */
export async function getCurrentPatientProfileId(): Promise<string | null> {
  try {
    const patient = await getDemoPatient();
    return patient?.profileId ?? null;
  } catch (err) {
    console.error('[Notifications] getCurrentPatientProfileId error:', err);
    return null;
  }
}

// ============================================================
// Fetch notifications for a profile
// ============================================================

/**
 * Fetch notifications for a given profile ID.
 * Returns newest first, limited to 20.
 */
export async function fetchNotifications(
  profileId: string
): Promise<NotificationRecord[]> {
  if (!profileId) return [];

  try {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, is_read, created_at, channel, status')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      type: row.type as string,
      title: row.title as string,
      message: row.message as string,
      isRead: row.is_read as boolean,
      createdAt: row.created_at as string,
      channel: row.channel as string,
      status: row.status as string,
    }));
  } catch (err) {
    console.error('[Notifications] fetchNotifications error:', err);
    return [];
  }
}

// ============================================================
// Mark a notification as read
// ============================================================

export async function markNotificationRead(
  notificationId: string
): Promise<{ ok: boolean }> {
  if (!notificationId) return { ok: false };

  try {
    const supabase = createSupabaseServerClient();

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('[Notifications] markRead error:', error.message);
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    console.error('[Notifications] markRead error:', err);
    return { ok: false };
  }
}

// ============================================================
// Mark all notifications as read for a profile
// ============================================================

export async function markAllNotificationsRead(
  profileId: string
): Promise<{ ok: boolean; count: number }> {
  if (!profileId) return { ok: false, count: 0 };

  try {
    const supabase = createSupabaseServerClient();

    const { error, count } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('profile_id', profileId)
      .eq('is_read', false);

    if (error) {
      console.error('[Notifications] markAllRead error:', error.message);
      return { ok: false, count: 0 };
    }

    return { ok: true, count: count || 0 };
  } catch (err) {
    console.error('[Notifications] markAllRead error:', err);
    return { ok: false, count: 0 };
  }
}

// ============================================================
// Get unread count for a profile
// ============================================================

export async function getUnreadCount(
  profileId: string
): Promise<number> {
  if (!profileId) return 0;

  try {
    const supabase = createSupabaseServerClient();

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('is_read', false);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}
