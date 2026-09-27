/**
 * Property-based tests for inline validation error display
 *
 * Property 8: Inline errors appear below their field and clear on correction
 * Validates: Requirements 5.1, 5.2, 5.3
 *
 * Tests the `validateCurrentTab` pure function directly:
 * - Triggering validation on a tab with empty required fields returns error messages
 * - Filling each field results in an empty errors object (errors cleared)
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateCurrentTab } from "../../lib/staffValidation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Non-empty string that passes the trim check */
const nonEmptyStr = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

const dateStr = fc.constantFrom(
  "2020-01-15",
  "2021-06-01",
  "2022-03-20",
  "2023-09-10",
  "2024-12-31"
);

// ---------------------------------------------------------------------------
// Property 8: Inline errors appear below their field and clear on correction
// Validates: Requirements 5.1, 5.2, 5.3
// ---------------------------------------------------------------------------

describe("Property 8: Inline errors appear below their field and clear on correction", () => {
  it("Tab 1 (basic, create): errors appear for empty required fields and clear when filled", () => {
    const tab1Required = ["name", "email", "password"];

    fc.assert(
      fc.property(
        // Pick a non-empty subset of required fields to leave empty
        fc.subarray(tab1Required, { minLength: 1 }),
        (emptyFields) => {
          // Step 1: Build form with chosen fields empty — errors should appear
          const emptyFormData = {
            name: "Alice",
            email: "alice@example.com",
            password: "secret",
          };
          emptyFields.forEach((f) => { emptyFormData[f] = ""; });

          const errorsWithEmpty = validateCurrentTab("basic", emptyFormData, false);

          // Each empty required field must produce an error message
          for (const field of emptyFields) {
            expect(errorsWithEmpty).toHaveProperty(field);
            expect(typeof errorsWithEmpty[field]).toBe("string");
            expect(errorsWithEmpty[field].length).toBeGreaterThan(0);
          }

          // Step 2: Fill all required fields — errors should clear (empty object)
          const filledFormData = {
            name: "Alice",
            email: "alice@example.com",
            password: "secret",
          };

          const errorsWhenFilled = validateCurrentTab("basic", filledFormData, false);
          expect(Object.keys(errorsWhenFilled)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 1 (basic, edit): password not required — errors appear only for name/email when empty", () => {
    const editRequired = ["name", "email"];

    fc.assert(
      fc.property(
        fc.subarray(editRequired, { minLength: 1 }),
        (emptyFields) => {
          // Step 1: empty chosen fields — errors should appear
          const emptyFormData = {
            name: "Bob",
            email: "bob@example.com",
            password: "",
          };
          emptyFields.forEach((f) => { emptyFormData[f] = ""; });

          const errorsWithEmpty = validateCurrentTab("basic", emptyFormData, true);

          for (const field of emptyFields) {
            expect(errorsWithEmpty).toHaveProperty(field);
            expect(errorsWithEmpty[field].length).toBeGreaterThan(0);
          }
          // password must never be an error in edit mode
          expect(errorsWithEmpty).not.toHaveProperty("password");

          // Step 2: fill all required fields — errors clear
          const filledFormData = { name: "Bob", email: "bob@example.com", password: "" };
          const errorsWhenFilled = validateCurrentTab("basic", filledFormData, true);
          expect(Object.keys(errorsWhenFilled)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 2 (employment, PERMANENT/ACTIVE): errors appear for empty base fields and clear when filled", () => {
    const baseRequired = ["staffType", "status", "basicPay", "joinDate"];

    fc.assert(
      fc.property(
        fc.subarray(baseRequired, { minLength: 1 }),
        (emptyFields) => {
          // Step 1: empty chosen fields
          const emptyFormData = {
            staffType: "PERMANENT",
            status: "ACTIVE",
            basicPay: "50000",
            joinDate: "2023-01-01",
            contractStart: "",
            contractEnd: "",
            leaveDate: "",
          };
          emptyFields.forEach((f) => { emptyFormData[f] = ""; });

          const errorsWithEmpty = validateCurrentTab("employment", emptyFormData, false);

          for (const field of emptyFields) {
            expect(errorsWithEmpty).toHaveProperty(field);
            expect(errorsWithEmpty[field].length).toBeGreaterThan(0);
          }

          // Step 2: fill all required fields — errors clear
          const filledFormData = {
            staffType: "PERMANENT",
            status: "ACTIVE",
            basicPay: "50000",
            joinDate: "2023-01-01",
            contractStart: "",
            contractEnd: "",
            leaveDate: "",
          };
          const errorsWhenFilled = validateCurrentTab("employment", filledFormData, false);
          expect(Object.keys(errorsWhenFilled)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 2 (employment, CONTRACT): errors appear for empty contract dates and clear when filled", () => {
    const contractFields = ["contractStart", "contractEnd"];

    fc.assert(
      fc.property(
        fc.subarray(contractFields, { minLength: 1 }),
        (emptyFields) => {
          // Step 1: empty chosen contract fields
          const emptyFormData = {
            staffType: "CONTRACT",
            status: "ACTIVE",
            basicPay: "50000",
            joinDate: "2023-01-01",
            contractStart: "2023-01-01",
            contractEnd: "2024-01-01",
            leaveDate: "",
          };
          emptyFields.forEach((f) => { emptyFormData[f] = ""; });

          const errorsWithEmpty = validateCurrentTab("employment", emptyFormData, false);

          for (const field of emptyFields) {
            expect(errorsWithEmpty).toHaveProperty(field);
            expect(errorsWithEmpty[field].length).toBeGreaterThan(0);
          }

          // Step 2: fill all contract fields — errors clear
          const filledFormData = {
            staffType: "CONTRACT",
            status: "ACTIVE",
            basicPay: "50000",
            joinDate: "2023-01-01",
            contractStart: "2023-01-01",
            contractEnd: "2024-01-01",
            leaveDate: "",
          };
          const errorsWhenFilled = validateCurrentTab("employment", filledFormData, false);
          expect(Object.keys(errorsWhenFilled)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 2 (employment, TERMINATED/RETIRED): leaveDate error appears when empty and clears when filled", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("TERMINATED", "RETIRED"),
        (status) => {
          // Step 1: leaveDate empty — error should appear
          const emptyFormData = {
            staffType: "PERMANENT",
            status,
            basicPay: "50000",
            joinDate: "2023-01-01",
            contractStart: "",
            contractEnd: "",
            leaveDate: "",
          };

          const errorsWithEmpty = validateCurrentTab("employment", emptyFormData, false);
          expect(errorsWithEmpty).toHaveProperty("leaveDate");
          expect(errorsWithEmpty.leaveDate.length).toBeGreaterThan(0);

          // Step 2: fill leaveDate — error clears
          const filledFormData = { ...emptyFormData, leaveDate: "2024-06-01" };
          const errorsWhenFilled = validateCurrentTab("employment", filledFormData, false);
          expect(errorsWhenFilled).not.toHaveProperty("leaveDate");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 3 (roles): error appears when no role selected and clears when a role is toggled on", () => {
    fc.assert(
      fc.property(
        // Generate which role(s) to toggle on after the error
        fc.oneof(
          fc.record({ isTeaching: fc.constant(true), isNonTeaching: fc.boolean() }),
          fc.record({ isTeaching: fc.boolean(), isNonTeaching: fc.constant(true) })
        ),
        (rolesOn) => {
          // Step 1: no roles selected — error should appear
          const noRolesData = { isTeaching: false, isNonTeaching: false };
          const errorsWithEmpty = validateCurrentTab("roles", noRolesData, false);
          expect(errorsWithEmpty).toHaveProperty("roles");
          expect(errorsWithEmpty.roles.length).toBeGreaterThan(0);

          // Step 2: at least one role on — error clears
          const errorsWhenFilled = validateCurrentTab("roles", rolesOn, false);
          expect(errorsWhenFilled).not.toHaveProperty("roles");
        }
      ),
      { numRuns: 100 }
    );
  });
});
