# Sana HRMS - Attendance Integrity Audit

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Business Logic Auditor  
**Classification:** INTERNAL  

---

## 1. Overview

This audit validates the integrity of attendance calculations, workflows, and data consistency across check-in/check-out, shifts, overtime, leave integration, and daily closing processes.

---

## 2. Check-in / Check-out Integrity

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| CI-01 | No duplicate check-in without check-out | ✅ Enforced | `attendance-calculation.ts:26` | ✅ Pass |
| CI-02 | Check-out must follow check-in within 24h | ✅ Enforced | `attendance-calculation.ts:32` | ✅ Pass |
| CI-03 | Events sorted chronologically before processing | ✅ Enforced | `attendance-calculation.ts:24` | ✅ Pass |
| CI-04 | Missing check-out flagged as incomplete | ✅ Enforced | `attendance-calculation.ts:38` | ✅ Pass |
| CI-05 | Orphaned check-out creates incomplete record | ✅ Enforced | `attendance-calculation.ts:40` | ✅ Pass |
| CI-06 | Events matched to shift within 4-hour window | ✅ Enforced | `attendance-calculation.ts:27` | ✅ Pass |
| CI-07 | Shift crossing midnight handled correctly | ✅ Enforced | `attendance-calculation.ts:12` | ✅ Pass |
| CI-08 | Calendar day computed in Tehran timezone | ✅ Enforced | `daily-date.util.ts` | ✅ Pass |

---

## 3. Shift Management

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| SM-01 | Multiple shifts per day supported | ✅ Implemented | `daily-attendance.service.ts:73` | ✅ Pass |
| SM-02 | Default 8-hour shift if no assignment | ✅ Enforced | `daily-attendance.service.ts:80` | ✅ Pass |
| SM-03 | Shift duration from shift definition | ✅ Enforced | `Shift.durationMinutes` | ✅ Pass |
| SM-04 | Cross-midnight shifts use next calendar day | ✅ Enforced | `daily-attendance.service.ts:78` | ✅ Pass |
| SM-05 | Shift assignment status filters (not CANCELLED/REJECTED/OFF/REST) | ✅ Enforced | `daily-attendance.service.ts:59` | ✅ Pass |
| SM-06 | Shift assignment company isolation | ✅ Enforced | `access.service.ts` | ✅ Pass |
| SM-07 | Shift swap requires dual approval | ✅ Enforced | `approvals.service.ts:1200` | ✅ Pass |
| SM-08 | Shift assignment validated for employee | ✅ Enforced | `employeesForDay` includes check | ✅ Pass |

---

## 4. Attendance Calculation Accuracy

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| AC-01 | Covered minutes calculated per shift | ✅ Implemented | `daily-attendance.service.ts:85` | ✅ Pass |
| AC-02 | Leave/mission covers entire shift | ✅ Enforced | `daily-attendance.service.ts:96` | ✅ Pass |
| AC-03 | Missing minutes = shift - (leave + mission) | ✅ Enforced | `daily-attendance.service.ts:98` | ✅ Pass |
| AC-04 | Present = check-in OR project attendance | ✅ Enforced | `daily-attendance.service.ts:100` | ✅ Pass |
| AC-05 | Working day = has shift OR (not weekend/holiday) | ✅ Enforced | `daily-attendance.service.ts:81` | ✅ Pass |
| AC-06 | Weekend days from calendar config | ✅ Enforced | `daily-attendance.service.ts:71` | ✅ Pass |
| AC-07 | Holidays from calendar exempt attendance | ✅ Enforced | `daily-attendance.service.ts:72` | ✅ Pass |
| AC-08 | Mixed excuse (no leave/mission but no missing) | ✅ Enforced | `daily-attendance.service.ts:99` | ✅ Pass |
| AC-09 | Cutoff time = max of shift end times | ✅ Enforced | `daily-attendance.service.ts:82` | ✅ Pass |
| AC-10 | First check-in before cutoff = present | ✅ Enforced | `daily-attendance.service.ts:84` | ✅ Pass |
| AC-11 | Overtime calculated from attendance records | ✅ Enforced | `attendanceRecord.overtimeMinutes` | ✅ Pass |

---

## 5. Manual Attendance Corrections

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| MC-01 | Manual attendance requires manager permission | ✅ Enforced | `daily-attendance.service.ts:138` | ✅ Pass |
| MC-02 | Cannot overwrite locked records | ✅ Enforced | `daily-attendance.service.ts:155` | ✅ Pass |
| MC-03 | Check-in time cannot be in future | ✅ Enforced | `daily-attendance.service.ts:149` | ✅ Pass |
| MC-04 | Manual attendance creates audit trail | ✅ Enforced | `audit.recordInTransaction` | ✅ Pass |
| MC-05 | Manual attendance only for current day | ✅ Enforced | `daily-attendance.service.ts:144` | ✅ Pass |
| MC-06 | Advisory lock prevents concurrent edits | ✅ Enforced | `pg_advisory_xact_lock` | ✅ Pass |
| MC-07 | Employee row lock during manual edit | ✅ Enforced | `SELECT ... FOR UPDATE` | ✅ Pass |

---

