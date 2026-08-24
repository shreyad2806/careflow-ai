-- CareFlow AI - Migration 008: Leave Conflict Handling
-- Adds:
--   1. Unique constraint to prevent duplicate approved leaves
--   2. Function to find affected appointments for a leave period
--   3. Function to release overlapping slot holds
--   4. Function to check for overlapping approved leaves

-- ============================================================
-- 1. UNIQUE CONSTRAINT: prevent duplicate approved leaves
-- ============================================================
-- Only one approved leave per doctor per date range.
-- Uses a partial unique index (only for 'approved' status).

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_leaves_unique_approved
  ON doctor_leaves(doctor_id, start_date, end_date)
  WHERE status = 'approved';

-- Also add a check for overlapping leaves via a trigger/function
-- This prevents two approved leaves that share any dates for the same doctor.

CREATE OR REPLACE FUNCTION check_leave_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    IF EXISTS (
      SELECT 1
      FROM doctor_leaves
      WHERE doctor_id = NEW.doctor_id
        AND status = 'approved'
        AND id IS DISTINCT FROM NEW.id
        AND start_date <= NEW.end_date
        AND end_date   >= NEW.start_date
    ) THEN
      RAISE EXCEPTION 'Doctor already has an approved leave overlapping the period % to %',
        NEW.start_date, NEW.end_date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_leave_overlap
  BEFORE INSERT OR UPDATE ON doctor_leaves
  FOR EACH ROW EXECUTE FUNCTION check_leave_overlap();


-- ============================================================
-- 2. FIND AFFECTED APPOINTMENTS
-- ============================================================
-- Returns PENDING/CONFIRMED appointments that overlap the leave period.
-- Uses a date range check: appointment_date BETWEEN start AND end.

CREATE OR REPLACE FUNCTION find_affected_appointments(
  p_doctor_id UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS TABLE (
  appointment_id   UUID,
  patient_id       UUID,
  appointment_date DATE,
  start_time       TIME,
  end_time         TIME,
  status           TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.patient_id,
    a.appointment_date,
    a.start_time,
    a.end_time,
    a.status
  FROM appointments a
  WHERE a.doctor_id = p_doctor_id
    AND a.appointment_date >= p_start_date
    AND a.appointment_date <= p_end_date
    AND a.status IN ('PENDING', 'CONFIRMED');
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================
-- 3. RELEASE OVERLAPPING SLOT HOLDS
-- ============================================================
-- Deletes slot holds that fall within the leave period.
-- Returns the count of released holds.

CREATE OR REPLACE FUNCTION release_holds_for_leave(
  p_doctor_id UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM slot_holds
  WHERE doctor_id = p_doctor_id
    AND appointment_date >= p_start_date
    AND appointment_date <= p_end_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 4. CHECK FOR OVERLAPPING APPROVED LEAVES (query helper)
-- ============================================================
-- Returns TRUE if the doctor has an approved leave that overlaps the given range.

CREATE OR REPLACE FUNCTION has_overlapping_leave(
  p_doctor_id   UUID,
  p_start_date  DATE,
  p_end_date    DATE,
  p_exclude_id  UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM doctor_leaves
    WHERE doctor_id = p_doctor_id
      AND status = 'approved'
      AND id IS DISTINCT FROM p_exclude_id
      AND start_date <= p_end_date
      AND end_date   >= p_start_date
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================
-- 5. COMMENTS
-- ============================================================

COMMENT ON FUNCTION find_affected_appointments(UUID, DATE, DATE)
  IS 'Returns PENDING/CONFIRMED appointments overlapping a leave period';

COMMENT ON FUNCTION release_holds_for_leave(UUID, DATE, DATE)
  IS 'Deletes slot holds within a leave period. Returns count of released holds.';

COMMENT ON FUNCTION has_overlapping_leave(UUID, DATE, DATE, UUID)
  IS 'Returns TRUE if doctor has an approved leave overlapping the given date range';
