export type Language = 'en' | 'hi';

export const translations: Record<string, Record<Language, string>> = {
  // Navigation
  'nav.dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड' },
  'nav.findDoctors': { en: 'Find Doctors', hi: 'डॉक्टर खोजें' },
  'nav.aiSymptomCheck': { en: 'AI Symptom Check', hi: 'AI लक्षण जांच' },
  'nav.appointments': { en: 'Appointments', hi: 'अपॉइंटमेंट' },
  'nav.careTimeline': { en: 'Care Timeline', hi: 'देखभाल टाइमलाइन' },
  'nav.schedule': { en: 'Schedule', hi: 'शेड्यूल' },
  'nav.patients': { en: 'Patients', hi: 'मरीज़' },
  'nav.doctors': { en: 'Doctors', hi: 'डॉक्टर' },
  'nav.leaveManagement': { en: 'Leave Management', hi: 'छुट्टी प्रबंधन' },
  'nav.consultation': { en: 'Consultation', hi: 'परामर्श' },

  // Patient Dashboard
  'dashboard.welcome': { en: 'Welcome back', hi: 'वापसी पर स्वागत है' },
  'dashboard.upcomingAppointment': { en: 'Upcoming Appointment', hi: 'आगामी अपॉइंटमेंट' },
  'dashboard.quickActions': { en: 'Quick Actions', hi: 'त्वरित क्रियाएँ' },
  'dashboard.aiCareInsights': { en: 'AI Care Insights', hi: 'AI देखभाल अंतर्दृष्टि' },
  'dashboard.medicationReminders': { en: 'Medication Reminders', hi: 'दवा अनुस्मारक' },
  'dashboard.recentAppointments': { en: 'Recent Appointments', hi: 'हाल के अपॉइंटमेंट' },
  'dashboard.careTimeline': { en: 'Care Timeline', hi: 'देखभाल टाइमलाइन' },
  'dashboard.findADoctor': { en: 'Find a Doctor', hi: 'डॉक्टर खोजें' },
  'dashboard.viewAppointments': { en: 'View Appointments', hi: 'अपॉइंटमेंट देखें' },
  'dashboard.join': { en: 'Join', hi: 'जुड़ें' },
  'dashboard.bookAppointment': { en: 'Book Appointment', hi: 'अपॉइंटमेंट बुक करें' },
  'dashboard.nextAppointment': { en: 'Next Appointment', hi: 'अगला अपॉइंटमेंट' },
  'dashboard.noUpcoming': { en: 'No upcoming appointments', hi: 'कोई आगामी अपॉइंटमेंट नहीं' },
  'dashboard.yourConsultation': { en: 'Your upcoming consultation', hi: 'आपका आगामी परामर्श' },

  // Symptom Intake
  'symptom.describe': { en: 'Describe your symptoms', hi: 'अपने लक्षणों का वर्णन करें' },
  'symptom.severity': { en: 'Severity', hi: 'गंभीरता' },
  'symptom.duration': { en: 'Duration', hi: 'अवधि' },
  'symptom.analyse': { en: 'Analyse Symptoms', hi: 'लक्षणों का विश्लेषण करें' },
  'symptom.continue': { en: 'Continue', hi: 'जारी रखें' },
  'symptom.back': { en: 'Back', hi: 'वापस' },
  'symptom.findDoctor': { en: 'Find Recommended Doctor', hi: 'सुझाए गए डॉक्टर खोजें' },
  'symptom.startOver': { en: 'Start Over', hi: 'फिर से शुरू करें' },
  'symptom.category': { en: 'Symptom Category', hi: 'लक्षण श्रेणी' },
  'symptom.additional': { en: 'Any additional symptoms?', hi: 'कोई अतिरिक्त लक्षण?' },

  // Booking
  'booking.selectDate': { en: 'Select Date', hi: 'तिथि चुनें' },
  'booking.availableSlots': { en: 'Available Slots', hi: 'उपलब्ध स्लॉट' },
  'booking.confirmAppointment': { en: 'Confirm Appointment', hi: 'अपॉइंटमेंट की पुष्टि करें' },
  'booking.summary': { en: 'Booking Summary', hi: 'बुकिंग सारांश' },
  'booking.consultationFee': { en: 'Consultation Fee', hi: 'परामर्श शुल्क' },
  'booking.reason': { en: 'Reason for Visit', hi: 'यात्रा का कारण' },
  'booking.urgencyLevel': { en: 'Urgency Level', hi: 'तात्कालिकता स्तर' },
  'booking.confirmed': { en: 'Booking Confirmed!', hi: 'बुकिंग की पुष्टि हो गई!' },

  // Appointment Statuses
  'status.confirmed': { en: 'Confirmed', hi: 'पुष्टि की गई' },
  'status.pending': { en: 'Pending', hi: 'लंबित' },
  'status.cancelled': { en: 'Cancelled', hi: 'रद्द' },
  'status.completed': { en: 'Completed', hi: 'पूर्ण' },
  'status.scheduled': { en: 'Scheduled', hi: 'निर्धारित' },
  'status.inProgress': { en: 'In Progress', hi: 'प्रगति में' },

  // Common
  'common.search': { en: 'Search...', hi: 'खोजें...' },
  'common.filter': { en: 'Filters', hi: 'फ़िल्टर' },
  'common.viewAll': { en: 'View All', hi: 'सभी देखें' },
  'common.cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'common.save': { en: 'Save', hi: 'सहेजें' },
  'common.delete': { en: 'Delete', hi: 'हटाएँ' },
  'common.edit': { en: 'Edit', hi: 'संपादित करें' },
  'common.add': { en: 'Add', hi: 'जोड़ें' },
  'common.help': { en: 'Help', hi: 'सहायता' },
  'common.notifications': { en: 'Notifications', hi: 'सूचनाएँ' },
  'common.markAllRead': { en: 'Mark all as read', hi: 'सभी पठित चिन्हित करें' },
  'common.noNotifications': { en: 'No notifications', hi: 'कोई सूचना नहीं' },
  'common.language': { en: 'Language', hi: 'भाषा' },
  'common.english': { en: 'English', hi: 'अंग्रेज़ी' },
  'common.hindi': { en: 'Hindi', hi: 'हिंदी' },

  // Admin
  'admin.overview': { en: 'Overview of CareFlow AI operations', hi: 'CareFlow AI संचालन का अवलोकन' },
  'admin.manageDoctors': { en: 'Manage Doctors', hi: 'डॉक्टर प्रबंधन' },
  'admin.reviewLeaves': { en: 'Review Leave Requests', hi: 'छुट्टी अनुरोधों की समीक्षा करें' },

  // Doctor
  'doctor.viewPatients': { en: 'View Patients', hi: 'मरीज़ देखें' },
  'doctor.allAppointments': { en: 'All Appointments', hi: 'सभी अपॉइंटमेंट' },
  'doctor.startConsultation': { en: 'Start Consultation', hi: 'परामर्श शुरू करें' },
  'doctor.patientNotes': { en: 'Patient Notes', hi: 'मरीज़ नोट्स' },

  // Medications
  'medication.name': { en: 'Medication Name', hi: 'दवा का नाम' },
  'medication.dosage': { en: 'Dosage', hi: 'खुराक' },
  'medication.frequency': { en: 'Frequency', hi: 'आवृत्ति' },
  'medication.nextDose': { en: 'Next Dose', hi: 'अगली खुराक' },
  'medication.taken': { en: 'Taken', hi: 'लिया' },
  'medication.markTaken': { en: 'Take', hi: 'लें' },
  'medication.addMedication': { en: 'Add Medication', hi: 'दवा जोड़ें' },
  'medication.noMedications': { en: 'No medications scheduled', hi: 'कोई दवा निर्धारित नहीं' },
  'medication.lowStock': { en: 'Low stock', hi: 'कम स्टॉक' },
  'medication.instructions': { en: 'Instructions', hi: 'निर्देश' },
};

export function t(key: string, lang: Language): string {
  return translations[key]?.[lang] || translations[key]?.['en'] || key;
}