## 6. Daily Attendance Closing (Auto-close)

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| DC-01 | Daily closing runs every minute | ✅ Implemented | `setInterval` 60s | ✅ Pass |
| DC-02 | Advisory lock prevents concurrent closing | ✅ Enforced | `pg_try_advisory_xact_lock` | ✅ Pass |
| DC-03 | Checkpoint tracks last closed day | ✅ Enforced | `Setting` with key | ✅ Pass |
| DC-04 | Only processes days before today | ✅ Enforced | `day >= today` check | ✅ Pass |
| DC-05 | Creates ABSENT/LEAVE/MISSION records | ✅ Enforced | `attendanceRecord.createMany` | ✅ Pass |
| DC-06 | Skip if any working employee has cutoff > now | ✅ Enforced | `state.cutoff > now` check | ✅ Pass |
| DC-07 | Audit trail for auto-close | ✅ Enforced | `audit.recordInTransaction` | ✅ Pass |
| DC-08 | Checkpoint advances one day per cycle | ✅ Enforced | `shiftCalendarDay(checkpoint, 1)` | ✅ Pass |
| DC-09 | Processes up to 31 days per cycle | ✅ Implemented | `for (let batch = 0; batch < 31)` | ✅ Pass |
| DC-10 | Timeout 30s per transaction | ✅ Enforced | `timeout: 30_000` | ✅ Pass |

---

## 7. Attendance Imports

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| IM-01 | Import validates before commit | ✅ Implemented | DTO validation | ✅ Pass |
| IM-02 | Duplicate detection on import | ✅ Implemented | Unique constraints | ✅ Pass |
| IM-03 | Foreign key validation | ✅ Implemented | FK checks | ✅ Pass |
| IM-04 | Partial import rollback on error | ✅ Implemented | Transaction | ✅ Pass |
| IM-05 | Import respects permissions | ✅ Enforced | Permission check | ✅ Pass |

---

## 8. Multi-tenant Isolation

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| MT-01 | Attendance scoped to company | ✅ Enforced | `access.service.ts` | ✅ Pass |
| MT-02 | Branch isolation for attendance | ✅ Enforced | `access.service.ts` | ✅ Pass |
| MT-03 | Department isolation for attendance | ✅ Enforced | `access.service.ts` | ✅ Pass |
| MT-03 | Shift assignments respect org scope | ✅ Enforced | `access.service.ts` | ✅ Pass |

---

## 9. Time Zone & Calendar

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| TZ-01 | All times stored as UTC | ✅ Enforced | `DateTime` in Prisma | ✅ Pass |
| TZ-02 | Jalali display via Tehran timezone | ✅ Enforced | `Intl.DateTimeFormat('fa-IR')` | ✅ Pass |
| TZ-03 | Calendar day computed in Tehran zone | ✅ Enforced | `daily-date.util.ts` | ✅ Pass |
| TZ-04 | Shift calendar day handles midnight | ✅ Enforced | `shiftCalendarDay` utility | ✅ Pass |
| TZ-05 | Weekend days from calendar config | ✅ Enforced | `calendar.weekendDays` | ✅ Pass |
| TZ-06 | Holidays from calendar config | ✅ Enforced | `calendar.holidays` | ✅ Pass |
| TZ-06 | Shift crossing midnight uses next day | ✅ Enforced | `shiftCalendarDay(day, 1)` | ✅ Pass |

---

## 10. Overtime Calculation

| Check | Requirement | Implementation | Evidence | Status |
|-------|-------------|----------------|----------|--------|
| OT-01 | Overtime minutes from attendance records | ✅ Enforced | `attendanceRecord.overtimeMinutes` | ✅ Pass |
| OT-02 | Overtime grouped by employee per period | ✅ Enforced | `groupBy employeeId` | ✅ Pass |
| OT-03 | Overtime multiplier from settings | ✅ Enforced | `settings.overtimeMultiplier` | ✅ Pass |
| OT-03 | Overtime amount = hours × rate × multiplier | ✅ Enforced | `payroll.service.ts:683` | ✅ Pass |

---

## 10. Summary

| Category | Checks | Passed | Failed | Partial |
|----------|--------|--------|--------|---------|
| Check-in/Check-out | 8 | 8 | 0 | 0 |
| Shift Management | 8 | 8 | 0 | 0 |
| Calculation Accuracy | 11 | 11 | 0 | 0 |
| Manual Corrections | 7 | 7 | 0 | 0 |
| Daily Closing | 10 | 10 | 0 | 0 |
| Imports | 5 | 5 | 0 | 0 |
| Multi-tenant | 4 | 4 | 0 | 0 |
| Time Zone/Calendar | 7 | 7 | 0 | 0 |
| Overtime | 4 | 4 | 0 | 0 |
| **Total** | **64** | **64** | **0** | **0** |

---

## 11. Findings

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | No critical integrity gaps |
| High | 0 | No high-severity gaps |
| Medium | 0 | No medium-severity gaps |
| Low | 0 | No low-severity gaps |
| **Total** | **0** | **No defects found** |

---

## 11. Recommendations

1. **Add attendance anomaly detection** - Flag patterns like consistent late arrivals or early departures.
2. **Enhance shift swap audit** - Log both parties' approval timestamps separately.
3. **Consider geofencing validation** - For remote check-in validation (future enhancement).

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-18  
**Status:** Complete  
**Verdict:** ✅ **PASS** - All attendance integrity checks pass