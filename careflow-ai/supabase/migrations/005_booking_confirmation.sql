-- ================================================================
-- CareFlow AI — Migration 005: Booking Confirmation (Phase A4.3)
-- ================================================================
-- Adds:
--   1. confirm_booking_with_auth: patient-authorized atomic confirmation
--   2. prevent_overlapping_appointments: trigger-based constraint
--   3. Index on slot_holds(patient_id) for ownership lookups
-- ================================================================

-- ================================================================
-- 1. AUTHORIZED BOOKING CONFIRMATION FUNCTION
-- ================================================================
-- Wraps the confirm_booking_from_hold logic with patient ownership
-- verification. Returns explicit domain error codes for the frontend.
--
-- Flow:
--   a. Fetch and FOR UPDATE lock the hold row
--   b. Verify hold exists                → HOLD_NOT_FOUND
--   c. Verify patient owns the hold      → UNAUTHORIZED_HOLD
--   d. Verify hold hasn't expired        → HOLD_EXPIRED
--   e. Re-check doctor availability      → DOCTOR_UNAVAILABLE
--   f. Re-check no overlapping appt      → SLOT_ALREADY_BOOKED
--   g. INSERT confirmed appointment      → BOOKING_CONFLICT (on overlap)
--   h. DELETE the consumed hold
--   All in one transaction. Rollback on any failure.
-- ================================================================

CREATE OR REPLACE FUNCTION confirm_booking_with_auth(
  p_hold_id          UUID,
  p_patient_id       UUID,
  p_chief_complaint  TEXT DEFAULT NULL,
  p_ai_analysis_id   UUID DEFAULT NULL,
  p_urgency          TEXT DEFAULT 'medium'
)
RETURNS JSONB AS $$
DECLARE
  v_hold           RECORD;
  v_appointment_id UUID;
  v_slot_overlap   BOOLEAN;
BEGIN
  -- Step 1: Fetch and lock the hold row (prevents concurrent confirmation of same hold)
  SELECT * INTO v_hold
  FROM slot_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  -- Step 2: Hold not found
  IF v_hold IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'HOLD_NOT_FOUND',
      'message', 'The booking hold was not found.'
    );
  END IF;

  -- Step 3: Patient ownership check
  IF v_hold.patient_id <> p_patient_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED_HOLD',
      'message', 'This hold belongs to another patient.'
    );
  END IF;

  -- Step 4: Hold expiration check
  IF v_hold.expires_at <= now() THEN
    -- Clean up expired hold
    DELETE FROM slot_holds WHERE id = p_hold_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'HOLD_EXPIRED',
      'message', 'Your hold has expired. Please select a new slot.'
    );
  END IF;

  -- Step 5: Re-check doctor is active (availability)
  IF NOT EXISTS (
    SELECT 1 FROM doctors
    WHERE id = v_hold.doctor_id
      AND is_active = true
  ) THEN
    DELETE FROM slot_holds WHERE id = p_hold_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DOCTOR_UNAVAILABLE',
      'message', 'The doctor is no longer available.'
    );
  END IF;

  -- Step 5b: Re-check doctor not on leave
  IF check_doctor_on_leave(v_hold.doctor_id, v_hold.appointment_date) THEN
    DELETE FROM slot_holds WHERE id = p_hold_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DOCTOR_UNAVAILABLE',
      'message', 'The doctor is on approved leave for this date.'
    );
  END IF;

  -- Step 6: Re-check no overlapping confirmed/pending appointment
  -- Note: check_slot_available includes active holds, but since OUR hold is
  -- locked and still active, we need to check specifically for appointments only.
  v_slot_overlap := EXISTS (
    SELECT 1
    FROM appointments
    WHERE doctor_id = v_hold.doctor_id
      AND appointment_date = v_hold.appointment_date
      AND status IN ('PENDING', 'CONFIRMED')
      AND start_time < v_hold.end_time
      AND end_time   > v_hold.start_time
  );

  IF v_slot_overlap THEN
    DELETE FROM slot_holds WHERE id = p_hold_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SLOT_ALREADY_BOOKED',
      'message', 'This slot has already been booked by another patient.'
    );
  END IF;

  -- Step 7: Create the confirmed appointment
  BEGIN
    INSERT INTO appointments (
      patient_id, doctor_id, appointment_date,
      start_time, end_time, status,
      urgency, chief_complaint, ai_analysis_id
    ) VALUES (
      v_hold.patient_id, v_hold.doctor_id, v_hold.appointment_date,
      v_hold.start_time, v_hold.end_time, 'CONFIRMED',
      p_urgency, p_chief_complaint, p_ai_analysis_id
    )
    RETURNING id INTO v_appointment_id;

  EXCEPTION
    WHEN OTHERS THEN
      -- Catch any constraint violation (e.g., trigger-based overlap check)
      RETURN jsonb_build_object(
        'success', false,
        'error', 'BOOKING_CONFLICT',
        'message', 'A booking conflict was detected. ' || SQLERRM
      );
  END;

  -- Step 8: Delete the consumed hold
  DELETE FROM slot_holds WHERE id = p_hold_id;

  -- Step 9: Success
  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'message', 'Appointment confirmed successfully.'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Catch-all: ensures no partial state remains
    -- The entire transaction rolls back automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BOOKING_FAILED',
      'message', 'An unexpected error occurred: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- 2. OVERLAPPING APPOINTMENTS TRIGGER (defense-in-depth)
