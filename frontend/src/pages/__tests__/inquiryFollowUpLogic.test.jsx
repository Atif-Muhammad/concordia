import { describe, it, expect } from "vitest";
import { format, addDays, addMonths } from "date-fns";

// Pure helper function reflecting InquiryTab's slab calculation logic
function calculateFollowUpDate(currentDate, slabVal) {
  if (slabVal === "1_DAY") {
    return format(addDays(new Date(), 1), "yyyy-MM-dd");
  } else if (slabVal === "3_DAYS") {
    return format(addDays(new Date(), 3), "yyyy-MM-dd");
  } else if (slabVal === "1_WEEK") {
    return format(addDays(new Date(), 7), "yyyy-MM-dd");
  } else if (slabVal === "2_WEEKS") {
    return format(addDays(new Date(), 14), "yyyy-MM-dd");
  } else if (slabVal === "1_MONTH") {
    return format(addMonths(new Date(), 1), "yyyy-MM-dd");
  }
  return currentDate;
}

// Helper for follow-up status colors
const getFollowUpStatusColor = (status) => {
  switch (status?.toUpperCase()) {
    case "COMPLETED":
      return "bg-green-50 text-green-700 border-green-200";
    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";
    case "PENDING":
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
};

// Helper for program display string without trailing dash
function formatProgramDisplay(program) {
  if (!program) return "";
  if (program.department?.name) {
    return `${program.name} — ${program.department.name}`;
  }
  return program.name;
}

describe("Inquiry Follow-up Logic & Calculations", () => {
  it("calculates follow-up date for 1_DAY slab", () => {
    const expected = format(addDays(new Date(), 1), "yyyy-MM-dd");
    expect(calculateFollowUpDate("", "1_DAY")).toBe(expected);
  });

  it("calculates follow-up date for 3_DAYS slab", () => {
    const expected = format(addDays(new Date(), 3), "yyyy-MM-dd");
    expect(calculateFollowUpDate("", "3_DAYS")).toBe(expected);
  });

  it("calculates follow-up date for 1_WEEK slab", () => {
    const expected = format(addDays(new Date(), 7), "yyyy-MM-dd");
    expect(calculateFollowUpDate("", "1_WEEK")).toBe(expected);
  });

  it("calculates follow-up date for 2_WEEKS slab", () => {
    const expected = format(addDays(new Date(), 14), "yyyy-MM-dd");
    expect(calculateFollowUpDate("", "2_WEEKS")).toBe(expected);
  });

  it("calculates follow-up date for 1_MONTH slab", () => {
    const expected = format(addMonths(new Date(), 1), "yyyy-MM-dd");
    expect(calculateFollowUpDate("", "1_MONTH")).toBe(expected);
  });

  it("preserves custom date when slab is CUSTOM", () => {
    const customDate = "2026-10-15";
    expect(calculateFollowUpDate(customDate, "CUSTOM")).toBe(customDate);
  });

  it("validates follow-up form requires date", () => {
    const validateFollowUpForm = (data) => {
      const errors = {};
      if (!data.date) errors.date = "Follow-up date is required";
      return errors;
    };

    expect(validateFollowUpForm({ date: "", remarks: "Test" })).toEqual({
      date: "Follow-up date is required",
    });
    expect(validateFollowUpForm({ date: "2026-10-01", remarks: "Test" })).toEqual({});
  });

  it("returns correct status badge classes", () => {
    expect(getFollowUpStatusColor("PENDING")).toContain("text-amber-700");
    expect(getFollowUpStatusColor("COMPLETED")).toContain("text-green-700");
    expect(getFollowUpStatusColor("CANCELLED")).toContain("text-red-700");
    expect(getFollowUpStatusColor(undefined)).toContain("text-amber-700");
  });

  it("formats program display without trailing dash when department is missing", () => {
    const prog1 = { id: 1, name: "BS Computer Science" };
    expect(formatProgramDisplay(prog1)).toBe("BS Computer Science");

    const prog2 = { id: 2, name: "FSC Pre-Medical", department: null };
    expect(formatProgramDisplay(prog2)).toBe("FSC Pre-Medical");

    const prog3 = { id: 3, name: "BBA", department: { name: "Management Sciences" } };
    expect(formatProgramDisplay(prog3)).toBe("BBA — Management Sciences");
  });
});
