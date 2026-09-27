/**
 * Property-based tests for Session-Based Examination Filters — Bulk Marks Entry dialog.
 *
 * Property 6: Bulk Marks Entry dialog inherits active session filter
 * Validates: Requirements 6.1, 6.2
 * Tag: Feature: session-based-examination-filters, Property 6
 *
 * Property 7: Bulk Marks Entry dialog session label tracks selected exam
 * Validates: Requirements 6.3, 6.4
 * Tag: Feature: session-based-examination-filters, Property 7
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure logic extracted from Examination.jsx (as specified in the task)
// ---------------------------------------------------------------------------

/**
 * Replicates the exam filtering logic used in the Bulk Marks Entry dialog.
 * The dialog uses `marksSessionFilteredExams` which is derived as:
 *
 *   const marksSessionName = sessions.find(s => s.id.toString() === marksSessionFilter)?.name;
 *   const marksSessionFilteredExams = marksSessionFilter
 *     ? exams.filter(e => e.session === marksSessionName)
 *     : exams;
 */
const filterExamsForBulkDialog = (exams, sessions, marksSessionFilter) => {
  if (!marksSessionFilter) return exams;
  const sessionName = sessions.find(s => s.id.toString() === marksSessionFilter)?.name;
  return exams.filter(e => e.session === sessionName);
};

/**
 * Replicates the session label derivation for the selected exam in the dialog:
 *
 *   exams.find(e => e.id.toString() === bulkExamId)?.session || ""
 */
const getSessionLabelForBulkDialog = (exams, bulkExamId) => {
  return exams.find(e => e.id.toString() === bulkExamId)?.session || "";
};

// ---------------------------------------------------------------------------
// Property 6: Bulk Marks Entry dialog inherits active session filter
// Validates: Requirements 6.1, 6.2
// ---------------------------------------------------------------------------

describe("Property 6: Bulk Marks Entry dialog inherits active session filter", () => {
  /**
   * When marksSessionFilter is active, every exam in the filtered list must
   * have its `session` field equal to the selected session's name.
   */
  it("filtered exams all match the active session filter", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), session: fc.string() }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }),
        }),
        (exams, selectedSession) => {
          const sessions = [selectedSession];
          const marksSessionFilter = selectedSession.id.toString();

          const filtered = filterExamsForBulkDialog(exams, sessions, marksSessionFilter);

          expect(filtered.every(e => e.session === selectedSession.name)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When no session filter is active, all exams are available in the dialog.
   */
  it("all exams are available when no session filter is active", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), session: fc.string() }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), name: fc.string() }),
          { minLength: 0, maxLength: 10 }
        ),
        (exams, sessions) => {
          const filtered = filterExamsForBulkDialog(exams, sessions, "");

          expect(filtered.length).toBe(exams.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When no session filter is active, the returned array is the same reference.
   */
  it("returns the original exams array when no filter is active", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), session: fc.string() }),
          { minLength: 0, maxLength: 20 }
        ),
        (exams) => {
          const result = filterExamsForBulkDialog(exams, [], "");
          expect(result).toBe(exams);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Filtered results are always a subset of the original exams array.
   */
  it("filtered exams are always a subset of the original exams", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), session: fc.string() }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }),
        }),
        fc.boolean(),
        (exams, selectedSession, applyFilter) => {
          const sessions = [selectedSession];
          const marksSessionFilter = applyFilter ? selectedSession.id.toString() : "";

          const filtered = filterExamsForBulkDialog(exams, sessions, marksSessionFilter);

          expect(filtered.every(fe => exams.includes(fe))).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When the active session matches no exam, the dialog shows an empty list.
   */
  it("returns empty array when no exams match the active session filter", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), session: fc.constant("OTHER_SESSION") }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }),
        }).filter(s => s.name !== "OTHER_SESSION"),
        (exams, selectedSession) => {
          const sessions = [selectedSession];
          const filtered = filterExamsForBulkDialog(exams, sessions, selectedSession.id.toString());

          expect(filtered.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Null/undefined marksSessionFilter behaves the same as empty string — all exams pass through.
   */
  it("null or undefined filter returns all exams", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), session: fc.string() }),
          { minLength: 0, maxLength: 20 }
        ),
        (exams) => {
          expect(filterExamsForBulkDialog(exams, [], null).length).toBe(exams.length);
          expect(filterExamsForBulkDialog(exams, [], undefined).length).toBe(exams.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Bulk Marks Entry dialog session label tracks selected exam
// Validates: Requirements 6.3, 6.4
// ---------------------------------------------------------------------------

describe("Property 7: Bulk Marks Entry dialog session label tracks selected exam", () => {
  /**
   * For any exam selected in the dialog, the session label equals that exam's session field.
   */
  it("session label equals the selected exam's session field", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            id: fc.integer({ min: 1 }),
            session: fc.string({ minLength: 1 }),
          }),
          { selector: (e) => e.id, minLength: 1, maxLength: 30 }
        ),
        fc.integer({ min: 0 }),
        (exams, indexSeed) => {
          const selectedExam = exams[indexSeed % exams.length];
          const bulkExamId = selectedExam.id.toString();

          const label = getSessionLabelForBulkDialog(exams, bulkExamId);

          expect(label).toBe(selectedExam.session);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When no exam is selected (empty bulkExamId), the session label is an empty string.
   */
  it("session label is empty string when no exam is selected", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), session: fc.string() }),
          { minLength: 0, maxLength: 20 }
        ),
        (exams) => {
          expect(getSessionLabelForBulkDialog(exams, "")).toBe("");
          expect(getSessionLabelForBulkDialog(exams, undefined)).toBe("");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * When bulkExamId does not match any exam, the session label is an empty string.
   */
  it("session label is empty string when bulkExamId matches no exam", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer({ min: 1, max: 1000 }), session: fc.string() }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.integer({ min: 9999 }),
        (exams, nonExistentId) => {
          const label = getSessionLabelForBulkDialog(exams, nonExistentId.toString());
          expect(label).toBe("");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * The session label updates when bulkExamId changes to a different exam.
   */
  it("session label updates when a different exam is selected", () => {
    fc.assert(
      fc.property(
        // Two exams with distinct ids and distinct sessions
        fc.record({
          id: fc.integer({ min: 1, max: 500 }),
          session: fc.string({ minLength: 1 }),
        }),
        fc.record({
          id: fc.integer({ min: 501, max: 1000 }),
          session: fc.string({ minLength: 1 }),
        }).filter(b => b.session !== " "), // avoid whitespace-only edge cases
        (examA, examB) => {
          // Only test when the two exams have different sessions
          if (examA.session === examB.session) return;

          const exams = [examA, examB];

          const labelA = getSessionLabelForBulkDialog(exams, examA.id.toString());
          const labelB = getSessionLabelForBulkDialog(exams, examB.id.toString());

          expect(labelA).toBe(examA.session);
          expect(labelB).toBe(examB.session);
          expect(labelA).not.toBe(labelB);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * The session label is always a string (never undefined or null).
   */
  it("session label is always a string", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), session: fc.string() }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.oneof(
          fc.integer({ min: 1 }).map(n => n.toString()),
          fc.constant(""),
          fc.constant(undefined)
        ),
        (exams, bulkExamId) => {
          const label = getSessionLabelForBulkDialog(exams, bulkExamId);
          expect(typeof label).toBe("string");
        }
      ),
      { numRuns: 200 }
    );
  });
});
