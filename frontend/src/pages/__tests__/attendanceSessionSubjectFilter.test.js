/**
 * Property-Based Tests — Attendance Session Subject Filter
 *
 * Tests encode the EXPECTED behavior for session-awareness and
 * section-scoped subject filtering in the Attendance module.
 *
 * Pure helper functions mirror the updated logic in admin-panel/config/apis.js
 * and admin-panel/src/pages/Attendance.jsx.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure helper functions — mirror the updated logic in apis.js / Attendance.jsx
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3000";

/**
 * Mirrors getSubjectsForClassWithAssignments URL building logic.
 */
function buildSubjectsUrl(classId, sessionId, sectionId) {
  let url = sessionId
    ? `${BASE_URL}/academics/scm/subjects-for-class?classId=${classId}&sessionId=${sessionId}`
    : `${BASE_URL}/academics/scm/subjects-for-class?classId=${classId}`;
  if (sectionId && sectionId !== "*") url += `&sectionId=${sectionId}`;
  return url;
}

/**
 * Mirrors fetchStudentAttendance URL building logic.
 */
function buildFetchAttendanceUrl(classId, sectionId, subjectId, date, sessionId) {
  let url = `${BASE_URL}/attendance/student/fetch?classId=${classId}&sectionId=${sectionId || ""}&subjectId=${subjectId}&date=${date}`;
  if (sessionId) url += `&sessionId=${sessionId}`;
  return url;
}

/**
 * Mirrors generateStudentAttendance URL building logic.
 */
function buildGenerateAttendanceUrl(classId, sectionId, subjectId, date, sessionId) {
  const params = new URLSearchParams({ attenFor: "student", date });
  if (classId) params.append("classId", classId);
  if (sectionId) params.append("sectionId", sectionId);
  if (subjectId) params.append("subjectId", subjectId);
  if (sessionId) params.append("sessionId", sessionId);
  return `${BASE_URL}/attendance/generate?${params.toString()}`;
}

/**
 * Mirrors getAttendanceReport URL building logic.
 */
function buildReportUrl(start, end, classId, sectionId, sessionId) {
  const params = new URLSearchParams({ start, end });
  if (classId) params.append("classId", classId);
  if (sectionId) params.append("sectionId", sectionId);
  if (sessionId) params.append("sessionId", sessionId);
  return `${BASE_URL}/attendance/report?${params.toString()}`;
}

/**
 * Pure filter: returns records where record.sectionId === sectionId OR record.sectionId === null.
 * Mirrors the backend SCM section filter logic.
 */
function filterScmBySection(scmRecords, sectionId) {
  return scmRecords.filter(
    (record) => record.sectionId === sectionId || record.sectionId === null
  );
}

/**
 * Returns first session where isActive === true, or undefined if none.
 * Mirrors the active session derivation in Attendance.jsx.
 */
function deriveActiveSession(sessions) {
  return sessions.find((s) => s.isActive === true);
}

/**
 * Builds the save payload for updateStudentAttendance, including sessionId.
 * Mirrors handleSaveAttendance in Attendance.jsx.
 */
