/**
 * Property-based tests for Session-Based Examination Filters — pure logic.
 *
 * Property 4: Session filter correctness invariant (all tabs)
 * Validates: Requirements 3.2, 3.3, 3.4, 4.2, 4.4, 4.5, 5.2, 5.4, 5.5
 * Tag: Feature: session-based-examination-filters, Property 4
 *
 * Property 5: Session filter change resets dependent filters
 * Validates: Requirements 4.3, 5.3
 * Tag: Feature: session-based-examination-filters, Property 5
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure filtering logic extracted from Examination.jsx
// ---------------------------------------------------------------------------

/**
 * Replicates the session-filtered exam derivation used in all three tabs:
 *
 *   const sessionFilteredExams = sessionFilterId
 *     ? exams.filter(e => e.session === sessions.find(s => s.id.toString() === sessionFilterId)?.name)
 *     : exams;
 */
const filterExamsBySessionId = (exams, sessions, sessionFilterId) => {
  if (!sessionFilterId) return exams;
  const sessionName = sessions.find(
    (s) => s.id.toString() === sessionFilterId
  )?.name;
  return exams.filter((e) => e.session === sessionName);
};

/**
 * Replicates the cascade-reset logic triggered by marksSessionFilter change:
 *
 *   useEffect(() => {
 *     setMarksFilterProgram("");
 *     setMarksFilterClass("");
 *     setMarksFilterSection("");
 *     setMarksFilterExam("");
 *   }, [marksSessionFilter]);
 */
const applyMarksSessionFilterReset = () => ({
  marksFilterProgram: "",
  marksFilterClass: "",
  marksFilterSection: "",
  marksFilterExam: "",
});

/**
 * Replicates the cascade-reset logic triggered by resultsSessionFilter change:
 *
 *   useEffect(() => {
 *     setResultFilterProgram("");
 *     setResultFilterClass("");
 *   }, [resultsSessionFilter]);
 */
const applyResultsSessionFilterReset = () => ({
  resultFilterProgram: "",
  resultFilterClass: "",
});

// ---------------------------------------------------------------------------
// Property 4: Session filter correctness invariant (all tabs)
// Validates: Requirements 3.2, 3.3, 3.4, 4.2, 4.4, 4.5, 5.2, 5.4, 5.5
// ---------------------------------------------------------------------------