-- ================================================================
-- Fires on INSERT to appointments. Rejects the row if it would
-- create a time overlap with an existing PENDING/CONFIRMED appt
-- for the same doctor on the same date.
--
-- This is a hard DB-level guardrail in addition to the application
-- logic in confirm_booking_with_auth. Even if the application layer
-- has a bug, this trigger prevents duplicates.
-- ================================================================

CREATE OR REPLACE FUNCTION prevent_overlapping_appointments()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for active appointment statuses
  IF NEW.status IN ('PENDING', 'CONFIRMED') THEN
    IF EXISTS (
      SELECT 1
      FROM appointments
      WHERE doctor_id = NEW.doctor_id
        AND appointment_date = NEW.appointment_date
        AND status IN ('PENDING', 'CONFIRMED')
        AND start_time < NEW.end_time
        AND end_time   > NEW.start_time
        -- Exclude the row being updated (for reschedule scenarios)
        AND id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'BOOKING_CONFLICT: Overlapping appointment exists for doctor % on % at %-%',
        NEW.doctor_id, NEW.appointment_date, NEW.start_time, NEW.end_time;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS trg_prevent_overlapping_appointments ON appointments;

CREATE CONSTRAINT TRIGGER trg_prevent_overlapping_appointments
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_overlapping_appointments();


-- ================================================================
-- 3. INDEX FOR PATIENT OWNERSHIP LOOKUPS
-- ================================================================
-- Speeds up the confirm_booking_with_auth WHERE patient_id check
-- and other patient-scoped hold queries.
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_slot_holds_patient
  ON slot_holds(patient_id);


-- ================================================================
-- 4. COMMENTS
-- ================================================================

COMMENT ON FUNCTION confirm_booking_with_auth(UUID, UUID, TEXT, UUID, TEXT)
  IS 'Patient-authorized atomic booking confirmation. Validates ownership, expiry, availability. Returns JSONB with explicit domain error codes.';

COMMENT ON FUNCTION prevent_overlapping_appointments()
  IS 'BEFORE INSERT/UPDATE trigger that prevents overlapping PENDING/CONFIRMED appointments for the same doctor';

COMMENT ON CONSTRAINT trg_prevent_overlapping_appointments ON appointments
  IS 'Ensures no two active appointments overlap for the same doctor';
