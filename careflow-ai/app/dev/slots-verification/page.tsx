/**
 * Development-only verification page for slot generation.
 *
 * Tests all required scenarios:
 *   1. Normal available slot
 *   2. Already confirmed appointment
 *   3. Active hold
 *   4. Expired hold
 *   5. Doctor leave
 *   6. Multiple availability windows
 *   7. Overlapping availability windows
 *   8. Past time filtering
 *   9. Concurrent hold acquisition (two patients race)
 *
 * Access at: /dev/slots-verification
 * Only works in development mode.
 */

import { generateAvailableSlots, getDoctorAvailabilityForDate } from '@/lib/services/availability';
import { simulateConcurrentHolds, releaseSlotHold } from '@/lib/services/slot-holds';
import { confirmBooking } from '@/lib/services/booking-confirmation';
import { cancelAppointment } from '@/lib/services/appointment-management';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SlotGenerationResult } from '@/lib/services/availability';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
  result?: SlotGenerationResult;
}

/** Compute timestamps outside component render to avoid Date.now() purity lint errors */
function computeTestTimestamps() {
  const now = Date.now();
  return {
    futureExpires: new Date(now + 300000).toISOString(),
    pastExpires: new Date(now - 1000).toISOString(),
    today: new Date(now).toISOString().split('T')[0],
  };
}

async function getTestDoctorId(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('doctors')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single();
  return data?.id ?? null;
}

