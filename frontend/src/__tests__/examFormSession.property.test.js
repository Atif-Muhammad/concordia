/**
 * Property-based tests for Session-Based Examination Filters — Exam Form session logic.
 *
 * Property 2: Session selection stores both id and name
 * Validates: Requirements 2.2, 2.3
 * Tag: Feature: session-based-examination-filters, Property 2
 *
 * Property 3: Edit form pre-selects the correct session
 * Validates: Requirements 2.4
 * Tag: Feature: session-based-examination-filters, Property 3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure logic extracted from Examination.jsx
// ---------------------------------------------------------------------------

/**
 * Replicates the onValueChange handler for the Session_Dropdown in Exam_Form:
 *
 *   const selected = sessions.find(s => s.id.toString() === value);
 *   setExamForm(prev => ({
 *     ...prev,
 *     sessionId: value,
 *     session: selected?.name || "",
 *   }));
 */
const onSessionValueChange = (value, sessions) => {
  const selected = sessions.find((s) => s.id.toString() === value);
  return { sessionId: value, session: selected?.name || "" };
};

/**
 * Replicates the sessionId derivation inside openEditExam:
 *
 *   const sessionId = exam.sessionId
 *     ? exam.sessionId.toString()
 *     : (sessions.find(s => s.name === exam.session)?.id?.toString() || "");
 */
const deriveSessionId = (exam, sessions) => {
  return exam.sessionId
    ? exam.sessionId.toString()
    : (sessions.find((s) => s.name === exam.session)?.id?.toString() || "");
};

// ---------------------------------------------------------------------------
// Property 2: Session selection stores both id and name
// Validates: Requirements 2.2, 2.3
// ---------------------------------------------------------------------------

describe("Property 2: Session selection stores both id and name", () => {
  /**
   * For any AcademicSession selected in the Exam_Form, the resulting examForm
   * state should have sessionId === session.id (as string) and session === session.name.
   */
  it("selecting a session sets sessionId to session.id.toString() and session to session.name", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }),
        }),
        (session) => {
          const sessions = [session];
          const value = session.id.toString();

          const result = onSessionValueChange(value, sessions);

          expect(result.sessionId).toBe(session.id.toString());
          expect(result.session).toBe(session.name);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When the selected value matches a session in the list, session name is never empty
   * (assuming the session has a non-empty name).
   */
  it("session name is non-empty when a matching session with non-empty name is selected", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }),
        }),
        (session) => {
          const sessions = [session];
          const value = session.id.toString();

          const result = onSessionValueChange(value, sessions);

          expect(result.session).not.toBe("");
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When the selected value does not match any session in the list,
   * session falls back to empty string.
   */
  it("session falls back to empty string when no matching session is found", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        // A value that won't match any session id in the list
        fc.integer({ min: 10001 }).map((n) => n.toString()),
        (sessions, value) => {
          const result = onSessionValueChange(value, sessions);

          expect(result.sessionId).toBe(value);
          expect(result.session).toBe("");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * The sessionId in the result always equals the value passed in.
   */
  it("sessionId in result always equals the value argument", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.string({ minLength: 1 }),
        (sessions, value) => {
          const result = onSessionValueChange(value, sessions);

          expect(result.sessionId).toBe(value);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Selecting from a list of multiple sessions always picks the correct one
   * (the one whose id matches the value).
   */
  it("correct session is picked from a list of multiple sessions", () => {
    fc.assert(
      fc.property(
        // Generate a list of sessions with unique ids using uniqueArray
        fc.uniqueArray(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 2, maxLength: 20, selector: (s) => s.id }
        ),
        fc.integer({ min: 0 }),
        (sessions, indexSeed) => {
          const idx = indexSeed % sessions.length;
          const targetSession = sessions[idx];
          const value = targetSession.id.toString();

          const result = onSessionValueChange(value, sessions);

          expect(result.sessionId).toBe(targetSession.id.toString());
          expect(result.session).toBe(targetSession.name);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Edit form pre-selects the correct session
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

describe("Property 3: Edit form pre-selects the correct session", () => {
  /**
   * For any existing exam that has a sessionId, opening the edit form should
   * result in the Session_Dropdown having a selected value equal to exam.sessionId.toString().
   */
  it("deriveSessionId returns exam.sessionId.toString() when exam has a sessionId", () => {
    fc.assert(
      fc.property(
        fc.record({
          sessionId: fc.integer({ min: 1 }),
          session: fc.string(),
        }),
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (exam, sessions) => {
          const result = deriveSessionId(exam, sessions);

          expect(result).toBe(exam.sessionId.toString());
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When exam.sessionId is present, the result is always a non-empty string.
   */
  it("result is always non-empty when exam has a sessionId", () => {
    fc.assert(
      fc.property(
        fc.record({
          sessionId: fc.integer({ min: 1 }),
          session: fc.string(),
        }),
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (exam, sessions) => {
          const result = deriveSessionId(exam, sessions);

          expect(result).not.toBe("");
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When exam.sessionId is falsy (0, null, undefined) but exam.session matches a
   * session name in the list, the result is that session's id as a string.
   */
  it("falls back to matching by session name when sessionId is falsy", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }),
        }),
        (session) => {
          const exam = { sessionId: 0, session: session.name };
          const sessions = [session];

          const result = deriveSessionId(exam, sessions);

          expect(result).toBe(session.id.toString());
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * When exam.sessionId is falsy and no session name matches, result is empty string.
   */
  it("returns empty string when sessionId is falsy and no session name matches", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        // Use a constant prefix that is extremely unlikely to appear in generated strings
        fc.string({ minLength: 1 }).map((s) => `__NOMATCH__${s}`),
        (sessions, unmatchedName) => {
          const exam = { sessionId: 0, session: unmatchedName };

          const result = deriveSessionId(exam, sessions);

          expect(result).toBe("");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * sessionId takes priority over session name lookup — even if a session with
   * a matching name exists, the sessionId is used when present.
   */
  it("sessionId takes priority over session name when both are present", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1, max: 500 }),
          name: fc.string({ minLength: 1 }),
        }),
        fc.integer({ min: 501, max: 1000 }),
        (session, differentSessionId) => {
          // exam.sessionId differs from session.id, but exam.session matches session.name
          const exam = {
            sessionId: differentSessionId,
            session: session.name,
          };
          const sessions = [session];

          const result = deriveSessionId(exam, sessions);

          // Should use sessionId, not the name-matched session's id
          expect(result).toBe(differentSessionId.toString());
        }
      ),
      { numRuns: 200 }
    );
  });
});
