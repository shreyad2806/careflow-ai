-- ================================================================
-- CareFlow AI — Seed Data (SQL Editor compatible)
-- ================================================================
--
-- PREREQUISITE: Create exactly 3 auth users in the Dashboard first.
-- This script looks them up by email using CTEs — no UUID editing needed.
--
-- Auth users to create (Dashboard → Authentication → Add User):
--
--   Email                        Password     App Metadata
--   ──────────────────────────── ──────────── ──────────────────────────────────
--   admin@careflow.demo           admin123     {"role":"ADMIN","full_name":"Admin User"}
--   doctor@careflow.demo          doctor123    {"role":"DOCTOR","full_name":"Dr. Sarah Johnson"}
--   patient@careflow.demo         patient123   {"role":"PATIENT","full_name":"John Smith"}
--
-- Then paste this entire script into SQL Editor and click Run.
-- ================================================================

-- ================================================================
-- Look up the 3 auth users by email
-- ================================================================
WITH auth_users AS (
  SELECT id, email FROM auth.users WHERE email IN (
    'admin@careflow.demo',
    'doctor@careflow.demo',
    'patient@careflow.demo'
  )
),
admin_user  AS (SELECT id FROM auth_users WHERE email = 'admin@careflow.demo'),
doctor_user AS (SELECT id FROM auth_users WHERE email = 'doctor@careflow.demo'),
patient_user AS (SELECT id FROM auth_users WHERE email = 'patient@careflow.demo'),

-- ================================================================
-- Profiles (may already exist from handle_new_user trigger)
-- ================================================================
upsert_profiles AS (
  INSERT INTO profiles (id, email, full_name, role, preferred_language)
  SELECT au.id, au.email,
    CASE au.email
      WHEN 'admin@careflow.demo'   THEN 'Admin User'
      WHEN 'doctor@careflow.demo'  THEN 'Dr. Sarah Johnson'
      WHEN 'patient@careflow.demo' THEN 'John Smith'
    END,
    CASE au.email
      WHEN 'admin@careflow.demo'   THEN 'ADMIN'
      WHEN 'doctor@careflow.demo'  THEN 'DOCTOR'
      WHEN 'patient@careflow.demo' THEN 'PATIENT'
    END,
    'en'
  FROM auth_users au
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    preferred_language = EXCLUDED.preferred_language
  RETURNING id
),

-- ================================================================
-- Patient record
-- ================================================================
insert_patient AS (
  INSERT INTO patients (id, profile_id, date_of_birth, phone, gender, emergency_contact)
  SELECT
    '00000000-0000-0000-0001-000000000001'::uuid,
    pu.id,
    '1985-03-15',
    '+1 (555) 123-4567',
    'male',
    '{"name":"Jane Smith","phone":"+1 (555) 123-4568","relationship":"Spouse"}'::jsonb
  FROM patient_user pu
  ON CONFLICT (id) DO NOTHING
  RETURNING id
),

-- ================================================================
-- Doctor record
-- ================================================================
insert_doctor AS (
  INSERT INTO doctors (id, profile_id, speciality, experience_years, bio, languages, consultation_fee)
  SELECT
    '10000000-0000-0000-0001-000000000001'::uuid,
    du.id,
    'Cardiology',
    15,
    'Specializing in preventive cardiology and heart disease management with a focus on patient education.',
    ARRAY['English', 'Hindi'],
    150.00
  FROM doctor_user du
  ON CONFLICT (id) DO NOTHING
  RETURNING id
),

-- ================================================================
-- Doctor availability (Mon=1, Wed=3, Fri=5, 9am-5pm, 30min slots)
-- ================================================================
insert_availability AS (
  INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes)
  SELECT d.id, v.day_num, '09:00', '17:00', 30
  FROM insert_doctor d
  CROSS JOIN (VALUES (1), (3), (5)) AS v(day_num)
  RETURNING id
),

-- ================================================================
-- AI analysis (for the patient's symptom intake)
-- ================================================================
insert_ai AS (
  INSERT INTO ai_analyses (patient_id, input_language, symptoms, urgency, chief_complaint,
    suggested_speciality, patient_summary, suggested_questions)
  SELECT
    p.id,
    'en',
    '[{"name":"Headache","severity":"moderate","duration":"3 days","description":"Persistent throbbing pain"},{"name":"Nausea","severity":"mild","duration":"2 days","description":"Occasional nausea after meals"}]'::jsonb,
    'medium',
    'Persistent headaches with associated symptoms',
    'Neurology',
    'Patient reports persistent headaches for 3 days with nausea. Migraine or tension headache suspected.',
    '["Do headaches occur at a specific time of day?","Have you noticed any triggers?","Is there family history of migraines?"]'::jsonb
  FROM insert_patient p
  RETURNING id
),

-- ================================================================
-- Appointments (4 appointments with varied statuses)
-- ================================================================
insert_appointments AS (
  INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time,
    status, urgency, chief_complaint, ai_analysis_id)
  SELECT
    p.id, d.id,
    '2026-08-28', '10:00', '10:30',
    'CONFIRMED', 'medium', 'Follow-up for blood pressure monitoring',
    ai.id
  FROM insert_patient p, insert_doctor d, insert_ai ai
  RETURNING id
),

