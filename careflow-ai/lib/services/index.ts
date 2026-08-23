/**
 * Data adapter layer.
 *
 * When Supabase environment variables are set, queries the database.
 * When they are missing or a query fails, gracefully falls back to mock data.
 *
 * In development, every data source decision is logged with:
 *   [DataAdapter] [/route] serviceName: message
 *
 * In production, all logs are silent.
 */

import type { Doctor, Appointment, LeaveRequest } from '@/lib/types';
import { mockDoctors, mockAppointments, mockLeaveRequests } from '@/lib/mock-data';
import {
  logSupabaseRead,
  logMockFallback,
  logSupabaseError,
  logSourceMode,
} from '@/lib/services/logger';

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-project-ref.supabase.co'
  );
}

// ============================================================
// Doctors — /patient/doctors
// ============================================================

export async function fetchDoctors(): Promise<Doctor[]> {
  const ctx = { service: 'fetchDoctors', route: '/patient/doctors' };
  const configured = isSupabaseConfigured();
  logSourceMode(ctx, configured);

  if (!configured) {
    logMockFallback(ctx, 'not-configured');
    return mockDoctors;
  }

  try {
    const { getDoctors } = await import('@/lib/services/doctors');
    const doctors = await getDoctors();

    if (doctors.length === 0) {
      // Empty is a valid result — the DB may genuinely have no doctors yet.
      // Do NOT fall back to mock data when Supabase is configured.
      logSupabaseRead(ctx, 0);
      return [];
    }

    logSupabaseRead(ctx, doctors.length);
    return doctors;
  } catch (error) {
    logSupabaseError(ctx, error);
    logMockFallback(ctx, 'query-failed');
    return mockDoctors;
  }
}

// ============================================================
// Appointments — /patient/appointments
// ============================================================

export async function fetchAppointmentsForPatient(patientId: string): Promise<Appointment[]> {
  const ctx = { service: 'fetchAppointmentsForPatient', route: '/patient/appointments' };
  const configured = isSupabaseConfigured();
  logSourceMode(ctx, configured);

  if (!configured) {
    logMockFallback(ctx, 'not-configured');
    return mockAppointments.filter(a => a.patientId === patientId);
  }

  try {
    const { getAppointmentsForPatient } = await import('@/lib/services/appointments');
    const appointments = await getAppointmentsForPatient(patientId);

    logSupabaseRead(ctx, appointments.length);
    return appointments;
  } catch (error) {
    logSupabaseError(ctx, error);
    logMockFallback(ctx, 'query-failed');
    return mockAppointments.filter(a => a.patientId === patientId);
  }
}

// ============================================================
// Appointments — /doctor
// ============================================================

export async function fetchAppointmentsForDoctor(doctorId: string): Promise<Appointment[]> {
  const ctx = { service: 'fetchAppointmentsForDoctor', route: '/doctor' };
  const configured = isSupabaseConfigured();
  logSourceMode(ctx, configured);

  if (!configured) {
    logMockFallback(ctx, 'not-configured');
    return mockAppointments.filter(a => a.doctorId === doctorId);
  }

  try {
    const { getAppointmentsForDoctor } = await import('@/lib/services/appointments');
    const appointments = await getAppointmentsForDoctor(doctorId);

    logSupabaseRead(ctx, appointments.length);
    return appointments;
  } catch (error) {
    logSupabaseError(ctx, error);
    logMockFallback(ctx, 'query-failed');
    return mockAppointments.filter(a => a.doctorId === doctorId);
  }
}

// ============================================================
// All appointments — /admin/appointments
// ============================================================

export async function fetchAllAppointments(): Promise<Appointment[]> {
  const ctx = { service: 'fetchAllAppointments', route: '/admin/appointments' };
  const configured = isSupabaseConfigured();
  logSourceMode(ctx, configured);

  if (!configured) {
    logMockFallback(ctx, 'not-configured');
    return mockAppointments;
  }

  try {
    const { getAllAppointments } = await import('@/lib/services/appointments');
    const appointments = await getAllAppointments();

    logSupabaseRead(ctx, appointments.length);
    return appointments;
  } catch (error) {
    logSupabaseError(ctx, error);
    logMockFallback(ctx, 'query-failed');
    return mockAppointments;
  }
}

// ============================================================
// All doctors — /admin/doctors
// ============================================================

export async function fetchAllDoctors(): Promise<Doctor[]> {
  const ctx = { service: 'fetchAllDoctors', route: '/admin/doctors' };
  const configured = isSupabaseConfigured();
  logSourceMode(ctx, configured);

  if (!configured) {
    logMockFallback(ctx, 'not-configured');
    return mockDoctors;
  }

  try {
    const { getDoctorsForAdmin } = await import('@/lib/services/doctors');
    const doctors = await getDoctorsForAdmin();

    if (doctors.length === 0) {
      logSupabaseRead(ctx, 0);
      return [];
    }

    logSupabaseRead(ctx, doctors.length);
    return doctors as Doctor[];
  } catch (error) {
    logSupabaseError(ctx, error);
    logMockFallback(ctx, 'query-failed');
    return mockDoctors;
  }
}

// ============================================================
// Doctor leaves — /admin/leaves
// ============================================================

export async function fetchDoctorLeaves(): Promise<LeaveRequest[]> {
  const ctx = { service: 'fetchDoctorLeaves', route: '/admin/leaves' };
  const configured = isSupabaseConfigured();
  logSourceMode(ctx, configured);

  if (!configured) {
    logMockFallback(ctx, 'not-configured');
    return mockLeaveRequests;
  }

  try {
    const { getDoctorLeaves } = await import('@/lib/services/leaves');
    const leaves = await getDoctorLeaves();

    logSupabaseRead(ctx, leaves.length);
    return leaves;
  } catch (error) {
    logSupabaseError(ctx, error);
    logMockFallback(ctx, 'query-failed');
    return mockLeaveRequests;
  }
}
