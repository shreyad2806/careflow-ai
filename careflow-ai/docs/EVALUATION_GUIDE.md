# CareFlow AI — Evaluation Guide

This guide walks evaluators through every implemented feature, including how to verify it works correctly.

---

## Quick Start

```bash
cd careflow-ai

# Install dependencies
npm install

# Run development server
npm run dev
```

The app opens at **http://localhost:3000**.

---

## Demo Accounts

| Role | Email | Name | Login As |
|------|-------|------|----------|
| Patient | `patient@careflow.demo` | John Smith | `/patient` |
| Doctor | `doctor@careflow.demo` | Dr. Priya Sharma (Cardiology) | `/doctor` |
| Admin | `admin@careflow.demo` | Admin User | `/admin` |

> **Note:** This project uses development-mode demo identity resolution. The system resolves user IDs from the database at runtime based on these email addresses. Real Supabase Auth login is not yet wired — the demo accounts bypass authentication for evaluation purposes.

---

## What to Test First

### 1. Landing Page (`/`)
- Hero section with project description
- Feature cards showing implemented capabilities
- Navigation to all three role dashboards

### 2. Patient Dashboard (`/patient`)
- Welcome card with patient name
- Upcoming appointment summary
- Quick-action buttons for symptom check and booking

### 3. AI Symptom Check (`/patient/symptoms`) ⭐
- **Step 1:** Type a symptom description (try "persistent headache for 3 days")
- **Step 2:** Select duration and severity
- **Step 3:** Click "Analyse"
- **Step 4:** Watch the progress bar (real API call happens here)
- **Step 5:** Review structured AI analysis:
  - Urgency badge (color-coded: LOW/MEDIUM/HIGH)
  - Chief complaint summary
  - Identified symptoms as tags
  - Suggested medical specialty
  - Patient-friendly summary
  - Numbered questions for the doctor
  - Medical disclaimer

**Try these inputs to see different AI responses:**
- `"chest pain"` → HIGH urgency, Cardiology
- `"persistent headache"` → MEDIUM urgency, Neurology
- `"high fever with chills"` → MEDIUM urgency, Internal Medicine
- `"cough for 2 weeks"` → MEDIUM urgency, Pulmonology
- `"stomach pain after meals"` → MEDIUM urgency, Gastroenterology
- `"random unusual symptoms"` → MEDIUM urgency, General Practice

### 4. Appointment Booking (`/patient/booking`) ⭐
- Select a doctor from the list
- Select a date (shows next 7 days)
- View dynamically generated available time slots
- Click a slot → 5-minute hold countdown starts
- Fill in reason → Click "Confirm Appointment"
- Verify booking appears in appointments list

### 5. Doctor Discovery (`/patient/doctors`)
- Browse available doctors with specialty, experience, fees
- Doctor cards show availability days

### 6. Appointments (`/patient/appointments`)
- View upcoming and past appointments
- See appointment details including urgency and status

### 7. Care Timeline (`/patient/timeline`)
- Chronological view of care events

---

## Verifying Supabase Integration

To verify the app uses real Supabase data (not just mock data):

1. **Check the terminal logs.** Every data fetch prints:
   ```
   [DataAdapter] [/patient/doctors] fetchDoctors: 🔗 Source: Supabase
   [DataAdapter] [/patient/doctors] fetchDoctors: ✅ Supabase read OK — 3 record(s)
   ```

2. **If Supabase is not configured**, you'll see:
   ```
   [DataAdapter] [/patient/doctors] fetchDoctors: 📦 Source: Mock data (Supabase not configured)
   ```

3. **For AI analysis**, the provider and persistence status are logged:
   ```
   [AIAnalysis] [ProviderFactory] ✅ Provider: mock (default — set AI_PROVIDER=openai with OPENAI_API_KEY to enable)
   [AIAnalysis] [/api/ai/symptoms/analyze] ✅ Persisted analysis: id=...
   [AIAnalysis] [/api/ai/symptoms/analyze] ✅ Analysis complete in 5ms: urgency=MEDIUM specialty=Neurology persisted=yes
   ```

---

## Switching from Mock AI to Real AI

1. Get an OpenAI API key from https://platform.openai.com/api-keys

2. Add to `.env.local`:
   ```bash
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-your-key-here
   ```

3. Restart the dev server:
   ```bash
   npm run dev
   ```

4. The terminal will show:
   ```
   [AIAnalysis] [ProviderFactory] ✅ Provider: openai (model=gpt-4o-mini)
   ```

5. All subsequent symptom analyses will use the real OpenAI API.

---

## Verifying Slot Concurrency Protection

### Automated Verification Page

Navigate to **http://localhost:3000/dev/slots-verification**

This development-only page runs 13 automated tests against the booking engine:

