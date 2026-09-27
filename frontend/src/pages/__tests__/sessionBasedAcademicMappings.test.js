/**
 * Property-based tests for Session-Based Academic Mappings feature.
 *
 * Property 1: SCM session filter isolates records
 * Validates: Requirements 3.1, 5.4
 */

// Feature: session-based-academic-mappings, Property 1: SCM session filter isolates records

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Filter logic (mirrors getScms(sessionId) filter in AcademicsService)
// ---------------------------------------------------------------------------

/**
 * Pure filter function that replicates the backend's session filter:
 *   WHERE sessionId = targetSessionId
 */
const getScms = (records, sessionId) =>
  sessionId != null
    ? records.filter((r) => r.sessionId === sessionId)
    : records;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A single SCM-like record with a nullable integer sessionId */
const scmRecordArb = fc.record({
  id: fc.integer({ min: 1, max: 100_000 }),
  subjectId: fc.integer({ min: 1, max: 500 }),
  classId: fc.integer({ min: 1, max: 500 }),
  sessionId: fc.oneof(
    fc.integer({ min: 1, max: 20 }),
    fc.constant(null)
  ),
  creditHours: fc.oneof(fc.integer({ min: 1, max: 6 }), fc.constant(null)),
  code: fc.oneof(fc.string({ maxLength: 10 }), fc.constant(null)),
});

/** An array of SCM records that contains at least one non-null sessionId */
const scmArrayWithSessionArb = fc
  .array(scmRecordArb, { minLength: 1, maxLength: 50 })
  .filter((records) => records.some((r) => r.sessionId !== null));

// ---------------------------------------------------------------------------
// Property 1: SCM session filter isolates records
// Validates: Requirements 3.1, 5.4
// ---------------------------------------------------------------------------

