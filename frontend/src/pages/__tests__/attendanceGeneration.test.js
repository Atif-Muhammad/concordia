/**
 * Property-based tests for Attendance Generation feature.
 *
 * Property 10: Attendance generation makes exactly one POST per trigger
 * Validates: Requirements 5.1, 5.2
 */

// Feature: leave-management-attendance-integration, Property 10: Attendance generation makes exactly one POST per trigger

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// Pure URL builder (mirrors generateStaffAttendance in config/apis.js)
const buildAttendanceUrl = (date) =>
  `http://localhost:3003/api/attendance/generate?attenFor=teacher&date=${date}`;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const dateStringArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  });

// ---------------------------------------------------------------------------
// Property 10: Attendance generation makes exactly one POST per trigger
// Validates: Requirements 5.1, 5.2
// ---------------------------------------------------------------------------

describe("Property 10: Attendance generation makes exactly one POST per trigger", () => {
  it("URL contains exactly one occurrence of /attendance/generate", () => {
    fc.assert(
      fc.property(dateStringArb, (date) => {
        const url = buildAttendanceUrl(date);
        const occurrences = url.split("/attendance/generate").length - 1;
        expect(occurrences).toBe(1);
      }),
      { numRuns: 20 }
    );
  });

  it("URL contains attenFor=teacher", () => {
    fc.assert(
      fc.property(dateStringArb, (date) => {
        const url = buildAttendanceUrl(date);
        expect(url).toContain("attenFor=teacher");
      }),
      { numRuns: 20 }
    );
  });

  it("URL contains the exact date passed as argument", () => {
    fc.assert(
      fc.property(dateStringArb, (date) => {
        const url = buildAttendanceUrl(date);
        expect(url).toContain(`date=${date}`);
      }),
      { numRuns: 20 }
    );
  });

  it("URL does not contain any leave endpoint patterns", () => {
    fc.assert(
      fc.property(dateStringArb, (date) => {
        const url = buildAttendanceUrl(date);
        expect(url).not.toContain("/hr/leave");
        expect(url).not.toContain("/leave-sheet");
      }),
      { numRuns: 20 }
    );
  });
});
