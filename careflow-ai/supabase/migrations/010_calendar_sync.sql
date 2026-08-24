-- CareFlow AI - Calendar Sync
-- Adds calendar integration metadata for appointments.
-- Calendar sync is fire-and-forget: appointment success never depends on calendar success.

-- ============================================================
-- CALENDAR_SYNC
-- One row per appointment × provider × role (patient/doctor).
-- Stores the external Google Calendar event ID so we can
-- update/delete events on reschedule/cancel.
-- ============================================================
CREATE TABLE calendar_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google'
    CHECK (provider IN ('google', 'outlook', 'apple')),
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor')),
  external_event_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'deleted')),
  last_sync_error TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- One event per appointment per profile per provider per role
CREATE UNIQUE INDEX idx_calendar_sync_unique
  ON calendar_sync(appointment_id, profile_id, provider, role);

CREATE INDEX idx_calendar_sync_appointment ON calendar_sync(appointment_id);
CREATE INDEX idx_calendar_sync_status ON calendar_sync(sync_status);
CREATE INDEX idx_calendar_sync_external ON calendar_sync(external_event_id) WHERE external_event_id IS NOT NULL;

-- ============================================================
-- UPDATED_AT trigger for calendar_sync
-- ============================================================
CREATE TRIGGER trigger_calendar_sync_updated_at
  BEFORE UPDATE ON calendar_sync
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RPC: Upsert calendar sync record
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_calendar_sync(
  p_appointment_id UUID,
  p_profile_id UUID,
  p_provider TEXT,
  p_role TEXT,
  p_external_event_id TEXT,
  p_sync_status TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO calendar_sync (
    appointment_id, profile_id, provider, role,
    external_event_id, sync_status, synced_at
  ) VALUES (
    p_appointment_id, p_profile_id, p_provider, p_role,
    p_external_event_id, p_sync_status,
    CASE WHEN p_sync_status = 'synced' THEN now() ELSE NULL END
  )
  ON CONFLICT (appointment_id, profile_id, provider, role)
  DO UPDATE SET
    external_event_id = EXCLUDED.external_event_id,
    sync_status = EXCLUDED.sync_status,
    synced_at = EXCLUDED.synced_at,
    last_sync_error = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RPC: Mark calendar sync as failed
-- ============================================================
CREATE OR REPLACE FUNCTION mark_calendar_sync_failed(
  p_appointment_id UUID,
  p_profile_id UUID,
  p_provider TEXT,
  p_role TEXT,
  p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO calendar_sync (
    appointment_id, profile_id, provider, role,
    sync_status, last_sync_error
  ) VALUES (
    p_appointment_id, p_profile_id, p_provider, p_role,
    'failed', p_error_message
  )
  ON CONFLICT (appointment_id, profile_id, provider, role)
  DO UPDATE SET
    sync_status = 'failed',
    last_sync_error = EXCLUDED.last_sync_error;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RPC: Mark calendar sync as deleted
-- ============================================================
CREATE OR REPLACE FUNCTION mark_calendar_sync_deleted(
  p_appointment_id UUID,
  p_profile_id UUID,
  p_provider TEXT,
  p_role TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE calendar_sync
  SET sync_status = 'deleted',
      external_event_id = NULL
  WHERE appointment_id = p_appointment_id
    AND profile_id = p_profile_id
    AND provider = p_provider
    AND role = p_role;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RPC: Get calendar sync records for an appointment
-- ============================================================
CREATE OR REPLACE FUNCTION get_calendar_syncs(p_appointment_id UUID)
RETURNS TABLE (
  sync_id UUID,
  profile_id UUID,
  provider TEXT,
  role TEXT,
  external_event_id TEXT,
  sync_status TEXT,
  last_sync_error TEXT,
  synced_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id, cs.profile_id, cs.provider, cs.role,
    cs.external_event_id, cs.sync_status,
    cs.last_sync_error, cs.synced_at
  FROM calendar_sync cs
  WHERE cs.appointment_id = p_appointment_id
  ORDER BY cs.created_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE calendar_sync IS 'Tracks external calendar event sync status per appointment per user role';
COMMENT ON COLUMN calendar_sync.external_event_id IS 'Google Calendar event ID (or other provider event ID)';
COMMENT ON COLUMN calendar_sync.sync_status IS 'pending → synced | failed | deleted';

-- ============================================================
-- OAUTH_TOKENS
-- Stores OAuth2 access and refresh tokens per user per provider.
-- Access tokens expire; refresh tokens are used to renew them.
-- Tokens are NEVER exposed to the browser.
-- ============================================================
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google'
    CHECK (provider IN ('google', 'outlook', 'apple')),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id, provider)
);

CREATE INDEX idx_oauth_tokens_profile ON oauth_tokens(profile_id);

CREATE TRIGGER trigger_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE oauth_tokens IS 'OAuth2 tokens for calendar provider integrations. NEVER expose to browser.';
