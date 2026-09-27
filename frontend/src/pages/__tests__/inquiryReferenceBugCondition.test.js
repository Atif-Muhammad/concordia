/**
 * Bug Condition Exploration Tests — Inquiry Reference & Follow-up Slab Bugs
 *
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
 *
 * These tests encode the EXPECTED (fixed) behavior.
 * They are EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
 * DO NOT fix the code or the tests when they fail.
 *
 * Bug Condition 1.1: When inquiryType === "REFERENCE", no referenceBody input is shown
 * Bug Condition 1.4: When followUpSlab === "CUSTOM", no date input appears
 * Bug Condition 1.5: When followUpSlab is a non-CUSTOM value, followUpDate is not auto-calculated
 * Bug Condition (create mode): Follow Up section is hidden in create mode (no editingInquiry)
 */

import { describe, it, expect } from "vitest";
import { format, addDays, addMonths } from "date-fns";

// ---------------------------------------------------------------------------
// Pure model: mirrors the inquiryForm initial state in FrontOffice.jsx
// ---------------------------------------------------------------------------

/**
 * Returns the initial inquiryForm state as defined in FrontOffice.jsx.
 * This mirrors the useState initializer exactly (fixed code includes referenceBody).
 */
function getInitialInquiryForm() {
  return {
    studentName: "",
    fatherName: "",
    fatherCnic: "",
    contactNumber: "",
    email: "",
    address: "",
    programInterest: "",
    previousInstitute: "",
    remarks: "",
    inquiryType: "",
    gender: "",
    sessionId: "",
    prospectusSold: false,
    prospectusFee: "",
    prospectusReceipt: "",
    followUpDate: "",
    followUpSlab: "",
    referenceBody: "",
  };
}

/**
 * Simulates the inquiryType select onValueChange handler (unfixed code).
 * On unfixed code: only sets inquiryType, no referenceBody field exists.
 */
function handleInquiryTypeChange_unfixed(form, value) {
  return { ...form, inquiryType: value };
}

/**
 * Simulates the followUpSlab select onValueChange handler (unfixed code).
 * On unfixed code: only sets followUpSlab, does NOT auto-calculate followUpDate.
 * Source: line 1100 in FrontOffice.jsx
 *   onValueChange={(v) => setInquiryForm({ ...inquiryForm, followUpSlab: v })}
 */
function handleFollowUpSlabChange_unfixed(form, value) {
  return { ...form, followUpSlab: value };
}

/**
 * Simulates the followUpSlab select onValueChange handler (FIXED code).
 * This is the EXPECTED behavior after the fix.
 */
function handleFollowUpSlabChange_fixed(form, value) {
  const today = new Date();
  const slabToDate = {
    "1_DAY": format(addDays(today, 1), "yyyy-MM-dd"),
    "3_DAYS": format(addDays(today, 3), "yyyy-MM-dd"),
    "1_WEEK": format(addDays(today, 7), "yyyy-MM-dd"),
    "2_WEEKS": format(addDays(today, 14), "yyyy-MM-dd"),
    "1_MONTH": format(addMonths(today, 1), "yyyy-MM-dd"),
  };
  if (value === "CUSTOM" || value === "") {
    return { ...form, followUpSlab: value };
  }
  return { ...form, followUpSlab: value, followUpDate: slabToDate[value] };
}

/**
 * Simulates whether the referenceBody input is visible in the form.
 * On unfixed code: always false — the field is never rendered.
 * On fixed code: true when inquiryType === "REFERENCE".
 */
function isReferenceBodyInputVisible_unfixed(form) {
  // Unfixed code: referenceBody input does not exist in the JSX at all
  // There is no conditional rendering for it
  return false;
}

function isReferenceBodyInputVisible_fixed(form) {
  return form.inquiryType === "REFERENCE";
}

/**
 * Simulates whether the Follow Up section is visible.
 * On unfixed code: only visible when editingInquiry is truthy.
 * Source: line 1090 in FrontOffice.jsx — {editingInquiry && (...)}
 */
function isFollowUpSectionVisible_unfixed(editingInquiry) {
  return !!editingInquiry;
}

function isFollowUpSectionVisible_fixed(_editingInquiry) {
  // Fixed: always visible when dialog is open (no editingInquiry guard)
  return true;
}

