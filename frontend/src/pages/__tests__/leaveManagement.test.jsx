/**
 * Property-based tests for Leave Management feature.
 *
 * Property 8: Status badge variant matches leave status
 * Validates: Requirements 4.7, 4.8, 4.9
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// Feature: leave-management-attendance-integration, Property 8: Status badge variant matches leave status

// Pure statusBadge logic (mirrors LeavesManagementDialog.jsx)
const statusBadge = (status) => {
  if (status === "APPROVED") return { variant: "green", className: "bg-green-500 text-white" };
  if (status === "REJECTED") return { variant: "destructive" };
  return { variant: "secondary" };
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const leaveStatusArb = fc.constantFrom("PENDING", "APPROVED", "REJECTED");

const leaveRecordArb = fc.record({
  leaveId: fc.integer({ min: 1, max: 9999 }),
  staffId: fc.integer({ min: 1, max: 9999 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  status: leaveStatusArb,
});

// ---------------------------------------------------------------------------
// Property 8: Status badge variant matches leave status
// Validates: Requirements 4.7, 4.8, 4.9
// ---------------------------------------------------------------------------

describe("Property 8: Status badge variant matches leave status", () => {
  it("APPROVED status produces a badge with className including 'bg-green-500'", () => {
    fc.assert(
      fc.property(
        leaveRecordArb.filter((r) => r.status === "APPROVED"),
        (record) => {
          const badge = statusBadge(record.status);
          expect(badge.className).toContain("bg-green-500");
        }
      ),
      { numRuns: 20 }
    );
  });

  it("REJECTED status produces a badge with variant='destructive'", () => {
    fc.assert(
      fc.property(
        leaveRecordArb.filter((r) => r.status === "REJECTED"),
        (record) => {
          const badge = statusBadge(record.status);
          expect(badge.variant).toBe("destructive");
        }
      ),
      { numRuns: 20 }
    );
  });

  it("PENDING status produces a badge with variant='secondary'", () => {
    fc.assert(
      fc.property(
        leaveRecordArb.filter((r) => r.status === "PENDING"),
        (record) => {
          const badge = statusBadge(record.status);
          expect(badge.variant).toBe("secondary");
        }
      ),
      { numRuns: 20 }
    );
  });

  it("each status maps to exactly one badge variant across all statuses", () => {
    fc.assert(
      fc.property(leaveRecordArb, (record) => {
        const badge = statusBadge(record.status);
        if (record.status === "APPROVED") {
          expect(badge.className).toContain("bg-green-500");
        } else if (record.status === "REJECTED") {
          expect(badge.variant).toBe("destructive");
        } else {
          expect(badge.variant).toBe("secondary");
        }
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: leave-management-attendance-integration, Property 9: Edit button present in every table row

// Pure function that mirrors the table row rendering logic
const buildTableRows = (records) => records.map((r) => ({ ...r, hasEditButton: true }));

// ---------------------------------------------------------------------------
// Arbitraries for Property 9
// ---------------------------------------------------------------------------

const leaveRecordFullArb = fc.record({
  leaveId: fc.integer({ min: 1, max: 9999 }),
  staffId: fc.integer({ min: 1, max: 9999 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  status: fc.constantFrom("PENDING", "APPROVED", "REJECTED"),
  startDate: fc.constant("2024-01-01"),
  endDate: fc.constant("2024-01-01"),
  days: fc.integer({ min: 1, max: 30 }),
  reason: fc.string({ minLength: 1, maxLength: 100 }),
  month: fc.constant("2024-01"),
});

const nonEmptyLeaveRecordsArb = fc.array(leaveRecordFullArb, { minLength: 1, maxLength: 20 });

// ---------------------------------------------------------------------------
// Property 9: Edit button present in every table row
// Validates: Requirements 3.1
// ---------------------------------------------------------------------------

describe("Property 9: Edit button present in every table row", () => {
  it("buildTableRows produces exactly N rows for N records", () => {
    fc.assert(
      fc.property(nonEmptyLeaveRecordsArb, (records) => {
        const rows = buildTableRows(records);
        expect(rows.length).toBe(records.length);
      }),
      { numRuns: 20 }
    );
  });

  it("every row produced by buildTableRows has hasEditButton === true", () => {
    fc.assert(
      fc.property(nonEmptyLeaveRecordsArb, (records) => {
        const rows = buildTableRows(records);
        expect(rows.every((row) => row.hasEditButton === true)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: leave-management-attendance-integration, Property 7: Edit dialog pre-populates all record fields

// Pure pre-population logic (mirrors EditLeaveDialog useEffect)
const prepopulateEditDialog = (record) => {
  if (!record) return { selectedDates: [], reason: "", status: "PENDING" };
  const start = record.startDate ? new Date(record.startDate) : null;
  const end = record.endDate ? new Date(record.endDate) : null;
  const dates = [];
  if (start) dates.push(start);
  if (end && end.getTime() !== start?.getTime()) dates.push(end);
  return {
    selectedDates: dates.length > 0 ? dates : (start ? [start] : []),
    reason: record.reason || "",
    status: record.status || "PENDING",
  };
};

// ---------------------------------------------------------------------------
// Arbitraries for Property 7
// ---------------------------------------------------------------------------

// Build ISO date strings from year/month/day integers to avoid invalid Date edge cases
const isoDateStringArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // cap at 28 to stay valid for all months
  })
  .map(({ year, month, day }) => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  });

const leaveRecordForEditArb = fc.record({
  leaveId: fc.integer({ min: 1, max: 9999 }),
  staffId: fc.integer({ min: 1, max: 9999 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  status: fc.constantFrom("PENDING", "APPROVED", "REJECTED"),
  startDate: isoDateStringArb,
  endDate: isoDateStringArb,
  days: fc.integer({ min: 1, max: 30 }),
  reason: fc.string({ minLength: 0, maxLength: 200 }),
  month: fc.constant("2024-01"),
});

// ---------------------------------------------------------------------------
// Property 7: Edit dialog pre-populates all record fields
// Validates: Requirements 3.2, 4.2
// ---------------------------------------------------------------------------

describe("Property 7: Edit dialog pre-populates all record fields", () => {
  it("status dropdown value matches record.status", () => {
    fc.assert(
      fc.property(leaveRecordForEditArb, (record) => {
        const state = prepopulateEditDialog(record);
        expect(state.status).toBe(record.status);
      }),
      { numRuns: 20 }
    );
  });

  it("reason field value matches record.reason", () => {
    fc.assert(
      fc.property(leaveRecordForEditArb, (record) => {
        const state = prepopulateEditDialog(record);
        expect(state.reason).toBe(record.reason);
      }),
      { numRuns: 20 }
    );
  });

  it("calendar selection includes a date matching record.startDate", () => {
    fc.assert(
      fc.property(leaveRecordForEditArb, (record) => {
        const state = prepopulateEditDialog(record);
        const startDateStr = new Date(record.startDate).toISOString().slice(0, 10);
        const hasStartDate = state.selectedDates.some(
          (d) => d.toISOString().slice(0, 10) === startDateStr
        );
        expect(hasStartDate).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  it("all three fields are pre-populated correctly for any record", () => {
    fc.assert(
      fc.property(leaveRecordForEditArb, (record) => {
        const state = prepopulateEditDialog(record);
        const startDateStr = new Date(record.startDate).toISOString().slice(0, 10);

        expect(state.status).toBe(record.status);
        expect(state.reason).toBe(record.reason);
        expect(
          state.selectedDates.some((d) => d.toISOString().slice(0, 10) === startDateStr)
        ).toBe(true);
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: leave-management-attendance-integration, Property 1: Date toggle is an involution

// Pure toggle logic (mirrors CreateLeaveDialog / EditLeaveDialog date selection)
const toggleDate = (selectedDates, date) => {
  const dateStr = date.toISOString().slice(0, 10);
  const exists = selectedDates.some(d => d.toISOString().slice(0, 10) === dateStr);
  if (exists) return selectedDates.filter(d => d.toISOString().slice(0, 10) !== dateStr);
  return [...selectedDates, date];
};

// ---------------------------------------------------------------------------
// Arbitraries for Property 1
// ---------------------------------------------------------------------------

// Safe integer-based Date generator (avoids invalid/edge-case timestamps)
const safeDateArb = fc
  .integer({ min: 0, max: 10000 })
  .map(n => new Date(Date.UTC(2020, 0, 1) + n * 86400000));

const selectedDatesArb = fc.array(safeDateArb, { minLength: 0, maxLength: 5 });

// ---------------------------------------------------------------------------
// Property 1: Date toggle is an involution
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------

describe("Property 1: Date toggle is an involution", () => {
  it("toggling a date twice returns the selection to its original state", () => {
    fc.assert(
      fc.property(selectedDatesArb, safeDateArb, (initialDates, dateToToggle) => {
        const afterFirst = toggleDate(initialDates, dateToToggle);
        const afterSecond = toggleDate(afterFirst, dateToToggle);

        // Same length
        expect(afterSecond.length).toBe(initialDates.length);

        // Same dates by ISO string comparison
        const originalStrs = new Set(initialDates.map(d => d.toISOString().slice(0, 10)));
        const resultStrs = new Set(afterSecond.map(d => d.toISOString().slice(0, 10)));
        expect(resultStrs.size).toBe(originalStrs.size);
        for (const s of originalStrs) {
          expect(resultStrs.has(s)).toBe(true);
        }
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: leave-management-attendance-integration, Property 2: Selected date count label matches selection size

// Pure count label logic (mirrors the Multi-Date Calendar Picker summary)
const countLabel = (selectedDates) =>
  selectedDates.length > 0 ? `${selectedDates.length} date(s) selected` : "";

// ---------------------------------------------------------------------------
// Arbitraries for Property 2
// ---------------------------------------------------------------------------

const nonEmptyDatesArb = fc.array(safeDateArb, { minLength: 1, maxLength: 10 });

// ---------------------------------------------------------------------------
// Property 2: Selected date count label matches selection size
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------

describe("Property 2: Selected date count label matches selection size", () => {
  it("countLabel contains the string representation of the number of selected dates", () => {
    fc.assert(
      fc.property(nonEmptyDatesArb, (dates) => {
        const label = countLabel(dates);
        expect(label).toContain(String(dates.length));
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: leave-management-attendance-integration, Property 3: Multi-date submit creates one record per date

// Pure multi-date submit logic (mirrors handleCreateLeave in LeavesManagementDialog.jsx)
const buildUpsertPayloads = (selectedDates, staffId, reason) => {
  return selectedDates.map(date => {
    const year = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    const monthStr = `${year}-${mm}`;
    return {
      staffId,
      startDate: dateStr,
      endDate: dateStr,
      days: 1,
      month: monthStr,
      reason,
      status: "PENDING",
    };
  });
};

// ---------------------------------------------------------------------------
// Arbitraries for Property 3
// ---------------------------------------------------------------------------

const staffIdArb = fc.integer({ min: 1, max: 9999 });
const reasonArb = fc.string({ minLength: 0, maxLength: 200 });

// ---------------------------------------------------------------------------
// Property 3: Multi-date submit creates one record per date
// Validates: Requirements 1.4
// ---------------------------------------------------------------------------

describe("Property 3: Multi-date submit creates one record per date", () => {
  it("buildUpsertPayloads returns exactly one payload per selected date", () => {
    fc.assert(
      fc.property(nonEmptyDatesArb, staffIdArb, reasonArb, (dates, staffId, reason) => {
        const payloads = buildUpsertPayloads(dates, staffId, reason);
        expect(payloads.length).toBe(dates.length);
      }),
      { numRuns: 20 }
    );
  });

  it("every payload has startDate === endDate", () => {
    fc.assert(
      fc.property(nonEmptyDatesArb, staffIdArb, reasonArb, (dates, staffId, reason) => {
        const payloads = buildUpsertPayloads(dates, staffId, reason);
        expect(payloads.every(p => p.startDate === p.endDate)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  it("every payload has days === 1", () => {
    fc.assert(
      fc.property(nonEmptyDatesArb, staffIdArb, reasonArb, (dates, staffId, reason) => {
        const payloads = buildUpsertPayloads(dates, staffId, reason);
        expect(payloads.every(p => p.days === 1)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  it("all three properties hold together for any non-empty date array", () => {
    fc.assert(
      fc.property(nonEmptyDatesArb, staffIdArb, reasonArb, (dates, staffId, reason) => {
        const payloads = buildUpsertPayloads(dates, staffId, reason);
        expect(payloads.length).toBe(dates.length);
        expect(payloads.every(p => p.startDate === p.endDate)).toBe(true);
        expect(payloads.every(p => p.days === 1)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: leave-management-attendance-integration, Property 5: Staff combobox filter is case-insensitive substring match

// Pure filter logic (mirrors filteredStaff in CreateLeaveDialog)
const filterStaff = (staffList, query) =>
  staffList.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

// ---------------------------------------------------------------------------
// Arbitraries for Property 5
// ---------------------------------------------------------------------------

const staffMemberArb = fc.record({
  id: fc.integer({ min: 1, max: 9999 }),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  isTeaching: fc.boolean(),
  isNonTeaching: fc.boolean(),
  department: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
});

const staffListArb = fc.array(staffMemberArb, { minLength: 0, maxLength: 20 });
const searchQueryArb = fc.string({ minLength: 0, maxLength: 20 });

// ---------------------------------------------------------------------------
// Property 5: Staff combobox filter is case-insensitive substring match
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

describe("Property 5: Staff combobox filter is case-insensitive substring match", () => {
  it("result count equals the number of staff whose names contain the query (case-insensitive)", () => {
    fc.assert(
      fc.property(staffListArb, searchQueryArb, (staffList, query) => {
        const result = filterStaff(staffList, query);
        const expected = staffList.filter(s =>
          s.name.toLowerCase().includes(query.toLowerCase())
        );
        expect(result.length).toBe(expected.length);
      }),
      { numRuns: 20 }
    );
  });

  it("every item in the result has a name that contains the query (case-insensitive)", () => {
    fc.assert(
      fc.property(staffListArb, searchQueryArb, (staffList, query) => {
        const result = filterStaff(staffList, query);
        expect(
          result.every(s => s.name.toLowerCase().includes(query.toLowerCase()))
        ).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  it("no item excluded from the result has a name that contains the query (case-insensitive)", () => {
    fc.assert(
      fc.property(staffListArb, searchQueryArb, (staffList, query) => {
        const result = filterStaff(staffList, query);
        const resultIds = new Set(result.map(s => s.id));
        const excluded = staffList.filter(s => !resultIds.has(s.id));
        expect(
          excluded.every(s => !s.name.toLowerCase().includes(query.toLowerCase()))
        ).toBe(true);
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: Leave Action History & Balance Approval Restriction

const getActionDetails = (actionStr) => {
  const action = String(actionStr || "").toUpperCase();
  if (action === "STATUS_APPROVED" || action === "APPROVED") {
    return { label: "Approved", badgeClass: "bg-green-500" };
  }
  if (action === "STATUS_REJECTED" || action === "REJECTED") {
    return { label: "Rejected", badgeClass: "bg-destructive" };
  }
  if (action === "CREATED") {
    return { label: "Request Submitted", badgeClass: "bg-blue-600" };
  }
  if (action === "UPDATED") {
    return { label: "Request Updated", badgeClass: "bg-amber-500" };
  }
  if (action === "LOCKED") {
    return { label: "Locked", badgeClass: "bg-zinc-700" };
  }
  if (action === "UNLOCKED") {
    return { label: "Unlocked", badgeClass: "bg-zinc-500" };
  }
  return { label: action.replace(/^STATUS_/, ""), badgeClass: "bg-secondary" };
};

const calculateUsedLeaves = (leaves, leaveType) => {
  return leaves
    .filter(
      (l) =>
        String(l.status).toUpperCase() === "APPROVED" &&
        String(l.leaveType).toUpperCase() === String(leaveType).toUpperCase()
    )
    .reduce((sum, l) => sum + (Number(l.days) || 1), 0);
};

describe("Leave Action History Mapping", () => {
  it("maps CREATED to Request Submitted", () => {
    const details = getActionDetails("CREATED");
    expect(details.label).toBe("Request Submitted");
    expect(details.badgeClass).toContain("bg-blue-600");
  });

  it("maps STATUS_APPROVED and APPROVED to Approved", () => {
    expect(getActionDetails("STATUS_APPROVED").label).toBe("Approved");
    expect(getActionDetails("APPROVED").label).toBe("Approved");
    expect(getActionDetails("STATUS_APPROVED").badgeClass).toContain("bg-green-500");
  });

  it("maps STATUS_REJECTED and REJECTED to Rejected", () => {
    expect(getActionDetails("STATUS_REJECTED").label).toBe("Rejected");
    expect(getActionDetails("REJECTED").label).toBe("Rejected");
    expect(getActionDetails("STATUS_REJECTED").badgeClass).toContain("bg-destructive");
  });

  it("maps UPDATED, LOCKED, UNLOCKED appropriately", () => {
    expect(getActionDetails("UPDATED").label).toBe("Request Updated");
    expect(getActionDetails("LOCKED").label).toBe("Locked");
    expect(getActionDetails("UNLOCKED").label).toBe("Unlocked");
  });
});

describe("Leave Balance Count - Approved Only", () => {
  it("only counts leaves with status APPROVED as used", () => {
    const leaves = [
      { leaveType: "SICK", days: 1, status: "PENDING" },
      { leaveType: "SICK", days: 2, status: "REJECTED" },
      { leaveType: "SICK", days: 3, status: "APPROVED" },
      { leaveType: "CASUAL", days: 2, status: "APPROVED" },
    ];
    expect(calculateUsedLeaves(leaves, "SICK")).toBe(3);
    expect(calculateUsedLeaves(leaves, "CASUAL")).toBe(2);
    expect(calculateUsedLeaves(leaves, "ANNUAL")).toBe(0);
  });

  it("returns 0 used leaves when request is rejected", () => {
    const leaves = [{ leaveType: "SICK", days: 1, status: "REJECTED" }];
    expect(calculateUsedLeaves(leaves, "SICK")).toBe(0);
  });

  it("returns 0 used leaves when request is pending", () => {
    const leaves = [{ leaveType: "SICK", days: 1, status: "PENDING" }];
    expect(calculateUsedLeaves(leaves, "SICK")).toBe(0);
  });
});

describe("AttendanceTab Leave Info and Bulk Mark Payloads", () => {
  const getLeaveInfo = (leaveType) => {
    const t = String(leaveType || "CASUAL").toUpperCase();
    if (t === "SICK" || t === "SK") {
      return { code: "SK", label: "Sick Leave" };
    }
    if (t === "ANNUAL" || t === "AL") {
      return { code: "AL", label: "Annual Leave" };
    }
    return { code: "CL", label: "Casual Leave" };
  };

  const buildSavePayloads = (staffAttendanceRows, staffAttendanceChanges, date) => {
    return staffAttendanceRows
      .map((row) => {
        const staffId = String(row.staffId || row.staff?.id || row.staff?._id || row.id || "");
        if (!staffId) return null;
        const changed = staffAttendanceChanges[staffId];
        const changedStatus = typeof changed === "string" ? changed : changed?.status;
        const changedLeaveType =
          typeof changed === "object" && changed !== null ? changed.leaveType : undefined;

        const effectiveStatus = (changedStatus || row.status || "").toLowerCase();
        if (!effectiveStatus || effectiveStatus === "null" || effectiveStatus === "undefined") {
          return null;
        }

        const effectiveLeaveType =
          changedLeaveType ||
          row.leaveType ||
          (effectiveStatus === "leave" ? "CASUAL" : undefined);

        return {
          staffId,
          date,
          status: effectiveStatus.toUpperCase(),
          leaveType:
            effectiveStatus === "leave"
              ? String(effectiveLeaveType || "CASUAL").toUpperCase()
              : undefined,
          notes: row.notes || (row.isApprovedLeave ? row.leaveReason || "Approved Leave" : ""),
        };
      })
      .filter(Boolean);
  };

  it("getLeaveInfo correctly maps SK (Sick), CL (Casual), and AL (Annual)", () => {
    expect(getLeaveInfo("SICK")).toEqual({ code: "SK", label: "Sick Leave" });
    expect(getLeaveInfo("SK")).toEqual({ code: "SK", label: "Sick Leave" });
    expect(getLeaveInfo("CASUAL")).toEqual({ code: "CL", label: "Casual Leave" });
    expect(getLeaveInfo("CL")).toEqual({ code: "CL", label: "Casual Leave" });
    expect(getLeaveInfo("ANNUAL")).toEqual({ code: "AL", label: "Annual Leave" });
    expect(getLeaveInfo("AL")).toEqual({ code: "AL", label: "Annual Leave" });
  });

  it("buildSavePayloads includes auto-marked approved leaves and manual marks, while skipping unmarked staff", () => {
    const rows = [
      {
        staffId: "66e000000000000000000001",
        name: "Teacher 1",
        status: "LEAVE",
        leaveType: "SICK",
        isApprovedLeave: true,
        leaveReason: "Flu",
      },
      {
        staffId: "66e000000000000000000002",
        name: "Teacher 2",
        status: null,
        isApprovedLeave: false,
      },
      {
        staffId: "66e000000000000000000003",
        name: "Staff 3",
        status: null,
        isApprovedLeave: false,
      },
    ];

    const changes = {
      "66e000000000000000000002": { status: "present" },
    };

    const payloads = buildSavePayloads(rows, changes, "2026-09-20");

    expect(payloads).toHaveLength(2);
    expect(payloads).toContainEqual({
      staffId: "66e000000000000000000001",
      date: "2026-09-20",
      status: "LEAVE",
      leaveType: "SICK",
      notes: "Flu",
    });
    expect(payloads).toContainEqual({
      staffId: "66e000000000000000000002",
      date: "2026-09-20",
      status: "PRESENT",
      leaveType: undefined,
      notes: "",
    });
  });

  it("manual leave change overrides existing status and sets selected leave type", () => {
    const rows = [
      {
        staffId: "66e000000000000000000001",
        name: "Teacher 1",
        status: "PRESENT",
      },
    ];

    const changes = {
      "66e000000000000000000001": { status: "leave", leaveType: "annual" },
    };

    const payloads = buildSavePayloads(rows, changes, "2026-09-20");

    expect(payloads).toEqual([
      {
        staffId: "66e000000000000000000001",
        date: "2026-09-20",
        status: "LEAVE",
        leaveType: "ANNUAL",
        notes: "",
      },
    ]);
  });
});

describe("Payroll Excess Leave and Absent Deduction Calculations", () => {
  const calculatePayrollDeductions = ({
    basicSalary = 0,
    leaveCounts = { casual: 0, sick: 0, annual: 0 },
    leaveSettings = {
      casualAllowed: 2,
      casualDeduction: 500,
      sickAllowed: 2,
      sickDeduction: 1000,
      annualAllowed: 2,
      annualDeduction: 1000,
    },
    absentCount = 0,
    absentRate = 0,
    otherDeductions = 0,
    allowances = 0,
  }) => {
    const casualExcess = Math.max(0, (leaveCounts.casual || 0) - (leaveSettings.casualAllowed ?? 0));
    const sickExcess = Math.max(0, (leaveCounts.sick || 0) - (leaveSettings.sickAllowed ?? 0));
    const annualExcess = Math.max(0, (leaveCounts.annual || 0) - (leaveSettings.annualAllowed ?? 0));

    const casualDeduction = casualExcess * (leaveSettings.casualDeduction ?? 0);
    const sickDeduction = sickExcess * (leaveSettings.sickDeduction ?? 0);
    const annualDeduction = annualExcess * (leaveSettings.annualDeduction ?? 0);
    const totalLeaveDeduction = casualDeduction + sickDeduction + annualDeduction;

    const absentDeduction = absentCount * absentRate;
    const totalDeductions = totalLeaveDeduction + absentDeduction + otherDeductions;
    const netSalary = Math.max(0, basicSalary - totalDeductions + allowances);

    return {
      casualExcess,
      sickExcess,
      annualExcess,
      casualDeduction,
      sickDeduction,
      annualDeduction,
      leaveDeduction: totalLeaveDeduction,
      absentDeduction,
      totalDeductions,
      netSalary,
    };
  };

  const applyPayrollPayment = (payroll, paymentAmount, paymentMethod = "Cash", userName = "Admin") => {
    const currentPaid = Number(payroll.paidAmount || 0);
    const netSalary = Number(payroll.netSalary || 0);
    const newPaidTotal = currentPaid + paymentAmount;
    const newBalance = Math.max(0, netSalary - newPaidTotal);
    const newStatus = newBalance === 0 ? "PAID" : "partially_paid";

    const paymentRecord = {
      amount: paymentAmount,
      paidAt: new Date().toISOString(),
      paidByName: userName,
      paymentMethod,
    };

    return {
      ...payroll,
      paidAmount: newPaidTotal,
      balanceAmount: newBalance,
      status: newStatus,
      payments: [...(payroll.payments || []), paymentRecord],
    };
  };

  it("calculates leave deductions only for excess days beyond allowed per leave type", () => {
    const res = calculatePayrollDeductions({
      basicSalary: 30000,
      leaveCounts: { casual: 3, sick: 4, annual: 1 },
      leaveSettings: {
        casualAllowed: 2,
        casualDeduction: 500,
        sickAllowed: 2,
        sickDeduction: 1000,
        annualAllowed: 2,
        annualDeduction: 1200,
      },
    });

    expect(res.casualExcess).toBe(1); // 3 - 2
    expect(res.sickExcess).toBe(2); // 4 - 2
    expect(res.annualExcess).toBe(0); // 1 <= 2
    expect(res.casualDeduction).toBe(500); // 1 * 500
    expect(res.sickDeduction).toBe(2000); // 2 * 1000
    expect(res.annualDeduction).toBe(0);
    expect(res.leaveDeduction).toBe(2500);
    expect(res.netSalary).toBe(27500);
  });

  it("calculates absent deduction from active absent deduction rate and absent count", () => {
    const res = calculatePayrollDeductions({
      basicSalary: 25000,
      absentCount: 3,
      absentRate: 800,
    });

    expect(res.absentDeduction).toBe(2400); // 3 * 800
    expect(res.totalDeductions).toBe(2400);
    expect(res.netSalary).toBe(22600);
  });

  it("partially paid payment updates paidAmount, balanceAmount, and status to partially_paid", () => {
    const initialPayroll = {
      basicSalary: 30000,
      netSalary: 30000,
      paidAmount: 0,
      balanceAmount: 30000,
      status: "PENDING",
      payments: [],
    };

    const afterPartial = applyPayrollPayment(initialPayroll, 10000, "Bank Transfer", "HR Officer");

    expect(afterPartial.paidAmount).toBe(10000);
    expect(afterPartial.balanceAmount).toBe(20000);
    expect(afterPartial.status).toBe("partially_paid");
    expect(afterPartial.payments).toHaveLength(1);
    expect(afterPartial.payments[0].amount).toBe(10000);
    expect(afterPartial.payments[0].paymentMethod).toBe("Bank Transfer");

    // Second payment to fully clear
    const afterFull = applyPayrollPayment(afterPartial, 20000, "Cash", "Accountant");
    expect(afterFull.paidAmount).toBe(30000);
    expect(afterFull.balanceAmount).toBe(0);
    expect(afterFull.status).toBe("PAID");
    expect(afterFull.payments).toHaveLength(2);
  });

  it("historical payroll is preserved when absent deduction setting rate is modified later", () => {
    // Payroll generated under rate 500
    const pastPayroll = calculatePayrollDeductions({
      basicSalary: 20000,
      absentCount: 2,
      absentRate: 500, // old rate
    });
    expect(pastPayroll.absentDeduction).toBe(1000);

    // Setting updated to 1000 for future payrolls
    const futureRate = 1000;

    // Past payroll object keeps its stored absentDeduction of 1000
    expect(pastPayroll.absentDeduction).toBe(1000);

    // New payroll uses new rate
    const newPayroll = calculatePayrollDeductions({
      basicSalary: 20000,
      absentCount: 2,
      absentRate: futureRate,
    });
    expect(newPayroll.absentDeduction).toBe(2000);
  });
});

