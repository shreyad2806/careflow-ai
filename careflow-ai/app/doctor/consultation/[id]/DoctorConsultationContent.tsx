'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import { doctorNavigation } from '@/lib/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import {
  Calendar, Clock, FileText, AlertTriangle, CheckCircle,
  Video, Phone, CalendarPlus, Loader2, BrainCircuit, Sparkles,
  ShieldAlert, Pill, ListChecks,
} from 'lucide-react';
import type { PostVisitSummary } from '@/lib/ai/consultation-schema';
import type { ConsultationNote } from '@/lib/services/consultation-notes';

// ============================================================
// Props
// ============================================================

interface Props {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentUrgency: string;
  appointmentReason: string;
  preVisitAnalysis: {
    urgency: string;
    chiefComplaint: string | null;
    symptoms: string[];
    patientSummary: string | null;
    suggestedQuestions: string[];
  } | null;
  existingNotes: ConsultationNote | null;
  outputLanguage: string;
}

// ============================================================
// Component
// ============================================================

export default function DoctorConsultationContent({
  appointmentId,
  doctorId,
  patientId,
  patientName,
  doctorName,
  appointmentDate,
  appointmentTime,
  appointmentUrgency,
  appointmentReason,
  preVisitAnalysis,
  existingNotes,
  outputLanguage: initialLanguage,
}: Props) {
  const router = useRouter();
  const { language: uiLanguage } = useLanguage();

  // --- Doctor-entered fields (source of truth) ---
  const [clinicalNotes, setClinicalNotes] = useState(existingNotes?.clinicalNotes || '');
  const [diagnosis, setDiagnosis] = useState(existingNotes?.diagnosis || '');
  const [prescription, setPrescription] = useState(existingNotes?.prescription || '');

  // --- AI summary state ---
  const [aiSummary, setAiSummary] = useState<PostVisitSummary | null>(
    existingNotes?.aiSummary || null
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // --- Saving state ---
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // --- View state ---
  const [showPatientSummary, setShowPatientSummary] = useState(!!existingNotes?.aiSummary);

  // ============================================================
  // Generate AI summary
  // ============================================================

  const generateAISummary = useCallback(async () => {
    if (!clinicalNotes.trim()) {
      setAiError('Please enter clinical notes before generating a summary.');
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      console.log(`[AIAnalysis] [Consultation] ✅ Generating post-visit summary: appointmentId=${appointmentId}`);

      const response = await fetch('/api/ai/consultation/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicalNotes,
          diagnosis,
          prescription,
          language: uiLanguage || 'en',
          appointmentId,
          doctorId,
          patientId,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.message || 'Failed to generate summary');
      }

      // Convert camelCase API response to snake_case PostVisitSummary type
      setAiSummary({
        patient_summary: json.data.patientSummary,
        key_findings: json.data.keyFindings,
        medications: json.data.medications,
        follow_up_steps: json.data.followUpSteps,
        warning_signs: json.data.warningSigns,
      });
      setShowPatientSummary(true);
      console.log(`[AIAnalysis] [Consultation] ✅ AI summary generated: findings=${json.data.keyFindings.length} meds=${json.data.medications.length}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate summary';
      setAiError(message);
      console.error(`[AIAnalysis] [Consultation] ❌ AI summary failed: ${message}`);
    } finally {
      setAiLoading(false);
    }
  }, [clinicalNotes, diagnosis, prescription, uiLanguage, appointmentId, doctorId, patientId]);

  // ============================================================
  // Save to Supabase
  // ============================================================

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Convert snake_case PostVisitSummary to camelCase for the save API
      const aiSummaryForSave = aiSummary
        ? {
            patientSummary: aiSummary.patient_summary,
            keyFindings: aiSummary.key_findings,
            medications: aiSummary.medications,
            followUpSteps: aiSummary.follow_up_steps,
            warningSigns: aiSummary.warning_signs,
          }
        : null;

      const response = await fetch('/api/ai/consultation/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          doctorId,
          patientId,
          clinicalNotes,
          diagnosis,
          prescription,
          aiSummary: aiSummaryForSave,
          language: uiLanguage || 'en',
        }),
      });

      const json = await response.json();
      if (json.ok) {
        setSaved(true);
        console.log(`[AIAnalysis] [Consultation] ✅ Notes saved: noteId=${json.noteId}`);
        setTimeout(() => setSaved(false), 3000);
      } else {
        console.error(`[AIAnalysis] [Consultation] ❌ Save failed: ${json.message}`);
      }
    } catch (err) {
      console.error(`[AIAnalysis] [Consultation] ❌ Save error: ${err}`);
    } finally {
      setSaving(false);
    }
  }, [appointmentId, doctorId, patientId, clinicalNotes, diagnosis, prescription, aiSummary, uiLanguage]);

  // ============================================================
  // Patient summary view
  // ============================================================

  if (showPatientSummary && aiSummary) {
    return (
      <DashboardLayout navigation={doctorNavigation} role="doctor" userName={doctorName} headerTitle="Patient Summary">
        <PageHeader title="Patient-Friendly Summary" subtitle="AI-generated summary from your clinical notes" />

        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <BrainCircuit size={24} className="text-blue-600" />
                <CardTitle className="text-blue-900">AI-Generated Consultation Summary</CardTitle>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Generated from your clinical notes • Source: Gemini AI • Language: {uiLanguage === 'hi' ? 'Hindi' : 'English'}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Patient Summary */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Summary for Patient</h4>
                <p className="text-slate-700">{aiSummary.patient_summary}</p>
              </div>

              {/* Key Findings */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Key Findings</h4>
                <div className="space-y-1">
                  {aiSummary.key_findings.map((finding: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded">
                      <Sparkles size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{finding}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Medications */}
              {aiSummary.medications.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Medication Schedule</h4>
                  <div className="space-y-2">
                    {aiSummary.medications.map((med, i) => (
                      <div key={i} className="p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Pill size={14} className="text-green-600" />
                          <p className="font-medium text-slate-900">{med.name}</p>
                        </div>
                        <p className="text-sm text-slate-600">
                          {med.dosage} • {med.frequency}
                        </p>
                        {med.instructions && (
                          <p className="text-xs text-slate-500 mt-1">{med.instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up Steps */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Follow-up Steps</h4>
                <div className="space-y-1">
                  {aiSummary.follow_up_steps.map((step: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded">
                      <ListChecks size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning Signs */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={16} className="text-amber-600" />
                  <h4 className="font-semibold text-amber-900">Warning Signs</h4>
                </div>
                <div className="space-y-1">
                  {aiSummary.warning_signs.map((sign: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle size={12} className="text-amber-600 mt-1 flex-shrink-0" />
                      <span className="text-sm text-amber-800">{sign}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => setShowPatientSummary(false)} variant="outline" className="flex-1">
              <FileText size={18} className="mr-2" />
              Back to Notes
            </Button>
            <Button onClick={() => router.push('/doctor/appointments')} className="flex-1">
              <CheckCircle size={18} className="mr-2" />
              Done — Back to Appointments
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ============================================================
  // Main consultation view
  // ============================================================

  return (
    <DashboardLayout navigation={doctorNavigation} role="doctor" userName={doctorName} headerTitle="Consultation">
      <PageHeader
        title={`Consultation with ${patientName}`}
        subtitle={`${appointmentDate} at ${appointmentTime}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Patient Info + Pre-Visit AI */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Patient Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">{patientName.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900">{patientName}</p>
                  <p className="text-sm text-slate-600">{appointmentReason || 'No reason provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Pre-Visit Summary */}
          <Card className="border-purple-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BrainCircuit size={18} className="text-purple-600" />
                <CardTitle>AI Pre-Visit Summary</CardTitle>
              </div>
              {preVisitAnalysis && (
                <p className="text-xs text-purple-600">From Gemini AI analysis</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {preVisitAnalysis ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Urgency</span>
                    <UrgencyBadge urgency={preVisitAnalysis.urgency as 'low' | 'medium' | 'high'} />
                  </div>
                  {preVisitAnalysis.chiefComplaint && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm font-medium text-slate-900 mb-1">Chief Complaint</p>
                      <p className="text-sm text-slate-700">{preVisitAnalysis.chiefComplaint}</p>
                    </div>
                  )}
                  {preVisitAnalysis.symptoms.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">Reported Symptoms</p>
                      <div className="flex flex-wrap gap-1">
                        {preVisitAnalysis.symptoms.map((s, i) => (
                          <span key={i} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {preVisitAnalysis.patientSummary && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs font-medium text-slate-500 mb-1">AI Summary</p>
                      <p className="text-sm text-slate-700">{preVisitAnalysis.patientSummary}</p>
                    </div>
                  )}
                  {preVisitAnalysis.suggestedQuestions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">Suggested Questions</p>
                      <div className="space-y-1">
                        {preVisitAnalysis.suggestedQuestions.map((q, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-purple-50 rounded text-xs">
                            <span className="text-purple-600 font-medium">{i + 1}.</span>
                            <span className="text-slate-700">{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">
                  No AI pre-visit analysis found for this patient.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column — Doctor Notes + AI Summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Consultation Notes Form */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Consultation Notes</CardTitle>
                {saved && (
                  <span className="text-xs text-green-600 font-medium">✓ Saved</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Clinical Notes *</label>
                <textarea
                  value={clinicalNotes}
                  onChange={e => setClinicalNotes(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter clinical observations, findings, and examination results..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Diagnosis / Assessment</label>
                <textarea
                  value={diagnosis}
                  onChange={e => setDiagnosis(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter diagnosis or clinical assessment..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Prescription</label>
                <textarea
                  value={prescription}
                  onChange={e => setPrescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter prescription details (medications, dosage, frequency)..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={generateAISummary}
                  disabled={!clinicalNotes.trim() || aiLoading}
                  className="flex-1"
                >
                  {aiLoading ? (
                    <><Loader2 size={18} className="mr-2 animate-spin" />Generating AI Summary...</>
                  ) : (
                    <><BrainCircuit size={18} className="mr-2" />Generate Patient Summary</>
                  )}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !clinicalNotes.trim()}
                  variant="outline"
                  className="flex-1"
                >
                  {saving ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" />Saving...</>
                  ) : (
                    <><FileText size={18} className="mr-2" />Save Notes</>
                  )}
                </Button>
              </div>

              {/* AI Error */}
              {aiError && (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <ShieldAlert size={16} className="text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">AI Summary Failed</p>
                    <p className="text-xs text-red-600">{aiError}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start" disabled title="Coming Soon">
                  <Video size={18} className="mr-2" />Video Call <span className="ml-1 text-xs text-slate-400">Soon</span>
                </Button>
                <Button variant="outline" className="justify-start" disabled title="Coming Soon">
                  <Phone size={18} className="mr-2" />Audio Call <span className="ml-1 text-xs text-slate-400">Soon</span>
                </Button>
                <Button variant="outline" className="justify-start" disabled title="Coming Soon">
                  <FileText size={18} className="mr-2" />View Records <span className="ml-1 text-xs text-slate-400">Soon</span>
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => router.push('/patient/booking')}>
                  <CalendarPlus size={18} className="mr-2" />Follow-up
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
