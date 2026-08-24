import { RoleNavigation, UserRole } from './types';

export const patientNavigation: RoleNavigation = {
  role: 'patient',
  items: [
    {
      label: 'Dashboard',
      href: '/patient',
      icon: 'LayoutDashboard',
    },
    {
      label: 'Find Doctors',
      href: '/patient/doctors',
      icon: 'Stethoscope',
    },
    {
      label: 'AI Symptom Check',
      href: '/patient/symptoms',
      icon: 'BrainCircuit',
    },
    {
      label: 'Appointments',
      href: '/patient/appointments',
      icon: 'Calendar',
    },
    {
      label: 'Care Timeline',
      href: '/patient/timeline',
      icon: 'ListOrdered',
    },
  ],
};

export const doctorNavigation: RoleNavigation = {
  role: 'doctor',
  items: [
    {
      label: 'Dashboard',
      href: '/doctor',
      icon: 'LayoutDashboard',
    },
    {
      label: 'Appointments',
      href: '/doctor/appointments',
      icon: 'CalendarDays',
    },
    {
      label: 'Patients',
      href: '/doctor/patients',
      icon: 'Users',
    },
  ],
};

export const adminNavigation: RoleNavigation = {
  role: 'admin',
  items: [
    {
      label: 'Dashboard',
      href: '/admin',
      icon: 'LayoutDashboard',
    },
    {
      label: 'Doctors',
      href: '/admin/doctors',
      icon: 'UserCog',
    },
    {
      label: 'Appointments',
      href: '/admin/appointments',
      icon: 'CalendarCheck',
    },
    {
      label: 'Leave Management',
      href: '/admin/leaves',
      icon: 'CalendarX',
    },
  ],
};

export function getNavigationByRole(role: UserRole): RoleNavigation {
  switch (role) {
    case 'patient':
      return patientNavigation;
    case 'doctor':
      return doctorNavigation;
    case 'admin':
      return adminNavigation;
    default:
      return patientNavigation;
  }
}
