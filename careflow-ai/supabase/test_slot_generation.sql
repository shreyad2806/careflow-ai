-- ================================================================
-- CareFlow AI — Slot Generation Test Data (Step 4)
-- ================================================================
--
-- Purpose: Create minimal deterministic test data for slot generation
-- Uses existing demo doctor and patient records from seed_demo.sql
--
-- Test scenario:
-- 1. Doctor availability on a future weekday (Monday)
-- 2. One confirmed appointment inside an available window
-- 3. One doctor leave period overlapping available hours
--
-- This script dynamically resolves doctor/patient IDs from existing profiles
-- Safe to re-run: uses NOT EXISTS guards
-- ================================================================

-- ================================================================
-- Resolve existing doctor and patient IDs from seed data
-- ================================================================
WITH auth_users AS (
  SELECT id, email FROM auth.users WHERE email IN (
    'doctor@careflow.demo',
    'patient@careflow.demo'
  )
),
doctor_user AS (SELECT id FROM auth_users WHERE email = 'doctor@careflow.demo'),
patient_user AS (SELECT id FROM auth_users WHERE email = 'patient@careflow.demo'),
resolved_doctor AS (
  SELECT d.id AS doctor_id 
  FROM doctors d 
  JOIN doctor_user du ON d.profile_id = du.id
),
resolved_patient AS (
  SELECT p.id AS patient_id 
  FROM patients p 
  JOIN patient_user pu ON p.profile_id = pu.id
),

-- ================================================================
-- Test date: Next Monday (deterministic future weekday)
-- ================================================================
test_dates AS (
  SELECT 
    -- Next Monday (if today is Monday, use next Monday to avoid today)
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN CURRENT_DATE + interval '7 days'
      ELSE CURRENT_DATE + ((1 - EXTRACT(DOW FROM CURRENT_DATE) + 7) % 7)::integer * interval '1 day'
    END::date AS test_monday,
    -- Following Wednesday for leave test
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_DATE) <= 3 THEN CURRENT_DATE + ((3 - EXTRACT(DOW FROM CURRENT_DATE))::integer * interval '1 day')
      ELSE CURRENT_DATE + ((3 - EXTRACT(DOW FROM CURRENT_DATE) + 7)::integer * interval '1 day')
    END::date AS test_wednesday
),

-- ================================================================
-- 1. Doctor Availability for Test Monday
--    Window: 09:00-12:00 (3 hours, 6 slots of 30 min)
-- ================================================================
insert_availability AS (
  INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, is_active)
  SELECT rd.doctor_id, 1, '09:00'::time, '12:00'::time, 30, true
  FROM resolved_doctor rd
  WHERE NOT EXISTS (
    SELECT 1 FROM doctor_availability da 
    WHERE da.doctor_id = rd.doctor_id 
      AND da.day_of_week = 1 
      AND da.start_time = '09:00'::time
  )
  RETURNING id
),

-- ================================================================
-- 2. Confirmed Appointment on Test Monday
--    Time: 10:00-10:30 (inside availability window)
--    This slot should be excluded from generated slots
-- ================================================================
insert_appointment AS (
  INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, 
    status, urgency, chief_complaint)
  SELECT rp.patient_id, rd.doctor_id, td.test_monday, '10:00'::time, '10:30'::time,
    'CONFIRMED', 'medium', 'Test appointment for slot generation verification'
  FROM resolved_patient rp, resolved_doctor rd, test_dates td
  WHERE NOT EXISTS (
    SELECT 1 FROM appointments a 
    WHERE a.doctor_id = rd.doctor_id 
      AND a.appointment_date = td.test_monday
      AND a.start_time = '10:00'::time
  )
  RETURNING id
),

-- ================================================================
-- 3. Doctor Leave on Test Wednesday
--    Time: 10:00-14:00 (4 hours, overlapping typical availability)
--    All slots in this period should be excluded
-- ================================================================
insert_leave AS (
  INSERT INTO doctor_leaves (doctor_id, start_date, end_date, start_time, end_time, 
    status, reason)
  SELECT rd.doctor_id, td.test_wednesday, td.test_wednesday, 
    '10:00'::time, '14:00'::time, 'APPROVED', 'Test leave for slot generation verification'
  FROM resolved_doctor rd, test_dates td
  WHERE NOT EXISTS (
    SELECT 1 FROM doctor_leaves dl 
    WHERE dl.doctor_id = rd.doctor_id 
      AND dl.start_date = td.test_wednesday
      AND dl.start_time = '10:00'::time
  )
  RETURNING id
)

