/**
 * Notification Service
 *
 * Reliable notification delivery with:
 *   - State machine: PENDING → DELIVERED | FAILED → retry → FAILED (permanent)
 *   - Idempotency: duplicate events don't create duplicate notifications
 *   - Retry with exponential backoff (1min, 5min, 15min)
 *   - Decoupled from business logic: booking success ≠ notification success
 *   - Provider abstraction: in-app + email interface
 *
 * State diagram:
 *
 *   Event received
 *       ↓
 *   Check idempotency (event_type + event_id)
 *       ↓
 *   Create notification record (status=PENDING)
 *       ↓
 *   Attempt delivery via provider
 *       ↓
 *   ┌─ SUCCESS → status=DELIVERED, delivered_at=now()
 *   │
 *   └─ FAILED → retry_count++
 *       ↓
 *       ├─ retry_count < max_retries → schedule next_retry_at (backoff)
 *       └─ retry_count >= max_retries → permanently FAILED
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getProvider } from './notification-providers';

// ============================================================
// Event types
// ============================================================

export type NotificationEventType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'APPOINTMENT_REMINDER'
  | 'DOCTOR_LEAVE_CONFLICT'
  | 'MEDICATION_REMINDER';

export type NotificationChannel = 'in_app' | 'email' | 'push';

export type NotificationStatus = 'pending' | 'delivered' | 'failed';

// ============================================================
// Logger
// ============================================================

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const prefix = '[NotificationService]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}

// ============================================================
// Create notification
// ============================================================

export interface CreateNotificationInput {
  recipientId: string;   // profile_id
  eventType: NotificationEventType;
  eventId: string;       // e.g. appointment UUID — for idempotency
  channel: NotificationChannel;
  title: string;
  message: string;
  /** Override max retries (default 3) */
  maxRetries?: number;
}

export interface CreateNotificationResult {
  ok: true;
  notificationId: string;
  idempotent: boolean; // true if this was a duplicate
}

export interface CreateNotificationError {
  ok: false;
  error: string;
  message: string;
}

export type CreateNotificationOutput = CreateNotificationResult | CreateNotificationError;

/**
 * Create a notification record and attempt delivery.
 *
 * Idempotency: if a notification with the same event_type + event_id
 * already exists in pending/delivered status, returns the existing ID
 * without creating a duplicate.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<CreateNotificationOutput> {
  const supabase = createSupabaseServerClient();
  const startTime = Date.now();

  log('info', `Creating notification: event=${input.eventType} id=${input.eventId} channel=${input.channel}`);

  // --- Step 1: Idempotency check ---
  const { data: existing } = await supabase
    .rpc('notification_event_exists', {
      p_event_type: input.eventType,
      p_event_id: input.eventId,
    });

  if (existing) {
    log('info', `Idempotent skip: event ${input.eventType}:${input.eventId} already has a notification`);
    // Find the existing notification to return its ID
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('event_type', input.eventType)
      .eq('event_id', input.eventId)
      .in('status', ['pending', 'delivered'])
      .limit(1)
      .maybeSingle();

    return {
      ok: true,
      notificationId: existingNotif?.id || '',
      idempotent: true,
    };
  }

  // --- Step 2: Insert notification record (status=PENDING) ---
  const { data: notif, error: insertError } = await supabase
    .from('notifications')
    .insert({
      profile_id: input.recipientId,
      type: 'info', // Will be overridden by the semantic type
      channel: input.channel,
      status: 'pending',
      event_type: input.eventType,
      event_id: input.eventId,
      title: input.title,
      message: input.message,
      retry_count: 0,
      max_retries: input.maxRetries ?? 3,
      is_read: false,
    })
    .select('id')
    .single();

  if (insertError || !notif) {
    log('error', `Failed to insert notification: ${insertError?.message || 'unknown'}`);
    return {
      ok: false,
      error: 'INSERT_FAILED',
      message: `Failed to create notification: ${insertError?.message || 'unknown'}`,
    };
  }

  const notificationId = notif.id;
  log('info', `Notification record created: id=${notificationId}`);

  // --- Step 3: Attempt delivery ---
  const deliveryResult = await deliverNotification(
    notificationId,
    input.channel,
    input.recipientId,
    input.title,
    input.message
  );

  const elapsed = Date.now() - startTime;
  log(
    'info',
    `Notification created in ${elapsed}ms: id=${notificationId} ` +
      `delivery=${deliveryResult ? 'delivered' : 'pending'}`
  );

  return {
    ok: true,
    notificationId,
    idempotent: false,
  };
}

// ============================================================
// Delivery
// ============================================================

/**
 * Attempt to deliver a notification via the appropriate provider.
 * Updates the notification record with delivery status.
 */
