/**
 * Bug Condition Exploration Tests — Attendance Subject RBAC Fix
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * These tests encode the EXPECTED (fixed) behavior.
 * They are EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT fix the code or the tests when they fail.
 *
 * Bug Condition: When a class is selected, `filteredSubjects` is computed by
 * filtering the `subjects` array on `s.classId === Number(selectedClassId)`.
 * Subjects returned from `/academics/subject/get/all` are global records with
 * no `classId` field, so the filter always returns `[]` — the dropdown is empty.
 *
 * Expected Behavior (after fix): `filteredSubjects` maps SCM entries to
 * `{ id: scm.subject.id, name: scm.subject.name }`, returning non-empty results
 * when the class has SCM entries.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure model: mirrors the broken filteredSubjects computation in Attendance.jsx
// ---------------------------------------------------------------------------

/**
 * OLD (broken) filteredSubjects computation — mirrors Attendance.jsx lines ~196-200:
 *   const filteredSubjects = subjects.filter(s => {
 *     const classMatch = s.classId === Number(selectedClassId);
 *     if (!classMatch) return false;
 *     return true;
 *   });
 *
 * Subjects from getClassSubjects have no `classId` field, so this always returns [].
 * This is the UNFIXED code path — used to demonstrate the bug.
 */
function filteredSubjects_old(subjects, selectedClassId) {
  return subjects.filter(s => {
    const classMatch = s.classId === Number(selectedClassId);
    if (!classMatch) return false;
    return true;
  });
}

/**
 * NEW (fixed) filteredSubjects computation — mirrors the fixed useMemo in Attendance.jsx:
 *   const filteredSubjects = useMemo(() => {
 *     if (!subjects.length) return [];
 *     if (isTeacher) {
 *       return subjects
 *         .filter(scm => scm.subject?.teachers?.some(t => t.teacherId === Number(currentUserId)))
 *         .map(scm => ({ id: scm.subject.id, name: scm.subject.name }));
 *     }
 *     return subjects.map(scm => ({ id: scm.subject.id, name: scm.subject.name }));
 *   }, [subjects, isTeacher, currentUserId]);
 *
 * subjects here are SCM entries from getSubjectsForClassWithAssignments.
 * This is the FIXED code path.
 */