-- ================================================================
-- Verification: Show created test data
-- ================================================================
SELECT 'Test Configuration' AS info, 
       'Doctor: ' || p.full_name AS detail
FROM profiles p
JOIN resolved_doctor rd ON p.id = (SELECT profile_id FROM doctors WHERE id = rd.doctor_id)

UNION ALL

SELECT 'Test Monday' AS info, 
       to_char(td.test_monday, 'YYYY-MM-DD (Day)') AS detail
FROM test_dates td

UNION ALL

SELECT 'Availability Window' AS info, 
       '09:00-12:00 (6 slots of 30 min)' AS detail

UNION ALL

SELECT 'Confirmed Appointment' AS info, 
       '10:00-10:30 (excluded from slots)' AS detail

UNION ALL

SELECT 'Test Wednesday' AS info, 
       to_char(td.test_wednesday, 'YYYY-MM-DD (Day)') AS detail
FROM test_dates td

UNION ALL

SELECT 'Doctor Leave' AS info, 
       '10:00-14:00 (all slots excluded)' AS detail

ORDER BY info;

-- ================================================================
-- Verification Queries (run these after inserting test data)
-- ================================================================

-- Verify doctor availability for test Monday
SELECT 
  da.day_of_week,
  da.start_time,
  da.end_time,
  da.slot_duration_minutes,
  da.is_active
FROM doctor_availability da
JOIN resolved_doctor rd ON da.doctor_id = rd.doctor_id
CROSS JOIN test_dates td
WHERE da.day_of_week = EXTRACT(DOW FROM td.test_monday)::integer;

-- Verify confirmed appointment on test Monday
SELECT 
  a.appointment_date,
  a.start_time,
  a.end_time,
  a.status,
  p.full_name AS patient_name
FROM appointments a
JOIN resolved_doctor rd ON a.doctor_id = rd.doctor_id
JOIN resolved_patient rp ON a.patient_id = rp.patient_id
JOIN profiles p ON rp.profile_id = p.id
CROSS JOIN test_dates td
WHERE a.appointment_date = td.test_monday
  AND a.status = 'CONFIRMED';

-- Verify doctor leave on test Wednesday
SELECT 
  dl.start_date,
  dl.end_date,
  dl.start_time,
  dl.end_time,
  dl.status,
  dl.reason
FROM doctor_leaves dl
JOIN resolved_doctor rd ON dl.doctor_id = rd.doctor_id
CROSS JOIN test_dates td
WHERE dl.start_date = td.test_wednesday
  AND dl.status = 'APPROVED';

-- ================================================================
-- Expected Slot Generation Result for Test Monday
-- ================================================================
-- 
-- Availability Window: 09:00-12:00 (3 hours)
-- Slot Duration: 30 minutes
-- Total Potential Slots: 6 (09:00, 09:30, 10:00, 10:30, 11:00, 11:30)
--
-- Exclusions:
-- - Confirmed Appointment: 10:00-10:30 (excludes 10:00 slot)
--
-- Expected Available Slots: 5
-- 1. 09:00-09:30
-- 2. 09:30-10:00
-- 3. 10:30-11:00
-- 4. 11:00-11:30
-- 5. 11:30-12:00
--
-- Note: 10:00-10:30 slot is excluded due to confirmed appointment
-- ================================================================

-- ================================================================
-- Expected Slot Generation Result for Test Wednesday
-- ================================================================
--
-- If availability exists for Wednesday (09:00-17:00 from seed data):
-- Leave Period: 10:00-14:00 (4 hours)
-- 
-- Expected Behavior:
-- - All slots between 10:00-14:00 should be excluded
-- - Slots before 10:00 (09:00-09:30, 09:30-10:00) should be available
-- - Slots after 14:00 (14:00-14:30, 14:30-15:00, etc.) should be available
-- ================================================================

-- ================================================================
-- Cleanup SQL (run this to remove test data)
-- ================================================================

-- Remove test appointment
DELETE FROM appointments
WHERE doctor_id = (SELECT doctor_id FROM resolved_doctor)
  AND patient_id = (SELECT patient_id FROM resolved_patient)
  AND start_time = '10:00'::time
  AND appointment_date = (SELECT test_monday FROM test_dates);

-- Remove test availability
DELETE FROM doctor_availability
WHERE doctor_id = (SELECT doctor_id FROM resolved_doctor)
  AND day_of_week = 1
  AND start_time = '09:00'::time
  AND end_time = '12:00'::time;

-- Remove test leave
DELETE FROM doctor_leaves
WHERE doctor_id = (SELECT doctor_id FROM resolved_doctor)
  AND start_date = (SELECT test_wednesday FROM test_dates)
  AND start_time = '10:00'::time;