| Test | What It Verifies |
|------|-----------------|
| 1. Normal available slot | Slot generation from doctor availability |
| 2. Confirmed appointment excludes slot | Booked slots don't appear |
| 3. Active hold excludes slot | Held slots don't appear |
| 4. Expired hold does NOT exclude slot | Expired holds free the slot |
| 5. Doctor leave blocks all slots | Leave prevents all bookings |
| 6. Multiple availability windows | Multiple windows are handled |
| 7. Overlapping windows merged | Duplicate slots are prevented |
| 8. Past time filtering | Past slots filtered for today |
| 9. Concurrent hold acquisition | Two simultaneous holds → only one succeeds |
| 10. Concurrent booking confirmation | Two simultaneous confirms → only one succeeds |
| 11. Unauthorized confirmation rejected | Patient B can't confirm Patient A's hold |
| 12. Appointment cancellation | Cancel frees the slot |
| 13. Unauthorized cancellation rejected | Patient B can't cancel Patient A's appointment |

### Manual Concurrency Test

From the terminal, fire two simultaneous `curl` requests:

```bash
# Terminal 1
curl -s -X POST http://localhost:3000/api/ai/symptoms/analyze \
  -H "Content-Type: application/json" \
  -d '{"description":"headache","patientId":"<uuid>"}' &

# Terminal 2 (same time)
curl -s -X POST http://localhost:3000/api/ai/symptoms/analyze \
  -H "Content-Type: application/json" \
  -d '{"description":"fever","patientId":"<uuid>"}' &
```

Both should succeed independently (they're analyzing different symptoms).

For true booking concurrency, the `/dev/slots-verification` page test 9 and 10 handle this by calling `simulateConcurrentHolds()` and racing `confirmBooking()` calls.

---

## API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai/symptoms/analyze` | Analyze symptoms via AI provider |
| POST | `/api/ai/doctors/match` | Match doctors to AI analysis results |

### Test the AI Analysis API

```bash
# Valid request
curl -s -X POST http://localhost:3000/api/ai/symptoms/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "description": "persistent headache for 3 days with nausea",
    "category": "Head & Neck",
    "duration": "3 days",
    "severity": "Moderate",
    "additionalSymptoms": ["Nausea", "Sensitivity to light"],
    "language": "en",
    "patientId": "00000000-0000-0000-0000-000000000000"
  }' | jq .
```

Expected response:
```json
{
  "ok": true,
  "data": {
    "chiefComplaint": "Persistent headaches with associated symptoms",
    "symptoms": ["Headache", "Sensitivity to light", "Nausea"],
    "urgency": "MEDIUM",
    "suggestedSpecialty": "Neurology",
    "patientSummary": "Patient reports persistent headaches...",
    "suggestedQuestions": [
      "Do the headaches occur at a specific time of day?",
      "Have you noticed any triggers?",
      "Is there a family history of migraines?"
    ]
  },
  "provider": "mock",
  "analysisId": "uuid-or-null"
}
```

### Error Cases

```bash
# Empty description → 400
curl -s -X POST http://localhost:3000/api/ai/symptoms/analyze \
  -H "Content-Type: application/json" \
  -d '{"description":""}' | jq .

# Missing patientId → 400
curl -s -X POST http://localhost:3000/api/ai/symptoms/analyze \
  -H "Content-Type: application/json" \
  -d '{"description":"headache"}' | jq .

# GET instead of POST → 405
curl -s http://localhost:3000/api/ai/symptoms/analyze | jq .
```

---

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suite
npx vitest run lib/ai/__tests__/
npx vitest run lib/services/__tests__/
```

### Test Coverage

| Suite | Tests | What It Covers |
|-------|-------|---------------|
| AI analysis route | 40 | Request validation, provider mock, output validation, persistence, error handling |
| Availability helpers | ~20 | Time parsing, interval overlap, window merging |
| Availability service | ~30 | Slot generation, doctor leave, date validation |
| **Total** | **94** | |

---

## Build Checks

```bash
# TypeScript type check
npx tsc --noEmit

# Lint
npm run lint

# Production build
npm run build
```

---

## Where Real Data Is Used

| Feature | Supabase Required? | Mock Fallback? |
|---------|-------------------|---------------|
| Doctor listing | Yes (or mock data) | ✅ Falls back to mock |
| Slot generation | Yes (needs doctor_availability + appointments) | ✅ Falls back to mock |
| Slot holds | Yes (needs slot_holds table) | ❌ Returns database error |
| Booking confirmation | Yes (needs DB functions) | ❌ Returns database error |
| AI symptom analysis | No (mock provider works offline) | ✅ Mock always works |
| AI persistence | Yes (needs ai_analyses table) | ✅ Analysis still returned, analysisId=null |
| Doctor matching | Yes (needs ai_analyses + doctors) | ❌ Returns error if no analysis |

---

## Known Limitations

1. **No real authentication.** Demo identity is resolved from the database. Real Supabase Auth login is not wired.
2. **Single doctor in demo.** The seed data creates one doctor (Dr. Priya Sharma, Cardiology). Additional doctors must be added manually.
3. **No push notifications.** The notifications table exists but no real-time delivery is implemented.
4. **UI-only localization.** Hindi is supported for UI labels but AI analysis always responds in English.
5. **No timezone handling.** Dates/times are interpreted as server-local. Per-doctor timezone support is not yet implemented.
6. **No hold cleanup scheduler.** Expired holds are cleaned up on next query but a background job (pg_cron) is recommended for production.