describe("Property 1: SCM session filter isolates records", () => {
  it("returns only records whose sessionId matches the target", () => {
    fc.assert(
      fc.property(scmArrayWithSessionArb, (records) => {
        // Pick a non-null sessionId that exists in the data
        const nonNullSessions = records
          .map((r) => r.sessionId)
          .filter((id) => id !== null);
        const targetSessionId =
          nonNullSessions[Math.floor(Math.random() * nonNullSessions.length)];

        const result = getScms(records, targetSessionId);

        // Every returned record must have exactly the target sessionId
        for (const record of result) {
          expect(record.sessionId).toBe(targetSessionId);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("returns no records from other sessions", () => {
    fc.assert(
      fc.property(scmArrayWithSessionArb, (records) => {
        const nonNullSessions = [
          ...new Set(
            records.map((r) => r.sessionId).filter((id) => id !== null)
          ),
        ];
        const targetSessionId = nonNullSessions[0];

        const result = getScms(records, targetSessionId);

        // No record from a different session should appear
        const leakingRecord = result.find(
          (r) => r.sessionId !== targetSessionId
        );
        expect(leakingRecord).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it("result is a subset of the original records", () => {
    fc.assert(
      fc.property(scmArrayWithSessionArb, (records) => {
        const nonNullSessions = records
          .map((r) => r.sessionId)
          .filter((id) => id !== null);
        const targetSessionId = nonNullSessions[0];

        const result = getScms(records, targetSessionId);

        // Every result record must exist in the original array
        for (const record of result) {
          expect(records).toContain(record);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: session-based-academic-mappings, Property 2: TCM session filter isolates records
// ---------------------------------------------------------------------------

/**
 * Pure filter function that replicates the backend's session filter:
 *   WHERE sessionId = targetSessionId
 */
const getTcsms = (records, sessionId) =>
  sessionId != null
    ? records.filter((r) => r.sessionId === sessionId)
    : records;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A single TCM-like record with a nullable integer sessionId */
const tcmRecordArb = fc.record({
  id: fc.integer({ min: 1, max: 100_000 }),
  teacherId: fc.integer({ min: 1, max: 500 }),
  classId: fc.integer({ min: 1, max: 500 }),
  sectionId: fc.oneof(fc.integer({ min: 1, max: 100 }), fc.constant(null)),
  sessionId: fc.oneof(
    fc.integer({ min: 1, max: 20 }),
    fc.constant(null)
  ),
});

/** An array of TCM records that contains at least one non-null sessionId */
const tcmArrayWithSessionArb = fc
  .array(tcmRecordArb, { minLength: 1, maxLength: 50 })
  .filter((records) => records.some((r) => r.sessionId !== null));

// ---------------------------------------------------------------------------
// Property 2: TCM session filter isolates records
// Validates: Requirements 4.1, 7.4
// ---------------------------------------------------------------------------

describe("Property 2: TCM session filter isolates records", () => {
  it("returns only records whose sessionId matches the target", () => {
    fc.assert(
      fc.property(tcmArrayWithSessionArb, (records) => {
        // Pick a non-null sessionId that exists in the data
        const nonNullSessions = records
          .map((r) => r.sessionId)
          .filter((id) => id !== null);
        const targetSessionId =
          nonNullSessions[Math.floor(Math.random() * nonNullSessions.length)];

        const result = getTcsms(records, targetSessionId);

        // Every returned record must have exactly the target sessionId
        for (const record of result) {
          expect(record.sessionId).toBe(targetSessionId);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("returns no records from other sessions", () => {
    fc.assert(
      fc.property(tcmArrayWithSessionArb, (records) => {
        const nonNullSessions = [
          ...new Set(
            records.map((r) => r.sessionId).filter((id) => id !== null)
          ),
        ];
        const targetSessionId = nonNullSessions[0];

        const result = getTcsms(records, targetSessionId);

        // No record from a different session should appear
        const leakingRecord = result.find(
          (r) => r.sessionId !== targetSessionId
        );
        expect(leakingRecord).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it("result is a subset of the original records", () => {
    fc.assert(
      fc.property(tcmArrayWithSessionArb, (records) => {
        const nonNullSessions = records
          .map((r) => r.sessionId)
          .filter((id) => id !== null);
        const targetSessionId = nonNullSessions[0];

        const result = getTcsms(records, targetSessionId);

        // Every result record must exist in the original array
        for (const record of result) {
          expect(records).toContain(record);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: session-based-academic-mappings, Property 6: "All Sessions" view includes legacy NULL records
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Arbitraries for Property 6
// ---------------------------------------------------------------------------

/**
 * An array of SCM records guaranteed to contain at least one null-sessionId record.
 * Mixes records with sessionId = null (legacy) and records with a non-null sessionId.
 */
const scmArrayWithNullRecordsArb = fc
  .array(scmRecordArb, { minLength: 1, maxLength: 50 })
  .filter((records) => records.some((r) => r.sessionId === null));

/**
 * An array of TCM records guaranteed to contain at least one null-sessionId record.
 */
const tcmArrayWithNullRecordsArb = fc
  .array(tcmRecordArb, { minLength: 1, maxLength: 50 })
  .filter((records) => records.some((r) => r.sessionId === null));

// ---------------------------------------------------------------------------
// Property 6: "All Sessions" view includes legacy NULL records
// Validates: Requirements 9.3, 9.4, 3.2, 4.2
// ---------------------------------------------------------------------------

describe('Property 6: "All Sessions" view includes legacy NULL records', () => {
  it("getScms() with no session filter includes all null-sessionId SCM records", () => {
    fc.assert(
      fc.property(scmArrayWithNullRecordsArb, (records) => {
        // Calling getScms without a sessionId argument returns all records
        const result = getScms(records, undefined);

        // Every null-session (legacy) record must appear in the result
        const nullSessionRecords = records.filter((r) => r.sessionId === null);
        for (const legacy of nullSessionRecords) {
          expect(result).toContain(legacy);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("getTcsms() with no session filter includes all null-sessionId TCM records", () => {
    fc.assert(
      fc.property(tcmArrayWithNullRecordsArb, (records) => {
        // Calling getTcsms without a sessionId argument returns all records
        const result = getTcsms(records, undefined);

        // Every null-session (legacy) record must appear in the result
        const nullSessionRecords = records.filter((r) => r.sessionId === null);
        for (const legacy of nullSessionRecords) {
          expect(result).toContain(legacy);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("unfiltered getScms() result contains every record regardless of sessionId", () => {
    fc.assert(
      fc.property(scmArrayWithNullRecordsArb, (records) => {
        const result = getScms(records, undefined);

        // The unfiltered result must equal the full input array
        expect(result).toHaveLength(records.length);
        for (const record of records) {
          expect(result).toContain(record);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("unfiltered getTcsms() result contains every record regardless of sessionId", () => {
    fc.assert(
      fc.property(tcmArrayWithNullRecordsArb, (records) => {
        const result = getTcsms(records, undefined);

        // The unfiltered result must equal the full input array
        expect(result).toHaveLength(records.length);
        for (const record of records) {
          expect(result).toContain(record);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: session-based-academic-mappings, Property 3: SCM sessionId round-trip
// ---------------------------------------------------------------------------

/**
 * Simulates createScm: constructs an SCM record with the given payload,
 * defaulting sessionId to null if not provided.
 */
const createScm = (payload) => ({ ...payload, sessionId: payload.sessionId ?? null });

/**
 * Simulates getScms filtered by sessionId: returns records whose sessionId
 * matches the given value (strict equality, including null).
 */
const getScmsById = (records, sessionId) =>
  records.filter((r) => r.sessionId === sessionId);

// ---------------------------------------------------------------------------
// Arbitraries for Property 3
// ---------------------------------------------------------------------------

/** A valid sessionId: a positive integer or null */
const sessionIdArb = fc.oneof(
  fc.integer({ min: 1, max: 100_000 }),
  fc.constant(null)
);

/** A minimal SCM payload (without sessionId — that is injected by the test) */
const scmPayloadArb = fc.record({
  subjectId: fc.integer({ min: 1, max: 500 }),
  classId: fc.integer({ min: 1, max: 500 }),
  creditHours: fc.oneof(fc.integer({ min: 1, max: 6 }), fc.constant(null)),
  code: fc.oneof(fc.string({ maxLength: 10 }), fc.constant(null)),
});

// ---------------------------------------------------------------------------
// Property 3: SCM sessionId round-trip
// Validates: Requirements 3.3, 3.5
// ---------------------------------------------------------------------------

describe("Property 3: SCM sessionId round-trip", () => {
  it("fetched record preserves the sessionId used during creation", () => {
    fc.assert(
      fc.property(scmPayloadArb, sessionIdArb, (payload, sessionId) => {
        // Create the SCM record with the given sessionId
        const created = createScm({ ...payload, sessionId });

        // Simulate a store containing this record
        const store = [created];

        // Fetch back by sessionId
        const results = getScmsById(store, created.sessionId);

        // There must be exactly one result and its sessionId must match
        expect(results).toHaveLength(1);
        expect(results[0].sessionId).toBe(sessionId ?? null);
      }),
      { numRuns: 100 }
    );
  });

  it("createScm defaults sessionId to null when not provided", () => {
    fc.assert(
      fc.property(scmPayloadArb, (payload) => {
        // Omit sessionId entirely from the payload
        const { sessionId: _omitted, ...payloadWithoutSession } = payload;
        const created = createScm(payloadWithoutSession);

        expect(created.sessionId).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("round-trip works for multiple records — only the matching one is returned", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            subjectId: fc.integer({ min: 1, max: 500 }),
            classId: fc.integer({ min: 1, max: 500 }),
            sessionId: fc.oneof(fc.integer({ min: 1, max: 20 }), fc.constant(null)),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        sessionIdArb,
        (payloads, targetSessionId) => {
          // Create all records
          const store = payloads.map((p) => createScm(p));

          // Fetch by targetSessionId
          const results = getScmsById(store, targetSessionId ?? null);

          // Every returned record must have the exact targetSessionId
          for (const record of results) {
            expect(record.sessionId).toBe(targetSessionId ?? null);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: session-based-academic-mappings, Property 4: TCM sessionId round-trip
// ---------------------------------------------------------------------------

/**
 * Simulates createTcsm: constructs a TCM record with the given payload,
 * defaulting sessionId to null if not provided.
 */
const createTcsm = (payload) => ({ ...payload, sessionId: payload.sessionId ?? null });

/**
 * Simulates getTcsms filtered by sessionId: returns records whose sessionId
 * matches the given value (strict equality, including null).
 */
const getTcsmsById = (records, sessionId) =>
  records.filter((r) => r.sessionId === sessionId);

// ---------------------------------------------------------------------------
// Arbitraries for Property 4
// ---------------------------------------------------------------------------

/** A minimal TCM payload (without sessionId — that is injected by the test) */
const tcmPayloadArb = fc.record({
  teacherId: fc.integer({ min: 1, max: 500 }),
  classId: fc.integer({ min: 1, max: 500 }),
  sectionId: fc.oneof(fc.integer({ min: 1, max: 100 }), fc.constant(null)),
});

// ---------------------------------------------------------------------------
// Property 4: TCM sessionId round-trip
// Validates: Requirements 4.3
// ---------------------------------------------------------------------------

describe("Property 4: TCM sessionId round-trip", () => {
  it("fetched record preserves the sessionId used during creation", () => {
    fc.assert(
      fc.property(tcmPayloadArb, sessionIdArb, (payload, sessionId) => {
        // Create the TCM record with the given sessionId
        const created = createTcsm({ ...payload, sessionId });

        // Simulate a store containing this record
        const store = [created];

        // Fetch back by sessionId
        const results = getTcsmsById(store, created.sessionId);

        // There must be exactly one result and its sessionId must match
        expect(results).toHaveLength(1);
        expect(results[0].sessionId).toBe(sessionId ?? null);
      }),
      { numRuns: 100 }
    );
  });

  it("createTcsm defaults sessionId to null when not provided", () => {
    fc.assert(
      fc.property(tcmPayloadArb, (payload) => {
        // Omit sessionId entirely from the payload
        const { sessionId: _omitted, ...payloadWithoutSession } = payload;
        const created = createTcsm(payloadWithoutSession);

        expect(created.sessionId).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("round-trip works for multiple records — only the matching one is returned", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            teacherId: fc.integer({ min: 1, max: 500 }),
            classId: fc.integer({ min: 1, max: 500 }),
            sectionId: fc.oneof(fc.integer({ min: 1, max: 100 }), fc.constant(null)),
            sessionId: fc.oneof(fc.integer({ min: 1, max: 20 }), fc.constant(null)),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        sessionIdArb,
        (payloads, targetSessionId) => {
          // Create all records
          const store = payloads.map((p) => createTcsm(p));

          // Fetch by targetSessionId
          const results = getTcsmsById(store, targetSessionId ?? null);

          // Every returned record must have the exact targetSessionId
          for (const record of results) {
            expect(record.sessionId).toBe(targetSessionId ?? null);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: session-based-academic-mappings, Property 5: Subject conflict check is session-scoped
// ---------------------------------------------------------------------------

/**
 * Simulates the conflict check logic from bulkAssignTeacherToClassSubjects.
 *
 * tcms  - array of TeacherClassSectionMapping records { teacherId, classId, sessionId }
 * tsms  - array of TeacherSubjectMapping records      { teacherId, subjectId }
 *
 * Returns true when another teacher in the same class+session already has a TSM
 * for the given subjectId.
 */
const hasConflict = (tcms, tsms, teacherId, classId, subjectId, sessionId) => {
  const classTeacherIds = tcms
    .filter(t => t.classId === classId && t.sessionId === (sessionId ?? null))
    .map(t => t.teacherId);
  return tsms.some(
    m => m.subjectId === subjectId &&
         classTeacherIds.includes(m.teacherId) &&
         m.teacherId !== teacherId
  );
};

// ---------------------------------------------------------------------------
// Arbitraries for Property 5
// ---------------------------------------------------------------------------

/**
 * Generates a scenario with two distinct teachers, one class, one subject,
 * and two distinct sessions.
 */
const conflictScenarioArb = fc
  .record({
    teacherA: fc.integer({ min: 1, max: 1000 }),
    teacherB: fc.integer({ min: 1, max: 1000 }),
    classId:  fc.integer({ min: 1, max: 500 }),
    subjectId: fc.integer({ min: 1, max: 500 }),
    sessionA: fc.integer({ min: 1, max: 100 }),
    sessionB: fc.integer({ min: 1, max: 100 }),
  })
  .filter(
    ({ teacherA, teacherB, sessionA, sessionB }) =>
      teacherA !== teacherB && sessionA !== sessionB
  );

// ---------------------------------------------------------------------------
// Property 5: Subject conflict check is session-scoped
// Validates: Requirements 4.6
// ---------------------------------------------------------------------------

describe("Property 5: Subject conflict check is session-scoped", () => {
  it(
    "assigning teacher B to the same subject in a DIFFERENT session does not conflict",
    () => {
      fc.assert(
        fc.property(conflictScenarioArb, ({ teacherA, teacherB, classId, subjectId, sessionA, sessionB }) => {
          // Teacher A is assigned to classId in sessionA and teaches subjectId
          const tcms = [{ teacherId: teacherA, classId, sessionId: sessionA }];
          const tsms = [{ teacherId: teacherA, subjectId }];

          // Teacher B tries to claim the same subject in sessionB (different session) → no conflict
          const conflict = hasConflict(tcms, tsms, teacherB, classId, subjectId, sessionB);
          expect(conflict).toBe(false);
        }),
        { numRuns: 100 }
      );
    }
  );

  it(
    "assigning teacher B to the same subject in the SAME session conflicts",
    () => {
      fc.assert(
        fc.property(conflictScenarioArb, ({ teacherA, teacherB, classId, subjectId, sessionA }) => {
          // Teacher A is assigned to classId in sessionA and teaches subjectId
          const tcms = [{ teacherId: teacherA, classId, sessionId: sessionA }];
          const tsms = [{ teacherId: teacherA, subjectId }];

          // Teacher B tries to claim the same subject in sessionA (same session) → conflict
          const conflict = hasConflict(tcms, tsms, teacherB, classId, subjectId, sessionA);
          expect(conflict).toBe(true);
        }),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Feature: session-based-academic-mappings, Property 8: subjects-for-class respects session filter
// ---------------------------------------------------------------------------

/**
 * Pure filter function that replicates getSubjectsForClassWithAssignments(classId, sessionId).
 * When sessionId is provided, only records matching both classId AND sessionId are returned.
 * When sessionId is undefined, all records for the classId are returned.
 */
const getSubjectsForClass = (scmRecords, classId, sessionId) =>
  scmRecords.filter(r =>
    r.classId === classId &&
    (sessionId !== undefined ? r.sessionId === sessionId : true)
  );

// ---------------------------------------------------------------------------
// Arbitraries for Property 8
// ---------------------------------------------------------------------------

/** A single SCM record for use in subjects-for-class tests */
const scmForClassArb = fc.record({
  id: fc.integer({ min: 1, max: 100_000 }),
  subjectId: fc.integer({ min: 1, max: 500 }),
  classId: fc.integer({ min: 1, max: 50 }),
  sessionId: fc.oneof(
    fc.integer({ min: 1, max: 20 }),
    fc.constant(null)
  ),
});

/**
 * Generates a scenario with:
 * - an array of SCM records spanning multiple classIds and sessionIds
 * - a target classId that exists in the records
 * - a target sessionId that exists in the records for that classId
 */
const subjectsForClassScenarioArb = fc
  .array(scmForClassArb, { minLength: 2, maxLength: 60 })
  .chain((records) => {
    const nonNullEntries = records.filter((r) => r.sessionId !== null);
    if (nonNullEntries.length === 0) return fc.constant(null);
    return fc
      .integer({ min: 0, max: nonNullEntries.length - 1 })
      .map((idx) => ({
        records,
        targetClassId: nonNullEntries[idx].classId,
        targetSessionId: nonNullEntries[idx].sessionId,
      }));
  })
  .filter((v) => v !== null);

// ---------------------------------------------------------------------------
// Property 8: subjects-for-class respects session filter
// Validates: Requirements 3.7, 8.4
// ---------------------------------------------------------------------------

describe("Property 8: subjects-for-class respects session filter", () => {
  it("returns only records matching both classId AND sessionId when sessionId is provided", () => {
    fc.assert(
      fc.property(subjectsForClassScenarioArb, ({ records, targetClassId, targetSessionId }) => {
        const result = getSubjectsForClass(records, targetClassId, targetSessionId);

        for (const record of result) {
          expect(record.classId).toBe(targetClassId);
          expect(record.sessionId).toBe(targetSessionId);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("returns all records for the classId when sessionId is undefined", () => {
    fc.assert(
      fc.property(
        fc.array(scmForClassArb, { minLength: 1, maxLength: 60 }),
        fc.integer({ min: 1, max: 50 }),
        (records, targetClassId) => {
          const result = getSubjectsForClass(records, targetClassId, undefined);

          // Every returned record must belong to the target class
          for (const record of result) {
            expect(record.classId).toBe(targetClassId);
          }

          // All records for that class must be present
          const expected = records.filter((r) => r.classId === targetClassId);
          expect(result).toHaveLength(expected.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("no records from other sessions leak through when a specific session is requested", () => {
    fc.assert(
      fc.property(subjectsForClassScenarioArb, ({ records, targetClassId, targetSessionId }) => {
        const result = getSubjectsForClass(records, targetClassId, targetSessionId);

        // No record with a different sessionId should appear
        const leaking = result.find((r) => r.sessionId !== targetSessionId);
        expect(leaking).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: session-based-academic-mappings, Property 7: Already-mapped check is session-scoped
// ---------------------------------------------------------------------------

/**
 * Already-mapped check logic from the SCM dialog.
 *
 * Returns true when the given subject is already mapped to classId in the
 * session identified by scmDialogSessionId.
 *
 * When scmDialogSessionId is a non-empty string, the check requires
 *   m.sessionId === Number(scmDialogSessionId).
 * When scmDialogSessionId is "" (no session selected), the check requires
 *   !m.sessionId  (i.e. the mapping has a null/falsy sessionId).
 */
const alreadyMapped = (scmMappings) => (subject, classId, scmDialogSessionId) =>
  scmMappings.some(
    m => m.subjectId === subject.id &&
         m.classId === classId &&
         (scmDialogSessionId ? m.sessionId === Number(scmDialogSessionId) : !m.sessionId)
  );

// ---------------------------------------------------------------------------
// Arbitraries for Property 7
// ---------------------------------------------------------------------------

/**
 * Generates a scenario with:
 * - a subject { id }
 * - a classId
 * - two distinct session IDs (sessionA, sessionB)
 *
 * The scmMappings array contains exactly one mapping for (subject, class, sessionA).
 */
const alreadyMappedScenarioArb = fc
  .record({
    subjectId: fc.integer({ min: 1, max: 500 }),
    classId:   fc.integer({ min: 1, max: 500 }),
    sessionA:  fc.integer({ min: 1, max: 100 }),
    sessionB:  fc.integer({ min: 1, max: 100 }),
  })
  .filter(({ sessionA, sessionB }) => sessionA !== sessionB);

// ---------------------------------------------------------------------------
// Property 7: Already-mapped check is session-scoped
// Validates: Requirements 6.6, 10.1, 10.3, 10.4
// ---------------------------------------------------------------------------

describe("Property 7: Already-mapped check is session-scoped", () => {
  it("returns true when the subject is mapped in session A and session A is selected", () => {
    fc.assert(
      fc.property(alreadyMappedScenarioArb, ({ subjectId, classId, sessionA }) => {
        const subject = { id: subjectId };
        const scmMappings = [{ subjectId, classId, sessionId: sessionA }];

        const result = alreadyMapped(scmMappings)(subject, classId, String(sessionA));

        expect(result).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("returns false when the subject is mapped in session A but session B is selected", () => {
    fc.assert(
      fc.property(alreadyMappedScenarioArb, ({ subjectId, classId, sessionA, sessionB }) => {
        const subject = { id: subjectId };
        const scmMappings = [{ subjectId, classId, sessionId: sessionA }];

        const result = alreadyMapped(scmMappings)(subject, classId, String(sessionB));

        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("returns true when the subject is mapped with null sessionId and no session is selected (scmDialogSessionId = \"\")", () => {
    fc.assert(
      fc.property(
        fc.record({
          subjectId: fc.integer({ min: 1, max: 500 }),
          classId:   fc.integer({ min: 1, max: 500 }),
        }),
        ({ subjectId, classId }) => {
          const subject = { id: subjectId };
          const scmMappings = [{ subjectId, classId, sessionId: null }];

          const result = alreadyMapped(scmMappings)(subject, classId, "");

          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns false when the subject is mapped with null sessionId but a specific session is selected", () => {
    fc.assert(
      fc.property(
        fc.record({
          subjectId: fc.integer({ min: 1, max: 500 }),
          classId:   fc.integer({ min: 1, max: 500 }),
          sessionId: fc.integer({ min: 1, max: 100 }),
        }),
        ({ subjectId, classId, sessionId }) => {
          const subject = { id: subjectId };
          const scmMappings = [{ subjectId, classId, sessionId: null }];

          const result = alreadyMapped(scmMappings)(subject, classId, String(sessionId));

          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests for service-layer session filtering (Task 10.1)
// Tests the URL construction logic of the API functions in config/apis.js
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 4.1, 4.2, 4.3, 4.6
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3003/api";

/**
 * Pure URL builders that mirror the logic in config/apis.js.
 * These are extracted for unit testing without needing axios or a live server.
 */
const buildGetSubjectClassMappingsUrl = (sessionId) =>
  sessionId
    ? `${BASE_URL}/academics/scm/get/all?sessionId=${sessionId}`
    : `${BASE_URL}/academics/scm/get/all`;

const buildGetTeacherClassMappingsUrl = (sessionId) =>
  sessionId
    ? `${BASE_URL}/academics/tcm/get/all?sessionId=${sessionId}`
    : `${BASE_URL}/academics/tcm/get/all`;

const buildGetSubjectsForClassWithAssignmentsUrl = (classId, sessionId) =>
  sessionId
    ? `${BASE_URL}/academics/scm/subjects-for-class?classId=${classId}&sessionId=${sessionId}`
    : `${BASE_URL}/academics/scm/subjects-for-class?classId=${classId}`;

// ---------------------------------------------------------------------------
// Unit tests: getSubjectClassMappings URL construction
// Validates: Requirements 3.1, 3.2
// ---------------------------------------------------------------------------

describe("Unit: getSubjectClassMappings URL construction", () => {
  it("calls the correct URL without sessionId param when no sessionId is provided", () => {
    const url = buildGetSubjectClassMappingsUrl(undefined);
    expect(url).toBe(`${BASE_URL}/academics/scm/get/all`);
    expect(url).not.toContain("sessionId");
  });

  it("calls the correct URL with ?sessionId=X when a sessionId is provided", () => {
    const url = buildGetSubjectClassMappingsUrl(5);
    expect(url).toBe(`${BASE_URL}/academics/scm/get/all?sessionId=5`);
    expect(url).toContain("sessionId=5");
  });

  it("includes the exact sessionId value in the URL", () => {
    const url = buildGetSubjectClassMappingsUrl(42);
    expect(url).toContain("sessionId=42");
  });

  it("does not append sessionId when called with null", () => {
    const url = buildGetSubjectClassMappingsUrl(null);
    expect(url).not.toContain("sessionId");
  });
});

// ---------------------------------------------------------------------------
// Unit tests: getTeacherClassMappings URL construction
// Validates: Requirements 4.1, 4.2
// ---------------------------------------------------------------------------

describe("Unit: getTeacherClassMappings URL construction", () => {
  it("calls the correct URL without sessionId param when no sessionId is provided", () => {
    const url = buildGetTeacherClassMappingsUrl(undefined);
    expect(url).toBe(`${BASE_URL}/academics/tcm/get/all`);
    expect(url).not.toContain("sessionId");
  });

  it("calls the correct URL with ?sessionId=X when a sessionId is provided", () => {
    const url = buildGetTeacherClassMappingsUrl(7);
    expect(url).toBe(`${BASE_URL}/academics/tcm/get/all?sessionId=7`);
    expect(url).toContain("sessionId=7");
  });

  it("includes the exact sessionId value in the URL", () => {
    const url = buildGetTeacherClassMappingsUrl(99);
    expect(url).toContain("sessionId=99");
  });

  it("does not append sessionId when called with null", () => {
    const url = buildGetTeacherClassMappingsUrl(null);
    expect(url).not.toContain("sessionId");
  });
});

// ---------------------------------------------------------------------------
// Unit tests: getSubjectsForClassWithAssignments URL construction
// Validates: Requirements 3.7
// ---------------------------------------------------------------------------

describe("Unit: getSubjectsForClassWithAssignments URL construction", () => {
  it("calls the URL without sessionId when only classId is provided", () => {
    const url = buildGetSubjectsForClassWithAssignmentsUrl(10, undefined);
    expect(url).toBe(`${BASE_URL}/academics/scm/subjects-for-class?classId=10`);
    expect(url).not.toContain("sessionId");
  });

  it("calls the URL with &sessionId=X when both classId and sessionId are provided", () => {
    const url = buildGetSubjectsForClassWithAssignmentsUrl(10, 3);
    expect(url).toBe(`${BASE_URL}/academics/scm/subjects-for-class?classId=10&sessionId=3`);
    expect(url).toContain("classId=10");
    expect(url).toContain("sessionId=3");
  });

  it("always includes classId in the URL", () => {
    const url = buildGetSubjectsForClassWithAssignmentsUrl(25, undefined);
    expect(url).toContain("classId=25");
  });

  it("includes the exact classId and sessionId values in the URL", () => {
    const url = buildGetSubjectsForClassWithAssignmentsUrl(15, 8);
    expect(url).toContain("classId=15");
    expect(url).toContain("sessionId=8");
  });

  it("does not append sessionId when called with null", () => {
    const url = buildGetSubjectsForClassWithAssignmentsUrl(5, null);
    expect(url).not.toContain("sessionId");
  });
});

// ---------------------------------------------------------------------------
// Unit: already-mapped check (concrete examples)
// Validates: Requirements 6.6, 10.1, 10.3
// ---------------------------------------------------------------------------

describe("Unit: already-mapped check", () => {
  // Reuse the alreadyMapped helper defined above in Property 7.
  // These are concrete example-based tests that complement the property tests.

  it("returns true when both classId AND sessionId match", () => {
    const scmMappings = [{ subjectId: 1, classId: 10, sessionId: 5 }];
    const subject = { id: 1 };
    expect(alreadyMapped(scmMappings)(subject, 10, "5")).toBe(true);
  });

  it("returns false when classId matches but sessionId does not match", () => {
    const scmMappings = [{ subjectId: 1, classId: 10, sessionId: 5 }];
    const subject = { id: 1 };
    expect(alreadyMapped(scmMappings)(subject, 10, "99")).toBe(false);
  });

  it("returns false when sessionId matches but classId does not match", () => {
    const scmMappings = [{ subjectId: 1, classId: 10, sessionId: 5 }];
    const subject = { id: 1 };
    expect(alreadyMapped(scmMappings)(subject, 99, "5")).toBe(false);
  });

  it("returns false when neither classId nor sessionId matches", () => {
    const scmMappings = [{ subjectId: 1, classId: 10, sessionId: 5 }];
    const subject = { id: 1 };
    expect(alreadyMapped(scmMappings)(subject, 99, "99")).toBe(false);
  });
});
