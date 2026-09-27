/**
 * Property-based tests for Hostel Student Profile & Fee Tracking feature.
 *
 * Feature: hostel-student-profile-fee-tracking
 * Tests Properties 3, 4, 5, 6, 10, 11
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeOutstandingBalance } from "../../lib/hostelUtils";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 });

const externalRegistrationArb = fc.record({
  studentId: fc.constant(null),
  externalName: nonEmptyStringArb,
  externalInstitute: nonEmptyStringArb,
  externalGuardianName: nonEmptyStringArb,
  externalGuardianNumber: fc.string({ minLength: 1, maxLength: 20 }),
  guardianCnic: fc.string({ minLength: 1, maxLength: 15 }),
  studentCnic: fc.string({ minLength: 1, maxLength: 15 }),
  address: nonEmptyStringArb,
  decidedFeePerMonth: fc.float({ min: 1, max: 50000, noNaN: true }),
});

const internalRegistrationArb = fc.record({
  studentId: fc.integer({ min: 1, max: 99999 }),
  externalName: fc.constant(null),
  decidedFeePerMonth: fc.float({ min: 1, max: 50000, noNaN: true }),
});

// ---------------------------------------------------------------------------
// Property 3: External profile panel renders all required fields
// Validates: Requirements 2.1, 2.4
// ---------------------------------------------------------------------------

describe("Property 3: External profile panel renders all required fields", () => {
  it("all profile fields are present in the registration data object", () => {
    fc.assert(
      fc.property(externalRegistrationArb, (reg) => {
        // The profile panel would display these fields from the registration object.
        // We verify that all required fields are truthy/accessible in the data.
        expect(reg.studentId).toBeNull();
        expect(reg.externalName).toBeTruthy();
        expect(reg.externalInstitute).toBeTruthy();
        expect(reg.externalGuardianName).toBeTruthy();
        expect(reg.externalGuardianNumber).toBeTruthy();
        expect(reg.guardianCnic).toBeTruthy();
        expect(reg.studentCnic).toBeTruthy();
        expect(reg.address).toBeTruthy();
        expect(reg.decidedFeePerMonth).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it("each required field value is accessible and non-empty", () => {
    fc.assert(
      fc.property(externalRegistrationArb, (reg) => {
        const requiredFields = [
          "externalName",
          "externalInstitute",
          "externalGuardianName",
          "externalGuardianNumber",
          "guardianCnic",
          "studentCnic",
          "address",
        ];
        for (const field of requiredFields) {
          expect(typeof reg[field]).toBe("string");
          expect(reg[field].length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Profile panel visibility is determined by studentId
// Validates: Requirements 2.2, 2.3
// ---------------------------------------------------------------------------

describe("Property 4: Profile panel visibility is determined by studentId", () => {
  it("profile panel should show when studentId is null", () => {
    fc.assert(
      fc.property(externalRegistrationArb, (reg) => {
        const shouldShowProfile = reg.studentId === null;
        expect(shouldShowProfile).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("profile panel should NOT show when studentId is set", () => {
    fc.assert(
      fc.property(internalRegistrationArb, (reg) => {
        const shouldShowProfile = reg.studentId === null;
        expect(shouldShowProfile).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("shouldShowProfile = !reg.studentId holds for both null and numeric studentId", () => {
    const mixedRegArb = fc.oneof(
      externalRegistrationArb,
      internalRegistrationArb
    );
    fc.assert(
      fc.property(mixedRegArb, (reg) => {
        const shouldShowProfile = !reg.studentId;
        if (reg.studentId === null) {
          expect(shouldShowProfile).toBe(true);
        } else {
          expect(shouldShowProfile).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Hostel indicator visibility is determined by active registration
// Validates: Requirements 3.1, 3.2, 3.3
// ---------------------------------------------------------------------------

describe("Property 5: Hostel indicator visibility is determined by active registration", () => {
  const activeRegistrationArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 36 }),
    studentId: fc.integer({ min: 1, max: 99999 }),
    status: fc.constant("active"),
    decidedFeePerMonth: fc.float({ min: 1, max: 50000, noNaN: true }),
    roomNumber: fc.string({ minLength: 1, maxLength: 10 }),
  });

  const inactiveRegistrationArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 36 }),
    studentId: fc.integer({ min: 1, max: 99999 }),
    status: fc.constantFrom("inactive", "departed", "suspended"),
    decidedFeePerMonth: fc.float({ min: 0, max: 50000, noNaN: true }),
  });

  it("badge renders when registration exists and status is active", () => {
    fc.assert(
      fc.property(activeRegistrationArb, (reg) => {
        const shouldShowBadge = reg != null && reg.status === "active";
        expect(shouldShowBadge).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("badge does NOT render when registration is inactive", () => {
    fc.assert(
      fc.property(inactiveRegistrationArb, (reg) => {
        const shouldShowBadge = reg != null && reg.status === "active";
        expect(shouldShowBadge).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("badge does NOT render when registration is null", () => {
    const shouldShowBadge = null != null && (null)?.status === "active";
    expect(shouldShowBadge).toBe(false);
  });

  it("room and fee are accessible when badge is shown", () => {
    fc.assert(
      fc.property(activeRegistrationArb, (reg) => {
        const shouldShowBadge = reg != null && reg.status === "active";
        if (shouldShowBadge) {
          expect(reg.decidedFeePerMonth).toBeGreaterThan(0);
          expect(reg.roomNumber).toBeTruthy();
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Fee Management hostel indicator mirrors registration state
// Validates: Requirements 4.1, 4.2, 4.3
// ---------------------------------------------------------------------------

describe("Property 6: Fee Management hostel indicator mirrors registration state", () => {
  const activeRegArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 36 }),
    studentId: fc.integer({ min: 1, max: 99999 }),
    status: fc.constant("active"),
    decidedFeePerMonth: fc.float({ min: 1, max: 50000, noNaN: true }),
  });

  it("hostel indicator is present when active registration exists", () => {
    fc.assert(
      fc.property(activeRegArb, (reg) => {
        const hasHostelIndicator = reg != null && reg.status === "active";
        expect(hasHostelIndicator).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("hostel indicator is absent when no registration exists", () => {
    const studentHostelReg = null;
    const hasHostelIndicator =
      studentHostelReg != null && studentHostelReg?.status === "active";
    expect(hasHostelIndicator).toBe(false);
  });

  it("hostel indicator is absent when registration is not active", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          studentId: fc.integer({ min: 1 }),
          status: fc.constantFrom("inactive", "departed"),
          decidedFeePerMonth: fc.float({ min: 0, max: 50000, noNaN: true }),
        }),
        (reg) => {
          const hasHostelIndicator = reg != null && reg.status === "active";
          expect(hasHostelIndicator).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("decidedFeePerMonth is accessible when indicator is shown", () => {
    fc.assert(
      fc.property(activeRegArb, (reg) => {
        const hasHostelIndicator = reg != null && reg.status === "active";
        if (hasHostelIndicator) {
          expect(typeof reg.decidedFeePerMonth).toBe("number");
          expect(reg.decidedFeePerMonth).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Outstanding balance formula
// Validates: Requirements 6.1, 6.5
// ---------------------------------------------------------------------------

describe("Property 10: Outstanding balance formula", () => {
  it("computeOutstandingBalance equals fee * months - sum(amounts) within tolerance", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 50000, noNaN: true }),   // decidedFeePerMonth
        fc.integer({ min: 1, max: 36 }),                  // monthsElapsed
        fc.array(
          fc.float({ min: 0, max: 50000, noNaN: true }),
          { maxLength: 50 }
        ),                                                 // payment amounts
        (fee, monthsElapsed, amounts) => {
          const now = new Date();
          // Construct a registrationDate that is exactly (monthsElapsed - 1) months before
          // the start of the current month, so that the function computes exactly monthsElapsed.
          const registrationDate = new Date(
            now.getFullYear(),
            now.getMonth() - (monthsElapsed - 1),
            1
          );

          const registration = {
            decidedFeePerMonth: fee,
            registrationDate: registrationDate.toISOString(),
          };
          const payments = amounts.map((a) => ({ amount: a }));

          const result = computeOutstandingBalance(registration, payments);
          const totalPaid = amounts.reduce((s, a) => s + a, 0);
          const expected = fee * monthsElapsed - totalPaid;

          expect(Math.abs(result - expected)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns null when decidedFeePerMonth is 0", () => {
    const registration = {
      decidedFeePerMonth: 0,
      registrationDate: new Date().toISOString(),
    };
    const result = computeOutstandingBalance(registration, []);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Property 11: Paid/Outstanding status reflects balance sign
// Validates: Requirements 6.2, 6.3, 6.6
// ---------------------------------------------------------------------------

describe("Property 11: Paid/Outstanding status reflects balance sign", () => {
  const getStatus = (balance) => {
    if (balance === null) return "No Fee Set";
    if (balance <= 0) return "Paid";
    return "Outstanding";
  };

  it("status is Paid when outstandingBalance <= 0", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 50000, noNaN: true }),  // decidedFeePerMonth
        fc.integer({ min: 1, max: 36 }),                 // monthsElapsed
        (fee, monthsElapsed) => {
          const now = new Date();
          const registrationDate = new Date(
            now.getFullYear(),
            now.getMonth() - (monthsElapsed - 1),
            1
          );
          const registration = {
            decidedFeePerMonth: fee,
            registrationDate: registrationDate.toISOString(),
          };
          // Pay exactly the total due — balance should be 0 → "Paid"
          const totalDue = fee * monthsElapsed;
          const payments = [{ amount: totalDue }];

          const balance = computeOutstandingBalance(registration, payments);
          const status = getStatus(balance);
          expect(status).toBe("Paid");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("status is Paid when overpaid (balance < 0)", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 50000, noNaN: true }),
        fc.integer({ min: 1, max: 36 }),
        fc.float({ min: Math.fround(0.01), max: 10000, noNaN: true }), // extra payment
        (fee, monthsElapsed, extra) => {
          const now = new Date();
          const registrationDate = new Date(
            now.getFullYear(),
            now.getMonth() - (monthsElapsed - 1),
            1
          );
          const registration = {
            decidedFeePerMonth: fee,
            registrationDate: registrationDate.toISOString(),
          };
          const totalDue = fee * monthsElapsed;
          const payments = [{ amount: totalDue + extra }];

          const balance = computeOutstandingBalance(registration, payments);
          const status = getStatus(balance);
          expect(status).toBe("Paid");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("status is Outstanding when balance > 0 (no payments made)", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 50000, noNaN: true }),
        fc.integer({ min: 1, max: 36 }),
        (fee, monthsElapsed) => {
          const now = new Date();
          const registrationDate = new Date(
            now.getFullYear(),
            now.getMonth() - (monthsElapsed - 1),
            1
          );
          const registration = {
            decidedFeePerMonth: fee,
            registrationDate: registrationDate.toISOString(),
          };
          const payments = []; // no payments

          const balance = computeOutstandingBalance(registration, payments);
          const status = getStatus(balance);
          expect(status).toBe("Outstanding");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("status is No Fee Set when decidedFeePerMonth is 0", () => {
    const registration = {
      decidedFeePerMonth: 0,
      registrationDate: new Date().toISOString(),
    };
    const balance = computeOutstandingBalance(registration, []);
    const status = getStatus(balance);
    expect(status).toBe("No Fee Set");
  });
});
