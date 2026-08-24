/**
 * Deterministic mock AI provider for development and testing.
 *
 * Routes symptoms to pre-built responses based on keyword matching.
 * No external API calls, no secrets, fully deterministic.
 *
 * Covers 5 primary categories + fallback:
 *   - Headache / head pain → Neurology
 *   - Chest pain / heart → Cardiology
 *   - Fever / temperature → Internal Medicine
 *   - Cough / respiratory → Pulmonology
 *   - Stomach / abdominal → Gastroenterology
 *   - Default → General Practice
 *
 * Usage:
 *   import { MockSymptomProvider } from '@/lib/ai/mock-provider';
 *   const provider = new MockSymptomProvider();
 *   const result = await provider.analyze({ symptoms: {...}, language: 'en' });
 */

import type {
  SymptomAIProvider,
  ProviderInput,
  ProviderResult,
} from './provider';

// ============================================================
// Keyword → category mapping
// ============================================================

interface CategoryProfile {
  /** Keywords that trigger this category (case-insensitive). */
  keywords: string[];
  /** Display name for logging. */
  label: string;
  /** Structured analysis template. */
  analysis: {
    chiefComplaint: string;
    symptoms: string[];
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    suggestedSpecialty: string;
    patientSummary: string;
    suggestedQuestions: string[];
  };
}

const CATEGORIES: CategoryProfile[] = [
  {
    keywords: ['headache', 'head pain', 'migraine', 'head ache', 'head pressure'],
    label: 'Headache',
    analysis: {
      chiefComplaint: 'Persistent headaches with associated symptoms',
      symptoms: ['Headache', 'Sensitivity to light', 'Nausea'],
      urgency: 'MEDIUM',
      suggestedSpecialty: 'Neurology',
      patientSummary:
        'Patient reports persistent headaches. Symptoms may indicate migraine or ' +
        'tension-type headache. Neurology referral recommended for further evaluation.',
      suggestedQuestions: [
        'Do the headaches occur at a specific time of day?',
        'Have you noticed any triggers like certain foods or stress?',
        'Is there a family history of migraines or headaches?',
        'Do you experience nausea or visual disturbances with the headaches?',
      ],
    },
  },
  {
    keywords: ['chest pain', 'chest tightness', 'heart pain', 'chest pressure', 'angina'],
    label: 'Chest Pain',
    analysis: {
      chiefComplaint: 'Chest pain requiring cardiac evaluation',
      symptoms: ['Chest pain', 'Chest tightness', 'Shortness of breath'],
      urgency: 'HIGH',
      suggestedSpecialty: 'Cardiology',
      patientSummary:
        'Patient presents with chest pain. Given the potential for cardiac causes, ' +
        'urgent cardiology evaluation is recommended. If symptoms are severe or ' +
        'acute, the patient should seek emergency care immediately.',
      suggestedQuestions: [
        'Does the pain radiate to your arm, jaw, or back?',
        'Does it worsen with exertion or physical activity?',
        'Have you experienced shortness of breath or dizziness?',
        'Do you have a history of heart disease or high blood pressure?',
      ],
    },
  },
  {
    keywords: ['fever', 'high temperature', 'chills', 'shaking', 'feverish'],
    label: 'Fever',
    analysis: {
      chiefComplaint: 'Fever with systemic symptoms',
      symptoms: ['Elevated body temperature', 'Fatigue', 'General malaise'],
      urgency: 'MEDIUM',
      suggestedSpecialty: 'Internal Medicine',
      patientSummary:
        'Patient presents with fever. Duration and associated symptoms should be ' +
        'evaluated to determine if further investigation (blood work, imaging) is needed.',
      suggestedQuestions: [
        'How high has your temperature been?',
        'How long have you had the fever?',
        'Do you have any other symptoms like cough, sore throat, or body aches?',
        'Have you traveled recently or been exposed to anyone who is ill?',
      ],
    },
  },
  {
    keywords: ['cough', 'coughing', 'chest congestion', 'phlegm', 'bronchitis'],
    label: 'Cough',
    analysis: {
      chiefComplaint: 'Persistent cough requiring respiratory evaluation',
      symptoms: ['Persistent cough', 'Chest congestion', 'Throat irritation'],
      urgency: 'MEDIUM',
      suggestedSpecialty: 'Pulmonology',
      patientSummary:
        'Patient reports a persistent cough. Duration and character of the cough ' +
        '(dry vs. productive) should be assessed. Pulmonology referral if symptoms ' +
        'persist beyond 2 weeks or worsen.',
      suggestedQuestions: [
        'Is the cough dry or producing mucus?',
        'How long have you been coughing?',
        'Does it worsen at night or with activity?',
        'Have you experienced any fever or weight loss?',
      ],
    },
  },
  {
    keywords: [
      'stomach pain', 'abdominal pain', 'belly ache', 'stomach ache',
      'nausea', 'vomiting', 'diarrhea', 'indigestion', 'heartburn',
    ],
    label: 'Stomach Pain',
    analysis: {
      chiefComplaint: 'Abdominal symptoms requiring GI evaluation',
      symptoms: ['Abdominal pain', 'Nausea', 'Digestive discomfort'],
      urgency: 'MEDIUM',
      suggestedSpecialty: 'Gastroenterology',
      patientSummary:
        'Patient presents with abdominal symptoms. Location, timing, and relation ' +
        'to meals should be evaluated. Gastroenterology referral recommended if ' +
        'symptoms persist or worsen.',
      suggestedQuestions: [
        'Where exactly is the pain located in your abdomen?',
        'Does it worsen after eating or on an empty stomach?',
        'Have you experienced changes in bowel movements?',
        'Do you have any nausea, vomiting, or bloating?',
      ],
    },
  },
];

