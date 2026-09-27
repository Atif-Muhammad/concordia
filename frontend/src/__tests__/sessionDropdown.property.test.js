/**
 * Property-based tests for Session-Based Examination Filters — Session Dropdown rendering.
 *
 * Property 1: Session dropdown renders all fetched sessions
 * Validates: Requirements 1.4
 * Tag: Feature: session-based-examination-filters, Property 1
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure data-transformation logic for the Session_Dropdown
//
// The dropdown is built from a sessions array as follows:
//   1. A fixed "All Sessions" item with value ""
//   2. One item per session: { value: session.id.toString(), label: session.name }
// ---------------------------------------------------------------------------

/**
 * Replicates the data transformation that produces dropdown items from a
 * sessions array, mirroring the JSX in Examination.jsx:
 *
 *   <SelectItem value="">All Sessions</SelectItem>
 *   {sessions.map(s => (
 *     <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
 *   ))}
 */
const buildDropdownItems = (sessions) => [
  { value: "", label: "All Sessions" },
  ...sessions.map((s) => ({ value: s.id.toString(), label: s.name })),
];

// ---------------------------------------------------------------------------
// Property 1: Session dropdown renders all fetched sessions
// Validates: Requirements 1.4
// ---------------------------------------------------------------------------

describe("Property 1: Session dropdown renders all fetched sessions", () => {
  /**
   * For any array of AcademicSession records, the dropdown should contain
   * exactly sessions.length + 1 items (the extra one being "All Sessions").
   */
  it("dropdown contains exactly sessions.length + 1 items (including All Sessions)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (sessions) => {
          const items = buildDropdownItems(sessions);

          expect(items).toHaveLength(sessions.length + 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * The first item is always the "All Sessions" option with value "".
   */
  it("first item is always All Sessions with value empty string", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (sessions) => {
          const items = buildDropdownItems(sessions);

          expect(items[0]).toEqual({ value: "", label: "All Sessions" });
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Each session item carries the session id as its value (as a string).
   */
  it("each session item value equals session.id.toString()", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (sessions) => {
          const items = buildDropdownItems(sessions);
          // Skip the first "All Sessions" item
          const sessionItems = items.slice(1);

          sessionItems.forEach((item, idx) => {
            expect(item.value).toBe(sessions[idx].id.toString());
          });
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Each session item label equals the session name.
   */
  it("each session item label equals session.name", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (sessions) => {
          const items = buildDropdownItems(sessions);
          const sessionItems = items.slice(1);

          sessionItems.forEach((item, idx) => {
            expect(item.label).toBe(sessions[idx].name);
          });
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * For an empty sessions array, the dropdown contains only the "All Sessions" item.
   */
  it("empty sessions array produces exactly one item (All Sessions)", () => {
    const items = buildDropdownItems([]);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ value: "", label: "All Sessions" });
  });

  /**
   * The order of session items in the dropdown matches the order of the input array.
   */
  it("session items preserve the order of the input sessions array", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (sessions) => {
          const items = buildDropdownItems(sessions);
          const sessionItems = items.slice(1);

          for (let i = 0; i < sessions.length; i++) {
            expect(sessionItems[i].value).toBe(sessions[i].id.toString());
            expect(sessionItems[i].label).toBe(sessions[i].name);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
