-- ================================================================
-- CareFlow AI — Migration 006: Cancellation & Rescheduling (A4.4)
-- ================================================================
-- Adds:
--   1. cancel_appointment_with_auth: patient-authorized cancellation
--   2. cancel_old_for_reschedule: reschedule helper that cancels
--      old appointment after new booking is confirmed
-- ================================================================

-- ================================================================
-- 1. AUTHORIZED CANCELLATION FUNCTION
-- ================================================================
-- Patient-safe cancellation that verifies ownership.
-- Validates:
--   - Appointment exists                → APPOINTMENT_NOT_FOUND
--   - Patient owns the appointment      → UNAUTHORIZED
--   - Status is cancellable             → CANNOT_CANCEL
--   - Appointment is in the future      → CANNOT_CANCEL_PAST
-- Sets status to CANCELLED atomically.
-- The slot is automatically freed because overlap checks only
-- consider PENDING/CONFIRMED appointments.
-- ================================================================

CREATE OR REPLACE FUNCTION cancel_appointment_with_auth(
  p_appointment_id UUID,
  p_patient_id     UUID
)
RETURNS JSONB AS $$
DECLARE
  v_apt RECORD;
BEGIN
  -- Step 1: Fetch and lock the appointment row
  SELECT * INTO v_apt
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  -- Step 2: Not found
  IF v_apt IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'APPOINTMENT_NOT_FOUND',
      'message', 'Appointment not found.'
    );
  END IF;

  -- Step 3: Ownership check
  IF v_apt.patient_id <> p_patient_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'You do not own this appointment.'
    );
  END IF;

  -- Step 4: Status check
  IF v_apt.status NOT IN ('PENDING', 'CONFIRMED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CANNOT_CANCEL',
      'message', 'This appointment cannot be cancelled (status: ' || v_apt.status || ').',
      'current_status', v_apt.status
    );
  END IF;

  -- Step 5: Past-appointment check (cannot cancel appointments that already happened)
  IF v_apt.appointment_date < CURRENT_DATE OR
     (v_apt.appointment_date = CURRENT_DATE AND v_apt.end_time < CURRENT_TIME) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CANNOT_CANCEL',
      'message', 'Cannot cancel an appointment that has already passed.'
    );
  END IF;

  -- Step 6: Cancel
  UPDATE appointments
  SET status = 'CANCELLED', updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'message', 'Appointment cancelled successfully.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CANCEL_FAILED',
      'message', 'Failed to cancel appointment: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- 2. RESCHEDULE HELPER: CANCEL OLD AFTER NEW IS CONFIRMED
-- ================================================================
-- Called by the application layer after the new appointment has
-- been successfully confirmed. Cancels the old appointment.
-- Verifies ownership and status before cancelling.
-- ================================================================

CREATE OR REPLACE FUNCTION cancel_old_for_reschedule(
  p_appointment_id UUID,
  p_patient_id     UUID
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
    RETURN jsonb_build_object('success', false, 'error', 'APPOINTMENT_NOT_FOUND');
  END IF;

  IF v_apt.patient_id <> p_patient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  IF v_apt.status NOT IN ('PENDING', 'CONFIRMED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CANNOT_CANCEL',
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
-- COMMENTS
-- ================================================================

COMMENT ON FUNCTION cancel_appointment_with_auth(UUID, UUID)
  IS 'Patient-authorized appointment cancellation with ownership and status validation';

COMMENT ON FUNCTION cancel_old_for_reschedule(UUID, UUID)
  IS 'Cancels an old appointment during reschedule after new booking is confirmed';
