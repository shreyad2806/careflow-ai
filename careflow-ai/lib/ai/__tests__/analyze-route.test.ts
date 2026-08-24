/**
 * Step 5.3 Verification — AI Symptom Analysis API.
 *
 * Tests all 8 required cases:
 *   1. Valid symptom input → 200
 *   2. Empty symptom input → 400
 *   3. Very short input → 200 (mock accepts any non-empty string)
 *   4. Malformed JSON → 400
 *   5. Invalid language value → 400
 *   6. Mock provider failure → 502
 *   7. Invalid provider output → 502
 *   8. Schema validation failure → 400
 *
 * Also tests:
 *   - validateAnalysis() unit tests
 *   - MockSymptomProvider keyword matching
 *   - Response shape consistency
 *   - No unhandled exceptions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================
// Mock the provider module — only needed for cases 6 & 7
// ============================================================

const mockAnalyze = vi.fn();

// Mock persistence — avoids real Supabase calls
const { mockSaveAnalysis } = vi.hoisted(() => ({
  mockSaveAnalysis: vi.fn(),
}));
vi.mock('@/lib/services/ai-analysis', () => ({
  saveAnalysis: mockSaveAnalysis,
}));

vi.mock('@/lib/ai/provider-factory', () => ({
  getProvider: () => ({
    name: 'mock',
    analyze: mockAnalyze,
  }),
}));

// ============================================================
// Import after mock setup
// ============================================================

import { POST, GET } from '@/app/api/ai/symptoms/analyze/route';
import { validateAnalysis } from '../validate';
import { MockSymptomProvider } from '../mock-provider';

// ============================================================
// Helpers
// ============================================================

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440001';

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/symptoms/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/symptoms/analyze', {
    method: 'GET',
  });
}

/** Default mock provider return value (valid analysis). */
function validProviderOutput() {
  return {
    ok: true as const,
    data: {
      chief_complaint: 'Persistent headaches with associated symptoms',
      symptoms: ['Headache', 'Sensitivity to light', 'Nausea'],
      urgency: 'MEDIUM',
      suggested_specialty: 'Neurology',
      patient_summary: 'Patient reports persistent headaches for 3 days.',
      suggested_questions: [
        'Do headaches occur at a specific time of day?',
        'Have you noticed any triggers?',
      ],
    },
  };
}

// ============================================================
// 1. validateAnalysis() unit tests
// ============================================================

