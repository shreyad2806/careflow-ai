-- CareFlow AI - Migration 009: Notification Service
-- Extends the notifications table with reliable delivery state machine fields.
-- All new columns have safe defaults so existing rows are unaffected.

-- ============================================================
-- 1. ADD DELIVERY/RETRY COLUMNS
-- ============================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'push'));

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'delivered'
    CHECK (status IN ('pending', 'delivered', 'failed'));

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS event_type TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS event_id TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;


-- ============================================================
-- 2. INDEXES FOR RETRY AND DELIVERY QUERIES
-- ============================================================

-- Find notifications that need retry (failed, not yet exhausted retries, next retry time passed)
CREATE INDEX IF NOT EXISTS idx_notifications_retryable
  ON notifications(status, next_retry_at)
  WHERE status = 'failed' AND retry_count < 3;

-- Find notifications by event for idempotency checks
CREATE INDEX IF NOT EXISTS idx_notifications_event
  ON notifications(event_type, event_id)
  WHERE event_type IS NOT NULL AND event_id IS NOT NULL;

-- Find pending notifications for processing
CREATE INDEX IF NOT EXISTS idx_notifications_pending
  ON notifications(status, created_at)
  WHERE status = 'pending';


-- ============================================================
-- 3. FUNCTION: Mark notification as delivered
-- ============================================================

CREATE OR REPLACE FUNCTION mark_notification_delivered(
  p_notification_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE notifications
  SET status = 'delivered',
      delivered_at = now(),
      last_attempt_at = now()
  WHERE id = p_notification_id
    AND status IN ('pending', 'failed');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 4. FUNCTION: Mark notification as failed with retry logic
-- ============================================================

CREATE OR REPLACE FUNCTION mark_notification_failed(
  p_notification_id UUID,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_notif RECORD;
  v_new_retry_count INTEGER;
  v_new_status TEXT;
  v_next_retry TIMESTAMPTZ;
BEGIN
  -- Fetch the notification
  SELECT * INTO v_notif
  FROM notifications
  WHERE id = p_notification_id
  FOR UPDATE;

  IF v_notif IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  v_new_retry_count := v_notif.retry_count + 1;

  IF v_new_retry_count >= v_notif.max_retries THEN
    -- Permanently failed
    v_new_status := 'failed';
    v_next_retry := NULL;
  ELSE
    -- Schedule retry with exponential backoff (1min, 5min, 15min)
    v_new_status := 'failed';
    CASE v_new_retry_count
      WHEN 1 THEN v_next_retry := now() + INTERVAL '1 minute';
      WHEN 2 THEN v_next_retry := now() + INTERVAL '5 minutes';
      ELSE v_next_retry := now() + INTERVAL '15 minutes';
    END CASE;
  END IF;

  UPDATE notifications
  SET status = v_new_status,
      retry_count = v_new_retry_count,
      last_attempt_at = now(),
      next_retry_at = v_next_retry,
      failure_reason = COALESCE(p_failure_reason, failure_reason)
  WHERE id = p_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'retry_count', v_new_retry_count,
    'max_retries', v_notif.max_retries,
    'permanently_failed', v_new_retry_count >= v_notif.max_retries,
    'next_retry_at', v_next_retry
  );
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 5. FUNCTION: Get retryable notifications
-- ============================================================

CREATE OR REPLACE FUNCTION get_retryable_notifications(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  notification_id UUID,
  profile_id UUID,
  channel TEXT,
  event_type TEXT,
  event_id TEXT,
  title TEXT,
  message TEXT,
  retry_count INTEGER,
  max_retries INTEGER,
  next_retry_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.profile_id,
    n.channel,
    n.event_type,
    n.event_id,
    n.title,
    n.message,
    n.retry_count,
    n.max_retries,
    n.next_retry_at
  FROM notifications n
  WHERE n.status = 'failed'
    AND n.retry_count < n.max_retries
    AND (n.next_retry_at IS NULL OR n.next_retry_at <= now())
  ORDER BY n.next_retry_at ASC NULLS FIRST, n.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 6. FUNCTION: Check for duplicate event (idempotency)
-- ============================================================

CREATE OR REPLACE FUNCTION notification_event_exists(
  p_event_type TEXT,
  p_event_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM notifications
    WHERE event_type = p_event_type
      AND event_id = p_event_id
      AND status IN ('pending', 'delivered')
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================
-- 7. COMMENTS
-- ============================================================

COMMENT ON COLUMN notifications.channel IS 'Delivery channel: in_app, email, or push';
COMMENT ON COLUMN notifications.status IS 'Delivery status: pending, delivered, or failed';
COMMENT ON COLUMN notifications.event_type IS 'Event type for idempotency (e.g. BOOKING_CONFIRMED)';
COMMENT ON COLUMN notifications.event_id IS 'Event ID for idempotency (e.g. appointment UUID)';
COMMENT ON COLUMN notifications.retry_count IS 'Number of delivery attempts made';
COMMENT ON COLUMN notifications.max_retries IS 'Maximum delivery attempts allowed (default 3)';
COMMENT ON COLUMN notifications.next_retry_at IS 'When to next attempt delivery (exponential backoff)';
COMMENT ON COLUMN notifications.delivered_at IS 'When the notification was successfully delivered';
COMMENT ON COLUMN notifications.failure_reason IS 'Last failure reason for debugging';

COMMENT ON FUNCTION mark_notification_delivered(UUID)
  IS 'Marks a notification as successfully delivered';
COMMENT ON FUNCTION mark_notification_failed(UUID, TEXT)
  IS 'Marks a notification as failed and schedules retry with exponential backoff';
COMMENT ON FUNCTION get_retryable_notifications(INTEGER)
  IS 'Returns failed notifications that are due for retry';
COMMENT ON FUNCTION notification_event_exists(TEXT, TEXT)
  IS 'Checks if a notification for this event already exists (idempotency)';
