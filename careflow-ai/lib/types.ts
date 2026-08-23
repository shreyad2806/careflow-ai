export type UserRole = 'patient' | 'doctor' | 'admin';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';

export type SymptomSeverity = 'mild' | 'moderate' | 'severe';

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  experience: number;
  rating: number;
  reviewCount: number;
  image: string;
  availability: string[];
  nextAvailable: string;
  location: string;
  consultationFee: number;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  bloodType: string;
  allergies: string[];
  chronicConditions: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  urgency: UrgencyLevel;
  reason: string;
  notes?: string;
}

export interface Symptom {
  id: string;
  name: string;
  severity: SymptomSeverity;
  duration: string;
  description: string;
}

export interface SymptomAnalysis {
  id: string;
  symptoms: Symptom[];
  urgency: UrgencyLevel;
  possibleConditions: string[];
  recommendedSpecialist: string;
  recommendations: string[];
  disclaimer: string;
  analyzedAt: string;
}

export interface CareTimelineEvent {
  id: string;
  type: 'appointment' | 'medication' | 'lab-result' | 'vital-signs' | 'note';
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'upcoming';
  metadata?: {
    doctorName?: string;
    results?: string;
    values?: string;
  };
}

export interface LeaveRequest {
  id: string;
  doctorId: string;
  doctorName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
}

export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
}

export interface RoleNavigation {
  role: UserRole;
  items: NavigationItem[];
}
