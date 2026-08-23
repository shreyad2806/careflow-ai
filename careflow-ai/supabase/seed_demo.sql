-- ================================================================
-- CareFlow AI — Demo Seed (idempotent, SQL Editor compatible)
-- ================================================================
--
-- Requires: 3 auth users already exist
--   admin@careflow.demo   (role ADMIN)
--   doctor@careflow.demo  (role DOCTOR)
--   patient@careflow.demo (role PATIENT)
--
-- And migration 003 has been run (profiles already backfilled).
--
-- This script dynamically resolves auth.user IDs by email.
-- Safe to re-run: uses NOT EXISTS guards and ON CONFLICT where
-- the schema provides unique constraints.
-- ================================================================

-- ================================================================
-- Resolve the three auth user IDs
-- ================================================================
WITH auth_users AS (
  SELECT id, email FROM auth.users WHERE email IN (
    'admin@careflow.demo',
    'doctor@careflow.demo',
    'patient@careflow.demo'
  )
),
admin_user   AS (SELECT id FROM auth_users WHERE email = 'admin@careflow.demo'),
doctor_user  AS (SELECT id FROM auth_users WHERE email = 'doctor@careflow.demo'),
patient_user AS (SELECT id FROM auth_users WHERE email = 'patient@careflow.demo'),

-- ================================================================
-- Ensure profiles have correct names/roles (upsert)
-- ================================================================
upsert_profiles AS (
  INSERT INTO profiles (id, email, full_name, role, preferred_language)
  SELECT au.id, au.email,
    CASE au.email
      WHEN 'admin@careflow.demo'   THEN 'Admin User'
      WHEN 'doctor@careflow.demo'  THEN 'Dr. Priya Sharma'
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
    full_name          = EXCLUDED.full_name,
    role               = EXCLUDED.role,
    preferred_language = EXCLUDED.preferred_language
  RETURNING id
),

-- ================================================================
-- Patient record (idempotent on UNIQUE(profile_id))
-- ================================================================
ensure_patient AS (
  INSERT INTO patients (id, profile_id, date_of_birth, phone, gender, emergency_contact)
  SELECT
    gen_random_uuid(),
    pu.id,
    '1990-05-14',
    '+1 (555) 987-6543',
    'male',
    '{"name": "Sarah Smith", "phone": "+1 (555) 987-6544", "relationship": "Spouse"}'::jsonb
  FROM patient_user pu
  WHERE NOT EXISTS (
    SELECT 1 FROM patients p WHERE p.profile_id = pu.id
  )
  RETURNING id AS patient_id
),
-- If patient already existed, grab its ID
existing_patient AS (
  SELECT id AS patient_id FROM patients WHERE profile_id = (SELECT id FROM patient_user)
),
resolved_patient AS (
  SELECT patient_id FROM ensure_patient
  UNION ALL
  SELECT patient_id FROM existing_patient
  WHERE NOT EXISTS (SELECT 1 FROM ensure_patient)
  LIMIT 1
),

-- ================================================================
-- Doctor record (idempotent on UNIQUE(profile_id))
-- ================================================================
ensure_doctor AS (
  INSERT INTO doctors (id, profile_id, speciality, experience_years, bio, languages, consultation_fee, is_active)
  SELECT
    gen_random_uuid(),
    du.id,
    'Cardiology',
    14,
    'Board-certified cardiologist with expertise in preventive cardiology, heart failure management, and cardiac imaging. Committed to patient education and evidence-based care.',
    ARRAY['English', 'Hindi'],
    150.00,
    true
  FROM doctor_user du
  WHERE NOT EXISTS (
    SELECT 1 FROM doctors d WHERE d.profile_id = du.id
  )
  RETURNING id AS doctor_id
),
existing_doctor AS (
  SELECT id AS doctor_id FROM doctors WHERE profile_id = (SELECT id FROM doctor_user)
),
resolved_doctor AS (
  SELECT doctor_id FROM ensure_doctor
  UNION ALL
  SELECT doctor_id FROM existing_doctor
  WHERE NOT EXISTS (SELECT 1 FROM ensure_doctor)
  LIMIT 1
),

-- ================================================================
-- Doctor availability (Mon-Fri, 9am-5pm, 30min slots)
-- Only insert if no rows exist for this doctor yet.
-- ================================================================
ensure_availability AS (
  INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes)
  SELECT rd.doctor_id, v.day_num, '09:00'::time, '17:00'::time, 30
  FROM resolved_doctor rd
  CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS v(day_num)
  WHERE NOT EXISTS (
    SELECT 1 FROM doctor_availability da WHERE da.doctor_id = rd.doctor_id
  )
  RETURNING id
),