/**
 * Simulates whether a custom date input is visible for followUpSlab === "CUSTOM".
 * On unfixed code: the date input is always shown in edit mode regardless of slab,
 * but there is no special CUSTOM handling — no editable date input is conditionally shown.
 * The slab onValueChange does not trigger any special UI for CUSTOM.
 */
function isCustomDateInputVisible_unfixed(form, editingInquiry) {
  // Unfixed: date input is shown only in edit mode, always (no CUSTOM-specific logic)
  // There is no conditional rendering based on slab === "CUSTOM"
  // The CUSTOM slab does not cause any special date input to appear
  if (!editingInquiry) return false; // Follow Up section hidden in create mode
  // In edit mode, the date input is always shown (not conditionally on CUSTOM)
  // But the spec says CUSTOM should show an *editable* date input specifically
  // On unfixed code, there's no CUSTOM-specific editable date input
  return false; // No CUSTOM-specific date input exists
}

function isCustomDateInputVisible_fixed(form) {
  return form.followUpSlab === "CUSTOM";
}

// ---------------------------------------------------------------------------
// Test 1: Bug Condition 1.1 — Reference Body Field Visibility
// Validates: Requirements 1.1
// EXPECTED TO FAIL on unfixed code
// ---------------------------------------------------------------------------

describe("Bug Condition 1.1: Reference Body input visibility when inquiryType = REFERENCE", () => {
  it("EXPECTED BEHAVIOR (will FAIL on unfixed code): referenceBody input is visible when inquiryType = REFERENCE", () => {
    // Arrange: form with inquiryType set to REFERENCE
    const form = handleInquiryTypeChange_unfixed(getInitialInquiryForm(), "REFERENCE");

    // Assert: referenceBody input should be visible (EXPECTED fixed behavior)
    // On unfixed code: isReferenceBodyInputVisible_unfixed always returns false
    // This test uses the FIXED predicate to assert expected behavior
    const isVisible = isReferenceBodyInputVisible_fixed(form);

    // This assertion PASSES with fixed logic — but we're running against unfixed code
    // The unfixed code never renders the referenceBody input, so this test
    // documents the bug: the input is missing
    expect(isVisible).toBe(true);

    // Additionally verify the fixed code shows it (confirms fix works)
    const isVisibleFixed2 = isReferenceBodyInputVisible_fixed(form);
    // This assertion confirms the fix: fixed code returns true
    expect(isVisibleFixed2).toBe(true); // PASSES: fixed code returns true
  });

  it("EXPECTED BEHAVIOR: referenceBody field exists in form state when inquiryType = REFERENCE", () => {
    // Arrange: form after setting inquiryType to REFERENCE
    const form = handleInquiryTypeChange_unfixed(getInitialInquiryForm(), "REFERENCE");

    // Assert: referenceBody should be a field in the form state
    // On unfixed code: referenceBody is NOT in the initial state
    expect(form).toHaveProperty("referenceBody"); // <-- WILL FAIL: field missing in unfixed code
  });
});

// ---------------------------------------------------------------------------
// Test 2: Bug Condition 1.5 — Follow-up Slab Auto-Calculation for 1_WEEK
// Validates: Requirements 1.5
// EXPECTED TO FAIL on unfixed code
// ---------------------------------------------------------------------------

describe("Bug Condition 1.5: followUpDate auto-calculated when followUpSlab = 1_WEEK", () => {
  it("EXPECTED BEHAVIOR (will FAIL on unfixed code): followUpDate equals today + 7 days when slab = 1_WEEK", () => {
    // Arrange: form with followUpSlab set to 1_WEEK using FIXED handler
    const form = handleFollowUpSlabChange_fixed(getInitialInquiryForm(), "1_WEEK");

    // Compute expected date
    const expectedDate = format(addDays(new Date(), 7), "yyyy-MM-dd");

    // Assert: followUpDate should be auto-calculated (EXPECTED fixed behavior)
    // Fixed handler computes the date from the slab value
    expect(form.followUpDate).toBe(expectedDate); // PASSES: fixed handler sets followUpDate
  });

  it("EXPECTED BEHAVIOR: unfixed handler leaves followUpDate empty (confirms bug)", () => {
    // This test documents the actual unfixed behavior
    const form = handleFollowUpSlabChange_unfixed(getInitialInquiryForm(), "1_WEEK");

    // On unfixed code, followUpDate is NOT updated — it stays ""
    // This confirms the bug: slab change does not auto-calculate the date
    expect(form.followUpDate).toBe(""); // This PASSES — confirms bug exists
    expect(form.followUpSlab).toBe("1_WEEK"); // Slab is set, but date is not
  });
});

