# CareFlow AI — Architecture

## Overview

CareFlow AI is a full-stack healthcare appointment and clinical intelligence platform built with Next.js 16 and Supabase. The system provides AI-assisted symptom analysis, concurrency-safe appointment booking, and multi-role dashboards for patients, doctors, and administrators.

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client (Browser)"
        UI[Next.js App Router]
    end

    subgraph "Server (Next.js)"
        SA[Server Actions]
        API[API Routes]
        SVC[Service Layer]
    end

    subgraph "AI Pipeline"
        PF[Provider Factory]
        MOCK[Mock Provider]
        OPENAI[OpenAI Provider]
        GEMINI[Gemini Provider]
        VAL[Zod Validation]
    end

    subgraph "Database (Supabase PostgreSQL)"
        DB[(PostgreSQL)]
        AUTH[Supabase Auth]
        RPC[DB Functions]
    end

    UI --> SA
    UI --> API
    SA --> SVC
    API --> SVC
    API --> PF
    PF --> MOCK
    PF --> OPENAI
    PF --> GEMINI
    SVC --> DB
    SVC --> AUTH
    SVC --> RPC
    OPENAI --> VAL
    VAL --> SVC
```

---

## AI Symptom Analysis Pipeline

The AI pipeline follows a provider abstraction pattern. A factory selects the active provider based on environment variables. All provider output is validated through Zod schemas before persistence or client delivery.

```mermaid
sequenceDiagram
    participant Patient
    participant UI as Next.js UI
    participant Route as API Route
    participant Factory as Provider Factory
    participant Provider as AI Provider
    participant Schema as Zod Validation
    participant DB as Supabase

    Patient->>UI: Fill symptom form (Step 1-3)
    UI->>Route: POST /api/ai/symptoms/analyze
    Route->>Route: Validate request body (Zod)
    Route->>Factory: getProvider()
    Factory-->>Route: MockSymptomProvider | OpenAIProvider | GeminiSymptomProvider
    Route->>Provider: analyze({ symptoms, language })
    Provider-->>Route: Raw JSON response
    Route->>Schema: RawAnalysisSchema.validate()
    Schema-->>Route: Normalized & validated result
    Route->>DB: INSERT INTO ai_analyses
    Route-->>UI: { ok, data, provider, analysisId }
    UI->>Patient: Display urgency, specialty, summary, questions
```

---

## Appointment Booking Architecture

The booking engine uses a three-phase approach: dynamic slot generation, temporary slot holds, and atomic confirmation. All concurrency protection is enforced at the database level through PostgreSQL functions.

```mermaid
sequenceDiagram
    participant Patient
    participant UI as Next.js UI
    participant Action as Server Action
    participant SlotSvc as Slot Service
    participant HoldSvc as Slot Hold Service
    participant ConfirmSvc as Booking Confirmation
    participant DB as PostgreSQL

    Note over Patient,DB: Phase 1: Dynamic Slot Generation
    Patient->>UI: Select doctor + date
    UI->>Action: fetchAvailableSlots(doctorId, date)
    Action->>SlotSvc: generateAvailableSlots()
    SlotSvc->>DB: Query doctor_availability
    SlotSvc->>DB: Query appointments (booked)
    SlotSvc->>DB: Query slot_holds (active)
    SlotSvc->>DB: Query doctor_leaves
    SlotSvc-->>UI: Available slots (free of conflicts)

    Note over Patient,DB: Phase 2: Temporary Slot Hold (5 min)
    Patient->>UI: Click time slot
    UI->>Action: requestHold(doctorId, patientId, date, time)
    Action->>HoldSvc: requestSlotHold()
    HoldSvc->>DB: SELECT acquire_slot_hold() [atomic RPC]
    DB-->>HoldSvc: { hold_id, expires_at }
    HoldSvc-->>UI: Hold acquired, countdown starts

    Note over Patient,DB: Phase 3: Transactional Confirmation
    Patient->>UI: Click "Confirm Appointment"
    UI->>Action: confirmAppointment(holdId, patientId, reason)
    Action->>ConfirmSvc: confirmBooking()
    ConfirmSvc->>DB: SELECT confirm_booking_with_auth() [atomic RPC]
    Note right of DB: Validates ownership, expiry,<br/>availability, overlap<br/>Creates appointment + deletes hold<br/>All in one transaction
    DB-->>ConfirmSvc: { appointment_id }
    ConfirmSvc-->>UI: Booking confirmed