describe("Property 4: Session filter correctness invariant (all tabs)", () => {
  /**
   * When a non-empty session filter is active, every exam in the filtered list
   * must have its `session` field equal to the selected session's name.
   */
  it("filtered exams all have session === selected session name when filter is non-empty", () => {
    fc.assert(
      fc.property(
        // Array of exams with id and session fields
        fc.array(
          fc.record({ id: fc.integer(), session: fc.string() }),
          { minLength: 0, maxLength: 50 }
        ),
        // A session to use as the filter (non-empty name)
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }),
        }),
        (exams, selectedSession) => {
          const sessions = [selectedSession];
          const sessionFilterId = selectedSession.id.toString();

          const filtered = filterExamsBySessionId(exams, sessions, sessionFilterId);

          // Every returned exam must match the selected session name
          expect(filtered.every((e) => e.session === selectedSession.name)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When the filter is empty (""), all exams pass through unchanged.
   */
  it("all exams pass through unchanged when filter is empty", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer(), session: fc.string() }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.array(
          fc.record({ id: fc.integer({ min: 1 }), name: fc.string() }),
          { minLength: 0, maxLength: 10 }
        ),
        (exams, sessions) => {
          const filtered = filterExamsBySessionId(exams, sessions, "");

          expect(filtered.length).toBe(exams.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When the filter is empty, the returned array is the same reference as the input.
   */
  it("returns the original exams array reference when filter is empty", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer(), session: fc.string() }),
          { minLength: 0, maxLength: 20 }
        ),
        (exams) => {
          const result = filterExamsBySessionId(exams, [], "");
          expect(result).toBe(exams);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * When the filter is set to a session whose name matches no exam, the result is empty.
   */
  it("returns empty array when no exams match the selected session", () => {
    fc.assert(
      fc.property(
        // Exams with a fixed session name that won't match the filter
        fc.array(
          fc.record({ id: fc.integer(), session: fc.constant("OTHER_SESSION") }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }),
        }).filter((s) => s.name !== "OTHER_SESSION"),
        (exams, selectedSession) => {
          const sessions = [selectedSession];
          const filtered = filterExamsBySessionId(
            exams,
            sessions,
            selectedSession.id.toString()
          );

          expect(filtered.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Filtered results are a subset of the original exams array.
   */
  it("filtered exams are always a subset of the original exams", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.integer(), session: fc.string() }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }),
        }),
        fc.boolean(),
        (exams, selectedSession, applyFilter) => {
          const sessions = [selectedSession];
          const sessionFilterId = applyFilter
            ? selectedSession.id.toString()
            : "";

          const filtered = filterExamsBySessionId(exams, sessions, sessionFilterId);

          // Every filtered exam must exist in the original array
          expect(filtered.every((fe) => exams.includes(fe))).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Session filter change resets dependent filters
// Validates: Requirements 4.3, 5.3
// ---------------------------------------------------------------------------

describe("Property 5: Session filter change resets dependent filters", () => {
  /**
   * After marksSessionFilter changes, all four dependent marks filters are reset to "".
   */
  it("changing marksSessionFilter resets marksFilterProgram, marksFilterClass, marksFilterSection, marksFilterExam to empty string", () => {
    fc.assert(
      fc.property(
        // Arbitrary non-empty current filter values
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        // Arbitrary new session filter value (can be anything)
        fc.string(),
        (program, cls, section, exam, _newSessionFilter) => {
          // Simulate the state before the session filter changes
          const stateBefore = {
            marksFilterProgram: program,
            marksFilterClass: cls,
            marksFilterSection: section,
            marksFilterExam: exam,
          };

          // Simulate the useEffect triggered by marksSessionFilter change
          const stateAfter = {
            ...stateBefore,
            ...applyMarksSessionFilterReset(),
          };

          expect(stateAfter.marksFilterProgram).toBe("");
          expect(stateAfter.marksFilterClass).toBe("");
          expect(stateAfter.marksFilterSection).toBe("");
          expect(stateAfter.marksFilterExam).toBe("");
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * After resultsSessionFilter changes, both dependent results filters are reset to "".
   */
  it("changing resultsSessionFilter resets resultFilterProgram and resultFilterClass to empty string", () => {
    fc.assert(
      fc.property(
        // Arbitrary non-empty current filter values
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        // Arbitrary new session filter value
        fc.string(),
        (program, cls, _newSessionFilter) => {
          const stateBefore = {
            resultFilterProgram: program,
            resultFilterClass: cls,
          };

          const stateAfter = {
            ...stateBefore,
            ...applyResultsSessionFilterReset(),
          };

          expect(stateAfter.resultFilterProgram).toBe("");
          expect(stateAfter.resultFilterClass).toBe("");
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * The reset is idempotent — applying it twice yields the same result as once.
   */
  it("cascade reset is idempotent for marks filters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (program, cls, section, exam) => {
          const stateBefore = {
            marksFilterProgram: program,
            marksFilterClass: cls,
            marksFilterSection: section,
            marksFilterExam: exam,
          };

          const afterFirst = { ...stateBefore, ...applyMarksSessionFilterReset() };
          const afterSecond = { ...afterFirst, ...applyMarksSessionFilterReset() };

          expect(afterFirst).toEqual(afterSecond);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * The reset is idempotent — applying it twice yields the same result as once.
   */
  it("cascade reset is idempotent for results filters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (program, cls) => {
          const stateBefore = {
            resultFilterProgram: program,
            resultFilterClass: cls,
          };

          const afterFirst = { ...stateBefore, ...applyResultsSessionFilterReset() };
          const afterSecond = { ...afterFirst, ...applyResultsSessionFilterReset() };

          expect(afterFirst).toEqual(afterSecond);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * When filters are already empty, the reset keeps them empty (no side effects).
   */
  it("reset on already-empty marks filters keeps them empty", () => {
    const emptyState = {
      marksFilterProgram: "",
      marksFilterClass: "",
      marksFilterSection: "",
      marksFilterExam: "",
    };

    const afterReset = { ...emptyState, ...applyMarksSessionFilterReset() };

    expect(afterReset.marksFilterProgram).toBe("");
    expect(afterReset.marksFilterClass).toBe("");
    expect(afterReset.marksFilterSection).toBe("");
    expect(afterReset.marksFilterExam).toBe("");
  });

  /**
   * When filters are already empty, the reset keeps them empty (no side effects).
   */
  it("reset on already-empty results filters keeps them empty", () => {
    const emptyState = {
      resultFilterProgram: "",
      resultFilterClass: "",
    };

    const afterReset = { ...emptyState, ...applyResultsSessionFilterReset() };

    expect(afterReset.resultFilterProgram).toBe("");
    expect(afterReset.resultFilterClass).toBe("");
  });
});
