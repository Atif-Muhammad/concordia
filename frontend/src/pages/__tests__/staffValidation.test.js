/**
 * Property-based tests for validateCurrentTab
 *
 * Property 5: Tab navigation is blocked when required fields are empty
 * Validates: Requirements 2.1, 2.2
 *
 * Property 6: Tab navigation succeeds when all required fields are filled
 * Validates: Requirements 2.4, 5.4
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateCurrentTab } from "../../lib/staffValidation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Non-empty string arbitrary */
const nonEmptyStr = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

/** Valid date string — use a fixed set to avoid fc.date() shrinking issues */
const dateStr = fc.constantFrom(
  "2020-01-15",
  "2021-06-01",
  "2022-03-20",
  "2023-09-10",
  "2024-12-31",
  "2025-07-04"
);

// ---------------------------------------------------------------------------
// Property 5: Tab navigation is blocked when required fields are empty
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------

describe("Property 5: Tab navigation is blocked when required fields are empty", () => {
  it("Tab 1 (basic, create): returns errors for each empty required field", () => {
    // Required fields for Tab 1 on create: name, email, password
    const tab1RequiredFields = ["name", "email", "password"];

    fc.assert(
      fc.property(
        // Generate a random non-empty subset of required fields to leave empty
        fc.subarray(tab1RequiredFields, { minLength: 1 }),
        (emptyFields) => {
          const formData = {
            name: "Alice",
            email: "alice@example.com",
            password: "secret",
          };
          // Clear the chosen fields
          emptyFields.forEach((f) => {
            formData[f] = "";
          });

          const errors = validateCurrentTab("basic", formData, false);

          // Every emptied field must have an error
          for (const field of emptyFields) {
            expect(errors).toHaveProperty(field);
            expect(typeof errors[field]).toBe("string");
            expect(errors[field].length).toBeGreaterThan(0);
          }

          // Fields that were NOT emptied must NOT have errors
          const filledFields = tab1RequiredFields.filter((f) => !emptyFields.includes(f));
          for (const field of filledFields) {
            expect(errors).not.toHaveProperty(field);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 2 (employment, PERMANENT, ACTIVE): returns errors for each empty required field", () => {
    // Base required fields for Tab 2
    const tab2BaseRequired = ["staffType", "status", "basicPay", "joinDate"];

    fc.assert(
      fc.property(
        fc.subarray(tab2BaseRequired, { minLength: 1 }),
        (emptyFields) => {
          const formData = {
            staffType: "PERMANENT",
            status: "ACTIVE",
            basicPay: "50000",
            joinDate: "2023-01-01",
            contractStart: "",
            contractEnd: "",
            leaveDate: "",
          };
          emptyFields.forEach((f) => {
            formData[f] = "";
          });

          const errors = validateCurrentTab("employment", formData, false);

          for (const field of emptyFields) {
            expect(errors).toHaveProperty(field);
            expect(typeof errors[field]).toBe("string");
            expect(errors[field].length).toBeGreaterThan(0);
          }

          const filledFields = tab2BaseRequired.filter((f) => !emptyFields.includes(f));
          for (const field of filledFields) {
            expect(errors).not.toHaveProperty(field);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 2 (employment, CONTRACT): returns errors for empty contractStart/contractEnd", () => {
    const contractFields = ["contractStart", "contractEnd"];

    fc.assert(
      fc.property(
        fc.subarray(contractFields, { minLength: 1 }),
        (emptyFields) => {
          const formData = {
            staffType: "CONTRACT",
            status: "ACTIVE",
            basicPay: "50000",
            joinDate: "2023-01-01",
            contractStart: "2023-01-01",
            contractEnd: "2024-01-01",
            leaveDate: "",
          };
          emptyFields.forEach((f) => {
            formData[f] = "";
          });

          const errors = validateCurrentTab("employment", formData, false);

          for (const field of emptyFields) {
            expect(errors).toHaveProperty(field);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 2 (employment, TERMINATED/RETIRED): returns error for empty leaveDate", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("TERMINATED", "RETIRED"),
        (status) => {
          const formData = {
            staffType: "PERMANENT",
            status,
            basicPay: "50000",
            joinDate: "2023-01-01",
            contractStart: "",
            contractEnd: "",
            leaveDate: "", // empty — should trigger error
          };

          const errors = validateCurrentTab("employment", formData, false);

          expect(errors).toHaveProperty("leaveDate");
          expect(typeof errors.leaveDate).toBe("string");
          expect(errors.leaveDate.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 3 (roles): returns error when neither isTeaching nor isNonTeaching is true", () => {
    fc.assert(
      fc.property(
        fc.record({
          isTeaching: fc.constant(false),
          isNonTeaching: fc.constant(false),
        }),
        (formData) => {
          const errors = validateCurrentTab("roles", formData, false);
          expect(errors).toHaveProperty("roles");
          expect(typeof errors.roles).toBe("string");
          expect(errors.roles.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Tab navigation succeeds when all required fields are filled
// Validates: Requirements 2.4, 5.4
// ---------------------------------------------------------------------------

describe("Property 6: Tab navigation succeeds when all required fields are filled", () => {
  it("Tab 1 (basic, create): returns empty errors when all required fields are filled", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: nonEmptyStr,
          email: nonEmptyStr,
          password: nonEmptyStr,
        }),
        (fields) => {
          const formData = {
            name: fields.name,
            email: fields.email,
            password: fields.password,
          };
          const errors = validateCurrentTab("basic", formData, false);
          expect(Object.keys(errors)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 1 (basic, edit): password not required — returns empty errors when name and email filled", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: nonEmptyStr,
          email: nonEmptyStr,
          // password can be anything including empty
          password: fc.string(),
        }),
        (fields) => {
          const formData = {
            name: fields.name,
            email: fields.email,
            password: fields.password,
          };
          const errors = validateCurrentTab("basic", formData, true);
          expect(Object.keys(errors)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 2 (employment, PERMANENT, ACTIVE): returns empty errors when all base fields filled", () => {
    fc.assert(
      fc.property(
        fc.record({
          staffType: fc.constantFrom("PERMANENT"),
          status: fc.constantFrom("ACTIVE"),
          basicPay: nonEmptyStr,
          joinDate: dateStr,
        }),
        (fields) => {
          const formData = {
            ...fields,
            contractStart: "",
            contractEnd: "",
            leaveDate: "",
          };
          const errors = validateCurrentTab("employment", formData, false);
          expect(Object.keys(errors)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 2 (employment, CONTRACT): returns empty errors when contract dates also filled", () => {
    fc.assert(
      fc.property(
        fc.record({
          basicPay: nonEmptyStr,
          joinDate: dateStr,
          contractStart: dateStr,
          contractEnd: dateStr,
        }),
        (fields) => {
          const formData = {
            staffType: "CONTRACT",
            status: "ACTIVE",
            ...fields,
            leaveDate: "",
          };
          const errors = validateCurrentTab("employment", formData, false);
          expect(Object.keys(errors)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 2 (employment, TERMINATED/RETIRED): returns empty errors when leaveDate also filled", () => {
    fc.assert(
      fc.property(
        fc.record({
          status: fc.constantFrom("TERMINATED", "RETIRED"),
          basicPay: nonEmptyStr,
          joinDate: dateStr,
          leaveDate: dateStr,
        }),
        (fields) => {
          const formData = {
            staffType: "PERMANENT",
            ...fields,
            contractStart: "",
            contractEnd: "",
          };
          const errors = validateCurrentTab("employment", formData, false);
          expect(Object.keys(errors)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Tab 3 (roles): returns empty errors when at least one role is true", () => {
    fc.assert(
      fc.property(
        // At least one of isTeaching/isNonTeaching must be true
        fc.oneof(
          fc.record({ isTeaching: fc.constant(true), isNonTeaching: fc.boolean() }),
          fc.record({ isTeaching: fc.boolean(), isNonTeaching: fc.constant(true) })
        ),
        (formData) => {
          const errors = validateCurrentTab("roles", formData, false);
          expect(Object.keys(errors)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