async function deliverNotification(
  notificationId: string,
  channel: string,
  recipientId: string,
  title: string,
  message: string
): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const provider = getProvider(channel);

  try {
    const result = await provider.send({ recipientId, title, message });

    if (result.ok) {
      // Mark as delivered
      await supabase.rpc('mark_notification_delivered', {
        p_notification_id: notificationId,
      });
      log('info', `Notification delivered: id=${notificationId} channel=${channel}`);
      return true;
    } else {
      // Mark as failed (will schedule retry)
      await supabase.rpc('mark_notification_failed', {
        p_notification_id: notificationId,
        p_failure_reason: result.message,
      });
      log('warn', `Notification delivery failed: id=${notificationId} reason=${result.message}`);
      return false;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.rpc('mark_notification_failed', {
      p_notification_id: notificationId,
      p_failure_reason: message,
    });
    log('error', `Notification delivery error: id=${notificationId} error=${message}`);
    return false;
  }
}

// ============================================================
// Retry logic
// ============================================================

/**
 * Get notifications that are due for retry.
 */
export async function getRetryableNotifications(
  limit: number = 10
): Promise<Array<{
  id: string;
  recipientId: string;
  channel: string;
  title: string;
  message: string;
  retryCount: number;
  maxRetries: number;
}>> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .rpc('get_retryable_notifications', { p_limit: limit });

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.notification_id as string,
    recipientId: row.profile_id as string,
    channel: row.channel as string,
    title: row.title as string,
    message: row.message as string,
    retryCount: row.retry_count as number,
    maxRetries: row.max_retries as number,
  }));
}

/**
 * Retry delivery for a single notification.
 */
export async function retryNotification(
  notificationId: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();

  // Fetch the notification
  const { data: notif, error } = await supabase
    .from('notifications')
    .select('id, channel, profile_id, title, message, retry_count, max_retries')
    .eq('id', notificationId)
    .single();

  if (error || !notif) {
    return { ok: false, message: 'Notification not found.' };
  }

  if (notif.retry_count >= notif.max_retries) {
    return { ok: false, message: 'Max retries reached. Notification permanently failed.' };
  }

  log('info', `Retrying notification: id=${notificationId} attempt=${notif.retry_count + 1}/${notif.max_retries}`);

  // Attempt delivery
  const delivered = await deliverNotification(
    notificationId,
    notif.channel,
    notif.profile_id,
    notif.title,
    notif.message
  );

  if (delivered) {
    return { ok: true, message: 'Notification delivered successfully.' };
  }

  return { ok: false, message: 'Delivery failed. Will retry later.' };
}

/**
 * Process all retryable notifications.
 * Called by a scheduled job or admin endpoint.
 */
export async function processRetryableNotifications(): Promise<{
  processed: number;
  delivered: number;
  failed: number;
}> {
  const retryable = await getRetryableNotifications(20);

  let delivered = 0;
  let failed = 0;

  for (const notif of retryable) {
    const result = await retryNotification(notif.id);
    if (result.ok) {
      delivered++;
    } else {
      failed++;
    }
  }

  log('info', `Retry batch complete: processed=${retryable.length} delivered=${delivered} failed=${failed}`);

  return {
    processed: retryable.length,
    delivered,
    failed,
  };
}

// ============================================================
// Convenience event handlers
// ============================================================

/**
 * Send a BOOKING_CONFIRMED notification to the patient.
 */
export async function notifyBookingConfirmed(input: {
  patientProfileId: string;
  appointmentId: string;
  doctorName: string;
  date: string;
  time: string;
}): Promise<CreateNotificationOutput> {
  return createNotification({
    recipientId: input.patientProfileId,
    eventType: 'BOOKING_CONFIRMED',
    eventId: input.appointmentId,
    channel: 'in_app',
    title: 'Appointment Confirmed',
    message:
      `Your appointment with ${input.doctorName} on ${input.date} at ${input.time} has been confirmed.`,
  });
}

/**
 * Send a BOOKING_CANCELLED notification to the patient.
 */
export async function notifyBookingCancelled(input: {
  patientProfileId: string;
  appointmentId: string;
  doctorName: string;
  date: string;
  time: string;
}): Promise<CreateNotificationOutput> {
  return createNotification({
    recipientId: input.patientProfileId,
    eventType: 'BOOKING_CANCELLED',
    eventId: input.appointmentId,
    channel: 'in_app',
    title: 'Appointment Cancelled',
    message:
      `Your appointment with ${input.doctorName} on ${input.date} at ${input.time} has been cancelled.`,
  });
}

/**
 * Send a DOCTOR_LEAVE_CONFLICT notification to the patient.
 */
export async function notifyDoctorLeaveConflict(input: {
  patientProfileId: string;
  appointmentId: string;
  doctorName: string;
  leaveStartDate: string;
  leaveEndDate: string;
  appointmentDate: string;
  appointmentTime: string;
}): Promise<CreateNotificationOutput> {
  return createNotification({
    recipientId: input.patientProfileId,
    eventType: 'DOCTOR_LEAVE_CONFLICT',
    eventId: input.appointmentId,
    channel: 'in_app',
    title: 'Doctor Leave — Appointment May Be Affected',
    message:
      `${input.doctorName} will be on leave from ${input.leaveStartDate} to ${input.leaveEndDate}. ` +
      `Your appointment on ${input.appointmentDate} at ${input.appointmentTime} may be affected. ` +
      `Please contact the clinic to reschedule.`,
  });
}
