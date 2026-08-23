-- CareFlow AI - Initial Database Schema
-- Run this migration to set up all tables
-- Requires: Supabase Auth enabled (auth.users table must exist)

-- ============================================================
-- PROFILES
-- References auth.users so each Supabase Auth user maps to one profile.
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('PATIENT', 'DOCTOR', 'ADMIN')),
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Auto-create a profile row when a new auth user is created.
-- Handles NULL email (phone-only signups) and missing metadata gracefully.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email     TEXT;
  v_full_name TEXT;
  v_role      TEXT;
BEGIN
  v_email := COALESCE(
    NEW.email,
    NEW.phone,
    'user-' || substring(NEW.id::text, 1, 8) || '@placeholder.careflow.ai'
  );

  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    split_part(v_email, '@', 1),
    'New User'
  );

  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'role', ''),
    'PATIENT'
  );

  IF v_role NOT IN ('PATIENT', 'DOCTOR', 'ADMIN') THEN
    v_role := 'PATIENT';
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, preferred_language, created_at, updated_at
  ) VALUES (
    NEW.id, v_email, v_full_name, v_role, 'en', now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: failed to create profile for %: %',
      NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_of_birth DATE,
  phone TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  emergency_contact JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id)
);

-- ============================================================
-- DOCTORS
-- ============================================================
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  speciality TEXT NOT NULL,
  experience_years INTEGER DEFAULT 0,
  bio TEXT,
  languages TEXT[] DEFAULT ARRAY['English'],
  consultation_fee NUMERIC(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id)
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  chief_complaint TEXT,
  ai_analysis_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for appointment queries
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);

-- ============================================================
-- DOCTOR_AVAILABILITY
-- ============================================================
CREATE TABLE doctor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INTEGER DEFAULT 30 CHECK (slot_duration_minutes > 0),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for availability lookups
CREATE INDEX idx_availability_doctor ON doctor_availability(doctor_id);
CREATE INDEX idx_availability_doctor_day ON doctor_availability(doctor_id, day_of_week);

-- ============================================================
-- SLOT_HOLDS
-- ============================================================
CREATE TABLE slot_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for slot hold lookups and expiry
CREATE INDEX idx_slot_holds_doctor_date ON slot_holds(doctor_id, appointment_date);
CREATE INDEX idx_slot_holds_expires ON slot_holds(expires_at);

-- ============================================================
-- DOCTOR_LEAVES
-- ============================================================
CREATE TABLE doctor_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_leaves_doctor ON doctor_leaves(doctor_id);
CREATE INDEX idx_leaves_status ON doctor_leaves(status);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('appointment', 'medication', 'system', 'urgent', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_notifications_profile ON notifications(profile_id);
CREATE INDEX idx_notifications_unread ON notifications(profile_id, is_read) WHERE is_read = false;

-- ============================================================
-- AI_ANALYSES
-- ============================================================
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  input_language TEXT DEFAULT 'en',
  symptoms JSONB NOT NULL,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  chief_complaint TEXT,
  suggested_speciality TEXT,
  patient_summary TEXT,
  suggested_questions JSONB,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_ai_analyses_patient ON ai_analyses(patient_id);

-- Add foreign key from appointments to ai_analyses
ALTER TABLE appointments
  ADD CONSTRAINT fk_appointments_ai_analysis
  FOREIGN KEY (ai_analysis_id) REFERENCES ai_analyses(id)
  ON DELETE SET NULL;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
