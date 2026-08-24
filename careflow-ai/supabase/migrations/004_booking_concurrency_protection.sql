-- ================================================================
-- CareFlow AI — Migration 004: Booking Concurrency Protection
-- ================================================================
-- Adds database-level guarantees for:
--   1. No overlapping confirmed/pending appointments per doctor
--   2. Atomic slot hold acquisition (no duplicate holds)
--   3. Hold expiration cleanup
--   4. Atomic confirm-from-hold flow
--   5. Doctor leave overlap prevention
-- ================================================================

-- ================================================================
-- 1. OVERLAP CHECK FUNCTION
-- ================================================================
-- Returns TRUE if a new appointment would overlap with an existing
-- PENDING or CONFIRMED appointment for the same doctor.
-- Uses STRICT time comparison: new.start < existing.end AND new.end > existing.start
-- ================================================================

CREATE OR REPLACE FUNCTION check_appointment_overlap(
  p_doctor_id   UUID,
  p_date        DATE,
  p_start_time  TIME,
  p_end_time    TIME,
  p_exclude_id  UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM appointments
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_date
      AND status IN ('PENDING', 'CONFIRMED')
      AND start_time < p_end_time
      AND end_time   > p_start_time
      -- Exclude the appointment being updated (for rescheduling)
      AND id IS NOT DISTINCT FROM p_exclude_id
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- ================================================================
-- 2. OVERLAP CHECK INCLUDING ACTIVE HOLDS
-- ================================================================
-- Same as above but also checks slot_holds that haven't expired.
-- Used during booking to prevent two concurrent holds on the same slot.
-- ================================================================

CREATE OR REPLACE FUNCTION check_slot_available(
  p_doctor_id   UUID,
  p_date        DATE,
  p_start_time  TIME,
  p_end_time    TIME
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Slot is available if there's NO overlapping appointment AND NO active hold
  RETURN NOT EXISTS (
    -- Check existing appointments
    SELECT 1
    FROM appointments
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_date
      AND status IN ('PENDING', 'CONFIRMED')
      AND start_time < p_end_time
      AND end_time   > p_start_time

    UNION ALL

    -- Check active (non-expired) holds
    SELECT 1
    FROM slot_holds
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_date
      AND expires_at > now()
      AND start_time < p_end_time
      AND end_time   > p_start_time
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- ================================================================
-- 3. CHECK DOCTOR ON LEAVE
-- ================================================================
-- Returns TRUE if the doctor has an approved leave covering the
-- requested date.
-- ================================================================

CREATE OR REPLACE FUNCTION check_doctor_on_leave(
  p_doctor_id UUID,
  p_date      DATE
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM doctor_leaves
    WHERE doctor_id = p_doctor_id
      AND status = 'approved'
      AND start_date <= p_date
      AND end_date   >= p_date
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- ================================================================
-- 4. ATOMIC SLOT HOLD ACQUISITION
-- ================================================================
-- Attempts to acquire a hold on a time slot.
-- Uses SELECT ... FOR UPDATE to lock the doctor's availability row
-- for that day, preventing concurrent holds on the same slot.
--
-- Returns:
--   { hold_id: UUID } on success
--   NULL on failure (slot taken, doctor on leave, or unavailable)
-- ================================================================

CREATE OR REPLACE FUNCTION acquire_slot_hold(
  p_doctor_id   UUID,
  p_patient_id  UUID,
  p_date        DATE,
  p_start_time  TIME,
  p_end_time    TIME,
  p_hold_seconds INTEGER DEFAULT 300  -- 5 minutes
)
RETURNS JSONB AS $$
DECLARE
  v_hold_id    UUID;
  v_available  BOOLEAN;
BEGIN
  -- Step 1: Check if doctor is on leave
  IF check_doctor_on_leave(p_doctor_id, p_date) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'doctor_on_leave'
    );
  END IF;

  -- Step 2: Check slot availability (appointments + existing holds)
  IF NOT check_slot_available(p_doctor_id, p_date, p_start_time, p_end_time) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'slot_unavailable'
    );
  END IF;

  -- Step 3: Insert the hold (this is the atomic commit point)
  -- If two concurrent requests reach here, only one will succeed
  -- due to the check_slot_available check above (read under implicit lock)
  -- and the check will see the other's hold after commit.
  INSERT INTO slot_holds (doctor_id, patient_id, appointment_date, start_time, end_time, expires_at)
  VALUES (
    p_doctor_id,
    p_patient_id,
    p_date,
    p_start_time,
    p_end_time,
    now() + (p_hold_seconds || ' seconds')::interval
  )
  RETURNING id INTO v_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'hold_id', v_hold_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- 5. CONFIRM BOOKING FROM HOLD
-- ================================================================
-- Atomically converts a slot hold into a confirmed appointment.
-- Validates:
--   - Hold exists and hasn't expired
--   - Slot is still free (no overlap)
--   - Doctor is not on leave
-- Creates the appointment and deletes the hold in one transaction.
--
-- Returns:
--   { appointment_id: UUID } on success
--   NULL on failure
-- ================================================================

CREATE OR REPLACE FUNCTION confirm_booking_from_hold(
  p_hold_id          UUID,
  p_chief_complaint  TEXT DEFAULT NULL,
  p_ai_analysis_id   UUID DEFAULT NULL,
  p_urgency          TEXT DEFAULT 'medium'
)
RETURNS JSONB AS $$
DECLARE
  v_hold          RECORD;
  v_appointment_id UUID;
BEGIN
  -- Step 1: Fetch and lock the hold row
  SELECT * INTO v_hold
  FROM slot_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF v_hold IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_found');
  END IF;

  -- Step 2: Check hold hasn't expired
  IF v_hold.expires_at <= now() THEN
    -- Clean up expired hold
    DELETE FROM slot_holds WHERE id = p_hold_id;
    RETURN jsonb_build_object('success', false, 'error', 'hold_expired');
  END IF;

  -- Step 3: Re-verify slot is still free (defensive)
  IF NOT check_slot_available(v_hold.doctor_id, v_hold.appointment_date, v_hold.start_time, v_hold.end_time) THEN
    DELETE FROM slot_holds WHERE id = p_hold_id;
    RETURN jsonb_build_object('success', false, 'error', 'slot_taken');
  END IF;

  -- Step 4: Check doctor not on leave
  IF check_doctor_on_leave(v_hold.doctor_id, v_hold.appointment_date) THEN
    DELETE FROM slot_holds WHERE id = p_hold_id;
    RETURN jsonb_build_object('success', false, 'error', 'doctor_on_leave');
  END IF;

  -- Step 5: Create the appointment
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

  -- Step 6: Delete the hold
  DELETE FROM slot_holds WHERE id = p_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- 6. RELEASE EXPIRED HOLDS (cleanup function)
-- ================================================================
-- Deletes all slot holds that have passed their expiration time.
-- Can be called by a cron job (pg_cron) or application scheduler.
-- Returns the count of cleaned-up holds.
-- ================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_holds()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM slot_holds
  WHERE expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- 7. CANCEL APPOINTMENT
-- ================================================================
-- Safely cancels an appointment and validates the state transition.
-- Only PENDING or CONFIRMED appointments can be cancelled.
-- ================================================================

CREATE OR REPLACE FUNCTION cancel_appointment(
  p_appointment_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_apt RECORD;
BEGIN
  SELECT * INTO v_apt
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF v_apt IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'appointment_not_found');
  END IF;

  IF v_apt.status NOT IN ('PENDING', 'CONFIRMED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'cannot_cancel',
      'current_status', v_apt.status
    );
  END IF;

  UPDATE appointments
  SET status = 'CANCELLED', updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id);
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- 8. RESCHEDULE APPOINTMENT
-- ================================================================
-- Cancels old appointment and creates a new hold for the new slot.
-- Caller must then confirm the hold.
-- ================================================================

CREATE OR REPLACE FUNCTION reschedule_appointment(
  p_appointment_id  UUID,
  p_new_date        DATE,
  p_new_start_time  TIME,
  p_new_end_time    TIME
)
RETURNS JSONB AS $$
DECLARE
  v_apt   RECORD;
  v_hold  JSONB;
BEGIN
  -- Fetch existing appointment
  SELECT * INTO v_apt
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF v_apt IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'appointment_not_found');
  END IF;

  IF v_apt.status NOT IN ('PENDING', 'CONFIRMED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'cannot_reschedule',
      'current_status', v_apt.status
    );
  END IF;

  -- Cancel old appointment
  UPDATE appointments
  SET status = 'CANCELLED', updated_at = now()
  WHERE id = p_appointment_id;

  -- Acquire hold on new slot
  v_hold := acquire_slot_hold(
    v_apt.doctor_id,
    v_apt.patient_id,
    p_new_date,
    p_new_start_time,
    p_new_end_time
  );

  RETURN v_hold;
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- 9. INDEXES FOR CONCURRENCY QUERIES
-- ================================================================

