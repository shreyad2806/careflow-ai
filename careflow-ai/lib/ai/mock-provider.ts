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
// Hindi translations for each category
// ============================================================

const HINDI_TRANSLATIONS: Record<string, {
  chiefComplaint: string;
  symptoms: string[];
  patientSummary: string;
  suggestedQuestions: string[];
}> = {
  Headache: {
    chiefComplaint: 'लगातार सिरदर्द और संबंधित लक्षण',
    symptoms: ['सिरदर्द', 'रोशनी के प्रति संवेदनशीलता', 'मतली'],
    patientSummary:
      'रोगी को लगातार सिरदर्द हो रहा है। लक्षण माइग्रेन या तनाव-प्रकार के सिरदर्द का संकेत दे सकते हैं। आगे के मूल्यांकन के लिए न्यूरोलॉजी रेफरल की सिफारिश की जाती है।',
    suggestedQuestions: [
      'क्या सिरदर्द दिन के किसी विशेष समय पर होता है?',
      'क्या आपने कुछ खाद्य पदार्थों या तनाव जैसे किसी ट्रिगर को नोटिस किया है?',
      'क्या परिवार में माइग्रेन या सिरदर्द का इतिहास है?',
      'क्या सिरदर्द के साथ मतली या दृश्य गड़बड़ी होती है?',
    ],
  },
  'Chest Pain': {
    chiefComplaint: 'हृदय मूल्यांकन की आवश्यकता वाला छाती में दर्द',
    symptoms: ['छाती में दर्द', 'छाती में जकड़न', 'सांस लेने में कठिनाई'],
    patientSummary:
      'रोगी छाती में दर्द के साथ प्रस्तुत होता है। हृदय के कारणों की संभावना को देखते हुए, तत्काल कार्डियोलॉजी मूल्यांकन की सिफारिश की जाती है। यदि लक्षण गंभीर या अचानक हैं, तो रोगी को तुरंत आपातकालीन देखभाल लेनी चाहिए।',
    suggestedQuestions: [
      'क्या दर्द आपकी भुजा, जबड़े या पीठ में फैलता है?',
      'क्या यह शारीरिक गतिविधि से बढ़ता है?',
      'क्या आपको सांस लेने में कठिनाई या चक्कर आना हुआ है?',
      'क्या आपको हृदय रोग या उच्च रक्तचाप का इतिहास है?',
    ],
  },
  Fever: {
    chiefComplaint: 'सिस्टमिक लक्षणों के साथ बुखार',
    symptoms: ['बढ़ा हुआ शरीर का तापमान', 'थकान', 'सामान्य बेचैनी'],
    patientSummary:
      'रोगी बुखार के साथ प्रस्तुत होता है। अवधि और संबंधित लक्षणों का मूल्यांकन किया जाना चाहिए ताकि यह निर्धारित किया जा सके कि आगे की जांच (रक्त कार्य, इमेजिंग) की आवश्यकता है या नहीं।',
    suggestedQuestions: [
      'आपका तापमान कितना ऊंचा रहा है?',
      'आपको कितने समय से बुखार है?',
      'क्या आपको खांसी, गले में खराश या शरीर में दर्द जैसे अन्य लक्षण हैं?',
      'क्या आप हाल ही में कहीं गए हैं या किसी बीमार व्यक्ति के संपर्क में आए हैं?',
    ],
  },
  Cough: {
    chiefComplaint: 'श्वसन मूल्यांकन की आवश्यकता वाली लगातार खांसी',
    symptoms: ['लगातार खांसी', 'छाती में जमाव', 'गले में जलन'],
    patientSummary:
      'रोगी को लगातार खांसी की शिकायत है। खांसी की अवधि और प्रकृति (सूखी या उत्पादक) का मूल्यांकन किया जाना चाहिए। यदि लक्षण 2 सप्ताह से अधिक समय तक बने रहते हैं या बिगड़ते हैं तो पल्मोनोलॉजी रेफरल की सिफारिश की जाती है।',
    suggestedQuestions: [
      'क्या खांसी सूखी है या बलगम निकल रहा है?',
      'आपको कितने समय से खांसी हो रही है?',
      'क्या या रात में या गतिविधि के साथ बढ़ती है?',
      'क्या आपको बुखार या वजन घटाना हुआ है?',
    ],
  },
  'Stomach Pain': {
    chiefComplaint: 'जीआई मूल्यांकन की आवश्यकता वाले पेट के लक्षण',
    symptoms: ['पेट में दर्द', 'मतली', 'पाचन असुविधा'],
    patientSummary:
      'रोगी पेट के लक्षणों के साथ प्रस्तुत होता है। स्थान, समय और भोजन के साथ संबंध का मूल्यांकन किया जाना चाहिए। यदि लक्षण बने रहते हैं या बिगड़ते हैं तो गैस्ट्रोएंटेरोलॉजी रेफरल की सिफारिश की जाती है।',
    suggestedQuestions: [
      'दर्द ठीक कहां होता है?',
      'क्या यह खाने के बाद या खाली पेट बढ़ता है?',
      'क्या मल त्याग में कोई बदलाव हुआ है?',
      'क्या आपको मतली, उल्टी या पेट फूलना हो रहा है?',
    ],
  },
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

    // Translate patient-facing content to Hindi if requested
    if (input.language === 'hi') {
      const hi = HINDI_TRANSLATIONS[category.label];
      if (hi) {
        raw.chief_complaint = hi.chiefComplaint;
        raw.symptoms = [...hi.symptoms];
        raw.patient_summary = hi.patientSummary;
        raw.suggested_questions = [...hi.suggestedQuestions];
      } else {
        raw.patient_summary +=
          ` [रोगी की पसंदीदा भाषा: हिंदी]`;
      }
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
