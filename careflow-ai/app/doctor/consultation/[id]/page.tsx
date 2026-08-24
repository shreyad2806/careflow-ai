'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import { doctorNavigation } from '@/lib/navigation';
import { mockAppointments, mockPatients } from '@/lib/mock-data';
import { getDemoDoctorName } from '@/lib/config/demo-identity';
import { Calendar, Clock, FileText, AlertTriangle, CheckCircle, Video, Phone, CalendarPlus, Download } from 'lucide-react';

export default function DoctorConsultation() {
  const router = useRouter();
  const doctorName = getDemoDoctorName();
  const params = useParams();
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [showPatientSummary, setShowPatientSummary] = useState(false);
  const [consultationComplete, setConsultationComplete] = useState(false);

  const appointment = mockAppointments.find(a => a.id === params.id) || mockAppointments[0];
  const patient = mockPatients.find(p => p.id === appointment.patientId) || mockPatients[0];

  const aiPreVisitSummary = {
    chiefComplaint: 'Persistent headaches with associated symptoms',
    suggestedQuestions: [
      'Do the headaches occur at a specific time of day?',
      'Have you noticed any triggers like certain foods or stress?',
      'Is there any family history of migraines or headaches?'
    ],
    symptoms: ['Headache', 'Nausea', 'Light sensitivity', 'Fatigue']
  };

  const mockPatientSummary = {
    discussion: 'Patient reported persistent headaches for the past 3 days, accompanied by nausea and light sensitivity. No fever reported. Pain described as throbbing, primarily in the frontal region.',
    treatment: 'Prescribed pain management medication and recommended lifestyle modifications. Advised to keep a headache diary to track patterns.',
    medications: [
      { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6 hours as needed', duration: '3 days' },
      { name: 'Rest', dosage: 'N/A', frequency: 'As needed', duration: 'Until symptoms improve' }
    ],
    followUp: 'Follow-up appointment scheduled in 1 week to monitor progress.'
  };

  const handleCompleteConsultation = () => {
    setConsultationComplete(true);
    setTimeout(() => setShowPatientSummary(true), 1500);
  };

  if (consultationComplete && !showPatientSummary) {
    return (
      <DashboardLayout navigation={doctorNavigation} role="doctor" userName={doctorName} headerTitle="Consultation">
        <div className="max-w-2xl mx-auto">
          <Card className="border-2 border-green-200">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Consultation Complete!</h2>
              <p className="text-slate-600">Generating patient summary...</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (showPatientSummary) {
    return (
      <DashboardLayout navigation={doctorNavigation} role="doctor" userName={doctorName} headerTitle="Patient Summary">
        <PageHeader title="Patient-Friendly Summary" subtitle="Share this summary with your patient" />
        
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">Consultation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">What Was Discussed</h4>
                <p className="text-slate-700">{mockPatientSummary.discussion}</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Treatment Summary</h4>
                <p className="text-slate-700">{mockPatientSummary.treatment}</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Medication Schedule</h4>
                <div className="space-y-2">
                  {mockPatientSummary.medications.map((med, index) => (
                    <div key={index} className="p-3 bg-blue-50 rounded-lg">
                      <p className="font-medium text-slate-900">{med.name}</p>
                      <p className="text-sm text-slate-600">Dosage: {med.dosage} | Frequency: {med.frequency}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-900 mb-1">Follow-up Instructions</h4>
                    <p className="text-sm text-amber-800">{mockPatientSummary.followUp}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="flex-1">
              <Download size={18} className="mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" className="flex-1">
              <Phone size={18} className="mr-2" />
              Send to Patient
            </Button>
            <Button variant="outline" onClick={() => router.push('/doctor/appointments')}>
              Back to Appointments
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigation={doctorNavigation} role="doctor" userName={doctorName} headerTitle="Consultation">
      <PageHeader 
        title={`Consultation with ${patient.name}`}
        subtitle={`Appointment ID: ${appointment.id}`}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Patient Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">{patient.name.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900">{patient.name}</p>
                  <p className="text-sm text-slate-600">{patient.email}</p>
                </div>
              </div>
              {patient.chronicConditions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Chronic Conditions</p>
                  <div className="flex flex-wrap gap-1">
                    {patient.chronicConditions.map((c, i) => (
                      <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-purple-200">
            <CardHeader><CardTitle>AI Pre-Visit Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Urgency</span>
                <UrgencyBadge urgency={appointment.urgency} />
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-slate-900 mb-1">Chief Complaint</p>
                <p className="text-sm text-slate-700">{aiPreVisitSummary.chiefComplaint}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Reported Symptoms</p>
                <div className="flex flex-wrap gap-1">
                  {aiPreVisitSummary.symptoms.map((s, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">{s}</span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Consultation Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Clinical Notes</label>
                <textarea value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} rows={4}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter clinical observations..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Diagnosis</label>
                <textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter diagnosis..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Prescription</label>
                <textarea value={prescription} onChange={e => setPrescription(e.target.value)} rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter prescription details..." />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleCompleteConsultation} disabled={!clinicalNotes.trim() || !diagnosis.trim()} className="flex-1">
                  <CheckCircle size={18} className="mr-2" />Complete Consultation
                </Button>
                <Button variant="outline" onClick={() => setShowPatientSummary(true)} className="flex-1">
                  <FileText size={18} className="mr-2" />Generate Summary
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start" disabled title="Coming Soon"><Video size={18} className="mr-2" />Video Call <span className="ml-1 text-xs text-slate-400">Soon</span></Button>
                <Button variant="outline" className="justify-start" disabled title="Coming Soon"><Phone size={18} className="mr-2" />Audio Call <span className="ml-1 text-xs text-slate-400">Soon</span></Button>
                <Button variant="outline" className="justify-start" disabled title="Coming Soon"><FileText size={18} className="mr-2" />View Records <span className="ml-1 text-xs text-slate-400">Soon</span></Button>
                <Button variant="outline" className="justify-start" onClick={() => router.push('/patient/booking')}><CalendarPlus size={18} className="mr-2" />Follow-up</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