function buildSavePayload({
  attendanceChanges,
  selectedClassId,
  selectedSectionId,
  selectedSubjectId,
  markDate,
  isTeacher,
  currentUserId,
  sessionId,
}) {
  const sectionParam = selectedSectionId === "*" ? null : Number(selectedSectionId);
  return {
    classId: Number(selectedClassId),
    sectionId: sectionParam,
    subjectId: Number(selectedSubjectId),
    teacherId: isTeacher ? (currentUserId || null) : null,
    date: markDate,
    sessionId: sessionId,
    students: Object.entries(attendanceChanges).map(([studentId, status]) => ({
      studentId,
      status: status.toUpperCase(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const classIdArb = fc.integer({ min: 1, max: 1000 }).map(String);
const sessionIdArb = fc.integer({ min: 1, max: 500 }).map(String);
const sectionIdArb = fc.integer({ min: 1, max: 500 }).map(String);
const subjectIdArb = fc.integer({ min: 1, max: 500 }).map(String);
const dateArb = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 })
).map(([y, m, d]) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);

const scmRecordArb = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  subjectId: fc.integer({ min: 1, max: 1000 }),
  sectionId: fc.oneof(
    fc.integer({ min: 1, max: 500 }),
    fc.constant(null)
  ),
});

const scmRecordsArb = fc.array(scmRecordArb, { minLength: 0, maxLength: 20 });

const academicSessionArb = fc.record({
  id: fc.integer({ min: 1, max: 500 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  isActive: fc.boolean(),
});

const academicSessionsArb = fc.array(academicSessionArb, { minLength: 0, maxLength: 10 });

const attendanceChangesArb = fc.dictionary(
  fc.integer({ min: 1, max: 1000 }).map(String),
  fc.constantFrom("present", "absent", "leave"),
  { minKeys: 1, maxKeys: 30 }
);

// ---------------------------------------------------------------------------
// Property 1 — section-scoped subject URL includes sectionId
// Feature: attendance-session-subject-filter, Property 1: section-scoped subject URL includes sectionId
// Validates: Requirements 1.1, 1.5
// ---------------------------------------------------------------------------

describe("Property 1: section-scoped subject URL includes sectionId", () => {
  it(
    "for any classId, sessionId, and non-null/non-'*' sectionId, buildSubjectsUrl contains both classId and sectionId as query params",
    () => {
      /**
       * **Validates: Requirements 1.1, 1.5**
       */
      // Feature: attendance-session-subject-filter, Property 1: section-scoped subject URL includes sectionId
      fc.assert(
        fc.property(classIdArb, sessionIdArb, sectionIdArb, (classId, sessionId, sectionId) => {
          const url = buildSubjectsUrl(classId, sessionId, sectionId);
          expect(url).toContain(`classId=${classId}`);
          expect(url).toContain(`sectionId=${sectionId}`);
        }),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 2 — absent sectionId is omitted from subject URL
// Feature: attendance-session-subject-filter, Property 2: absent sectionId is omitted from subject URL
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------

describe("Property 2: absent sectionId is omitted from subject URL", () => {
  it(
    "when sectionId is null, undefined, or '*', buildSubjectsUrl does NOT contain a sectionId query param",
    () => {
      /**
       * **Validates: Requirements 1.2**
       */
      // Feature: attendance-session-subject-filter, Property 2: absent sectionId is omitted from subject URL
      fc.assert(
        fc.property(
          classIdArb,
          sessionIdArb,
          fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant("*")),
          (classId, sessionId, sectionId) => {
            const url = buildSubjectsUrl(classId, sessionId, sectionId);
            expect(url).not.toContain("sectionId=");
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 3 — SCM section filter correctness
// Feature: attendance-session-subject-filter, Property 3: SCM section filter correctness
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------

describe("Property 3: SCM section filter correctness", () => {
  it(
    "for any array of SCM records and any sectionId, filterScmBySection returns only records where record.sectionId === sectionId OR record.sectionId === null",
    () => {
      /**
       * **Validates: Requirements 1.3**
       */
      // Feature: attendance-session-subject-filter, Property 3: SCM section filter correctness
      fc.assert(
        fc.property(scmRecordsArb, fc.integer({ min: 1, max: 500 }), (records, sectionId) => {
          const result = filterScmBySection(records, sectionId);

          // Every returned record must match sectionId or have null sectionId
          result.forEach((record) => {
            expect(
              record.sectionId === sectionId || record.sectionId === null
            ).toBe(true);
          });

          // Every record that matches must appear in result
          const expected = records.filter(
            (r) => r.sectionId === sectionId || r.sectionId === null
          );
          expect(result).toEqual(expected);
        }),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 4 — active session derivation
// Feature: attendance-session-subject-filter, Property 4: active session derivation
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

describe("Property 4: active session derivation", () => {
  it(
    "for any array of AcademicSession objects, deriveActiveSession returns the first element where isActive === true, or undefined if none",
    () => {
      /**
       * **Validates: Requirements 3.2**
       */
      // Feature: attendance-session-subject-filter, Property 4: active session derivation
      fc.assert(
        fc.property(academicSessionsArb, (sessions) => {
          const result = deriveActiveSession(sessions);
          const firstActive = sessions.find((s) => s.isActive === true);

          if (firstActive === undefined) {
            expect(result).toBeUndefined();
          } else {
            expect(result).toBe(firstActive);
            expect(result.isActive).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 5 — fetchStudentAttendance URL includes sessionId
// Feature: attendance-session-subject-filter, Property 5: fetchStudentAttendance URL includes sessionId
// Validates: Requirements 3.5, 3.6
// ---------------------------------------------------------------------------

describe("Property 5: fetchStudentAttendance URL includes sessionId", () => {
  it(
    "for any classId, sectionId, subjectId, date, and sessionId, buildFetchAttendanceUrl contains sessionId=<value> when sessionId is provided",
    () => {
      /**
       * **Validates: Requirements 3.5, 3.6**
       */
      // Feature: attendance-session-subject-filter, Property 5: fetchStudentAttendance URL includes sessionId
      fc.assert(
        fc.property(classIdArb, sectionIdArb, subjectIdArb, dateArb, sessionIdArb, (classId, sectionId, subjectId, date, sessionId) => {
          const url = buildFetchAttendanceUrl(classId, sectionId, subjectId, date, sessionId);
          expect(url).toContain(`sessionId=${sessionId}`);
        }),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 6 — updateStudentAttendance payload includes sessionId
// Feature: attendance-session-subject-filter, Property 6: updateStudentAttendance payload includes sessionId
// Validates: Requirements 3.7
// ---------------------------------------------------------------------------

describe("Property 6: updateStudentAttendance payload includes sessionId", () => {
  it(
    "for any attendance payload and sessionId, the payload object contains a sessionId field equal to the active session's id",
    () => {
      /**
       * **Validates: Requirements 3.7**
       */
      // Feature: attendance-session-subject-filter, Property 6: updateStudentAttendance payload includes sessionId
      fc.assert(
        fc.property(
          attendanceChangesArb,
          classIdArb,
          fc.oneof(fc.constant("*"), fc.integer({ min: 1, max: 500 }).map(String)),
          subjectIdArb,
          dateArb,
          fc.integer({ min: 1, max: 500 }),
          (attendanceChanges, selectedClassId, selectedSectionId, selectedSubjectId, markDate, sessionId) => {
            const payload = buildSavePayload({
              attendanceChanges,
              selectedClassId,
              selectedSectionId,
              selectedSubjectId,
              markDate,
              isTeacher: false,
              currentUserId: null,
              sessionId,
            });

            expect(payload).toHaveProperty("sessionId");
            expect(payload.sessionId).toBe(sessionId);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 7 — generateStudentAttendance URL includes sessionId
// Feature: attendance-session-subject-filter, Property 7: generateStudentAttendance URL includes sessionId
// Validates: Requirements 3.8, 3.9
// ---------------------------------------------------------------------------

describe("Property 7: generateStudentAttendance URL includes sessionId", () => {
  it(
    "for any classId, sectionId, subjectId, date, and sessionId, buildGenerateAttendanceUrl contains sessionId=<value> when sessionId is provided",
    () => {
      /**
       * **Validates: Requirements 3.8, 3.9**
       */
      // Feature: attendance-session-subject-filter, Property 7: generateStudentAttendance URL includes sessionId
      fc.assert(
        fc.property(classIdArb, sectionIdArb, subjectIdArb, dateArb, sessionIdArb, (classId, sectionId, subjectId, date, sessionId) => {
          const url = buildGenerateAttendanceUrl(classId, sectionId, subjectId, date, sessionId);
          expect(url).toContain(`sessionId=${sessionId}`);
        }),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 8 — getAttendanceReport URL includes sessionId when provided, omits it when absent
// Feature: attendance-session-subject-filter, Property 8: getAttendanceReport URL includes sessionId when provided, omits it when absent
// Validates: Requirements 4.3, 4.4, 4.5, 5.3, 5.4
// ---------------------------------------------------------------------------

describe("Property 8: getAttendanceReport URL includes sessionId when provided, omits it when absent", () => {
  it(
    "when sessionId is provided, buildReportUrl contains sessionId=<value>",
    () => {
      /**
       * **Validates: Requirements 4.3, 4.4, 5.3**
       */
      // Feature: attendance-session-subject-filter, Property 8: getAttendanceReport URL includes sessionId when provided, omits it when absent
      fc.assert(
        fc.property(dateArb, dateArb, classIdArb, sectionIdArb, sessionIdArb, (start, end, classId, sectionId, sessionId) => {
          const url = buildReportUrl(start, end, classId, sectionId, sessionId);
          expect(url).toContain(`sessionId=${sessionId}`);
        }),
        { numRuns: 100 }
      );
    }
  );

  it(
    "when sessionId is absent (null, undefined, or ''), buildReportUrl does NOT contain a sessionId param",
    () => {
      /**
       * **Validates: Requirements 4.5, 5.4**
       */
      // Feature: attendance-session-subject-filter, Property 8: getAttendanceReport URL includes sessionId when provided, omits it when absent
      fc.assert(
        fc.property(
          dateArb,
          dateArb,
          classIdArb,
          sectionIdArb,
          fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant("")),
          (start, end, classId, sectionId, sessionId) => {
            const url = buildReportUrl(start, end, classId, sectionId, sessionId);
            expect(url).not.toContain("sessionId=");
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
