# CareFlow AI — Seed Instructions

Fast setup: **3 auth users → 1 SQL paste → done.**

---

## Step 1: Run the Migrations

1. Open Supabase Dashboard → **SQL Editor**
2. Paste contents of `supabase/migrations/001_initial_schema.sql` → **Run**
3. Paste contents of `supabase/migrations/003_backfill_profiles_and_fix_trigger.sql` → **Run**

Verify:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
ORDER BY tablename;
```

Should show: `ai_analyses`, `appointments`, `doctor_availability`,
`doctor_leaves`, `doctors`, `notifications`, `patients`, `profiles`,
`slot_holds`.

---

## Step 2: Create 3 Auth Users

Go to **Authentication → Users → Add user**. Create these three:

| # | Email | Password | App Metadata (JSON) |
|---|-------|----------|---------------------|
| 1 | `admin@careflow.demo` | `admin123` | `{"role":"ADMIN","full_name":"Admin User"}` |
| 2 | `doctor@careflow.demo` | `doctor123` | `{"role":"DOCTOR","full_name":"Dr. Sarah Johnson"}` |
| 3 | `patient@careflow.demo` | `patient123` | `{"role":"PATIENT","full_name":"John Smith"}` |

> The **App Metadata** field appears when you expand "Optional" in the
> Add User form. Setting `role` here lets the auto-trigger create the
> correct profile.

---

## Step 3: Run the Seed Script

1. Open **SQL Editor**
2. Paste the entire contents of `supabase/seed.sql`
3. Click **Run**

The script uses CTEs to look up the 3 auth users by email — no UUID
editing required. If the auto-trigger already created profiles, the
seed uses `ON CONFLICT DO UPDATE` to fill in any missing data.

You should see a result row like:

| profiles_count | patients_count | doctors_count | appointments_count | ... |
|----------------|----------------|---------------|--------------------|-----|
| 3 | 1 | 1 | 4 | ... |

---

## Step 4: Verify

Run each query below in the SQL Editor to confirm the seed worked.

### Profiles
```sql
SELECT id, email, full_name, role FROM profiles ORDER BY role;
```
Expected: 3 rows (Admin User, Dr. Sarah Johnson, John Smith).

### Patients
```sql
SELECT p.id, pr.full_name, p.phone, p.gender, p.date_of_birth
FROM patients p
JOIN profiles pr ON p.profile_id = pr.id;
```
Expected: 1 row (John Smith, male, 1985-03-15).

### Doctors
```sql
SELECT d.id, pr.full_name, d.speciality, d.experience_years,
       d.languages, d.consultation_fee
FROM doctors d
JOIN profiles pr ON d.profile_id = pr.id;
```
Expected: 1 row (Dr. Sarah Johnson, Cardiology, 15 years, £150).

### Appointments
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
Expected: 4 rows — CONFIRMED, PENDING, COMPLETED, CANCELLED.

### Doctor Availability
```sql
SELECT da.day_of_week,
       CASE da.day_of_week
         WHEN 1 THEN 'Mon' WHEN 3 THEN 'Wed' WHEN 5 THEN 'Fri'
       END AS day_name,
       da.start_time, da.end_time, da.slot_duration_minutes
FROM doctor_availability da
JOIN doctors d ON da.doctor_id = d.id
ORDER BY da.day_of_week;
```
Expected: 3 rows (Mon, Wed, Fri — 09:00 to 17:00, 30min slots).

### Slot Holds
```sql
SELECT sh.appointment_date, sh.start_time, sh.end_time,
       sh.expires_at > now() AS is_active
FROM slot_holds sh;
```
Expected: 1 row, `is_active` = true.

### Notifications
```sql
SELECT n.type, n.title, n.is_read
FROM notifications n
ORDER BY n.is_read, n.created_at;
```
Expected: 6 rows — 4 unread, 2 read.

### AI Analyses
```sql
SELECT aa.urgency, aa.chief_complaint, aa.suggested_speciality,
       aa.symptoms
FROM ai_analyses aa;
```
Expected: 1 row — medium urgency, Neurology suggested.

---

## Step 5: Test the App

```bash
cd careflow-ai
npm run dev
```

| Page | What to check |
|------|---------------|
| `/patient/doctors` | Shows 1 doctor (Dr. Sarah Johnson, Cardiology) |
| `/patient/appointments` | Shows 4 appointments with status filters |
| `/doctor` | Dashboard with Dr. Sarah Johnson's appointments |
| `/admin/doctors` | Admin view of the single doctor |
| `/admin/leaves` | Shows 1 pending leave request |

---

## Troubleshooting

**"permission denied for table"**
→ Run the seed as the `postgres` user (service role), not as
  anonymous/authenticated. The SQL Editor uses the service role by default.

**"duplicate key value violates unique constraint" on profiles**
→ The trigger already created the profile. The `ON CONFLICT DO UPDATE`
  should handle this. If it doesn't, the profile already exists — skip
  profiles and seed the rest manually.

**"foreign key violation" on patients/doctors**
→ The auth user must exist first. Make sure you created all 3 users
  in Step 2 before running the seed.

**0 rows in auth.users**
→ Go to Authentication → Settings and ensure Auth is enabled for
  your project.

---

## Quick Reset

```sql
-- Deletes all app data (safe to re-run seed after)
TRUNCATE notifications CASCADE;
TRUNCATE ai_analyses CASCADE;
TRUNCATE slot_holds CASCADE;
TRUNCATE doctor_leaves CASCADE;
TRUNCATE appointments CASCADE;
TRUNCATE doctor_availability CASCADE;
TRUNCATE doctors CASCADE;
TRUNCATE patients CASCADE;
-- profiles stay linked to auth.users; delete auth users to remove them
```
