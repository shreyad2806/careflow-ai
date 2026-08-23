-- ================================================================
-- Migration 002: Fix handle_new_user() trigger
-- ================================================================
--
-- Problem:
--   The original trigger passes NEW.email directly into profiles.email.
--   If a user signs up via phone OTP (no email), NEW.email is NULL,
--   causing a NOT NULL violation and the profile row is never created.
--   This silently breaks the FK chain (patients, doctors, etc.).
--
-- Fix:
--   1. COALESCE email from auth.users: email → phone → placeholder
--   2. COALESCE full_name from metadata → email → 'New User'
--   3. COALESCE role from metadata → default 'PATIENT'
--   4. Explicitly set preferred_language with a safe default
--   5. Use ON CONFLICT DO NOTHING for idempotency
--   6. Add EXCEPTION block so a failed profile insert doesn't
--      kill the entire auth signup transaction
--
-- Idempotent: safe to run multiple times.
-- ================================================================

-- Step 1: Drop the old trigger (must drop trigger before replacing function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Replace the function with the robust version
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email     TEXT;
  v_full_name TEXT;
  v_role      TEXT;
BEGIN
  -- Safely extract email: auth email → phone number → placeholder
  v_email := COALESCE(
    NEW.email,
    NEW.phone,
    'user-' || substring(NEW.id::text, 1, 8) || '@placeholder.careflow.ai'
  );

  -- Safely extract full_name: metadata → email prefix → 'New User'
  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    split_part(v_email, '@', 1),
    'New User'
  );

  -- Safely extract role: metadata → default 'PATIENT'
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'role', ''),
    'PATIENT'
  );

  -- Validate role (must match CHECK constraint)
  IF v_role NOT IN ('PATIENT', 'DOCTOR', 'ADMIN') THEN
    v_role := 'PATIENT';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    preferred_language,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_email,
    v_full_name,
    v_role,
    'en',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth signup.
    -- The profile can be created manually later.
    RAISE WARNING 'handle_new_user: failed to create profile for %: %',
      NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Re-create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================================================
-- Verification: show auth users joined with profiles
-- ================================================================
-- Run this after creating a new auth user to confirm the trigger works:
--
--   SELECT
--     au.id AS auth_id,
--     au.email AS auth_email,
--     au.raw_user_meta_data ->> 'role' AS auth_role,
--     p.id AS profile_id,
--     p.email AS profile_email,
--     p.full_name,
--     p.role AS profile_role,
--     p.preferred_language,
--     p.created_at
--   FROM auth.users au
--   LEFT JOIN profiles p ON p.id = au.id
--   ORDER BY p.created_at;
--
-- Every row should show profile_id = auth_id (no NULLs in profile columns).