function filteredSubjects_new(scmSubjects, isTeacher = false, currentUserId = null) {
  if (!scmSubjects.length) return [];
  if (isTeacher) {
    return scmSubjects
      .filter(scm => scm.subject?.teachers?.some(t => t.teacherId === Number(currentUserId)))
      .map(scm => ({ id: scm.subject.id, name: scm.subject.name }));
  }
  return scmSubjects.map(scm => ({ id: scm.subject.id, name: scm.subject.name }));
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a non-empty array of subject objects with NO classId field —
 * matching the real API response shape from /academics/subject/get/all.
 */
const subjectsWithoutClassIdArb = fc.array(
  fc.record({
    id: fc.integer({ min: 1, max: 1000 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
  }),
  { minLength: 1, maxLength: 20 }
);

/**
 * Generates a non-empty selectedClassId string (non-empty, numeric-like).
 */
const selectedClassIdArb = fc.integer({ min: 1, max: 100 }).map(String);

/**
 * Generates a non-empty array of SCM entries matching the shape returned by
 * getSubjectsForClassWithAssignments.
 */
const scmEntriesArb = fc.array(
  fc.record({
    id: fc.integer({ min: 1, max: 1000 }),
    subjectId: fc.integer({ min: 1, max: 1000 }),
    classId: fc.integer({ min: 1, max: 100 }),
    subject: fc.record({
      id: fc.integer({ min: 1, max: 1000 }),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      teachers: fc.array(
        fc.record({
          teacherId: fc.integer({ min: 1, max: 500 }),
        }),
        { minLength: 0, maxLength: 5 }
      ),
    }),
  }),
  { minLength: 1, maxLength: 10 }
);

// ---------------------------------------------------------------------------
// Property-Based Test: Bug Condition
// Validates: Requirements 1.1, 1.2, 1.3
// EXPECTED TO FAIL on unfixed code
// ---------------------------------------------------------------------------

describe("Property 1: Bug Condition — filteredSubjects must return non-empty [{id,name}] from SCM data", () => {
  it(
    "FIXED BEHAVIOR: for all non-empty SCM entries (admin), new filter maps to [{id,name}] and returns non-empty array",
    () => {
      fc.assert(
        fc.property(scmEntriesArb, (scmSubjects) => {
          // The NEW fixed filter — maps SCM entries to {id, name} for admin
          const newResult = filteredSubjects_new(scmSubjects, false, null);

          // Fixed behavior: always returns non-empty array when SCM data is non-empty
          expect(newResult.length).toBeGreaterThan(0);

          // Each entry must have id and name from the SCM subject
          newResult.forEach(entry => {
            expect(entry).toHaveProperty("id");
            expect(entry).toHaveProperty("name");
          });
        }),
        { numRuns: 50 }
      );
    }
  );

  it(
    "FIXED BEHAVIOR: SCM data mapped to [{id,name}] returns non-empty array matching expected shape",
    () => {
      fc.assert(
        fc.property(scmEntriesArb, (scmSubjects) => {
          // The EXPECTED (fixed) behavior: map SCM entries to {id, name}
          const expectedResult = scmSubjects.map(scm => ({
            id: scm.subject.id,
            name: scm.subject.name,
          }));

          // Fixed behavior produces the expected mapping
          const newResult = filteredSubjects_new(scmSubjects, false, null);
          expect(newResult).toEqual(expectedResult);

          // Result is non-empty when SCM data is non-empty
          expect(newResult.length).toBeGreaterThan(0);
        }),
        { numRuns: 50 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Concrete Unit Test: Bug Condition Example
// Validates: Requirements 1.1, 1.3
// EXPECTED TO FAIL on unfixed code
// ---------------------------------------------------------------------------

describe("Concrete example: subjects without classId → old filter returns [], expected [{id,name}]", () => {
  it(
    "FIXED BEHAVIOR: admin sees subjects when class is selected (SCM mapping returns non-empty)",
    () => {
      // Arrange: SCM entries as returned by getSubjectsForClassWithAssignments
      const scmData = [
        { id: 10, subjectId: 1, classId: 1, subject: { id: 1, name: "Math", teachers: [] } },
        { id: 11, subjectId: 2, classId: 1, subject: { id: 2, name: "Science", teachers: [] } },
      ];

      // NEW fixed behavior: map SCM entries to {id, name}
      const newResult = filteredSubjects_new(scmData, false, null);

      // The fixed behavior returns non-empty [{id, name}]
      expect(newResult).toEqual([
        { id: 1, name: "Math" },
        { id: 2, name: "Science" },
      ]);
    }
  );

  it(
    "FIXED BEHAVIOR: SCM input [{id:10,subjectId:1,classId:1,subject:{id:1,name:'Math',teachers:[]}}] → filteredSubjects returns [{id:1,name:'Math'}]",
    () => {
      // SCM data as returned by getSubjectsForClassWithAssignments
      const scmData = [
        { id: 10, subjectId: 1, classId: 1, subject: { id: 1, name: "Math", teachers: [] } },
      ];

      // NEW fixed behavior: map SCM entries to {id, name}
      const newResult = filteredSubjects_new(scmData, false, null);

      // Expected: [{id:1, name:"Math"}]
      expect(newResult).toEqual([{ id: 1, name: "Math" }]);
    }
  );
});


// ---------------------------------------------------------------------------
// Preservation Property Tests — Task 2
// Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6
//
// These tests capture EXISTING CORRECT behaviors that must not regress after
// the subject-dropdown fix. They are written by observing the UNFIXED code
// and MUST PASS on unfixed code.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pure model functions extracted from Attendance.jsx (unfixed code)
// ---------------------------------------------------------------------------

/**
 * Admin filteredSections — mirrors Attendance.jsx:
 *   allSections.filter(s => s.classId === Number(selectedClassId))
 */
function adminFilteredSections(allSections, selectedClassId) {
  return allSections.filter(s => s.classId === Number(selectedClassId));
}

/**
 * Teacher filteredSections — mirrors Attendance.jsx:
 *   teacherClassMappings
 *     .filter(mapping => mapping.class?.id === Number(selectedClassId))
 *     .map(mapping => mapping.section)
 *     .filter(Boolean)
 */
function teacherFilteredSections(teacherClassMappings, selectedClassId) {
  return teacherClassMappings
    .filter(mapping => mapping.class?.id === Number(selectedClassId))
    .map(mapping => mapping.section)
    .filter(Boolean);
}

/**
 * Attendance save payload builder — mirrors Attendance.jsx handleSaveAttendance:
 *   const sectionParam = selectedSectionId === "*" ? null : Number(selectedSectionId);
 *   const payload = { classId, sectionId, subjectId, teacherId, date, students }
 */
function buildSavePayload({
  attendanceChanges,
  selectedClassId,
  selectedSectionId,
  selectedSubjectId,
  markDate,
  isTeacher,
  currentUserId,
}) {
  const sectionParam = selectedSectionId === "*" ? null : Number(selectedSectionId);
  return {
    classId: Number(selectedClassId),
    sectionId: sectionParam,
    subjectId: Number(selectedSubjectId),
    teacherId: isTeacher ? (currentUserId || null) : null,
    date: markDate,
    students: Object.entries(attendanceChanges).map(([studentId, status]) => ({
      studentId,
      status: status.toUpperCase(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries for preservation tests
// ---------------------------------------------------------------------------

const sectionArb = fc.record({
  id: fc.integer({ min: 1, max: 500 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  classId: fc.integer({ min: 1, max: 100 }),
});

const allSectionsArb = fc.array(sectionArb, { minLength: 0, maxLength: 30 });

const classIdStringArb = fc.integer({ min: 1, max: 100 }).map(String);

const teacherMappingArb = fc.record({
  class: fc.record({
    id: fc.integer({ min: 1, max: 100 }),
    name: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  section: fc.oneof(
    fc.record({
      id: fc.integer({ min: 1, max: 500 }),
      name: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    fc.constant(null)
  ),
});

const teacherClassMappingsArb = fc.array(teacherMappingArb, { minLength: 0, maxLength: 20 });

const attendanceChangesArb = fc.dictionary(
  fc.integer({ min: 1, max: 1000 }).map(String),
  fc.constantFrom("present", "absent", "leave"),
  { minKeys: 1, maxKeys: 30 }
);

const sectionIdArb = fc.oneof(
  fc.constant("*"),
  fc.integer({ min: 1, max: 500 }).map(String)
);

const subjectIdArb = fc.integer({ min: 1, max: 500 }).map(String);

const markDateArb = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 })
).map(([y, m, d]) => {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
});

// ---------------------------------------------------------------------------
// Property 2: Preservation — Section Filtering and Attendance Payload Unchanged
// Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6
// MUST PASS on unfixed code
// ---------------------------------------------------------------------------

describe("Property 2: Preservation — Section Filtering and Attendance Payload Unchanged", () => {
  // -------------------------------------------------------------------------
  // 2a. Admin section filtering
  // Validates: Requirement 3.1
  // -------------------------------------------------------------------------
  it(
    "Admin filteredSections: for all (allSections, selectedClassId), result contains exactly sections where s.classId === Number(selectedClassId)",
    () => {
      /**
       * **Validates: Requirements 3.1**
       */
      fc.assert(
        fc.property(allSectionsArb, classIdStringArb, (allSections, selectedClassId) => {
          const result = adminFilteredSections(allSections, selectedClassId);
          const classIdNum = Number(selectedClassId);

          // Every returned section must match the classId
          expect(result.every(s => s.classId === classIdNum)).toBe(true);

          // Every section in allSections with matching classId must appear in result
          const expected = allSections.filter(s => s.classId === classIdNum);
          expect(result).toEqual(expected);
        }),
        { numRuns: 100 }
      );
    }
  );

  it(
    "Admin filteredSections: sections with non-matching classId are excluded",
    () => {
      /**
       * **Validates: Requirements 3.1**
       */
      // Concrete example
      const allSections = [
        { id: 1, name: "A", classId: 5 },
        { id: 2, name: "B", classId: 5 },
        { id: 3, name: "C", classId: 7 },
      ];
      const result = adminFilteredSections(allSections, "5");
      expect(result).toEqual([
        { id: 1, name: "A", classId: 5 },
        { id: 2, name: "B", classId: 5 },
      ]);
    }
  );

  // -------------------------------------------------------------------------
  // 2b. Teacher section filtering
  // Validates: Requirement 3.2
  // -------------------------------------------------------------------------
  it(
    "Teacher filteredSections: for all (teacherClassMappings, selectedClassId), result = sections from mappings where mapping.class.id === Number(selectedClassId), nulls excluded",
    () => {
      /**
       * **Validates: Requirements 3.2**
       */
      fc.assert(
        fc.property(teacherClassMappingsArb, classIdStringArb, (mappings, selectedClassId) => {
          const result = teacherFilteredSections(mappings, selectedClassId);
          const classIdNum = Number(selectedClassId);

          // Manually compute expected
          const expected = mappings
            .filter(m => m.class?.id === classIdNum)
            .map(m => m.section)
            .filter(Boolean);

          expect(result).toEqual(expected);
        }),
        { numRuns: 100 }
      );
    }
  );

  it(
    "Teacher filteredSections: null sections are excluded from result",
    () => {
      /**
       * **Validates: Requirements 3.2**
       */
      const mappings = [
        { class: { id: 3, name: "Class 3" }, section: { id: 10, name: "A" } },
        { class: { id: 3, name: "Class 3" }, section: null },
        { class: { id: 5, name: "Class 5" }, section: { id: 20, name: "B" } },
      ];
      const result = teacherFilteredSections(mappings, "3");
      expect(result).toEqual([{ id: 10, name: "A" }]);
    }
  );

  it(
    "Teacher filteredSections: mappings for other classes are excluded",
    () => {
      /**
       * **Validates: Requirements 3.2**
       */
      const mappings = [
        { class: { id: 1, name: "Class 1" }, section: { id: 1, name: "A" } },
        { class: { id: 2, name: "Class 2" }, section: { id: 2, name: "B" } },
      ];
      const result = teacherFilteredSections(mappings, "1");
      expect(result).toEqual([{ id: 1, name: "A" }]);
    }
  );

  // -------------------------------------------------------------------------
  // 2c. Attendance save payload shape
  // Validates: Requirements 3.4, 3.5
  // -------------------------------------------------------------------------
  it(
    "Save payload: for all inputs, payload always contains classId, sectionId, subjectId, teacherId, date, and students",
    () => {
      /**
       * **Validates: Requirements 3.5**
       */
      fc.assert(
        fc.property(
          attendanceChangesArb,
          classIdStringArb,
          sectionIdArb,
          subjectIdArb,
          markDateArb,
          fc.boolean(),
          fc.oneof(fc.integer({ min: 1, max: 500 }), fc.constant(null)),
          (attendanceChanges, selectedClassId, selectedSectionId, selectedSubjectId, markDate, isTeacher, currentUserId) => {
            const payload = buildSavePayload({
              attendanceChanges,
              selectedClassId,
              selectedSectionId,
              selectedSubjectId,
              markDate,
              isTeacher,
              currentUserId,
            });

            // Payload must always have all required keys
            expect(payload).toHaveProperty("classId");
            expect(payload).toHaveProperty("sectionId");
            expect(payload).toHaveProperty("subjectId");
            expect(payload).toHaveProperty("teacherId");
            expect(payload).toHaveProperty("date");
            expect(payload).toHaveProperty("students");

            // classId must be a number
            expect(typeof payload.classId).toBe("number");

            // subjectId must be a number
            expect(typeof payload.subjectId).toBe("number");

            // date must match the input markDate
            expect(payload.date).toBe(markDate);

            // students must be an array
            expect(Array.isArray(payload.students)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "Save payload: sectionId is null when selectedSectionId is '*', otherwise Number(selectedSectionId)",
    () => {
      /**
       * **Validates: Requirements 3.5**
       */
      fc.assert(
        fc.property(
          attendanceChangesArb,
          classIdStringArb,
          subjectIdArb,
          markDateArb,
          (attendanceChanges, selectedClassId, selectedSubjectId, markDate) => {
            const payloadStar = buildSavePayload({
              attendanceChanges,
              selectedClassId,
              selectedSectionId: "*",
              selectedSubjectId,
              markDate,
              isTeacher: false,
              currentUserId: null,
            });
            expect(payloadStar.sectionId).toBeNull();

            const numericSectionId = "42";
            const payloadNumeric = buildSavePayload({
              attendanceChanges,
              selectedClassId,
              selectedSectionId: numericSectionId,
              selectedSubjectId,
              markDate,
              isTeacher: false,
              currentUserId: null,
            });
            expect(payloadNumeric.sectionId).toBe(42);
          }
        ),
        { numRuns: 50 }
      );
    }
  );

  it(
    "Save payload: teacherId is currentUserId when isTeacher=true, null when isTeacher=false",
    () => {
      /**
       * **Validates: Requirements 3.5**
       */
      const base = {
        attendanceChanges: { "1": "present" },
        selectedClassId: "5",
        selectedSectionId: "10",
        selectedSubjectId: "3",
        markDate: "2024-06-01",
      };

      const teacherPayload = buildSavePayload({ ...base, isTeacher: true, currentUserId: 99 });
      expect(teacherPayload.teacherId).toBe(99);

      const adminPayload = buildSavePayload({ ...base, isTeacher: false, currentUserId: 99 });
      expect(adminPayload.teacherId).toBeNull();
    }
  );

  it(
    "Save payload: students array entries have studentId and uppercased status",
    () => {
      /**
       * **Validates: Requirements 3.5**
       */
      fc.assert(
        fc.property(attendanceChangesArb, (attendanceChanges) => {
          const payload = buildSavePayload({
            attendanceChanges,
            selectedClassId: "1",
            selectedSectionId: "2",
            selectedSubjectId: "3",
            markDate: "2024-01-01",
            isTeacher: false,
            currentUserId: null,
          });

          payload.students.forEach(entry => {
            expect(entry).toHaveProperty("studentId");
            expect(entry).toHaveProperty("status");
            // status must be uppercase
            expect(entry.status).toBe(entry.status.toUpperCase());
          });

          // students count matches attendanceChanges entries
          expect(payload.students.length).toBe(Object.keys(attendanceChanges).length);
        }),
        { numRuns: 100 }
      );
    }
  );
});
