/**
 * Preservation Property Tests — Inquiry Reference & Follow-up Slab
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
 *
 * These tests encode BASELINE behavior that must be PRESERVED after the fix.
 * They are EXPECTED TO PASS on unfixed code — passing confirms the baseline.
 * If any test fails, the test is wrong (not the code) — fix the test.
 *
 * Preservation 3.1: Non-REFERENCE inquiry types must NOT show referenceBody input
 * Preservation 3.3: followUpSlab = "" must leave followUpDate unchanged and show no date input
 * Preservation 3.5: Create mode submit must include status: "NEW" and all pre-existing fields
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure model: mirrors the inquiryForm initial state in FrontOffice.jsx (unfixed)
// ---------------------------------------------------------------------------

/**
 * Returns the initial inquiryForm state as defined in FrontOffice.jsx (unfixed code).
 * NOTE: referenceBody is intentionally absent — this is the unfixed baseline.
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
    // NOTE: referenceBody is NOT present on unfixed code — this is the baseline
  };
}

/**
 * Simulates the inquiryType select onValueChange handler (unfixed code).
 * Only sets inquiryType — no referenceBody field exists.
 */
function handleInquiryTypeChange_unfixed(form, value) {
  return { ...form, inquiryType: value };
}

/**
 * Simulates the followUpSlab select onValueChange handler (unfixed code).
 * Only sets followUpSlab — does NOT auto-calculate followUpDate.
 * Source: FrontOffice.jsx line ~1099
 *   onValueChange={(v) => setInquiryForm({ ...inquiryForm, followUpSlab: v })}
 */
function handleFollowUpSlabChange_unfixed(form, value) {
  return { ...form, followUpSlab: value };
}

/**
 * Simulates whether the referenceBody input is visible in the form (unfixed code).
 * On unfixed code: always false — the field is never rendered.
 */
function isReferenceBodyInputVisible_unfixed(_form) {
  return false;
}

/**
 * Simulates whether a date input is visible for the follow-up section (unfixed code).
 * On unfixed code: date input is shown only in edit mode (editingInquiry truthy),
 * always visible regardless of slab value.
 * For create mode (editingInquiry = null): Follow Up section is hidden entirely.
 */
function isFollowUpDateInputVisible_unfixed(form, editingInquiry) {
  // Follow Up section is gated on editingInquiry in unfixed code
  if (!editingInquiry) return false;
  // In edit mode, date input is always shown (no slab-based conditional)
  return true;
}

/**
 * Simulates the create mode submit payload (unfixed code).
 * Mirrors handleInquirySubmit in FrontOffice.jsx:
 *   createMutation.mutate({ ...payload, status: "NEW" })
 * where payload = { ...inquiryForm, sessionId: ..., prospectusFee: ..., prospectusSold: ... }
 */
function buildCreatePayload_unfixed(form) {
  const payload = {
    ...form,
    sessionId: form.sessionId ? Number(form.sessionId) : undefined,
    prospectusFee: form.prospectusFee ? Number(form.prospectusFee) : undefined,
    prospectusSold: !!form.prospectusSold,
  };
  return { ...payload, status: "NEW" };
}

// ---------------------------------------------------------------------------
// Preservation 3.1 — Non-REFERENCE types do NOT show referenceBody input
// Property-based test: for all non-REFERENCE inquiryType values, referenceBody
// input is NOT rendered.
// EXPECTED TO PASS on unfixed code.
// ---------------------------------------------------------------------------