insert_appointments2 AS (
  INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time,
    status, urgency, chief_complaint)
  SELECT
    p.id, d.id,
    '2026-09-02', '14:00', '14:30',
    'PENDING', 'low', 'Annual physical examination'
  FROM insert_patient p, insert_doctor d
  RETURNING id
),

insert_appointments3 AS (
  INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time,
    status, urgency, chief_complaint)
  SELECT
    p.id, d.id,
    '2026-08-20', '09:00', '09:30',
    'COMPLETED', 'low', 'Routine check-up and blood work'
  FROM insert_patient p, insert_doctor d
  RETURNING id
),

insert_appointments4 AS (
  INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time,
    status, urgency, chief_complaint)
  SELECT
    p.id, d.id,
    '2026-08-15', '11:00', '11:30',
    'CANCELLED', 'medium', 'Chest pain evaluation — cancelled by patient'
  FROM insert_patient p, insert_doctor d
  RETURNING id
),

-- ================================================================
-- Slot hold (one active hold to demonstrate concurrency)
-- ================================================================
insert_slot_hold AS (
  INSERT INTO slot_holds (doctor_id, patient_id, appointment_date, start_time, end_time, expires_at)
  SELECT
    d.id, p.id,
    '2026-09-05', '10:00', '10:30',
    now() + interval '5 minutes'
  FROM insert_doctor d, insert_patient p
  RETURNING id
),

-- ================================================================
-- Doctor leave
-- ================================================================
insert_leave AS (
  INSERT INTO doctor_leaves (doctor_id, start_date, end_date, reason, status)
  SELECT d.id, '2026-09-08', '2026-09-12', 'Medical conference attendance', 'pending'
  FROM insert_doctor d
  RETURNING id
),

-- ================================================================
-- Notifications for the patient
-- ================================================================
insert_notifications AS (
  INSERT INTO notifications (profile_id, type, title, message, is_read)
  SELECT pu.id, 'appointment', 'Appointment Confirmed',
    'Your appointment with Dr. Sarah Johnson (Cardiology) on Aug 28 at 10:00 AM has been confirmed.', false
  FROM patient_user pu
  UNION ALL
  SELECT pu.id, 'appointment', 'Upcoming Appointment Reminder',
    'You have an appointment with Dr. Sarah Johnson tomorrow at 2:00 PM.', false
  FROM patient_user pu
  UNION ALL
  SELECT pu.id, 'urgent', 'Doctor Leave Conflict',
    'Dr. Sarah Johnson will be on leave Sep 8-12. Your appointment may need rescheduling.', false
  FROM patient_user pu
  UNION ALL
  SELECT pu.id, 'medication', 'Medication Reminder',
    'Time to take Lisinopril 10mg. Take one tablet by mouth once daily.', false
  FROM patient_user pu
  UNION ALL
  SELECT pu.id, 'system', 'Appointment Cancelled',
    'Your appointment on Aug 15 has been cancelled.', true
  FROM patient_user pu
  UNION ALL
  SELECT pu.id, 'info', 'Follow-up Available',
    'Your recent check-up results are ready. View your care timeline for details.', true
  FROM patient_user pu
  RETURNING id
)

-- ================================================================
-- Final SELECT to confirm seed completed
-- ================================================================
SELECT
  (SELECT count(*) FROM profiles)   AS profiles_count,
  (SELECT count(*) FROM patients)   AS patients_count,
  (SELECT count(*) FROM doctors)    AS doctors_count,
  (SELECT count(*) FROM appointments) AS appointments_count,
  (SELECT count(*) FROM doctor_availability) AS availability_count,
  (SELECT count(*) FROM slot_holds) AS slot_holds_count,
  (SELECT count(*) FROM doctor_leaves) AS leaves_count,
  (SELECT count(*) FROM notifications) AS notifications_count,
  (SELECT count(*) FROM ai_analyses) AS ai_analyses_count;