// ============================================================
// Fallback analysis (no keyword match)
// ============================================================

const FALLBACK_ANALYSIS = {
  chiefComplaint: 'General symptoms requiring evaluation',
  symptoms: ['Patient-reported symptoms'],
  urgency: 'MEDIUM' as const,
  suggestedSpecialty: 'General Practice',
  patientSummary:
    'The patient has reported symptoms that require professional evaluation. ' +
    'A general practitioner should conduct an initial assessment and determine ' +
    'if specialist referral is needed.',
  suggestedQuestions: [
    'Can you describe your symptoms in your own words?',
    'When did the symptoms first start?',
    'Have you experienced these symptoms before?',
    'Are there any factors that make the symptoms better or worse?',
  ],
};

// ============================================================
// Mock provider implementation
// ============================================================

/**
 * Deterministic mock AI provider.
 *
 * Matches symptoms against keyword categories and returns
 * pre-built structured responses. Fully deterministic —
 * the same input always produces the same output.
 */
export class MockSymptomProvider implements SymptomAIProvider {
  readonly name = 'mock';

  async analyze(input: ProviderInput): Promise<ProviderResult> {
    const text = this.buildSearchText(input);
    const category = this.matchCategory(text);

    // Build raw output matching RawAnalysisSchema shape (snake_case)
    const raw = {
      chief_complaint: category.analysis.chiefComplaint,
      symptoms: [...category.analysis.symptoms],
      urgency: category.analysis.urgency,
      suggested_specialty: category.analysis.suggestedSpecialty,
      patient_summary: category.analysis.patientSummary,
      suggested_questions: [...category.analysis.suggestedQuestions],
    };

    // Add language note if non-English
    if (input.language !== 'en') {
      raw.patient_summary +=
        ` [Patient preferred language: ${input.language}]`;
    }

    return { ok: true, data: raw };
  }

  // ----------------------------------------------------------
  // Internal helpers
  // ----------------------------------------------------------

  /** Combine all symptom text into one searchable string. */
  private buildSearchText(input: ProviderInput): string {
    const parts: string[] = [input.symptoms.description.toLowerCase()];

    if (input.symptoms.category) {
      parts.push(input.symptoms.category.toLowerCase());
    }
    if (input.symptoms.additionalSymptoms) {
      parts.push(
        ...input.symptoms.additionalSymptoms.map((s) => s.toLowerCase())
      );
    }

    return parts.join(' ');
  }

  /** Match text against keyword categories. Returns first match or fallback. */
  private matchCategory(text: string): CategoryProfile {
    for (const category of CATEGORIES) {
      for (const keyword of category.keywords) {
        if (text.includes(keyword)) {
          return category;
        }
      }
    }
    // No keyword match → return a constructed fallback
    return {
      keywords: [],
      label: 'General',
      analysis: FALLBACK_ANALYSIS,
    };
  }
}

// ============================================================
// Singleton for convenience
// ============================================================

let _instance: MockSymptomProvider | null = null;

/** Get the singleton mock provider instance. */
export function getMockProvider(): MockSymptomProvider {
  if (!_instance) {
    _instance = new MockSymptomProvider();
  }
  return _instance;
}