```

---

## Database-Level Concurrency Protection

Concurrency is enforced through PostgreSQL functions and triggers, not application code. This prevents race conditions even under simultaneous requests.

```mermaid
graph TD
    A[Concurrent Request A] --> B[acquire_slot_hold RPC]
    C[Concurrent Request B] --> D[acquire_slot_hold RPC]
    B --> E{check_slot_available}
    D --> E
    E -->|A reads first| F[INSERT hold A — succeeds]
    E -->|B reads after A commits| G[INSERT hold B — slot_unavailable]
    F --> H[confirm_booking_with_auth RPC]
    H --> I[FOR UPDATE lock on hold]
    I --> J{Re-verify slot free}
    J -->|Yes| K[INSERT appointment + DELETE hold]
    J -->|No| L[ROLLBACK — SLOT_ALREADY_BOOKED]
    
    style F fill:#d4edda
    style G fill:#f8d7da
    style K fill:#d4edda
    style L fill:#f8d7da
```

### Protection Layers

| Layer | Mechanism | Protects Against |
|-------|-----------|-----------------|
| **Slot generation** | Excludes booked + held + leave intervals | Displaying unavailable slots |
| **Slot hold** | `acquire_slot_hold()` atomic RPC | Two patients holding the same slot |
| **Booking confirmation** | `confirm_booking_with_auth()` with `FOR UPDATE` lock | Confirming an expired/owned/concurrent hold |
| **Overlap trigger** | `prevent_overlapping_appointments` constraint trigger | Two appointments for same doctor/time |
| **Cancellation** | `cancel_appointment_with_auth()` with ownership check | Unauthorized cancellation |

---

## Rescheduling Transaction Flow

Rescheduling follows a **cancel-after-confirm** pattern. The old appointment is only cancelled after the new booking is confirmed, preventing the patient from losing their slot if the new booking fails.

```mermaid
graph TD
    A[Reschedule Request] --> B[Verify old appointment]
    B -->|Exists + owned + cancellable| C[Acquire hold on new slot]
    B -->|Failed| Z1[Error: APPOINTMENT_NOT_FOUND]
    C -->|Success| D[Confirm new booking]
    C -->|Failed| Z2[Error: HOLD_FAILED — old appt still active]
    D -->|Success| E[Cancel old appointment]
    D -->|Failed| Z3[Error: CONFIRM_FAILED — old appt still active]
    E -->|Success| F[SUCCESS: rescheduled]
    E -->|Failed| G[Partial: new appt exists, old couldn't cancel]
    
    style F fill:#d4edda
    style Z1 fill:#f8d7da
    style Z2 fill:#f8d7da
    style Z3 fill:#f8d7da
    style G fill:#fff3cd
```

---

## Supabase Integration

### Client Types

| Client | Usage | File |
|--------|-------|------|
| Server client | Server components, server actions, API routes | `lib/supabase/server.ts` |
| Browser client | Client components (currently unused — all data via server) | `lib/supabase/client.ts` |
| Admin client | Service role operations (bypasses RLS) | `lib/supabase/admin.ts` |

### Data Adapter Pattern

The service layer (`lib/services/index.ts`) implements a data adapter pattern:

```
Supabase configured?  →  Query real database
Not configured?       →  Return mock data from lib/mock-data.ts
Query fails?          →  Log error, fall back to mock data
```

This allows the application to function fully without a database connection during development.

---

## AI Provider Architecture

```mermaid
graph TD
    ENV[Environment Variables] --> FF[Provider Factory]
    FF -->|AI_PROVIDER=mock| MOCK[MockSymptomProvider]
    FF -->|AI_PROVIDER=openai + key| OAI[OpenAIProvider]
    FF -->|AI_PROVIDER=gemini + key| GEM[GeminiSymptomProvider]
    FF -->|No key + no flag| MOCK
    FF -->|openai + no key| MOCK
    FF -->|gemini + no key| MOCK

    MOCK -->|Deterministic keyword match| R[Raw JSON]
    OAI -->|OpenAI API + JSON mode| R
    GEM -->|Gemini API + responseJsonSchema| R
    R --> VAL[Zod Schema Validation]
    VAL -->|Valid| RESULT[Normalized Result]
    VAL -->|Invalid| FALLBACK[Controlled Error]

    subgraph "Provider Contract"
        PI[SymptomAIProvider interface]
        PI --> MOCK
        PI --> OAI
        PI --> GEM
    end

    style MOCK fill:#d4edda
    style OAI fill:#cce5ff
    style GEM fill:#e8f5e9
    style FALLBACK fill:#f8d7da
```

### Mock Provider Keyword Routing

| Input Keywords | Specialty | Urgency |
|---------------|-----------|---------|
| headache, head pain, migraine | Neurology | MEDIUM |
| chest pain, chest tightness, heart pain | Cardiology | **HIGH** |
| fever, high temperature, chills | Internal Medicine | MEDIUM |
| cough, coughing, chest congestion | Pulmonology | MEDIUM |
| stomach pain, abdominal pain, nausea, diarrhea | Gastroenterology | MEDIUM |
| *(no match)* | General Practice | MEDIUM |

---

## Database Schema

### Entity Relationship

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1 via trigger"
    profiles ||--o| patients : "1:0..1"
    profiles ||--o| doctors : "1:0..1"
    patients ||--o{ appointments : "1:many"
    doctors ||--o{ appointments : "1:many"
    doctors ||--o{ doctor_availability : "1:many"
    doctors ||--o{ doctor_leaves : "1:many"
    patients ||--o{ slot_holds : "1:many"
    doctors ||--o{ slot_holds : "1:many"
    patients ||--o{ ai_analyses : "1:many"
    profiles ||--o{ notifications : "1:many"
    ai_analyses ||--o| appointments : "0..1:1"

    profiles {
        uuid id PK
        text email UK
        text full_name
        text role "PATIENT|DOCTOR|ADMIN"
        text preferred_language "en|hi"
    }

    patients {
        uuid id PK
        uuid profile_id FK
        date date_of_birth
        text phone
        text gender
    }

    doctors {
        uuid id PK
        uuid profile_id FK
        text speciality
        int experience_years
        text[] languages
        numeric consultation_fee
        boolean is_active
    }

    appointments {
        uuid id PK
        uuid patient_id FK
        uuid doctor_id FK
        date appointment_date
        time start_time
        time end_time
        text status "PENDING|CONFIRMED|CANCELLED|COMPLETED"
        text urgency "low|medium|high|critical"
        text chief_complaint
        uuid ai_analysis_id FK
    }

    doctor_availability {
        uuid id PK
        uuid doctor_id FK
        int day_of_week "0-6"
        time start_time
        time end_time
        int slot_duration_minutes
    }

    slot_holds {
        uuid id PK
        uuid doctor_id FK
        uuid patient_id FK
        date appointment_date
        time start_time
        time end_time
        timestamptz expires_at
    }

    ai_analyses {
        uuid id PK
        uuid patient_id FK
        text input_language
        jsonb symptoms
        text urgency
        text chief_complaint
        text suggested_speciality
        text patient_summary
        jsonb suggested_questions
        jsonb raw_response
    }
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.3.2 |
| UI | React | 19.2.8 |
| Styling | Tailwind CSS | 4.x |
| Language | TypeScript | 5.x |
| Database | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth | — |
| Validation | Zod | 4.4.3 |
| AI Provider | OpenAI SDK + Google GenAI SDK | 7.5.0 + 2.18.0 |
| Icons | Lucide React | 1.33.0 |
| Testing | Vitest | 4.1.11 |

---

## Project Structure

```
careflow-ai/
├── app/
│   ├── api/
│   │   └── ai/
│   │       ├── doctors/match/route.ts     # POST: AI-assisted doctor matching
│   │       └── symptoms/analyze/route.ts  # POST: Symptom analysis
│   ├── dev/
│   │   └── slots-verification/page.tsx    # Dev-only booking engine tests
│   ├── patient/
│   │   ├── booking/                       # Appointment booking flow
│   │   ├── doctors/                       # Doctor discovery
│   │   ├── symptoms/                      # AI symptom check
│   │   ├── appointments/                  # Appointment list + detail
│   │   └── timeline/                      # Care timeline
│   ├── doctor/
│   │   ├── appointments/                  # Doctor appointment view
│   │   ├── consultation/[id]/             # Consultation detail
│   │   └── patients/                      # Patient list
│   └── admin/
│       ├── doctors/                       # Doctor management
│       ├── appointments/                  # All appointments
│       └── leaves/                        # Leave management
├── lib/
│   ├── ai/
│   │   ├── provider.ts                    # SymptomAIProvider interface
│   │   ├── mock-provider.ts               # Deterministic mock provider
│   │   ├── openai-provider.ts             # OpenAI provider
│   │   ├── gemini-provider.ts             # Google Gemini provider
│   │   ├── provider-factory.ts            # Env-based provider selection
│   │   ├── schema.ts                      # Zod schemas + prompts
│   │   ├── types.ts                       # AI analysis types
│   │   ├── validate.ts                    # Validation + fallback
│   │   └── __tests__/                     # AI route tests
│   ├── services/
│   │   ├── availability.ts                # Slot generation engine
│   │   ├── availability-helpers.ts        # Pure time/interval helpers
│   │   ├── slot-holds.ts                  # Temporary slot holds
│   │   ├── booking-confirmation.ts        # Atomic booking confirmation
│   │   ├── appointment-management.ts      # Cancel + reschedule
│   │   ├── ai-analysis.ts                 # AI analysis persistence
│   │   ├── doctors.ts                     # Doctor queries
│   │   ├── appointments.ts                # Appointment queries
│   │   ├── leaves.ts                      # Leave queries
│   │   ├── index.ts                       # Data adapter (Supabase/mock)
│   │   ├── logger.ts                      # Dev-only structured logging
│   │   └── __tests__/                     # Service tests
│   ├── actions/
│   │   ├── slots.ts                       # Server actions for booking
│   │   ├── bookings.ts                    # Server actions for confirmation
│   │   └── appointments.ts                # Server actions for management
│   ├── supabase/
│   │   ├── server.ts                      # Server-side Supabase client
│   │   ├── client.ts                      # Browser Supabase client
│   │   ├── admin.ts                       # Service role client
│   │   └── types.ts                       # Generated DB types
│   ├── config/
│   │   └── demo-identity.ts               # Development demo accounts
│   ├── types.ts                           # Frontend domain types
│   ├── mock-data.ts                       # Mock data for offline dev
│   ├── navigation.ts                      # Role-based navigation
│   ├── translations.ts                    # i18n strings (en/hi)
│   └── LanguageContext.tsx                 # Client language state
├── components/
│   ├── app/                               # App-specific components
│   └── ui/                                # Shared UI primitives
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql         # Core schema + triggers
│   │   ├── 002_fix_handle_new_user_trigger.sql
│   │   ├── 003_backfill_profiles_and_fix_trigger.sql
│   │   ├── 004_booking_concurrency_protection.sql  # DB functions + indexes
│   │   ├── 005_booking_confirmation.sql            # Auth confirmation + overlap trigger
│   │   └── 006_cancellation_rescheduling.sql       # Cancel + reschedule RPCs
│   ├── seed.sql                           # Base seed data
│   └── seed_demo.sql                      # Demo account data
└── docs/
    ├── ARCHITECTURE.md                    # This document
    └── EVALUATION_GUIDE.md               # Evaluator walkthrough
```

---

## PostgreSQL Functions Reference

| Function | Purpose | Called From |
|----------|---------|------------|
| `acquire_slot_hold()` | Atomically reserve a slot for 5 minutes | `lib/services/slot-holds.ts` |
| `confirm_booking_with_auth()` | Convert hold → confirmed appointment (with ownership + expiry checks) | `lib/services/booking-confirmation.ts` |
| `cancel_appointment_with_auth()` | Patient-authorized cancellation | `lib/services/appointment-management.ts` |
| `cancel_old_for_reschedule()` | Cancel old appointment after reschedule | `lib/services/appointment-management.ts` |
| `check_slot_available()` | Check if slot has no overlapping appointment or active hold | Slot generation |
| `check_doctor_on_leave()` | Check if doctor has approved leave on a date | Slot generation |
| `check_appointment_overlap()` | Check for overlapping confirmed/pending appointments | Overlap trigger |
| `cleanup_expired_holds()` | Delete all expired slot holds | Scheduled cleanup |
| `prevent_overlapping_appointments()` | Trigger: reject overlapping INSERT/UPDATE | Database trigger |
| `handle_new_user()` | Trigger: auto-create profile on auth signup | Database trigger |
| `update_updated_at()` | Trigger: auto-update `updated_at` column | Database trigger |

---

## Key Design Decisions

1. **Database-level concurrency, not application-level.** All race conditions are prevented by PostgreSQL functions with `FOR UPDATE` locks and constraint triggers. The application layer simply calls these functions via RPC.

2. **Mock-first development.** Every data adapter falls back to mock data when Supabase is unavailable. The AI provider defaults to mock when no API key is set. The application runs fully without any external dependencies.

3. **Cancel-after-confirm for rescheduling.** The old appointment is only cancelled after the new booking succeeds, preventing the patient from losing their slot on failure.

4. **Persistence failure does not block AI response.** If the database is unavailable when saving an AI analysis, the response is still returned to the client with `analysisId: null`. The analysis is still clinically useful.

5. **Provider abstraction.** The AI provider interface allows swapping between mock, OpenAI, Gemini, or any future provider with zero changes to the API route or validation layer.