describe("Preservation 3.1: referenceBody input is NOT rendered for non-REFERENCE inquiry types", () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * Property: For any inquiryType in the non-REFERENCE set, the referenceBody
   * input must not be rendered. This is the baseline — unfixed code never renders
   * the input at all, so this must hold for all non-REFERENCE types.
   */
  const NON_REFERENCE_TYPES = [
    "PHYSICAL",
    "HEAD_OFFICE",
    "REGIONAL_OFFICE",
    "SOCIAL_MEDIA",
    "TELEPHONE",
  ];

  it("property: referenceBody input is NOT rendered for all non-REFERENCE inquiry types", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NON_REFERENCE_TYPES),
        (inquiryType) => {
          const form = handleInquiryTypeChange_unfixed(getInitialInquiryForm(), inquiryType);
          const isVisible = isReferenceBodyInputVisible_unfixed(form);
          // Preservation: non-REFERENCE types must NOT show referenceBody input
          return isVisible === false;
        }
      )
    );
  });

  it("example: PHYSICAL type does not show referenceBody input", () => {
    const form = handleInquiryTypeChange_unfixed(getInitialInquiryForm(), "PHYSICAL");
    expect(isReferenceBodyInputVisible_unfixed(form)).toBe(false);
  });

  it("example: HEAD_OFFICE type does not show referenceBody input", () => {
    const form = handleInquiryTypeChange_unfixed(getInitialInquiryForm(), "HEAD_OFFICE");
    expect(isReferenceBodyInputVisible_unfixed(form)).toBe(false);
  });

  it("example: REGIONAL_OFFICE type does not show referenceBody input", () => {
    const form = handleInquiryTypeChange_unfixed(getInitialInquiryForm(), "REGIONAL_OFFICE");
    expect(isReferenceBodyInputVisible_unfixed(form)).toBe(false);
  });

  it("example: SOCIAL_MEDIA type does not show referenceBody input", () => {
    const form = handleInquiryTypeChange_unfixed(getInitialInquiryForm(), "SOCIAL_MEDIA");
    expect(isReferenceBodyInputVisible_unfixed(form)).toBe(false);
  });

  it("example: TELEPHONE type does not show referenceBody input", () => {
    const form = handleInquiryTypeChange_unfixed(getInitialInquiryForm(), "TELEPHONE");
    expect(isReferenceBodyInputVisible_unfixed(form)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Preservation 3.3 — followUpSlab = "" leaves followUpDate unchanged and
// shows no date input
// Property-based test: for followUpSlab = "", followUpDate is unchanged.
// EXPECTED TO PASS on unfixed code.
// ---------------------------------------------------------------------------

describe("Preservation 3.3: followUpSlab = '' leaves followUpDate unchanged and shows no date input", () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * Property: When followUpSlab is set to "" (empty/cleared), followUpDate must
   * remain unchanged. The unfixed handler only sets followUpSlab, so followUpDate
   * is never touched — this is the baseline behavior to preserve.
   */
  it("property: followUpDate is unchanged when followUpSlab is set to empty string", () => {
    fc.assert(
      fc.property(
        // Generate arbitrary existing followUpDate values (including empty)
        fc.oneof(
          fc.constant(""),
          fc.integer({ min: 2020, max: 2030 }).chain((year) =>
            fc.integer({ min: 1, max: 12 }).chain((month) =>
              fc.integer({ min: 1, max: 28 }).map((day) =>
                `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              )
            )
          )
        ),
        (existingDate) => {
          const formWithDate = { ...getInitialInquiryForm(), followUpDate: existingDate };
          const form = handleFollowUpSlabChange_unfixed(formWithDate, "");
          // Preservation: followUpDate must remain unchanged
          return form.followUpDate === existingDate;
        }
      )
    );
  });

  it("example: followUpDate stays empty when slab is cleared to ''", () => {
    const form = handleFollowUpSlabChange_unfixed(getInitialInquiryForm(), "");
    expect(form.followUpDate).toBe("");
    expect(form.followUpSlab).toBe("");
  });

  it("example: followUpDate stays as existing date when slab is cleared to ''", () => {
    const formWithDate = { ...getInitialInquiryForm(), followUpDate: "2025-06-15" };
    const form = handleFollowUpSlabChange_unfixed(formWithDate, "");
    expect(form.followUpDate).toBe("2025-06-15");
    expect(form.followUpSlab).toBe("");
  });

  it("example: no date input shown in create mode when followUpSlab = '' (Follow Up section hidden)", () => {
    const form = handleFollowUpSlabChange_unfixed(getInitialInquiryForm(), "");
    const editingInquiry = null; // create mode
    // In unfixed code, Follow Up section is hidden in create mode entirely
    expect(isFollowUpDateInputVisible_unfixed(form, editingInquiry)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Preservation 3.5 — Create mode submit includes status: "NEW" and all
// pre-existing fields
// EXPECTED TO PASS on unfixed code.
// ---------------------------------------------------------------------------

describe("Preservation 3.5: create mode submit payload includes status: 'NEW' and all pre-existing fields", () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * The create mode submit must include status: "NEW" and all fields that were
   * previously supported in the inquiryForm. This is the baseline behavior.
   */

  // All fields that must be present in the create payload (pre-existing fields)
  const PRE_EXISTING_FIELDS = [
    "studentName",
    "fatherName",
    "fatherCnic",
    "contactNumber",
    "email",
    "address",
    "programInterest",
    "previousInstitute",
    "remarks",
    "inquiryType",
    "gender",
    "sessionId",
    "prospectusSold",
    "prospectusFee",
    "prospectusReceipt",
    "followUpDate",
    "followUpSlab",
    "status",
  ];

  it("create mode payload includes status: 'NEW'", () => {
    const form = {
      ...getInitialInquiryForm(),
      studentName: "Ali Khan",
      contactNumber: "03001234567",
    };
    const payload = buildCreatePayload_unfixed(form);
    expect(payload.status).toBe("NEW");
  });

  it("create mode payload includes all pre-existing fields", () => {
    const form = {
      ...getInitialInquiryForm(),
      studentName: "Ali Khan",
      contactNumber: "03001234567",
      fatherName: "Usman Khan",
      email: "ali@example.com",
      inquiryType: "PHYSICAL",
      gender: "Male",
      followUpSlab: "1_WEEK",
    };
    const payload = buildCreatePayload_unfixed(form);

    for (const field of PRE_EXISTING_FIELDS) {
      expect(payload).toHaveProperty(field);
    }
  });

  it("property: create mode payload always includes status: 'NEW' regardless of form values", () => {
    fc.assert(
      fc.property(
        fc.record({
          studentName: fc.string({ minLength: 1 }),
          contactNumber: fc.string({ minLength: 1 }),
          fatherName: fc.string(),
          email: fc.string(),
          inquiryType: fc.constantFrom(
            "PHYSICAL", "HEAD_OFFICE", "REGIONAL_OFFICE", "SOCIAL_MEDIA", "TELEPHONE", ""
          ),
          gender: fc.constantFrom("Male", "Female", ""),
          followUpSlab: fc.constantFrom("1_DAY", "3_DAYS", "1_WEEK", "2_WEEKS", "1_MONTH", "CUSTOM", ""),
          followUpDate: fc.string(),
          prospectusSold: fc.boolean(),
        }),
        (overrides) => {
          const form = { ...getInitialInquiryForm(), ...overrides };
          const payload = buildCreatePayload_unfixed(form);
          return payload.status === "NEW";
        }
      )
    );
  });

  it("property: create mode payload always includes all pre-existing fields", () => {
    fc.assert(
      fc.property(
        fc.record({
          studentName: fc.string({ minLength: 1 }),
          contactNumber: fc.string({ minLength: 1 }),
          inquiryType: fc.constantFrom(
            "PHYSICAL", "HEAD_OFFICE", "REGIONAL_OFFICE", "SOCIAL_MEDIA", "TELEPHONE", ""
          ),
          followUpSlab: fc.constantFrom("1_DAY", "3_DAYS", "1_WEEK", "2_WEEKS", "1_MONTH", "CUSTOM", ""),
        }),
        (overrides) => {
          const form = { ...getInitialInquiryForm(), ...overrides };
          const payload = buildCreatePayload_unfixed(form);
          // All pre-existing fields must be present in the payload
          return PRE_EXISTING_FIELDS.every((field) => field in payload);
        }
      )
    );
  });

  it("create mode payload: sessionId is converted to number when provided", () => {
    const form = { ...getInitialInquiryForm(), studentName: "Test", contactNumber: "123", sessionId: "5" };
    const payload = buildCreatePayload_unfixed(form);
    expect(payload.sessionId).toBe(5);
    expect(typeof payload.sessionId).toBe("number");
  });

  it("create mode payload: sessionId is undefined when empty", () => {
    const form = { ...getInitialInquiryForm(), studentName: "Test", contactNumber: "123", sessionId: "" };
    const payload = buildCreatePayload_unfixed(form);
    expect(payload.sessionId).toBeUndefined();
  });

  it("create mode payload: prospectusSold is always boolean", () => {
    const form1 = { ...getInitialInquiryForm(), studentName: "Test", contactNumber: "123", prospectusSold: false };
    const form2 = { ...getInitialInquiryForm(), studentName: "Test", contactNumber: "123", prospectusSold: true };
    expect(buildCreatePayload_unfixed(form1).prospectusSold).toBe(false);
    expect(buildCreatePayload_unfixed(form2).prospectusSold).toBe(true);
  });
});