-- ================================================================
-- AI analysis for the patient's symptom intake
-- ================================================================
ensure_ai AS (
  INSERT INTO ai_analyses (patient_id, input_language, symptoms, urgency, chief_complaint,
    suggested_speciality, patient_summary, suggested_questions)
  SELECT
    rp.patient_id,
    'en',
    '[{"name":"Headache","severity":"moderate","duration":"3 days","description":"Persistent throbbing pain, worse in the morning"},{"name":"Nausea","severity":"mild","duration":"2 days","description":"Occasional nausea after meals"},{"name":"Light sensitivity","severity":"mild","duration":"1 day","description":"Mild photophobia, manageable indoors"}]'::jsonb,
    'medium',
    'Persistent headaches with associated nausea and light sensitivity',
    'Neurology',
    'Patient reports 3-day history of moderate headaches with nausea and photophobia. Symptoms consistent with migraine or tension-type headache. Neurology referral recommended.',
    '["Do headaches occur at a specific time of day?","Have you noticed any food or stress triggers?","Is there a family history of migraines?"]'::jsonb
  FROM resolved_patient rp
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_analyses aa WHERE aa.patient_id = rp.patient_id
  )
  RETURNING id AS ai_id
),
existing_ai AS (
  SELECT id AS ai_id FROM ai_analyses WHERE patient_id = (SELECT patient_id FROM resolved_patient)
),
resolved_ai AS (
  SELECT ai_id FROM ensure_ai
  UNION ALL
  SELECT ai_id FROM existing_ai
  WHERE NOT EXISTS (SELECT 1 FROM ensure_ai)
  LIMIT 1
),

-- ================================================================
-- Appointments
-- ================================================================

-- 1) Upcoming CONFIRMED appointment (7 days from now)
ensure_appt_upcoming AS (
  INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time,
    status, urgency, chief_complaint, ai_analysis_id)
  SELECT
    rp.patient_id, rd.doctor_id,
    (CURRENT_DATE + interval '7 days')::date,
    '10:00'::time, '10:30'::time,
    'CONFIRMED', 'medium',
    'Follow-up for blood pressure monitoring and medication review',
    ra.ai_id
  FROM resolved_patient rp, resolved_doctor rd, resolved_ai ra
  WHERE NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.patient_id = rp.patient_id
      AND a.doctor_id = rd.doctor_id
      AND a.appointment_date = (CURRENT_DATE + interval '7 days')::date
      AND a.start_time = '10:00'::time
  )
  RETURNING id
),

-- 2) Completed appointment (14 days ago)
ensure_appt_completed AS (
  INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time,
    status, urgency, chief_complaint)
  SELECT
    rp.patient_id, rd.doctor_id,
    (CURRENT_DATE - interval '14 days')::date,
    '14:00'::time, '14:30'::time,
    'COMPLETED', 'low',
    'Annual physical examination and routine blood work'
  FROM resolved_patient rp, resolved_doctor rd
  WHERE NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.patient_id = rp.patient_id
      AND a.doctor_id = rd.doctor_id
      AND a.appointment_date = (CURRENT_DATE - interval '14 days')::date
      AND a.start_time = '14:00'::time
  )
  RETURNING id
),

-- ================================================================
-- Notifications for the patient
-- ================================================================
ensure_notifications AS (
  INSERT INTO notifications (profile_id, type, title, message, is_read)
  SELECT pu.id, 'appointment', 'Appointment Confirmed',
    'Your appointment with Dr. Priya Sharma (Cardiology) is confirmed for ' ||
    to_char(CURRENT_DATE + interval '7 days', 'Mon DD') || ' at 10:00 AM.',
    false
  FROM patient_user pu
  WHERE NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.profile_id = pu.id AND n.title = 'Appointment Confirmed'
  )
  UNION ALL
  SELECT pu.id, 'medication', 'Medication Reminder',
    'Time to take Lisinopril 10mg. Take one tablet by mouth once daily.',
    false
  FROM patient_user pu
  WHERE NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.profile_id = pu.id AND n.title = 'Medication Reminder'
  )
  UNION ALL
  SELECT pu.id, 'info', 'Test Results Available',
    'Your recent blood work results are ready. Open your care timeline to view.',
    true
  FROM patient_user pu
  WHERE NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.profile_id = pu.id AND n.title = 'Test Results Available'
  )
  RETURNING id
)

-- ================================================================
-- Verification: row counts for every table
-- ================================================================
SELECT 'profiles' AS table_name, count(*) AS row_count FROM profiles
UNION ALL SELECT 'patients',              count(*) FROM patients
UNION ALL SELECT 'doctors',               count(*) FROM doctors
UNION ALL SELECT 'appointments',          count(*) FROM appointments
UNION ALL SELECT 'doctor_availability',   count(*) FROM doctor_availability
UNION ALL SELECT 'slot_holds',            count(*) FROM slot_holds
UNION ALL SELECT 'doctor_leaves',         count(*) FROM doctor_leaves
UNION ALL SELECT 'notifications',         count(*) FROM notifications
UNION ALL SELECT 'ai_analyses',           count(*) FROM ai_analyses
ORDER BY table_name;