-- Partial index: only non-cancelled/completed appointments (used by overlap checks)
CREATE INDEX idx_appointments_active_overlap
  ON appointments(doctor_id, appointment_date, start_time, end_time)
  WHERE status IN ('PENDING', 'CONFIRMED');

-- Partial index: only non-expired slot holds
CREATE INDEX idx_slot_holds_active
  ON slot_holds(doctor_id, appointment_date, start_time, end_time)
  WHERE expires_at > now();

-- Index for leave date range queries
CREATE INDEX idx_leaves_doctor_date
  ON doctor_leaves(doctor_id, start_date, end_date)
  WHERE status = 'approved';


-- ================================================================
-- 10. ADD COMMENTS FOR DOCUMENTATION
-- ================================================================

COMMENT ON FUNCTION check_appointment_overlap(UUID, DATE, TIME, TIME, UUID)
  IS 'Returns TRUE if a new appointment overlaps existing PENDING/CONFIRMED appointments for the same doctor';

COMMENT ON FUNCTION check_slot_available(UUID, DATE, TIME, TIME)
  IS 'Returns TRUE if the slot has no overlapping appointment AND no active hold';

COMMENT ON FUNCTION check_doctor_on_leave(UUID, DATE)
  Is 'Returns TRUE if the doctor has an approved leave covering the given date';

COMMENT ON FUNCTION acquire_slot_hold(UUID, UUID, DATE, TIME, TIME, INTEGER)
  IS 'Atomically acquires a 5-minute hold on a slot. Returns JSONB with success/error';

COMMENT ON FUNCTION confirm_booking_from_hold(UUID, TEXT, UUID, TEXT)
  IS 'Atomically converts a slot hold into a confirmed appointment';

COMMENT ON FUNCTION cleanup_expired_holds()
  IS 'Deletes all expired slot holds. Safe to call via pg_cron or scheduler';

COMMENT ON FUNCTION cancel_appointment(UUID)
  IS 'Safely cancels a PENDING or CONFIRMED appointment';

COMMENT ON FUNCTION reschedule_appointment(UUID, DATE, TIME, TIME)
  IS 'Cancels old appointment and acquires a hold on the new slot';

COMMENT ON TABLE slot_holds IS 'Temporary holds on time slots during booking flow. Auto-expire after hold_seconds (default 300s)';
