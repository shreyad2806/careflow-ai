-- ================================================================
-- Migration 003: Apply fixed trigger + backfill existing auth users
-- ================================================================
--
-- Context:
--   Three auth users already exist (admin@careflow.demo, etc.)
--   but the original trigger was never applied or failed silently.
--   This migration:
--     1. Installs the robust handle_new_user() trigger
--     2. Backfills profiles for any auth users missing a profile row
--     3. Is fully idempotent — safe to re-run
--
-- ================================================================

-- ================================================================
-- STEP 1: Install the robust trigger (idempotent)
-- ================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email     TEXT;
  v_full_name TEXT;
  v_role      TEXT;
BEGIN
  -- Email: auth email → phone → generated placeholder
  v_email := COALESCE(
    NEW.email,
    NEW.phone,
    'user-' || substring(NEW.id::text, 1, 8) || '@placeholder.careflow.ai'
  );

  -- Full name: metadata 'full_name' → email prefix → 'New User'
  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    split_part(v_email, '@', 1),
    'New User'
  );

  -- Role: metadata 'role' → default 'PATIENT'
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'role', ''),
    'PATIENT'
  );

  -- Guard against invalid role values
  IF v_role NOT IN ('PATIENT', 'DOCTOR', 'ADMIN') THEN
    v_role := 'PATIENT';
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role,
    preferred_language, created_at, updated_at
  ) VALUES (
    NEW.id, v_email, v_full_name, v_role,
    'en', now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    full_name    = EXCLUDED.full_name,
    role         = EXCLUDED.role,
    updated_at   = now();

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

-- ================================================================
-- STEP 2: Backfill profiles for existing auth users
-- ================================================================
-- Uses the same logic as the trigger so profiles are consistent.
-- ON CONFLICT DO UPDATE ensures this is idempotent.

INSERT INTO public.profiles (
  id, email, full_name, role,
  preferred_language, created_at, updated_at
)
SELECT
  au.id,
  COALESCE(
    au.email,
    au.phone,
    'user-' || substring(au.id::text, 1, 8) || '@placeholder.careflow.ai'
  ) AS email,
  COALESCE(
    NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
    split_part(
      COALESCE(au.email, au.phone, 'unknown'), '@', 1
    ),
    'New User'
  ) AS full_name,
  COALESCE(
    NULLIF(au.raw_user_meta_data ->> 'role', ''),
    'PATIENT'
  ) AS role,
  'en',
  au.created_at,
  au.updated_at
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL  -- only auth users without a profile
  AND COALESCE(
        NULLIF(au.raw_user_meta_data ->> 'role', ''),
        'PATIENT'
      ) IN ('PATIENT', 'DOCTOR', 'ADMIN');  -- guard

-- If any auth user had an invalid role in metadata, the INSERT above
-- was filtered out by the WHERE clause. Insert those with default role.

INSERT INTO public.profiles (
  id, email, full_name, role,
  preferred_language, created_at, updated_at
)
SELECT
  au.id,
  COALESCE(au.email, au.phone,
    'user-' || substring(au.id::text, 1, 8) || '@placeholder.careflow.ai'
  ),
  COALESCE(
    NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
    split_part(COALESCE(au.email, au.phone, 'unknown'), '@', 1),
    'New User'
  ),
  'PATIENT',
  'en',
  au.created_at,
  au.updated_at
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- STEP 3: Verification query
-- ================================================================
-- Run this to confirm every auth user has a matching profile:

SELECT
  au.id                                        AS auth_id,
  au.email                                     AS auth_email,
  au.raw_user_meta_data ->> 'role'             AS auth_meta_role,
  au.raw_user_meta_data ->> 'full_name'        AS auth_meta_name,
  p.id                                         AS profile_id,
  p.email                                      AS profile_email,
  p.full_name,
  p.role                                       AS profile_role,
  p.preferred_language,
  p.created_at                                 AS profile_created
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
ORDER BY p.created_at;

-- Expected result: every row has profile_id = auth_id (no NULLs)
-- If any profile_id is NULL, the backfill failed — check PostgreSQL logs.