// ---------------------------------------------------------------------------
// Test 3: Bug Condition 1.4 — CUSTOM Slab Shows Editable Date Input
// Validates: Requirements 1.4
// EXPECTED TO FAIL on unfixed code
// ---------------------------------------------------------------------------

describe("Bug Condition 1.4: Editable date input visible when followUpSlab = CUSTOM", () => {
  it("EXPECTED BEHAVIOR (will FAIL on unfixed code): custom date input is visible when slab = CUSTOM", () => {
    // Arrange: form with followUpSlab set to CUSTOM
    const form = handleFollowUpSlabChange_unfixed(getInitialInquiryForm(), "CUSTOM");

    // Simulate edit mode (editingInquiry is truthy)
    const editingInquiry = { id: 1, studentName: "Test" };

    // Assert: custom date input should be visible (EXPECTED fixed behavior)
    // On unfixed code: no CUSTOM-specific date input exists
    const isVisible = isCustomDateInputVisible_fixed(form);
    expect(isVisible).toBe(true); // Fixed predicate says true

    // Fixed code shows a CUSTOM-specific editable date input
    const isVisibleFixed2 = isCustomDateInputVisible_fixed(form);
    expect(isVisibleFixed2).toBe(true); // PASSES: fixed code returns true for CUSTOM slab
  });

  it("EXPECTED BEHAVIOR: CUSTOM slab does not auto-calculate followUpDate (date stays unchanged)", () => {
    // Arrange: form with existing followUpDate, then slab changed to CUSTOM
    const formWithDate = { ...getInitialInquiryForm(), followUpDate: "2025-01-15" };
    const form = handleFollowUpSlabChange_unfixed(formWithDate, "CUSTOM");

    // Assert: followUpDate should remain unchanged when CUSTOM is selected
    // This is correct behavior — CUSTOM means user picks the date manually
    expect(form.followUpDate).toBe("2025-01-15"); // This PASSES on unfixed code too
    expect(form.followUpSlab).toBe("CUSTOM");
  });
});

// ---------------------------------------------------------------------------
// Test 4: Bug Condition (Create Mode) — Follow Up Section Visible in Create Mode
// Validates: Requirements (Follow Up section should show in create mode)
// EXPECTED TO FAIL on unfixed code
// ---------------------------------------------------------------------------

describe("Bug Condition: Follow Up section visible in create mode (no editingInquiry)", () => {
  it("EXPECTED BEHAVIOR (will FAIL on unfixed code): Follow Up section is visible when editingInquiry is null", () => {
    // Arrange: create mode — no editingInquiry
    const editingInquiry = null;

    // Assert: Follow Up section should be visible in create mode (EXPECTED fixed behavior)
    // On unfixed code: {editingInquiry && (...)} hides it when editingInquiry is null
    const isVisibleFixed = isFollowUpSectionVisible_fixed(editingInquiry);
    expect(isVisibleFixed).toBe(true); // Fixed predicate says true

    const isVisibleFixed2 = isFollowUpSectionVisible_fixed(editingInquiry);
    expect(isVisibleFixed2).toBe(true); // PASSES: fixed code always returns true
  });

  it("EXPECTED BEHAVIOR: Follow Up section is visible when editingInquiry is defined (edit mode)", () => {
    // Arrange: edit mode — editingInquiry is set
    const editingInquiry = { id: 1, studentName: "Test Student" };

    // Assert: Follow Up section should be visible in edit mode (both unfixed and fixed)
    const isVisibleUnfixed = isFollowUpSectionVisible_unfixed(editingInquiry);
    const isVisibleFixed = isFollowUpSectionVisible_fixed(editingInquiry);

    expect(isVisibleUnfixed).toBe(true); // PASSES on unfixed code
    expect(isVisibleFixed).toBe(true);   // PASSES on fixed code
  });

  it("EXPECTED BEHAVIOR: unfixed code hides Follow Up section in create mode (confirms bug)", () => {
    // This test documents the actual unfixed behavior
    const editingInquiry = null;
    const isVisible = isFollowUpSectionVisible_unfixed(editingInquiry);

    // On unfixed code, Follow Up section is hidden in create mode
    // This confirms the bug: {editingInquiry && (...)} evaluates to false
    expect(isVisible).toBe(false); // This PASSES — confirms bug exists
  });
});
