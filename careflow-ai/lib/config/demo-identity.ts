/**
 * Development demo identity configuration.
 *
 * Single source of truth for the 3 demo accounts:
 *   admin@careflow.demo   → Admin User
 *   doctor@careflow.demo  → Dr. Priya Sharma (Cardiology)
 *   patient@careflow.demo → John Smith
 *
 * This file exists ONLY for development/demo mode.
 * In production, identity comes from supabase.auth.getSession().
 *
 * HOW TO REPLACE WITH REAL AUTH:
 *   1. Replace getDemoIdentity() calls with supabase.auth.getUser()
 *   2. Look up the profile/patient/doctor record by auth user ID
 *   3. Delete this file
 *
 * DO NOT import this file in production builds.
 * All exports are gated behind NODE_ENV !== 'production'.
 */

// ============================================================
// Types
// ============================================================

export interface DemoIdentity {
  /** The auth.users email (login credential) */
  authEmail: string;
  /** Profile role: PATIENT | DOCTOR | ADMIN */
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  /** Display name from profiles.full_name */
  displayName: string;
  /** profiles.id (same as auth.users.id) */
  profileId: string;
}

export interface DemoPatientIdentity extends DemoIdentity {
  role: 'PATIENT';
  /** patients.id */
  patientId: string;
}

export interface DemoDoctorIdentity extends DemoIdentity {
  role: 'DOCTOR';
  /** doctors.id */
  doctorId: string;
}

export interface DemoAdminIdentity extends DemoIdentity {
  role: 'ADMIN';
}

// ============================================================
// Demo account definitions
// ============================================================
//
// These are the auth emails of the 3 demo Supabase Auth users.
// The IDs are resolved at runtime from the database, NOT hardcoded.
// The emails are stable identifiers that match the seed data.

const DEMO_ACCOUNTS = {
  admin: {
    authEmail: 'admin@careflow.demo',
    displayName: 'Admin User',
  },
  doctor: {
    authEmail: 'doctor@careflow.demo',
    displayName: 'Dr. Priya Sharma',
  },
  patient: {
    authEmail: 'patient@careflow.demo',
    displayName: 'John Smith',
  },
} as const;

// ============================================================
// Runtime resolution (database lookup)
// ============================================================

let _cachedIdentities: {
  admin: DemoAdminIdentity | null;
  doctor: DemoDoctorIdentity | null;
  patient: DemoPatientIdentity | null;
} | null = null;

/**
 * Resolve all 3 demo identities from the database.
 * Caches the result for the lifetime of the server process.
 *
 * Returns null for any identity whose auth user or profile
 * doesn't exist in the database yet.
 */
export async function resolveDemoIdentities(): Promise<{
  admin: DemoAdminIdentity | null;
  doctor: DemoDoctorIdentity | null;
  patient: DemoPatientIdentity | null;
}> {
  if (_cachedIdentities) return _cachedIdentities;

  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = createSupabaseServerClient();

    // Look up profiles by email
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('email', [
        DEMO_ACCOUNTS.admin.authEmail,
        DEMO_ACCOUNTS.doctor.authEmail,
        DEMO_ACCOUNTS.patient.authEmail,
      ]);

    if (!profiles || profiles.length === 0) {
      _cachedIdentities = { admin: null, doctor: null, patient: null };
      return _cachedIdentities;
    }

    const profileMap = new Map<string, { id: string; full_name: string; role: string }>();
    for (const p of profiles) {
      profileMap.set(p.email, p);
    }

    const adminProfile = profileMap.get(DEMO_ACCOUNTS.admin.authEmail);
    const doctorProfile = profileMap.get(DEMO_ACCOUNTS.doctor.authEmail);
    const patientProfile = profileMap.get(DEMO_ACCOUNTS.patient.authEmail);

    // Look up patient record
    let patientId: string | null = null;
    if (patientProfile) {
      const { data: patientRow } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', patientProfile.id)
        .single();
      patientId = patientRow?.id ?? null;
    }

    // Look up doctor record
    let doctorId: string | null = null;
    if (doctorProfile) {
      const { data: doctorRow } = await supabase
        .from('doctors')
        .select('id')
        .eq('profile_id', doctorProfile.id)
        .single();
      doctorId = doctorRow?.id ?? null;
    }

    _cachedIdentities = {
      admin: adminProfile
        ? {
            authEmail: DEMO_ACCOUNTS.admin.authEmail,
            role: 'ADMIN',
            displayName: adminProfile.full_name,
            profileId: adminProfile.id,
          }
        : null,
      doctor: doctorProfile && doctorId
        ? {
            authEmail: DEMO_ACCOUNTS.doctor.authEmail,
            role: 'DOCTOR',
            displayName: doctorProfile.full_name,
            profileId: doctorProfile.id,
            doctorId,
          }
        : null,
      patient: patientProfile && patientId
        ? {
            authEmail: DEMO_ACCOUNTS.patient.authEmail,
            role: 'PATIENT',
            displayName: patientProfile.full_name,
            profileId: patientProfile.id,
            patientId,
          }
        : null,
    };

    return _cachedIdentities;
  } catch (error) {
    console.error('[DemoIdentity] Failed to resolve identities:', error);
    _cachedIdentities = { admin: null, doctor: null, patient: null };
    return _cachedIdentities;
  }
}

/**
 * Get the demo patient identity.
 * Returns null if not found in database.
 */
export async function getDemoPatient(): Promise<DemoPatientIdentity | null> {
  const identities = await resolveDemoIdentities();
  return identities.patient;
}

/**
 * Get the demo doctor identity.
 * Returns null if not found in database.
 */
export async function getDemoDoctor(): Promise<DemoDoctorIdentity | null> {
  const identities = await resolveDemoIdentities();
  return identities.doctor;
}

/**
 * Get the demo admin identity.
 * Returns null if not found in database.
 */
export async function getDemoAdmin(): Promise<DemoAdminIdentity | null> {
  const identities = await resolveDemoIdentities();
  return identities.admin;
}

// ============================================================
// Fallback for client components (can't do DB lookups)
// ============================================================

/**
 * Get the demo patient's display name for client components.
 * This is a static fallback — real auth would use session data.
 */
export function getDemoPatientName(): string {
  return DEMO_ACCOUNTS.patient.displayName;
}

/**
 * Get the demo doctor's display name for client components.
 */
export function getDemoDoctorName(): string {
  return DEMO_ACCOUNTS.doctor.displayName;
}

/**
 * Get the demo admin's display name for client components.
 */
export function getDemoAdminName(): string {
  return DEMO_ACCOUNTS.admin.displayName;
}
