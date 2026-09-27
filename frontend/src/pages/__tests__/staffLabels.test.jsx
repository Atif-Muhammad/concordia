/**
 * Property-based tests for Staff form Required/Optional label logic.
 *
 * Property 1: Required fields are labeled "Required"
 * Validates: Requirements 1.1, 1.3, 1.5
 *
 * Property 2: Optional fields are labeled "Optional"
 * Validates: Requirements 1.2, 1.4, 1.8
 *
 * Property 3: Conditional required fields reflect staffType
 * Validates: Requirements 1.6
 *
 * Property 4: Conditional required field reflects status
 * Validates: Requirements 1.7
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure helper: mirrors the label logic in Staff.jsx
// Returns "Required" | "Optional" | null for each field given form state.
// ---------------------------------------------------------------------------

/**
 * Determines the label indicator for a given field based on form state.
 * @param {string} field - field name
 * @param {{ staffType: string, status: string }} formData
 * @param {boolean} isEditing - true when editing an existing staff member
 * @returns {"Required" | "Optional" | null}
 */
function getFieldLabelIndicator(field, formData, isEditing) {
  // Tab 1 — Basic Info
  const tab1Required = ["name", "email"];
  const tab1RequiredCreateOnly = ["password"];
  const tab1Optional = ["fatherName", "cnic", "phone", "religion", "address"];

  if (tab1Required.includes(field)) return "Required";
  if (tab1RequiredCreateOnly.includes(field)) {
    return isEditing ? "Optional" : "Required";
  }
  if (tab1Optional.includes(field)) return "Optional";

  // Tab 2 — Employment
  const tab2Required = ["staffType", "status", "basicPay", "joinDate"];
  if (tab2Required.includes(field)) return "Required";

  if (field === "contractStart" || field === "contractEnd") {
    return formData.staffType === "CONTRACT" ? "Required" : "Optional";
  }

  if (field === "leaveDate") {
    return formData.status === "TERMINATED" || formData.status === "RETIRED"
      ? "Required"
      : "Optional";
  }

  // Leave config fields — all Optional
  const leaveFields = [
    "sickAllowed", "sickDeduction",
    "annualAllowed", "annualDeduction",
    "casualAllowed", "casualDeduction",
  ];
  if (leaveFields.includes(field)) return "Optional";

  return null;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const staffTypeArb = fc.constantFrom("PERMANENT", "CONTRACT");
const statusArb = fc.constantFrom("ACTIVE", "TERMINATED", "RETIRED");

const formDataArb = fc.record({
  staffType: staffTypeArb,
  status: statusArb,
});

// ---------------------------------------------------------------------------
// Property 1: Required fields are labeled "Required"
// Validates: Requirements 1.1, 1.3, 1.5
// ---------------------------------------------------------------------------

describe("Property 1: Required fields are labeled 'Required'", () => {
  it("Tab 1 always-required fields (name, email) show Required regardless of form state", () => {
    fc.assert(
      fc.property(formDataArb, fc.boolean(), (formData, isEditing) => {
        for (const field of ["name", "email"]) {
          expect(getFieldLabelIndicator(field, formData, isEditing)).toBe("Required");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("password shows Required on create (isEditing=false)", () => {
    fc.assert(
      fc.property(formDataArb, (formData) => {
        expect(getFieldLabelIndicator("password", formData, false)).toBe("Required");
      }),
      { numRuns: 100 }
    );
  });

  it("Tab 2 always-required fields (staffType, status, basicPay, joinDate) show Required", () => {
    fc.assert(
      fc.property(formDataArb, fc.boolean(), (formData, isEditing) => {
        for (const field of ["staffType", "status", "basicPay", "joinDate"]) {
          expect(getFieldLabelIndicator(field, formData, isEditing)).toBe("Required");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("contractStart/contractEnd show Required when staffType is CONTRACT", () => {
    fc.assert(
      fc.property(statusArb, fc.boolean(), (status, isEditing) => {
        const formData = { staffType: "CONTRACT", status };
        expect(getFieldLabelIndicator("contractStart", formData, isEditing)).toBe("Required");
        expect(getFieldLabelIndicator("contractEnd", formData, isEditing)).toBe("Required");
      }),
      { numRuns: 100 }
    );
  });

  it("leaveDate shows Required when status is TERMINATED or RETIRED", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("TERMINATED", "RETIRED"),
        staffTypeArb,
        fc.boolean(),
        (status, staffType, isEditing) => {
          const formData = { staffType, status };
          expect(getFieldLabelIndicator("leaveDate", formData, isEditing)).toBe("Required");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Optional fields are labeled "Optional"
// Validates: Requirements 1.2, 1.4, 1.8
// ---------------------------------------------------------------------------

describe("Property 2: Optional fields are labeled 'Optional'", () => {
  it("Tab 1 optional fields (fatherName, cnic, phone, religion, address) show Optional", () => {
    fc.assert(
      fc.property(formDataArb, fc.boolean(), (formData, isEditing) => {
        for (const field of ["fatherName", "cnic", "phone", "religion", "address"]) {
          expect(getFieldLabelIndicator(field, formData, isEditing)).toBe("Optional");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("password shows Optional on edit (isEditing=true)", () => {
    fc.assert(
      fc.property(formDataArb, (formData) => {
        expect(getFieldLabelIndicator("password", formData, true)).toBe("Optional");
      }),
      { numRuns: 100 }
    );
  });

  it("all leave config fields show Optional", () => {
    const leaveFields = [
      "sickAllowed", "sickDeduction",
      "annualAllowed", "annualDeduction",
      "casualAllowed", "casualDeduction",
    ];
    fc.assert(
      fc.property(formDataArb, fc.boolean(), (formData, isEditing) => {
        for (const field of leaveFields) {
          expect(getFieldLabelIndicator(field, formData, isEditing)).toBe("Optional");
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Conditional required fields reflect staffType
// Validates: Requirements 1.6
// ---------------------------------------------------------------------------

describe("Property 3: Conditional required fields reflect staffType", () => {
  it("contractStart/contractEnd are Required when staffType=CONTRACT, Optional otherwise", () => {
    fc.assert(
      fc.property(staffTypeArb, statusArb, fc.boolean(), (staffType, status, isEditing) => {
        const formData = { staffType, status };
        const expected = staffType === "CONTRACT" ? "Required" : "Optional";
        expect(getFieldLabelIndicator("contractStart", formData, isEditing)).toBe(expected);
        expect(getFieldLabelIndicator("contractEnd", formData, isEditing)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it("non-CONTRACT staffType always yields Optional for contract dates", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("PERMANENT"),
        statusArb,
        fc.boolean(),
        (staffType, status, isEditing) => {
          const formData = { staffType, status };
          expect(getFieldLabelIndicator("contractStart", formData, isEditing)).toBe("Optional");
          expect(getFieldLabelIndicator("contractEnd", formData, isEditing)).toBe("Optional");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Conditional required field reflects status
// Validates: Requirements 1.7
// ---------------------------------------------------------------------------

describe("Property 4: Conditional required field reflects status", () => {
  it("leaveDate is Required when status is TERMINATED or RETIRED", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("TERMINATED", "RETIRED"),
        staffTypeArb,
        fc.boolean(),
        (status, staffType, isEditing) => {
          const formData = { staffType, status };
          expect(getFieldLabelIndicator("leaveDate", formData, isEditing)).toBe("Required");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("leaveDate is Optional when status is ACTIVE", () => {
    fc.assert(
      fc.property(staffTypeArb, fc.boolean(), (staffType, isEditing) => {
        const formData = { staffType, status: "ACTIVE" };
        expect(getFieldLabelIndicator("leaveDate", formData, isEditing)).toBe("Optional");
      }),
      { numRuns: 100 }
    );
  });
});
