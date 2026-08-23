# CareFlow AI — Demo Seed Instructions

Exact execution order for setting up the database with 3 demo users.

---

## Prerequisites

A Supabase project with Auth enabled.

---

## Execution Order

### Step 1: Schema Migration

Open **SQL Editor** → paste `supabase/migrations/001_initial_schema.sql` → **Run**.

Creates all 9 tables, the `handle_new_user()` trigger, and `update_updated_at()` trigger.

### Step 2: Create 3 Auth Users

Go to **Authentication → Users → Add user**. Create each:

| Email | Password | App Metadata (JSON) |
|-------|----------|---------------------|
| `admin@careflow.demo` | `admin123` | `{"role":"ADMIN","full_name":"Admin User"}` |
| `doctor@careflow.demo` | `doctor123` | `{"role":"DOCTOR","full_name":"Dr. Priya Sharma"}` |
| `patient@careflow.demo` | `patient123` | `{"role":"PATIENT","full_name":"John Smith"}` |

The `handle_new_user()` trigger auto-creates a `profiles` row for each.

### Step 3: Trigger Backfill Migration

Open **SQL Editor** → paste `supabase/migrations/003_backfill_profiles_and_fix_trigger.sql` → **Run**.

This ensures the trigger is the robust version and backfills any auth users that were created before the trigger existed.

### Step 4: Verify Profiles

Run in **SQL Editor**:

```sql
SELECT
  au.email,
  au.raw_user_meta_data ->> 'role' AS auth_role,
  p.full_name,
  p.role AS profile_role,
  p.preferred_language
FROM auth.users au
JOIN profiles p ON p.id = au.id
ORDER BY p.role;
```

Expected:

| email | auth_role | full_name | profile_role | preferred_language |
|-------|-----------|-----------|-------------|-------------------|
| admin@careflow.demo | ADMIN | Admin User | ADMIN | en |
| doctor@careflow.demo | DOCTOR | Dr. Priya Sharma | DOCTOR | en |
| patient@careflow.demo | PATIENT | John Smith | PATIENT | en |

All 3 rows must appear. If any are missing, the trigger didn't fire — check PostgreSQL logs.

### Step 5: Run Demo Seed

Open **SQL Editor** → paste `supabase/seed_demo.sql` → **Run**.

The script uses CTEs to look up auth users by email at runtime. It creates:
- Patient record (John Smith, male, 1990-05-14)
- Doctor record (Dr. Priya Sharma, Cardiology, 14 years, ₹150)
- Availability (Mon–Fri, 9am–5pm, 30min slots)
- AI analysis (headache symptoms, Neurology referral)
- 2 appointments (1 upcoming CONFIRMED, 1 completed)
- 3 notifications (1 unread appointment, 1 unread medication, 1 read info)

You should see a result table:

| table_name | row_count |
|------------|-----------|
| ai_analyses | 1 |
| appointments | 2 |
| doctor_availability | 5 |
| doctor_leaves | 0 |
| doctors | 1 |
| notifications | 3 |
| patients | 1 |
| profiles | 3 |
| slot_holds | 0 |

### Step 6: Verification Queries

Run each in **SQL Editor**.

#### Profiles
```sql
SELECT id, email, full_name, role FROM profiles ORDER BY role;
```
3 rows: Admin User, Dr. Priya Sharma, John Smith.

#### Patients
```sql
SELECT p.id, pr.full_name, p.phone, p.gender, p.date_of_birth
FROM patients p JOIN profiles pr ON p.profile_id = pr.id;
```
1 row: John Smith, +1 (555) 987-6543, male, 1990-05-14.

#### Doctors
```sql
SELECT d.id, pr.full_name, d.speciality, d.experience_years,
       d.languages, d.consultation_fee, d.is_active
FROM doctors d JOIN profiles pr ON d.profile_id = pr.id;
```
1 row: Dr. Priya Sharma, Cardiology, 14 years, {English,Hindi}, 150.00, true.

#### Appointments
```sql
SELECT
  pt.full_name AS patient,
  dt.full_name AS doctor,
  d.speciality,
  a.appointment_date,
  a.start_time,
  a.end_time,
  a.status,
  a.urgency,
  a.chief_complaint
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN profiles pt ON p.profile_id = pt.id
JOIN doctors d ON a.doctor_id = d.id
JOIN profiles dt ON d.profile_id = dt.id
ORDER BY a.appointment_date;
```
2 rows: 1 CONFIRMED (7 days ahead), 1 COMPLETED (14 days ago).

#### Doctor Availability
```sql
SELECT
  da.day_of_week,
  CASE da.day_of_week
    WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue'
    WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri'
    WHEN 6 THEN 'Sat'
  END AS day_name,
  da.start_time, da.end_time, da.slot_duration_minutes
FROM doctor_availability da
JOIN doctors d ON da.doctor_id = d.id
ORDER BY da.day_of_week;
```
5 rows: Mon(1) through Fri(5), 09:00–17:00, 30 minutes.

#### Slot Holds
```sql
SELECT count(*) AS slot_holds_count FROM slot_holds;
```
0 rows (none seeded).

#### Doctor Leaves
```sql
SELECT count(*) AS doctor_leaves_count FROM doctor_leaves;
```
0 rows (none seeded).

#### Notifications
```sql
SELECT n.type, n.title, n.is_read
FROM notifications n ORDER BY n.is_read, n.created_at;
```
3 rows: appointment (unread), medication (unread), info (read).

#### AI Analyses
```sql
SELECT aa.urgency, aa.chief_complaint, aa.suggested_speciality
FROM ai_analyses aa;
```
1 row: medium urgency, Neurology referral.

---

## Test the App

```bash
cd careflow-ai
npm run dev
```

| Page | Expected |
|------|----------|
| `/patient/doctors` | Shows Dr. Priya Sharma (Cardiology) |
| `/patient/appointments` | Shows 2 appointments with filters |
| `/doctor` | Dashboard with upcoming/completed appointments |
| `/admin/doctors` | Admin view of the single doctor |

---

## Re-running the Seed

The seed is idempotent. Every INSERT has a `NOT EXISTS` or `ON CONFLICT` guard. Re-running will not create duplicates.

To reset completely:

```sql
TRUNCATE notifications CASCADE;
TRUNCATE ai_analyses CASCADE;
TRUNCATE slot_holds CASCADE;
TRUNCATE doctor_leaves CASCADE;
TRUNCATE appointments CASCADE;
TRUNCATE doctor_availability CASCADE;
TRUNCATE doctors CASCADE;
TRUNCATE patients CASCADE;
-- profiles remain linked to auth.users
```

Then re-run `seed_demo.sql`.

---

## Troubleshooting

**"permission denied for table"**
→ Run as `postgres` (service role). SQL Editor uses this by default.

**"foreign key violation" on patients/doctors**
→ Auth users don't exist yet. Complete Step 2 before Step 5.

**0 rows in auth.users**
→ Auth is not enabled. Go to Authentication → Settings.

**"duplicate key" on profiles**
→ The `ON CONFLICT DO UPDATE` handles this. If it still errors, profiles were already correct — skip Step 5 profiles section.

**Doctor or patient row already exists**
→ The `NOT EXISTS` guards prevent duplicates. Re-running is safe.