describe('validateAnalysis()', () => {
  it('accepts valid raw analysis object', () => {
    const result = validateAnalysis({
      chief_complaint: 'Headache',
      symptoms: ['Headache', 'Nausea'],
      urgency: 'medium',
      suggested_specialty: 'Neurology',
      patient_summary: 'Patient reports headaches.',
      suggested_questions: ['When did it start?'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.chiefComplaint).toBe('Headache');
    expect(result.data.urgency).toBe('MEDIUM');
    expect(result.data.symptoms).toEqual(['Headache', 'Nausea']);
  });

  it('normalizes lowercase urgency to uppercase', () => {
    const result = validateAnalysis({
      chief_complaint: 'Test',
      symptoms: ['Test'],
      urgency: 'low',
      suggested_specialty: 'General',
      patient_summary: 'Test summary.',
      suggested_questions: ['Test question?'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.urgency).toBe('LOW');
  });

  it('rejects null input', () => {
    const result = validateAnalysis(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('STRUCTURE_MISMATCH');
  });

  it('rejects undefined input', () => {
    const result = validateAnalysis(undefined);
    expect(result.ok).toBe(false);
  });

  it('rejects non-object input', () => {
    const result = validateAnalysis('just a string');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('STRUCTURE_MISMATCH');
  });

  it('rejects invalid urgency value', () => {
    const result = validateAnalysis({
      chief_complaint: 'Test',
      symptoms: ['Test'],
      urgency: 'CRITICAL',
      suggested_specialty: 'General',
      patient_summary: 'Test.',
      suggested_questions: ['Q1?'],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID_URGENCY');
  });

  it('rejects empty chief_complaint', () => {
    const result = validateAnalysis({
      chief_complaint: '',
      symptoms: ['Test'],
      urgency: 'medium',
      suggested_specialty: 'General',
      patient_summary: 'Test.',
      suggested_questions: ['Q1?'],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('EMPTY_CHIEF_COMPLAINT');
  });

  it('accepts empty symptoms array (permissive raw schema)', () => {
    // RawAnalysisSchema is intentionally permissive — it accepts empty arrays
    // because the provider may return an empty list for non-specific symptoms.
    // The AnalysisResultSchema (strict) enforces .min(1) for the final output.
    const result = validateAnalysis({
      chief_complaint: 'Test',
      symptoms: [],
      urgency: 'medium',
      suggested_specialty: 'General',
      patient_summary: 'Test.',
      suggested_questions: ['Q1?'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.symptoms).toEqual([]);
  });

  it('rejects empty suggested_questions array', () => {
    const result = validateAnalysis({
      chief_complaint: 'Test',
      symptoms: ['Test'],
      urgency: 'medium',
      suggested_specialty: 'General',
      patient_summary: 'Test.',
      suggested_questions: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID_QUESTIONS');
  });

  it('rejects more than 5 questions', () => {
    const result = validateAnalysis({
      chief_complaint: 'Test',
      symptoms: ['Test'],
      urgency: 'medium',
      suggested_specialty: 'General',
      patient_summary: 'Test.',
      suggested_questions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?', 'Q6?'],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID_QUESTIONS');
  });
});

// ============================================================
// 2. MockSymptomProvider unit tests
// ============================================================

describe('MockSymptomProvider', () => {
  const provider = new MockSymptomProvider();

  it('has name "mock"', () => {
    expect(provider.name).toBe('mock');
  });

  it('routes headache to Neurology', async () => {
    const result = await provider.analyze({
      symptoms: { description: 'I have a severe headache' },
      language: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.suggested_specialty).toBe('Neurology');
    expect(result.data.urgency).toBe('MEDIUM');
  });

  it('routes chest pain to Cardiology with HIGH urgency', async () => {
    const result = await provider.analyze({
      symptoms: { description: 'Sharp chest pain when breathing' },
      language: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.suggested_specialty).toBe('Cardiology');
    expect(result.data.urgency).toBe('HIGH');
  });

  it('routes fever to Internal Medicine', async () => {
    const result = await provider.analyze({
      symptoms: { description: 'High fever with chills for 2 days' },
      language: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.suggested_specialty).toBe('Internal Medicine');
  });

  it('routes cough to Pulmonology', async () => {
    const result = await provider.analyze({
      symptoms: { description: 'Persistent cough for a week' },
      language: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.suggested_specialty).toBe('Pulmonology');
  });

  it('routes stomach pain to Gastroenterology', async () => {
    const result = await provider.analyze({
      symptoms: { description: 'Stomach pain after eating' },
      language: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.suggested_specialty).toBe('Gastroenterology');
  });

  it('falls back to General Practice for unmatched symptoms', async () => {
    const result = await provider.analyze({
      symptoms: { description: 'My elbow feels weird' },
      language: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.suggested_specialty).toBe('General Practice');
  });

  it('output has all required fields (matches RawAnalysisSchema)', async () => {
    const result = await provider.analyze({
      symptoms: { description: 'headache' },
      language: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveProperty('chief_complaint');
    expect(result.data).toHaveProperty('symptoms');
    expect(result.data).toHaveProperty('urgency');
    expect(result.data).toHaveProperty('suggested_specialty');
    expect(result.data).toHaveProperty('patient_summary');
    expect(result.data).toHaveProperty('suggested_questions');
    expect(Array.isArray(result.data.symptoms)).toBe(true);
    expect(Array.isArray(result.data.suggested_questions)).toBe(true);
  });

  it('matches keywords from additionalSymptoms', async () => {
    const result = await provider.analyze({
      symptoms: {
        description: 'I feel unwell',
        additionalSymptoms: ['chest pain'],
      },
      language: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.suggested_specialty).toBe('Cardiology');
  });

  it('adds language note for non-English', async () => {
    const result = await provider.analyze({
      symptoms: { description: 'headache' },
      language: 'hi',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.patient_summary).toContain('Patient preferred language: hi');
  });
});

// ============================================================
// 3. Route handler — all 8 verification cases
// ============================================================

describe('POST /api/ai/symptoms/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: mock provider returns valid output
    mockAnalyze.mockResolvedValue(validProviderOutput());
    // Default: mock persistence succeeds
    mockSaveAnalysis.mockResolvedValue({
      ok: true,
      analysisId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      data: validProviderOutput().data,
    });
  });

  // --- Case 1: Valid symptom input ---
  it('Case 1: Returns 200 with valid analysis for symptom input', async () => {
    const req = makePostRequest({
      description: 'I have been experiencing persistent headaches for 3 days',
      category: 'Head & Neck',
      duration: '3 days',
      severity: 'Moderate',
      additionalSymptoms: ['Nausea', 'Sensitivity to light'],
      language: 'en',
      patientId: TEST_UUID,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe('mock');
    expect(body.data).toHaveProperty('chiefComplaint');
    expect(body.data).toHaveProperty('symptoms');
    expect(body.data).toHaveProperty('urgency');
    expect(body.data).toHaveProperty('suggestedSpecialty');
    expect(body.data).toHaveProperty('patientSummary');
    expect(body.data).toHaveProperty('suggestedQuestions');
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(body.data.urgency);
    expect(Array.isArray(body.data.symptoms)).toBe(true);
    expect(body.data.symptoms.length).toBeGreaterThan(0);
    expect(Array.isArray(body.data.suggestedQuestions)).toBe(true);
    expect(body.data.suggestedQuestions.length).toBeGreaterThanOrEqual(1);
    expect(body.data.suggestedQuestions.length).toBeLessThanOrEqual(5);
  });

  // --- Case 2: Empty symptom input ---
  it('Case 2: Returns 400 for empty description', async () => {
    const req = makePostRequest({ description: '' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('description');
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });

  // --- Case 3: Very short input ---
  it('Case 3: Returns 200 for very short but non-empty input', async () => {
    const req = makePostRequest({ description: 'hi', patientId: TEST_UUID });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.symptoms.length).toBeGreaterThan(0);
  });

  // --- Case 4: Malformed JSON ---
  it('Case 4: Returns 400 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/symptoms/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json {{{',
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('INVALID_JSON');
    expect(body.message).toContain('JSON');
  });

  // --- Case 5: Invalid language value ---
  it('Case 5: Returns 400 for invalid language value', async () => {
    const req = makePostRequest({
      description: 'headache',
      language: 'fr',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('language');
  });

  // --- Case 6: Mock provider failure ---
  it('Case 6: Returns 502 when provider fails', async () => {
    mockAnalyze.mockResolvedValue({
      ok: false,
      error: 'PROVIDER_UNAVAILABLE',
      message: 'Provider is temporarily unavailable.',
    });

    const req = makePostRequest({ description: 'headache', patientId: TEST_UUID });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('PROVIDER_FAILED');
    expect(body.message).toBe('Provider is temporarily unavailable.');
  });

  // --- Case 7: Invalid provider output ---
  it('Case 7: Returns 502 when provider output is invalid', async () => {
    mockAnalyze.mockResolvedValue({
      ok: true,
      data: {
        // Missing required fields
        chief_complaint: '',
        urgency: 'invalid',
      },
    });

    const req = makePostRequest({ description: 'headache', patientId: TEST_UUID });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('PROVIDER_OUTPUT_INVALID');
    expect(body.message).toContain('invalid data');
  });

  // --- Case 8: Schema validation failure (missing required field) ---
  it('Case 8: Returns 400 when required field is missing', async () => {
    const req = makePostRequest({
      // description is missing
      category: 'Head & Neck',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('description');
  });

  // --- Additional: unknown fields rejected (strict mode) ---
  it('Rejects unknown fields in request body', async () => {
    const req = makePostRequest({
      description: 'headache',
      unknownField: 'should be rejected',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // --- Additional: provider throws exception ---
  it('Returns 500 when provider throws an exception', async () => {
    mockAnalyze.mockRejectedValue(new Error('Network timeout'));

    const req = makePostRequest({ description: 'headache', patientId: TEST_UUID });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('PROVIDER_ERROR');
    expect(body.message).toContain('unexpected error');
  });

  // --- Additional: GET returns 405 ---
  it('GET returns 405 Method Not Allowed', async () => {
    const req = makeGetRequest();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(405);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('METHOD_NOT_ALLOWED');
  });

  // --- Additional: no unhandled exceptions on any input ---
  it('Never throws unhandled exceptions', async () => {
    const inputs = [
      null,
      undefined,
      42,
      'string',
      [],
      { description: '' },
      { description: 'test', language: 'invalid' },
      { totally: 'wrong' },
    ];

    for (const input of inputs) {
      const req = makePostRequest(input);
      // Should never throw — always returns a response
      const res = await POST(req);
      expect(res).toBeDefined();
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(600);
    }
  });

  // --- Additional: response shape is always consistent ---
  it('Error responses always have ok, error, and message', async () => {
    const req = makePostRequest({ description: '' });
    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty('ok', false);
    expect(typeof body.error).toBe('string');
    expect(typeof body.message).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
    expect(body.message.length).toBeGreaterThan(0);
  });

  it('Success responses always have ok, data, provider, and analysisId', async () => {
    const req = makePostRequest({ description: 'headache', patientId: TEST_UUID });
    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('provider', 'mock');
    expect(body).toHaveProperty('analysisId');
    expect(typeof body.data).toBe('object');
  });

  it('Returns analysisId when persistence succeeds', async () => {
    const req = makePostRequest({ description: 'headache', patientId: TEST_UUID });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.analysisId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(mockSaveAnalysis).toHaveBeenCalledTimes(1);
  });

  it('Returns analysisId=null when persistence fails but still returns analysis', async () => {
    mockSaveAnalysis.mockResolvedValue({
      ok: false,
      error: 'DATABASE_ERROR',
      message: 'Insert failed',
    });

    const req = makePostRequest({ description: 'headache', patientId: TEST_UUID });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.analysisId).toBeNull();
    expect(body.data).toHaveProperty('chiefComplaint');
  });

  it('Returns 400 when patientId is missing', async () => {
    const req = makePostRequest({ description: 'headache' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('patientId');
  });

  it('Returns 400 when patientId is not a valid UUID', async () => {
    const req = makePostRequest({ description: 'headache', patientId: 'not-a-uuid' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // --- Additional: additionalSymptoms limit ---
  it('Rejects more than 20 additional symptoms', async () => {
    const req = makePostRequest({
      description: 'test',
      additionalSymptoms: Array.from({ length: 21 }, (_, i) => `symptom ${i}`),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // --- Additional: description length limit ---
  it('Rejects description over 2000 characters', async () => {
    const req = makePostRequest({
      description: 'x'.repeat(2001),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
