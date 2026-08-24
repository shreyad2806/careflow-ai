// ============================================================
// Database types generated from the schema
// ============================================================

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      patients: {
        Row: PatientRow;
        Insert: PatientInsert;
        Update: PatientUpdate;
      };
      doctors: {
        Row: DoctorRow;
        Insert: DoctorInsert;
        Update: DoctorUpdate;
      };
      appointments: {
        Row: AppointmentRow;
        Insert: AppointmentInsert;
        Update: AppointmentUpdate;
      };
      doctor_availability: {
        Row: DoctorAvailability;
        Insert: DoctorAvailabilityInsert;
        Update: DoctorAvailabilityUpdate;
      };
      slot_holds: {
        Row: SlotHold;
        Insert: SlotHoldInsert;
        Update: SlotHoldUpdate;
      };
      doctor_leaves: {
        Row: DoctorLeave;
        Insert: DoctorLeaveInsert;
        Update: DoctorLeaveUpdate;
      };
      notifications: {
        Row: NotificationRow;
        Insert: NotificationInsert;
        Update: NotificationUpdate;
      };
      ai_analyses: {
        Row: AIAnalysis;
        Insert: AIAnalysisInsert;
        Update: AIAnalysisUpdate;
      };
    };
    Enums: Record<string, never>;
  };
};

// ============================================================
// Row Types
// ============================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  preferred_language: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id?: string;
  email: string;
  full_name: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  preferred_language?: string;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ProfileUpdate = Partial<ProfileInsert>;

export interface PatientRow {
  id: string;
  profile_id: string;
  date_of_birth: string | null;
  phone: string | null;
  gender: 'male' | 'female' | 'other' | null;
  emergency_contact: Record<string, unknown> | null;
  created_at: string;
}

export interface PatientInsert {
  id?: string;
  profile_id: string;
  date_of_birth?: string | null;
  phone?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  emergency_contact?: Record<string, unknown> | null;
  created_at?: string;
}

export type PatientUpdate = Partial<PatientInsert>;

export interface DoctorRow {
  id: string;
  profile_id: string;
  speciality: string;
  experience_years: number;
  bio: string | null;
  languages: string[];
  consultation_fee: number;
  is_active: boolean;
  created_at: string;
}

export interface DoctorInsert {
  id?: string;
  profile_id: string;
  speciality: string;
  experience_years?: number;
  bio?: string | null;
  languages?: string[];
  consultation_fee?: number;
  is_active?: boolean;
  created_at?: string;
}

export type DoctorUpdate = Partial<DoctorInsert>;

export interface AppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  chief_complaint: string | null;
  ai_analysis_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentInsert {
  id?: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  chief_complaint?: string | null;
  ai_analysis_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type AppointmentUpdate = Partial<AppointmentInsert>;

export interface DoctorAvailability {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface DoctorAvailabilityInsert {
  id?: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes?: number;
  is_active?: boolean;
  created_at?: string;
}

export type DoctorAvailabilityUpdate = Partial<DoctorAvailabilityInsert>;

export interface SlotHold {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  expires_at: string;
  created_at: string;
}

export interface SlotHoldInsert {
  id?: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  expires_at: string;
  created_at?: string;
}

export type SlotHoldUpdate = Partial<SlotHoldInsert>;

export interface DoctorLeave {
  id: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface DoctorLeaveInsert {
  id?: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

export type DoctorLeaveUpdate = Partial<DoctorLeaveInsert>;

export interface NotificationRow {
  id: string;
  profile_id: string;
  type: 'appointment' | 'medication' | 'system' | 'urgent' | 'info';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationInsert {
  id?: string;
  profile_id: string;
  type: 'appointment' | 'medication' | 'system' | 'urgent' | 'info';
  title: string;
  message: string;
  is_read?: boolean;
  created_at?: string;
}

export type NotificationUpdate = Partial<NotificationInsert>;

export interface AIAnalysis {
  id: string;
  patient_id: string;
  input_language: string;
  symptoms: Record<string, unknown>;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  chief_complaint: string | null;
  suggested_speciality: string | null;
  patient_summary: string | null;
  suggested_questions: Record<string, unknown> | null;
  raw_response: Record<string, unknown> | null;
  created_at: string;
}

export interface AIAnalysisInsert {
  id?: string;
  patient_id: string;
  input_language?: string;
  symptoms: Record<string, unknown>;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  chief_complaint?: string | null;
  suggested_speciality?: string | null;
  patient_summary?: string | null;
  suggested_questions?: Record<string, unknown> | null;
  raw_response?: Record<string, unknown> | null;
  created_at?: string;
}

export type AIAnalysisUpdate = Partial<AIAnalysisInsert>;

// ============================================================
// Helper: Map DB status to frontend status
// ============================================================
export function mapAppointmentStatus(
  dbStatus: AppointmentRow['status']
): 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' {
  switch (dbStatus) {
    case 'PENDING': return 'scheduled';
    case 'CONFIRMED': return 'confirmed';
    case 'COMPLETED': return 'completed';
    case 'CANCELLED': return 'cancelled';
    default: return 'scheduled';
  }
}

// ============================================================
// Helper: Map DB doctor row to frontend Doctor shape
// ============================================================
export interface DoctorFromDB {
  doctor: DoctorRow;
  profile: Profile;
}

export function mapDoctorToFrontend(
  doctor: DoctorRow,
  profile: Profile
) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    id: doctor.id,
    name: profile.full_name,
    specialty: doctor.speciality,
    experience: doctor.experience_years,
    rating: 4.8,
    reviewCount: 200,
    image: profile.avatar_url || '',
    availability: [] as string[],
    nextAvailable: new Date().toISOString().split('T')[0],
    location: 'CareFlow Medical Center',
    consultationFee: Number(doctor.consultation_fee),
    languages: doctor.languages,
    description: doctor.bio || '',
    profile_id: profile.id,
    email: profile.email,
  };
}

// ============================================================
// Booking Engine Function Return Types
// ============================================================

export interface SlotAvailabilityResult {
  available: boolean;
  error?: string;
}

export interface AcquireHoldResult {
  success: boolean;
  hold_id?: string;
  error?: string;
}

export interface ConfirmBookingResult {
  success: boolean;
  appointment_id?: string;
  error?: string;
}

export interface CancelAppointmentResult {
  success: boolean;
  appointment_id?: string;
  error?: string;
  current_status?: string;
}

export interface RescheduleResult {
  success: boolean;
  hold_id?: string;
  error?: string;
}
