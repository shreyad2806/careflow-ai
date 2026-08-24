'use client';

import React, { useState, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/app/DashboardLayout';
import PageHeader from '@/components/app/PageHeader';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UrgencyBadge from '@/components/app/UrgencyBadge';
import { patientNavigation } from '@/lib/navigation';
import {
  BrainCircuit, Mic, ChevronRight, ChevronLeft,
  CheckCircle, AlertTriangle, Stethoscope, Loader2, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { getDemoPatientName } from '@/lib/config/demo-identity';
import { useLanguage } from '@/lib/LanguageContext';
import { useSpeechRecognition } from '@/lib/hooks/useSpeechRecognition';

// ============================================================
// Types
// ============================================================

type Step = 1 | 2 | 3 | 4 | 5;

/** API response shape — matches the route's SuccessResponse. */
interface AnalysisData {
  chiefComplaint: string;
  symptoms: string[];
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedSpecialty: string;
  patientSummary: string;
  suggestedQuestions: string[];
}

/** Mapped result for the UI — UrgencyBadge expects lowercase. */
interface AnalysisResult {
  urgency: 'low' | 'medium' | 'high';
  chiefComplaint: string;
  suggestedSpecialty: string;
  summary: string;
  symptoms: string[];
  questionsForDoctor: string[];
}

interface Props {
  patientId: string;
}

// ============================================================
// Constants
// ============================================================

const SYMPTOM_CATEGORIES = [
  'Head & Neck', 'Chest & Heart', 'Stomach & Digestive',
  'Skin & Allergies', 'Muscles & Joints', 'Mental Health',
  'General', 'Other',
];

const DURATION_OPTIONS = [
  'Less than 1 day', '1-3 days', '4-7 days',
  '1-2 weeks', '2-4 weeks', 'More than 1 month',
];
const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe', 'Very Severe'];
const ADDITIONAL_SYMPTOMS = [
  'Fever', 'Fatigue', 'Nausea', 'Dizziness', 'Headache',
  'Cough', 'Shortness of breath', 'Chest pain', 'Vomiting',
];

const PROMPT_EXAMPLES = [
  "I've been experiencing persistent headaches for the past few days...",
  "I have sharp pain in my lower back when I stand up...",
  "I've been feeling unusually tired and weak lately...",
];

// ============================================================
// Component
// ============================================================

export default function SymptomsPageContent({ patientId }: Props) {
  const patientName = getDemoPatientName();
  const { language } = useLanguage();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const [symptomDescription, setSymptomDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState('');
  const [additionalSymptoms, setAdditionalSymptoms] = useState<string[]>([]);
  // Voice input
  const speechLang = language === 'hi' ? 'hi-IN' : 'en-IN';
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const {
    isSupported: speechSupported,
    isListening,
    interimTranscript,
    finalTranscript,
    error: speechError,
    start: startListening,
    stop: stopListening,
    reset: resetSpeech,
  } = useSpeechRecognition({
    language: speechLang,
    onResult: (transcript) => {
      // Append final transcript to the symptom description
      setSymptomDescription((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${transcript}` : transcript;
      });
    },
    onError: (err) => {
      setVoiceError(err.message);
    },
  });

  // Real API state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ----------------------------------------------------------
  // API call
  // ----------------------------------------------------------

  const callAnalyzeAPI = useCallback(async (): Promise<AnalysisData | null> => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await fetch('/api/ai/symptoms/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: symptomDescription,
        category: selectedCategory || undefined,
        duration: duration || undefined,
        severity: severity || undefined,
        additionalSymptoms: additionalSymptoms.length > 0 ? additionalSymptoms : undefined,
        language: language || 'en',
        patientId,
      }),
      signal: controller.signal,
    });

    const json = await response.json();

    if (!response.ok || !json.ok) {
      throw new Error(json.message || 'Analysis failed. Please try again.');
    }

    return json.data as AnalysisData;
  }, [symptomDescription, selectedCategory, duration, severity, additionalSymptoms, patientId]);

  // ----------------------------------------------------------
  // Map API response → UI shape
  // ----------------------------------------------------------

  function mapToResult(data: AnalysisData): AnalysisResult {
    return {
      urgency: data.urgency.toLowerCase() as 'low' | 'medium' | 'high',
      chiefComplaint: data.chiefComplaint,
      suggestedSpecialty: data.suggestedSpecialty,
      summary: data.patientSummary,
      symptoms: data.symptoms,
      questionsForDoctor: data.suggestedQuestions,
    };
  }

  // ----------------------------------------------------------
  // Analysis trigger — Step 3 → Step 4 → Step 5
  // ----------------------------------------------------------

  const startAnalysis = useCallback(async () => {
    if (isSubmitting || isAnalyzing) return; // duplicate prevention

    setCurrentStep(4);
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setApiError(null);
    setAnalysisResult(null);
    setIsSubmitting(true);

    // Progress bar animation (runs independently of API)
    const interval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90; // Cap at 90% until API responds
        }
        return prev + 15;
      });
    }, 500);

    try {
      const data = await callAnalyzeAPI();
      clearInterval(interval);

      if (data) {
        setAnalysisResult(mapToResult(data));
      }
    } catch (err: unknown) {
      clearInterval(interval);

      // Ignore abort (user navigated away or new request)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }

      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setApiError(message);
    } finally {
      // Complete the progress bar
      setAnalysisProgress(100);
      setTimeout(() => {
        setIsAnalyzing(false);
        setCurrentStep(5);
        setIsSubmitting(false);
      }, 400);
    }
  }, [callAnalyzeAPI, isSubmitting, isAnalyzing]);

  // ----------------------------------------------------------
  // Reset
  // ----------------------------------------------------------

  const resetForm = useCallback(() => {
    abortControllerRef.current?.abort();
    setCurrentStep(1);
    setSymptomDescription('');
    setSelectedCategory('');
    setDuration('');
    setSeverity('');
    setAdditionalSymptoms([]);
    resetSpeech();
    setVoiceError(null);
    setAnalysisResult(null);
    setApiError(null);
    setIsSubmitting(false);
    setAnalysisProgress(0);
  }, []);

  // ----------------------------------------------------------
  // Toggle additional symptom
  // ----------------------------------------------------------

  const toggleAdditionalSymptom = useCallback((symptom: string) => {
    setAdditionalSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  }, []);

  // ----------------------------------------------------------
  // Step renderers (visual design preserved)
  // ----------------------------------------------------------

  const renderStep1 = () => (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-bold">1</span>
          </div>
          <div>
            <CardTitle>Describe Your Symptoms</CardTitle>
            <p className="text-sm text-slate-500">Tell us what you&apos;re experiencing</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            What symptoms are you experiencing?
          </label>
          <div className="relative">
            <textarea
              value={symptomDescription}
              onChange={(e) => setSymptomDescription(e.target.value)}
              placeholder={PROMPT_EXAMPLES[0]}
              rows={5}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {/* Voice input button inside textarea */}
            {speechSupported && currentStep === 1 && (
              <button
                type="button"
                onClick={() => {
                  if (isListening) {
                    stopListening();
                  } else {
                    setVoiceError(null);
                    startListening();
                  }
                }}
                className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-500 animate-pulse'
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
                }`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                <Mic size={18} className="text-white" />
              </button>
            )}
          </div>
          {/* Live interim transcript */}
          {isListening && interimTranscript && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 font-medium mb-1">Listening...</p>
              <p className="text-sm text-slate-700 italic">{interimTranscript}</p>
            </div>
          )}
          {/* Voice error display */}
          {voiceError && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">{voiceError}</p>
            </div>
          )}
          {/* Language hint */}
          {speechSupported && (
            <p className="text-xs text-slate-400 mt-1">
              {language === 'hi'
                ? '🎤 Voice input available in Hindi (हिंदी)'
                : '🎤 Voice input available in English (India)'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Symptom Category</label>
          <div className="flex flex-wrap gap-2">
            {SYMPTOM_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => setCurrentStep(2)}
            disabled={!symptomDescription.trim()}
            className="min-w-[120px]"
          >
            Continue
            <ChevronRight size={18} className="ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card className="border-2 border-purple-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <span className="text-purple-600 font-bold">2</span>
          </div>
          <div>
            <CardTitle>Symptom Details</CardTitle>
            <p className="text-sm text-slate-500">Help us understand the severity</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">How long have you had these symptoms?</label>
          <div className="grid grid-cols-2 gap-2">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setDuration(option)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  duration === option
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-purple-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">How severe are your symptoms?</label>
          <div className="grid grid-cols-2 gap-2">
            {SEVERITY_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setSeverity(option)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  severity === option
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-purple-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Any additional symptoms? (Optional)</label>
          <div className="flex flex-wrap gap-2">
            {ADDITIONAL_SYMPTOMS.map((symptom) => (
              <button
                key={symptom}
                onClick={() => toggleAdditionalSymptom(symptom)}
                className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  additionalSymptoms.includes(symptom)
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {additionalSymptoms.includes(symptom) && <CheckCircle size={14} className="mr-1 inline" />}
                {symptom}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            <ChevronLeft size={18} className="mr-2" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep(3)}
            disabled={!duration || !severity}
            className="min-w-[120px]"
          >
            Continue
            <ChevronRight size={18} className="ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card className="border-2 border-green-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 font-bold">3</span>
          </div>
          <div>
            <CardTitle>Voice Input (Optional)</CardTitle>
            <p className="text-sm text-slate-500">Describe your symptoms in your own words</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center py-8">
          {speechSupported ? (
            <>
              <button
                onClick={() => {
                  if (isListening) {
                    stopListening();
                  } else {
                    setVoiceError(null);
                    startListening();
                  }
                }}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-500 animate-pulse'
                    : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                }`}
              >
                <Mic size={40} className="text-white" />
              </button>
              <p className="mt-4 text-sm text-slate-600">
                {isListening ? 'Listening... Tap to stop' : 'Tap to start speaking'}
              </p>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mic size={28} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">
                Voice input is not available in this browser.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Please type your symptoms instead.
              </p>
            </div>
          )}
        </div>

        {/* Live interim transcript during Step 3 recording */}
        {isListening && interimTranscript && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-600 font-medium mb-1">🎤 Hearing you...</p>
            <p className="text-sm text-slate-700 italic">{interimTranscript}</p>
          </div>
        )}

        {/* Voice error in Step 3 */}
        {voiceError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">{voiceError}</p>
          </div>
        )}

        {/* Transcript preview — shows what was captured */}
        {finalTranscript && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs text-slate-500 font-medium mb-1">Captured text:</p>
            <p className="text-sm text-slate-700">{finalTranscript}</p>
            <p className="text-xs text-slate-400 mt-2">
              This text has been added to your symptom description on Step 1.
            </p>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep(2)}>
            <ChevronLeft size={18} className="mr-2" />
            Back
          </Button>              <Button
                onClick={() => {
                  // Stop any active recording before analysis
                  if (isListening) stopListening();
                  startAnalysis();
                }}
                disabled={isSubmitting}
                className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Analysing...
              </>
            ) : (
              <>
                Analyse
                <BrainCircuit size={18} className="ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card className="border-2 border-indigo-200">
      <CardContent className="p-12 text-center">
        <div className="flex flex-col items-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-indigo-200 rounded-full"></div>
            <div className="absolute top-0 left-0 w-24 h-24 border-4 border-indigo-600 rounded-full animate-spin border-t-transparent"></div>
            <BrainCircuit size={40} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            {analysisProgress < 25
              ? 'Analyzing your symptoms...'
              : analysisProgress < 50
                ? 'Identifying key health concerns...'
                : analysisProgress < 75
                  ? 'Preparing questions for your doctor...'
                  : 'Generating care recommendations...'}
          </h2>

          <div className="w-full max-w-md bg-slate-200 rounded-full h-2 mb-4">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>

          <p className="text-sm text-slate-600">
            Our AI is analyzing your symptoms to provide personalized insights
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep5 = () => {
    // Error state
    if (apiError && !analysisResult) {
      return (
        <Card className="border-2 border-red-200">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Analysis Failed</h2>
              <p className="text-slate-600 mb-6 max-w-md">{apiError}</p>
              <div className="flex gap-3">
                <Button onClick={startAnalysis} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 size={18} className="mr-2 animate-spin" />
                  ) : null}
                  Try Again
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Start Over
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // No result yet (shouldn't happen, but safety fallback)
    if (!analysisResult) {
      return (
        <Card className="border-2 border-slate-200">
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">No analysis results available.</p>
            <Button onClick={resetForm} className="mt-4">Start Over</Button>
          </CardContent>
        </Card>
      );
    }

    // Success state — render validated analysis
    return (
      <div className="space-y-6">
        <Card className="border-2 border-emerald-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={20} className="text-emerald-600" />
                </div>
                <div>
                  <CardTitle>AI Analysis Complete</CardTitle>
                  <p className="text-sm text-slate-500">Your personalized health insights</p>
                </div>
              </div>
              <UrgencyBadge urgency={analysisResult.urgency} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-emerald-50 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2">Chief Complaint</h4>
              <p className="text-slate-700">{analysisResult.chiefComplaint}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-1">Suggested Specialty</h4>
                <p className="text-blue-700 font-medium">{analysisResult.suggestedSpecialty}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-1">Urgency Level</h4>
                <p className="text-purple-700 font-medium capitalize">{analysisResult.urgency}</p>
              </div>
            </div>

            {analysisResult.symptoms.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Identified Symptoms</h4>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.symptoms.map((symptom, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                    >
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-slate-900 mb-2">AI Summary</h4>
              <p className="text-slate-700">{analysisResult.summary}</p>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-3">Questions for Your Doctor</h4>
              <div className="space-y-2">
                {analysisResult.questionsForDoctor.map((question, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {index + 1}
                    </span>
                    <p className="text-sm text-slate-700">{question}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 mb-1">Important Disclaimer</h4>
                  <p className="text-sm text-amber-800">
                    This analysis is for informational purposes only and does not
                    constitute a medical diagnosis. Please consult a healthcare
                    professional for proper evaluation and treatment.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/patient/doctors?specialty=${encodeURIComponent(analysisResult.suggestedSpecialty)}`}
                className="flex-1"
              >
                <Button className="w-full">
                  <Stethoscope size={18} className="mr-2" />
                  Find Recommended Doctor
                </Button>
              </Link>
              <Link href="/patient/booking" className="flex-1">
                <Button variant="outline" className="w-full">
                  Book Appointment
                </Button>
              </Link>
              <Button variant="outline" onClick={resetForm}>
                Start Over
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ----------------------------------------------------------
  // Main render
  // ----------------------------------------------------------

  return (
    <DashboardLayout
      navigation={patientNavigation}
      role="patient"
      userName={patientName}
      headerTitle="AI Symptom Check"
    >
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="AI Symptom Analysis"
          subtitle="Describe your symptoms and get AI-powered health insights"
        />

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-medium text-sm ${
                  step === currentStep
                    ? 'bg-blue-600 text-white'
                    : step < currentStep
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {step < currentStep ? <CheckCircle size={18} /> : step}
              </div>
              {step < 5 && (
                <div className={`w-6 sm:w-16 h-1 mx-1 sm:mx-2 ${step < currentStep ? 'bg-green-500' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </div>
    </DashboardLayout>
  );
}
