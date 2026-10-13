import { describe, it, expect } from "vitest";

describe("HR & Payroll Reports Redesign Logic", () => {
  // Test month formatting
  const formatPayrollMonth = (monthStr) => {
    if (!monthStr || typeof monthStr !== "string") return "-";
    const parts = monthStr.split("-");
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m)) {
        const date = new Date(y, m - 1, 1);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      }
    }
    return monthStr;
  };

  it("formats payroll month strings correctly into readable labels", () => {
    expect(formatPayrollMonth("2026-08")).toBe("Aug 2026");
    expect(formatPayrollMonth("2025-01")).toBe("Jan 2025");
    expect(formatPayrollMonth("2026-12")).toBe("Dec 2026");
    expect(formatPayrollMonth("")).toBe("-");
    expect(formatPayrollMonth(null)).toBe("-");
  });

  it("calculates month-wise payroll summary totals accurately", () => {
    const records = [
      {
        basicSalary: 50000,
        totalAllowances: 10000,
        totalDeductions: 5000,
        netSalary: 55000,
        paidAmount: 55000,
        status: "PAID",
      },
      {
        basicSalary: 60000,
        totalAllowances: 15000,
        totalDeductions: 8000,
        netSalary: 67000,
        paidAmount: 0,
        status: "PENDING",
      },
      {
        basicSalary: 40000,
        totalAllowances: 5000,
        totalDeductions: 3000,
        netSalary: 42000,
        paidAmount: 20000,
        status: "PARTIAL",
      },
    ];

    const totalBasic = records.reduce((s, r) => s + r.basicSalary, 0);
    const totalAllowances = records.reduce((s, r) => s + r.totalAllowances, 0);
    const totalDeductions = records.reduce((s, r) => s + r.totalDeductions, 0);
    const totalNet = records.reduce((s, r) => s + r.netSalary, 0);
    const totalPaid = records.reduce((s, r) => s + r.paidAmount, 0);
    const totalPending = records.reduce((s, r) => s + Math.max(0, r.netSalary - r.paidAmount), 0);

    expect(totalBasic).toBe(150000);
    expect(totalAllowances).toBe(30000);
    expect(totalDeductions).toBe(16000);
    expect(totalNet).toBe(164000);
    expect(totalPaid).toBe(75000);
    expect(totalPending).toBe(89000); // 0 + 67000 + 22000 = 89000
  });

  it("aggregates combined staff totals and consolidated breakdowns properly", () => {
    const staffRecords = [
      {
        staffId: "s1",
        staffName: "Ahmad Khan",
        basicSalary: 80000,
        totalAllowances: 20000,
        allowanceBreakdown: { travel: 5000, medical: 5000, houseRent: 10000, extra: 0, insurance: 0, other: 0 },
        totalDeductions: 10000,
        deductionBreakdown: { absent: 2000, leave: 0, advance: 3000, tax: 4000, eobi: 1000, security: 0, lateArrival: 0, other: 0 },
        netSalary: 90000,
        paidAmount: 90000,
        status: "PAID",
      },
      {
        staffId: "s2",
        staffName: "Fatima Noor",
        basicSalary: 70000,
        totalAllowances: 15000,
        allowanceBreakdown: { travel: 3000, medical: 4000, houseRent: 8000, extra: 0, insurance: 0, other: 0 },
        totalDeductions: 8000,
        deductionBreakdown: { absent: 1000, leave: 1000, advance: 2000, tax: 3000, eobi: 1000, security: 0, lateArrival: 0, other: 0 },
        netSalary: 77000,
        paidAmount: 0,
        status: "PENDING",
      },
    ];

    const combinedBasic = staffRecords.reduce((s, r) => s + r.basicSalary, 0);
    const combinedAllowances = staffRecords.reduce((s, r) => s + r.totalAllowances, 0);
    const combinedDeductions = staffRecords.reduce((s, r) => s + r.totalDeductions, 0);
    const combinedNet = staffRecords.reduce((s, r) => s + r.netSalary, 0);

    const combinedTravel = staffRecords.reduce((s, r) => s + r.allowanceBreakdown.travel, 0);
    const combinedTax = staffRecords.reduce((s, r) => s + r.deductionBreakdown.tax, 0);

    expect(combinedBasic).toBe(150000);
    expect(combinedAllowances).toBe(35000);
    expect(combinedDeductions).toBe(18000);
    expect(combinedNet).toBe(167000);
    expect(combinedTravel).toBe(8000);
    expect(combinedTax).toBe(7000);
  });

  it("handles staff selection checkboxes for selective print/preview", () => {
    const staffList = [
      { id: "s1", name: "Staff 1" },
      { id: "s2", name: "Staff 2" },
      { id: "s3", name: "Staff 3" },
    ];

    let selectedStaffIds = new Set();

    // Toggle staff 1
    selectedStaffIds.add("s1");
    expect(selectedStaffIds.has("s1")).toBe(true);
    expect(selectedStaffIds.size).toBe(1);

    // Toggle staff 2
    selectedStaffIds.add("s2");
    expect(selectedStaffIds.size).toBe(2);

    // Filter staff for selective print
    const effectiveStaff = staffList.filter((s) => selectedStaffIds.has(s.id));
    expect(effectiveStaff.length).toBe(2);
    expect(effectiveStaff.map((s) => s.id)).toEqual(["s1", "s2"]);

    // If none selected, effective staff defaults to all staff
    selectedStaffIds.clear();
    const fallbackStaff = selectedStaffIds.size === 0 ? staffList : staffList.filter((s) => selectedStaffIds.has(s.id));
    expect(fallbackStaff.length).toBe(3);
  });

  it("handles month-card selection and aggregates monthly totals correctly", () => {
    const monthCards = [
      {
        month: "2026-01",
        staffCount: 15,
        totalBasic: 750000,
        totalAllowances: 120000,
        allowanceBreakdown: { travel: 30000, medical: 40000, houseRent: 50000 },
        totalDeductions: 45000,
        deductionBreakdown: { absent: 15000, tax: 20000, advance: 10000 },
        totalNet: 825000,
        status: "PAID",
      },
      {
        month: "2026-02",
        staffCount: 16,
        totalBasic: 800000,
        totalAllowances: 130000,
        allowanceBreakdown: { travel: 35000, medical: 40000, houseRent: 55000 },
        totalDeductions: 50000,
        deductionBreakdown: { absent: 10000, tax: 25000, advance: 15000 },
        totalNet: 880000,
        status: "PARTIAL",
      },
    ];

    let selectedMonthKeys = new Set();
    selectedMonthKeys.add("2026-01");

    expect(selectedMonthKeys.has("2026-01")).toBe(true);
    expect(selectedMonthKeys.has("2026-02")).toBe(false);

    // Selected months filter
    const effectiveMonths = selectedMonthKeys.size === 0
      ? monthCards
      : monthCards.filter((m) => selectedMonthKeys.has(m.month));

    expect(effectiveMonths.length).toBe(1);
    expect(effectiveMonths[0].totalAllowances).toBe(120000);
    expect(effectiveMonths[0].totalDeductions).toBe(45000);
  });
});
