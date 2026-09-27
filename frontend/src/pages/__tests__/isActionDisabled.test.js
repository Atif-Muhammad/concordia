/**
 * Property-based tests for `isActionDisabled`
 *
 * Feature: staff-attendance-undo-confirmation, Property 1: button disable logic is future-date-only
 *
 * Property 1: Button disable logic is future-date-only
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { isActionDisabled } from "../../lib/dateUtils.js";

describe("Property 1: Button disable logic is future-date-only", () => {
  it("returns false for any date from 2000-01-01 to today (inclusive), including weekends", () => {
    // Feature: staff-attendance-undo-confirmation, Property 1: button disable logic is future-date-only
    // Use start-of-today as max to avoid timezone edge cases where new Date() can
    // be slightly ahead of the local midnight boundary used inside isActionDisabled.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2000, 0, 1), max: startOfToday }),
        (date) => isActionDisabled(date) === false
      ),
      { numRuns: 20 }
    );
  });

  it("returns true for any date strictly after today (tomorrow onwards)", () => {
    // Feature: staff-attendance-undo-confirmation, Property 1: button disable logic is future-date-only
    const tomorrow = new Date(Date.now() + 86400000);
    const farFuture = new Date(2100, 0, 1);
    fc.assert(
      fc.property(
        fc.date({ min: tomorrow, max: farFuture }).filter((d) => !isNaN(d.getTime())),
        (date) => isActionDisabled(date) === true
      ),
      { numRuns: 20 }
    );
  });
});