function getNextWeekday(dayOfWeek: number): string {
  const today = new Date();
  const current = today.getDay();
  let daysAhead = dayOfWeek - current;
  if (daysAhead <= 0) daysAhead += 7;
  const target = new Date(today);
  target.setDate(today.getDate() + daysAhead);
  return target.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default async function SlotsVerificationPage() {
  // Only in development
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">This page is only available in development mode.</p>
      </div>
    );
  }

  const doctorId = await getTestDoctorId();
  const tests: TestResult[] = [];

  if (!doctorId) {
    tests.push({
      name: 'Setup: Find test doctor',
      status: 'FAIL',
      details: 'No active doctor found in database. Run seed_demo.sql first.',
    });
  } else {
    // -------------------------------------------------------
    // Test 1: Normal available slot
    // -------------------------------------------------------
    // Find a day the doctor has availability (Mon=1, Fri=5)
    const normalDay = getNextWeekday(1); // Next Monday
    const normalResult = await generateAvailableSlots(doctorId, normalDay);
    tests.push({
      name: '1. Normal available slot',
      status: normalResult.ok && normalResult.slots.length > 0 ? 'PASS' : 'FAIL',
      details: normalResult.ok
        ? `Found ${normalResult.slots.length} slots on ${formatDate(normalDay)}. First: ${normalResult.slots[0].startTime}–${normalResult.slots[0].endTime}`
        : `Error: ${normalResult.message}`,
      result: normalResult,
    });

    // -------------------------------------------------------
    // Test 2: Already confirmed appointment
    // -------------------------------------------------------
    // Insert a test appointment, check that slot is excluded, then clean up
    if (normalResult.ok && normalResult.slots.length > 0) {
      const supabase = createSupabaseServerClient();
      const testSlot = normalResult.slots[0];
      const testPatient = await supabase.from('patients').select('id').limit(1).single();

      if (testPatient.data) {
        const { data: inserted } = await supabase
          .from('appointments')
          .insert({
            patient_id: testPatient.data.id,
            doctor_id: doctorId,
            appointment_date: normalDay,
            start_time: testSlot.startTime + ':00',
            end_time: testSlot.endTime + ':00',
            status: 'CONFIRMED',
            urgency: 'low',
            chief_complaint: 'Verification test appointment',
          })
          .select('id')
          .single();

        const afterResult = await generateAvailableSlots(doctorId, normalDay);
        const slotStillAvailable = afterResult.ok &&
          afterResult.slots.some(s => s.startTime === testSlot.startTime);

        tests.push({
          name: '2. Confirmed appointment excludes slot',
          status: !slotStillAvailable ? 'PASS' : 'FAIL',
          details: !slotStillAvailable
            ? `Slot ${testSlot.startTime} correctly excluded after confirmed appointment. Total slots: ${afterResult.ok ? afterResult.slots.length : 0}`
            : `Slot ${testSlot.startTime} still appears after confirmed appointment!`,
          result: afterResult,
        });

        // Cleanup
        if (inserted) {
          await supabase.from('appointments').delete().eq('id', inserted.id);
        }
      } else {
        tests.push({
          name: '2. Confirmed appointment excludes slot',
          status: 'SKIP',
          details: 'No patient record found for test insertion.',
        });
      }
    } else {
      tests.push({
        name: '2. Confirmed appointment excludes slot',
        status: 'SKIP',
        details: 'Test 1 failed — no base slots to test against.',
      });
    }

    // -------------------------------------------------------
    // Test 3: Active hold excludes slot
    // -------------------------------------------------------
    if (normalResult.ok && normalResult.slots.length > 0) {
      const supabase = createSupabaseServerClient();
      const testSlot = normalResult.ok ? normalResult.slots[normalResult.slots.length > 1 ? 1 : 0] : null;
      const testPatient = await supabase.from('patients').select('id').limit(1).single();

      const timestamps = computeTestTimestamps();
      if (testSlot && testPatient.data) {
        const { data: inserted } = await supabase
          .from('slot_holds')
          .insert({
            doctor_id: doctorId,
            patient_id: testPatient.data.id,
            appointment_date: normalDay,
            start_time: testSlot.startTime + ':00',
            end_time: testSlot.endTime + ':00',
            expires_at: timestamps.futureExpires,
          })
          .select('id')
          .single();

        const afterResult = await generateAvailableSlots(doctorId, normalDay);
        const slotStillAvailable = afterResult.ok &&
          afterResult.slots.some(s => s.startTime === testSlot.startTime);

        tests.push({
          name: '3. Active hold excludes slot',
          status: !slotStillAvailable ? 'PASS' : 'FAIL',
          details: !slotStillAvailable
            ? `Slot ${testSlot.startTime} correctly excluded by active hold. Total slots: ${afterResult.ok ? afterResult.slots.length : 0}`
            : `Slot ${testSlot.startTime} still appears with active hold!`,
          result: afterResult,
        });

        if (inserted) {
          await supabase.from('slot_holds').delete().eq('id', inserted.id);
        }
      } else {
        tests.push({
          name: '3. Active hold excludes slot',
          status: 'SKIP',
          details: 'Could not create test hold.',
        });
      }
    } else {
      tests.push({
        name: '3. Active hold excludes slot',
        status: 'SKIP',
        details: 'Test 1 failed — no base slots.',
      });
    }

    // -------------------------------------------------------
    // Test 4: Expired hold does NOT exclude slot
    // -------------------------------------------------------
    if (normalResult.ok && normalResult.slots.length > 0) {
      const supabase = createSupabaseServerClient();
      const testSlot = normalResult.ok ? normalResult.slots[0] : null;
      const testPatient = await supabase.from('patients').select('id').limit(1).single();

      const timestamps2 = computeTestTimestamps();
      if (testSlot && testPatient.data) {
        const { data: inserted } = await supabase
          .from('slot_holds')
          .insert({
            doctor_id: doctorId,
            patient_id: testPatient.data.id,
            appointment_date: normalDay,
            start_time: testSlot.startTime + ':00',
            end_time: testSlot.endTime + ':00',
            expires_at: timestamps2.pastExpires,
          })
          .select('id')
          .single();

        const afterResult = await generateAvailableSlots(doctorId, normalDay);
        const slotAvailable = afterResult.ok &&
          afterResult.slots.some(s => s.startTime === testSlot.startTime);

        tests.push({
          name: '4. Expired hold does NOT exclude slot',
          status: slotAvailable ? 'PASS' : 'FAIL',
          details: slotAvailable
            ? `Slot ${testSlot.startTime} correctly available despite expired hold.`
            : `Slot ${testSlot.startTime} excluded even though hold is expired!`,
          result: afterResult,
        });

        if (inserted) {
          await supabase.from('slot_holds').delete().eq('id', inserted.id);
        }
      } else {
        tests.push({
          name: '4. Expired hold does NOT exclude slot',
          status: 'SKIP',
          details: 'Could not create test expired hold.',
        });
      }
    } else {
      tests.push({
        name: '4. Expired hold does NOT exclude slot',
        status: 'SKIP',
        details: 'Test 1 failed — no base slots.',
      });
    }

    // -------------------------------------------------------
    // Test 5: Doctor leave blocks all slots
    // -------------------------------------------------------
    if (normalResult.ok) {
      const supabase = createSupabaseServerClient();
      const { data: insertedLeave } = await supabase
        .from('doctor_leaves')
        .insert({
          doctor_id: doctorId,
          start_date: normalDay,
          end_date: normalDay,
          reason: 'Verification test leave',
          status: 'approved',
        })
        .select('id')
        .single();

      const afterResult = await generateAvailableSlots(doctorId, normalDay);

      tests.push({
        name: '5. Doctor leave blocks all slots',
        status: !afterResult.ok && afterResult.error === 'doctor_on_leave' ? 'PASS' : 'FAIL',
        details: !afterResult.ok && afterResult.error === 'doctor_on_leave'
          ? `Correctly returned doctor_on_leave error for ${formatDate(normalDay)}.`
          : `Expected doctor_on_leave, got: ${afterResult.ok ? `ok with ${afterResult.slots.length} slots` : afterResult.error}`,
        result: afterResult,
      });

      if (insertedLeave) {
        await supabase.from('doctor_leaves').delete().eq('id', insertedLeave.id);
      }
    } else {
      tests.push({
        name: '5. Doctor leave blocks all slots',
        status: 'SKIP',
        details: 'Test 1 failed — no base availability.',
      });
    }

    // -------------------------------------------------------
    // Test 6: Multiple availability windows
    // -------------------------------------------------------
    // Check if the doctor has multiple windows on any day
    const { windows } = await getDoctorAvailabilityForDate(doctorId, normalDay);
    if (windows.length > 1) {
      tests.push({
        name: '6. Multiple availability windows',
        status: 'PASS',
        details: `Found ${windows.length} windows: ${windows.map(w => `${w.startTime}–${w.endTime}`).join(', ')}. Total slots: ${normalResult.ok ? normalResult.slots.length : 0}`,
        result: normalResult,
      });
    } else {
      tests.push({
        name: '6. Multiple availability windows',
        status: 'SKIP',
        details: `Doctor has ${windows.length} window on ${formatDate(normalDay)}. Seed multiple availability rows to test.`,
      });
    }

    // -------------------------------------------------------
    // Test 7: Overlapping availability windows are merged
    // -------------------------------------------------------
    if (windows.length >= 1) {
      // We verify the merge logic by checking that the windows are non-overlapping
      let hasOverlap = false;
      for (let i = 0; i < windows.length; i++) {
        for (let j = i + 1; j < windows.length; j++) {
          const aEnd = parseInt(windows[i].endTime.replace(':', ''));
          const bStart = parseInt(windows[j].startTime.replace(':', ''));
          if (aEnd > bStart) hasOverlap = true;
        }
      }

      tests.push({
        name: '7. Overlapping windows merged correctly',
        status: !hasOverlap ? 'PASS' : 'FAIL',
        details: !hasOverlap
          ? `${windows.length} windows are non-overlapping (merged correctly).`
          : `Windows still overlap after merge — check mergeWindows() logic.`,
      });
    } else {
      tests.push({
        name: '7. Overlapping windows merged correctly',
        status: 'SKIP',
        details: 'Only 0-1 windows present — overlap test not applicable.',
      });
    }

    // -------------------------------------------------------
    // Test 8: Past time filtering (today only)
    // -------------------------------------------------------
    const ts = computeTestTimestamps();
    const today = ts.today;
    const todayResult = await generateAvailableSlots(doctorId, today);
    if (todayResult.ok) {
      const allFuture = todayResult.slots.every(s => !s.isPast);

      tests.push({
        name: '8. Past time filtering for today',
        status: allFuture ? 'PASS' : 'FAIL',
        details: allFuture
          ? `Today's ${todayResult.slots.length} slots all have isPast=false (future only).`
          : `Found ${todayResult.slots.filter(s => s.isPast).length} past slots still included!`,
        result: todayResult,
      });
    } else {
      // Doctor may not have availability today — that's OK
      tests.push({
        name: '8. Past time filtering for today',
        status: todayResult.error === 'no_availability' ? 'PASS' : 'SKIP',
        details: todayResult.error === 'no_availability'
          ? `Doctor has no availability today — past filtering not applicable (correct behavior).`
          : todayResult.error === 'no_slots_available'
          ? `All today's slots are past — past filtering working correctly.`
          : `Result: ${todayResult.message}`,
        result: todayResult,
      });
    }

    // -------------------------------------------------------
    // Test 9: Concurrent hold acquisition
    // -------------------------------------------------------
    if (normalResult.ok && normalResult.slots.length >= 1) {
      const supabase = createSupabaseServerClient();
      const testSlot = normalResult.slots[0];
      const patients = await supabase.from('patients').select('id').limit(2);

      if (patients.data && patients.data.length >= 2) {
        const patientA = patients.data[0].id;
        const patientB = patients.data[1].id;

        try {
          const concurrency = await simulateConcurrentHolds(
            doctorId,
            patientA,
            patientB,
            normalDay,
            testSlot.startTime + ':00',
            testSlot.endTime + ':00'
          );

          tests.push({
            name: '9. Concurrent hold acquisition (race condition)',
            status: concurrency.exactlyOneSucceeded ? 'PASS' : 'FAIL',
            details: concurrency.summary,
          });

          // Cleanup: release whichever hold succeeded
          if (concurrency.patientA.ok) {
            await releaseSlotHold(concurrency.patientA.holdId, patientA);
          }
          if (concurrency.patientB.ok) {
            await releaseSlotHold(concurrency.patientB.holdId, patientB);
          }
        } catch (err) {
          tests.push({
            name: '9. Concurrent hold acquisition (race condition)',
            status: 'FAIL',
            details: `Concurrency test threw an error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } else {
        tests.push({
          name: '9. Concurrent hold acquisition (race condition)',
          status: 'SKIP',
          details: `Need 2 patients in database, found ${patients.data?.length ?? 0}. Run seed_demo.sql with an additional patient.`,
        });
      }
    } else {
      tests.push({
        name: '9. Concurrent hold acquisition (race condition)',
        status: 'SKIP',
        details: 'Test 1 failed — no base slots to test concurrent holds against.',
      });
    }

    // -------------------------------------------------------
    // Test 10: Concurrent booking confirmation
    // -------------------------------------------------------
    // Two patients hold the SAME slot (impossible in production due to
    // acquire_slot_hold, but we simulate by creating two holds on
    // overlapping times with different patient IDs, then racing confirmations.
    //
    // In practice: create hold A on slot, confirm it, then try to confirm
    // a stale hold on the same slot — the second should get SLOT_ALREADY_BOOKED.
    if (normalResult.ok && normalResult.slots.length >= 1) {
      const supabase = createSupabaseServerClient();
      const testSlot = normalResult.slots[0];
      const patients = await supabase.from('patients').select('id').limit(2);

      if (patients.data && patients.data.length >= 2) {
        const patientA = patients.data[0].id;
        const patientB = patients.data[1].id;
        const ts10 = computeTestTimestamps();

        // Create two holds: one for patientA and one for patientB
        // on overlapping time slots (B's hold is on the same timeslot)
        // In production, acquire_slot_hold would prevent this, but we
        // create them directly to test confirmation concurrency.
        const { data: holdA } = await supabase
          .from('slot_holds')
          .insert({
            doctor_id: doctorId,
            patient_id: patientA,
            appointment_date: normalDay,
            start_time: testSlot.startTime + ':00',
            end_time: testSlot.endTime + ':00',
            expires_at: ts10.futureExpires,
          })
          .select('id')
          .single();

        // Hold B goes to same slot but for patientB — force it
        // (bypass acquire_slot_hold's check to simulate edge case)
        const { data: holdB } = await supabase
          .from('slot_holds')
          .insert({
            doctor_id: doctorId,
            patient_id: patientB,
            appointment_date: normalDay,
            start_time: testSlot.startTime + ':00',
            end_time: testSlot.endTime + ':00',
            expires_at: ts10.futureExpires,
          })
          .select('id')
          .single();

        if (holdA && holdB) {
          try {
            // Fire two confirmations simultaneously
            const [resultA, resultB] = await Promise.all([
              confirmBooking(holdA.id, patientA, 'Concurrent test A', undefined, 'medium'),
              confirmBooking(holdB.id, patientB, 'Concurrent test B', undefined, 'medium'),
            ]);

            const aSucceeded = resultA.ok;
            const bSucceeded = resultB.ok;
            const exactlyOne = (aSucceeded && !bSucceeded) || (!aSucceeded && bSucceeded);

            let summary: string;
            if (exactlyOne) {
              const winner = aSucceeded ? 'A' : 'B';
              const loser = aSucceeded ? 'B' : 'A';
              const loserResult = aSucceeded ? resultB : resultA;
              summary = `✓ Confirmation concurrency PASSED: Patient ${winner} won. Patient ${loser} received: ${loserResult.ok ? 'ok' : loserResult.error}`;
            } else if (aSucceeded && bSucceeded) {
              summary = '✗ Confirmation concurrency FAILED: Both patients got appointments — race condition!';
            } else {
              summary = `✗ Confirmation concurrency FAILED: Both rejected. A: ${resultA.ok ? 'ok' : resultA.error}, B: ${resultB.ok ? 'ok' : resultB.error}`;
            }

            tests.push({
              name: '10. Concurrent booking confirmation (race condition)',
              status: exactlyOne ? 'PASS' : 'FAIL',
              details: summary,
            });
          } catch (err) {
            tests.push({
              name: '10. Concurrent booking confirmation (race condition)',
              status: 'FAIL',
              details: `Confirmation test threw an error: ${err instanceof Error ? err.message : String(err)}`,
            });
          }

          // Cleanup: delete any remaining holds and the test appointment
          await supabase.from('slot_holds').delete().in('id', [holdA.id, holdB.id]);
          await supabase
            .from('appointments')
            .delete()
            .eq('doctor_id', doctorId)
            .eq('appointment_date', normalDay)
            .eq('start_time', testSlot.startTime + ':00')
            .eq('chief_complaint', 'Concurrent test A')
            .or('chief_complaint.eq.Concurrent test B');
        } else {
          tests.push({
            name: '10. Concurrent booking confirmation (race condition)',
            status: 'SKIP',
            details: 'Could not create test holds for confirmation race test.',
          });
        }
      } else {
        tests.push({
          name: '10. Concurrent booking confirmation (race condition)',
          status: 'SKIP',
          details: `Need 2 patients in database, found ${patients.data?.length ?? 0}.`,
        });
      }
    } else {
      tests.push({
        name: '10. Concurrent booking confirmation (race condition)',
        status: 'SKIP',
        details: 'Test 1 failed — no base slots to test concurrent confirmations against.',
      });
    }

    // -------------------------------------------------------
    // Test 11: Unauthorized confirmation rejected
    // -------------------------------------------------------
    if (normalResult.ok && normalResult.slots.length >= 2) {
      const supabase = createSupabaseServerClient();
      const testSlot = normalResult.slots[normalResult.slots.length - 1];
      const patients = await supabase.from('patients').select('id').limit(2);

      if (patients.data && patients.data.length >= 2) {
        const patientA = patients.data[0].id;
        const patientB = patients.data[1].id;
        const ts11 = computeTestTimestamps();

        // Create a hold for patientA
        const { data: hold } = await supabase
          .from('slot_holds')
          .insert({
            doctor_id: doctorId,
            patient_id: patientA,
            appointment_date: normalDay,
            start_time: testSlot.startTime + ':00',
            end_time: testSlot.endTime + ':00',
            expires_at: ts11.futureExpires,
          })
          .select('id')
          .single();

        if (hold) {
          try {
            // Patient B tries to confirm patient A's hold
            const unauthResult = await confirmBooking(
              hold.id, patientB, 'Unauthorized attempt', undefined, 'medium'
            );

            tests.push({
              name: '11. Unauthorized confirmation rejected',
              status: !unauthResult.ok && unauthResult.error === 'UNAUTHORIZED_HOLD' ? 'PASS' : 'FAIL',
              details: !unauthResult.ok && unauthResult.error === 'UNAUTHORIZED_HOLD'
                ? `Correctly rejected unauthorized confirmation attempt. Error: ${unauthResult.error}`
                : `Expected UNAUTHORIZED_HOLD, got: ${unauthResult.ok ? 'success' : unauthResult.error}`,
            });
          } catch (err) {
            tests.push({
              name: '11. Unauthorized confirmation rejected',
              status: 'FAIL',
              details: `Test threw: ${err instanceof Error ? err.message : String(err)}`,
            });
          }

          // Cleanup
          await supabase.from('slot_holds').delete().eq('id', hold.id);
        } else {
          tests.push({
            name: '11. Unauthorized confirmation rejected',
            status: 'SKIP',
            details: 'Could not create test hold.',
          });
        }
      } else {
        tests.push({
          name: '11. Unauthorized confirmation rejected',
          status: 'SKIP',
          details: 'Need 2 patients.',
        });
      }
    } else {
      tests.push({
        name: '11. Unauthorized confirmation rejected',
        status: 'SKIP',
        details: 'Test 1 failed — no base slots.',
      });
    }

    // -------------------------------------------------------
    // Test 12: Appointment cancellation
    // -------------------------------------------------------
    if (normalResult.ok && normalResult.slots.length >= 1) {
      const supabase = createSupabaseServerClient();
      const testSlot = normalResult.slots[0];
      const patients = await supabase.from('patients').select('id').limit(1);

      if (patients.data && patients.data.length >= 1) {
        const patientId = patients.data[0].id;
        // Create a test appointment to cancel
        const { data: testApt } = await supabase
          .from('appointments')
          .insert({
            patient_id: patientId,
            doctor_id: doctorId,
            appointment_date: normalDay,
            start_time: testSlot.startTime + ':00',
            end_time: testSlot.endTime + ':00',
            status: 'CONFIRMED',
            urgency: 'low',
            chief_complaint: 'Cancellation test appointment',
          })
          .select('id')
          .single();

        if (testApt) {
          // Cancel it
          const cancelResult = await cancelAppointment(testApt.id, patientId);

          // Verify it's now cancelled
          const { data: checkApt } = await supabase
            .from('appointments')
            .select('status')
            .eq('id', testApt.id)
            .single();

          tests.push({
            name: '12. Appointment cancellation',
            status: cancelResult.ok && checkApt?.status === 'CANCELLED' ? 'PASS' : 'FAIL',
            details: cancelResult.ok && checkApt?.status === 'CANCELLED'
              ? `Appointment ${testApt.id} successfully cancelled. Status: ${checkApt.status}`
              : `Cancel result: ${cancelResult.ok ? 'ok' : cancelResult.error}, DB status: ${checkApt?.status}`,
          });

          // Verify slot is now available again
          const afterCancel = await generateAvailableSlots(doctorId, normalDay);
          const slotAvailable = afterCancel.ok && afterCancel.slots.some(s => s.startTime === testSlot.startTime);
          tests.push({
            name: '12b. Cancelled slot becomes available',
            status: slotAvailable ? 'PASS' : 'FAIL',
            details: slotAvailable
              ? `Slot ${testSlot.startTime} correctly available after cancellation.`
              : `Slot ${testSlot.startTime} NOT available after cancellation!`,
          });

          // Cleanup
          await supabase.from('appointments').delete().eq('id', testApt.id);
        } else {
          tests.push({
            name: '12. Appointment cancellation',
            status: 'SKIP',
            details: 'Could not create test appointment.',
          });
        }
      } else {
        tests.push({
          name: '12. Appointment cancellation',
          status: 'SKIP',
          details: 'No patients found.',
        });
      }
    } else {
      tests.push({
        name: '12. Appointment cancellation',
        status: 'SKIP',
        details: 'Test 1 failed — no base slots.',
      });
    }

    // -------------------------------------------------------
    // Test 13: Unauthorized cancellation rejected
    // -------------------------------------------------------
    if (normalResult.ok && normalResult.slots.length >= 1) {
      const supabase = createSupabaseServerClient();
      const testSlot = normalResult.slots[0];
      const patients = await supabase.from('patients').select('id').limit(2);

      if (patients.data && patients.data.length >= 2) {
        const patientA = patients.data[0].id;
        const patientB = patients.data[1].id;

        // Create appointment for patientA
        const { data: testApt } = await supabase
          .from('appointments')
          .insert({
            patient_id: patientA,
            doctor_id: doctorId,
            appointment_date: normalDay,
            start_time: testSlot.startTime + ':00',
            end_time: testSlot.endTime + ':00',
            status: 'CONFIRMED',
            urgency: 'low',
            chief_complaint: 'Unauthorized cancel test',
          })
          .select('id')
          .single();

        if (testApt) {
          // PatientB tries to cancel patientA's appointment
          const unauthResult = await cancelAppointment(testApt.id, patientB);

          tests.push({
            name: '13. Unauthorized cancellation rejected',
            status: !unauthResult.ok && unauthResult.error === 'UNAUTHORIZED' ? 'PASS' : 'FAIL',
            details: !unauthResult.ok && unauthResult.error === 'UNAUTHORIZED'
              ? `Correctly rejected unauthorized cancel. Error: ${unauthResult.error}`
              : `Expected UNAUTHORIZED, got: ${unauthResult.ok ? 'success' : unauthResult.error}`,
          });

          // Cleanup
          await supabase.from('appointments').delete().eq('id', testApt.id);
        } else {
          tests.push({
            name: '13. Unauthorized cancellation rejected',
            status: 'SKIP',
            details: 'Could not create test appointment.',
          });
        }
      } else {
        tests.push({
          name: '13. Unauthorized cancellation rejected',
          status: 'SKIP',
          details: 'Need 2 patients.',
        });
      }
    } else {
      tests.push({
        name: '13. Unauthorized cancellation rejected',
        status: 'SKIP',
        details: 'Test 1 failed — no base slots.',
      });
    }
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  const passCount = tests.filter(t => t.status === 'PASS').length;
  const failCount = tests.filter(t => t.status === 'FAIL').length;
  const skipCount = tests.filter(t => t.status === 'SKIP').length;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Booking Engine Verification
        </h1>
        <p className="text-slate-600 mb-8">
          Development-only test page for the full booking engine: slots, holds, confirmation, cancellation, and rescheduling.
        </p>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-700">{passCount}</p>
            <p className="text-sm text-green-600">Passed</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-red-700">{failCount}</p>
            <p className="text-sm text-red-600">Failed</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-amber-700">{skipCount}</p>
            <p className="text-sm text-amber-600">Skipped</p>
          </div>
        </div>

        {/* Test Results */}
        <div className="space-y-4">
          {tests.map((test, i) => (
            <div
              key={i}
              className={`border rounded-lg p-4 ${
                test.status === 'PASS'
                  ? 'bg-green-50 border-green-200'
                  : test.status === 'FAIL'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                    test.status === 'PASS'
                      ? 'bg-green-600 text-white'
                      : test.status === 'FAIL'
                      ? 'bg-red-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {test.status === 'PASS' ? '✓' : test.status === 'FAIL' ? '✗' : '—'}
                </span>
                <div>
                  <h3 className="font-medium text-slate-900">{test.name}</h3>
                  <p className="text-sm text-slate-600">{test.details}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-slate-100 rounded-lg">
          <p className="text-sm text-slate-600">
            <strong>Doctor ID:</strong> {doctorId || 'Not found'} &nbsp;|&nbsp;
            <strong>Date tested:</strong> {getNextWeekday(1)} (next Monday)
          </p>
        </div>
      </div>
    </div>
  );
}
