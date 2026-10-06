import { describe, it, expect } from "vitest";
import { normalizeChallan, generateChallanHtml, applyPaidChallanPrintTreatment } from "../fee-management/feeFinancialUtils";

describe("ChallansTab Bulk Selection & Print Flow", () => {
  const mockChallans = [
    {
      _id: "ch-1",
      challanNumber: "CH-1001",
      studentName: "Ali Khan",
      rollNumber: "2026-FSC-01",
      amount: 15000,
      status: "PENDING",
      dueDate: "2026-10-15",
    },
    {
      _id: "ch-2",
      challanNumber: "CH-1002",
      studentName: "Sara Ahmed",
      rollNumber: "2026-ICS-02",
      amount: 20000,
      status: "PAID",
      dueDate: "2026-10-15",
    },
    {
      _id: "ch-3",
      challanNumber: "CH-1003",
      studentName: "Bilal Tariq",
      rollNumber: "2026-FA-03",
      amount: 12000,
      status: "PARTIAL",
      dueDate: "2026-10-15",
    },
  ];

  it("handles Select All and individual toggle logic correctly", () => {
    const visibleIds = mockChallans.map((c) => c._id);
    let selectedIds = [];

    // Initially none selected
    let isAllVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    let isSomeVisibleSelected =
      visibleIds.some((id) => selectedIds.includes(id)) && !isAllVisibleSelected;
    expect(isAllVisibleSelected).toBe(false);
    expect(isSomeVisibleSelected).toBe(false);

    // Toggle one
    selectedIds = [...selectedIds, "ch-1"];
    isAllVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    isSomeVisibleSelected =
      visibleIds.some((id) => selectedIds.includes(id)) && !isAllVisibleSelected;
    expect(isAllVisibleSelected).toBe(false);
    expect(isSomeVisibleSelected).toBe(true);

    // Select all
    selectedIds = Array.from(new Set([...selectedIds, ...visibleIds]));
    isAllVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    isSomeVisibleSelected =
      visibleIds.some((id) => selectedIds.includes(id)) && !isAllVisibleSelected;
    expect(isAllVisibleSelected).toBe(true);
    expect(isSomeVisibleSelected).toBe(false);
    expect(selectedIds).toHaveLength(3);

    // Deselect all
    selectedIds = selectedIds.filter((id) => !visibleIds.includes(id));
    expect(selectedIds).toHaveLength(0);
  });

  it("filters selected challans for bulk printing correctly", () => {
    const selectedIds = ["ch-1", "ch-3"];
    const challansToPrint = mockChallans.filter((c) => selectedIds.includes(c._id));

    expect(challansToPrint).toHaveLength(2);
    expect(challansToPrint.map((c) => c.challanNumber)).toEqual(["CH-1001", "CH-1003"]);
  });

  it("creates valid renderers for selected challans applying template and treatments", () => {
    const mockTemplateHtml = `<div>Challan {{challanNumber}} - {{studentName}}</div>`;
    const selected = [mockChallans[0], mockChallans[1]];

    const renderers = selected.map((challan) => () => {
      const normalized = normalizeChallan(challan);
      const baseHtml = generateChallanHtml(normalized, mockTemplateHtml, {
        lateFeeRatePerDay: 50,
      });
      return applyPaidChallanPrintTreatment(baseHtml, normalized, mockChallans);
    });

    expect(renderers).toHaveLength(2);

    const html1 = renderers[0]();
    expect(typeof html1).toBe("string");
    expect(html1).toContain("CH-1001");
    expect(html1).toContain("Ali Khan");

    const html2 = renderers[1]();
    expect(typeof html2).toBe("string");
    expect(html2).toContain("CH-1002");
    expect(html2).toContain("Sara Ahmed");
  });

  it("renders payment history for previous installments with month, total, and paid amounts in bottom table", () => {
    const templateHtml = `
      <table>
        <tr><td>Month</td>{{paymentHistoryMonths}}</tr>
        <tr><td>Total</td>{{paymentHistoryTotals}}</tr>
        <tr><td>Paid</td>{{paymentHistoryPaid}}</tr>
      </table>
    `;

    const challanInst3 = {
      _id: "ch-3",
      challanNumber: "CH-1003",
      installmentNumber: 3,
      amount: 15000,
      month: "March 2026",
      student: {
        _id: "s-1",
        fName: "Ali",
        lName: "Khan",
        rollNumber: "2026-FSC-01",
        installments: [
          { installmentNumber: 1, month: "January 2026", amount: 15000, paidAmount: 15000, status: "PAID" },
          { installmentNumber: 2, month: "February 2026", amount: 15000, paidAmount: 10000, status: "PARTIAL" },
          { installmentNumber: 3, month: "March 2026", amount: 15000, paidAmount: 0, status: "PENDING" },
        ],
      },
    };

    const html = generateChallanHtml(challanInst3, templateHtml, {});
    expect(html).toContain("<td>January 2026</td>");
    expect(html).toContain("<td>February 2026</td>");
    expect(html).toContain("<td>15000</td>");
    expect(html).toContain("<td>10000</td>");
    const monthRow = html.match(/<tr><td>Month<\/td>(.*?)<\/tr>/s)?.[1] || "";
    const monthCols = monthRow.match(/<td>.*?<\/td>/g);
    expect(monthCols).toHaveLength(4);
  });

  it("renders payment history from sibling feeChallans when student installments array is absent", () => {
    const templateHtml = `
      <table>
        <tr><td>Month</td>{{paymentHistoryMonths}}</tr>
        <tr><td>Total</td>{{paymentHistoryTotals}}</tr>
        <tr><td>Paid</td>{{paymentHistoryPaid}}</tr>
      </table>
    `;

    const siblingChallans = [
      {
        _id: "ch-101",
        challanNumber: "CH-101",
        studentId: "s-2",
        rollNumber: "2026-ICS-02",
        installmentNumber: 1,
        month: "October 2025",
        totalAmount: 12000,
        paidAmount: 12000,
        status: "PAID",
      },
      {
        _id: "ch-102",
        challanNumber: "CH-102",
        studentId: "s-2",
        rollNumber: "2026-ICS-02",
        installmentNumber: 2,
        month: "November 2025",
        totalAmount: 12000,
        paidAmount: 12000,
        status: "PAID",
      },
    ];

    const currentChallan = {
      _id: "ch-103",
      challanNumber: "CH-103",
      studentId: "s-2",
      rollNumber: "2026-ICS-02",
      installmentNumber: 3,
      month: "December 2025",
      totalAmount: 12000,
      status: "PENDING",
    };

    const html = generateChallanHtml(currentChallan, templateHtml, { feeChallans: siblingChallans });
    expect(html).toContain("<td>October 2025</td>");
    expect(html).toContain("<td>November 2025</td>");
    expect(html).toContain("<td>12000</td>");
  });

  it("limits payment history to the most recent 4 previous installments when more than 4 exist", () => {
    const templateHtml = `
      <table>
        <tr><td>Month</td>{{paymentHistoryMonths}}</tr>
        <tr><td>Total</td>{{paymentHistoryTotals}}</tr>
        <tr><td>Paid</td>{{paymentHistoryPaid}}</tr>
      </table>
    `;

    const challanInst6 = {
      _id: "ch-6",
      challanNumber: "CH-1006",
      installmentNumber: 6,
      amount: 10000,
      month: "June 2026",
      student: {
        _id: "s-5",
        fName: "Zaid",
        rollNumber: "2026-ENG-05",
        installments: [
          { installmentNumber: 1, month: "Jan 2026", amount: 10000, paidAmount: 10000, status: "PAID" },
          { installmentNumber: 2, month: "Feb 2026", amount: 10000, paidAmount: 10000, status: "PAID" },
          { installmentNumber: 3, month: "Mar 2026", amount: 10000, paidAmount: 10000, status: "PAID" },
          { installmentNumber: 4, month: "Apr 2026", amount: 10000, paidAmount: 10000, status: "PAID" },
          { installmentNumber: 5, month: "May 2026", amount: 10000, paidAmount: 10000, status: "PAID" },
          { installmentNumber: 6, month: "Jun 2026", amount: 10000, paidAmount: 0, status: "PENDING" },
        ],
      },
    };

    const html = generateChallanHtml(challanInst6, templateHtml, {});
    // Should NOT contain Jan 2026 (installment 1) because only previous 4 (2, 3, 4, 5) are shown
    expect(html).not.toContain("<td>Jan 2026</td>");
    expect(html).toContain("<td>Feb 2026</td>");
    expect(html).toContain("<td>Mar 2026</td>");
    expect(html).toContain("<td>Apr 2026</td>");
    expect(html).toContain("<td>May 2026</td>");
  });

  it("calculates actual totals (including heads, arrears, fine) and paid amounts (including advance and settled arrears)", () => {
    const templateHtml = `
      <table>
        <tr><td>Month</td>{{paymentHistoryMonths}}</tr>
        <tr><td>Total</td>{{paymentHistoryTotals}}</tr>
        <tr><td>Paid</td>{{paymentHistoryPaid}}</tr>
      </table>
    `;

    const challanInst3 = {
      _id: "ch-3",
      challanNumber: "CH-1003",
      installmentNumber: 3,
      amount: 10000,
      month: "December 2026",
      student: {
        _id: "s-1",
        fName: "Zain",
        rollNumber: "2026-FSC-10",
        installments: [
          {
            installmentNumber: 1,
            month: "October 2026",
            basePayable: 10000,
            headsAmount: 2000,
            arrearsAmount: 1000,
            fineAmount: 500,
            // Gross = 10000 + 2000 + 1000 + 500 = 13500
            grossAmount: 13500,
            // Paid via advance 3500 + direct 10000 = 13500
            advanceApplied: 3500,
            paidAmount: 10000,
            status: "PAID"
          },
          {
            installmentNumber: 2,
            month: "November 2026",
            basePayable: 10000,
            headsAmount: 1000,
            grossAmount: 11000,
            // Carried forward as arrears to subsequent challan, settled via arrears
            settledViaArrearsAmount: 11000,
            paidAmount: 0,
            status: "SUPERSEDED"
          },
          {
            installmentNumber: 3,
            month: "December 2026",
            amount: 10000,
            status: "PENDING"
          }
        ]
      }
    };

    const html = generateChallanHtml(challanInst3, templateHtml, {});
    // Oct should show full gross 13500 and total paid 13500 (direct + advance)
    expect(html).toContain("<td>13500</td>");
    // Nov should show full gross 11000 and total settled via arrears 11000
    expect(html).toContain("<td>11000</td>");
  });

  it("blocks selection when a prior installment in plan has not had its challan generated yet (including non-sequential months)", () => {
    // Student with non-sequential plan months: Nov 2026 (#1) -> Jan 2027 (#2) -> March 2027 (#3)
    const student = {
      id: "std-99",
      fName: "Hamza",
      lName: "Abbasi",
      feeInstallments: [
        { installmentNumber: 1, month: "November", dueDate: "2026-11-10", amount: 15000, challanGenerated: true },
        { installmentNumber: 2, month: "January", dueDate: "2027-01-10", amount: 15000, challanGenerated: false }, // missing!
        { installmentNumber: 3, month: "March", dueDate: "2027-03-10", amount: 15000, challanGenerated: false },
      ],
      challans: [
        { installmentNumber: 1, month: "November", status: "PAID", challanNo: "88001122" }
      ]
    };

    // When trying to generate March (#3) challan:
    const targetInst = student.feeInstallments.find(i => i.month.toLowerCase() === "march");
    expect(targetInst).toBeDefined();

    // Sort plan
    const sortedPlan = [...student.feeInstallments].sort((a, b) => Number(a.installmentNumber) - Number(b.installmentNumber));
    const targetIndex = sortedPlan.findIndex(i => i.installmentNumber === targetInst.installmentNumber);
    const priorPlanInsts = sortedPlan.slice(0, targetIndex);

    // Verify prior plan includes November and January
    expect(priorPlanInsts.map(i => i.month)).toEqual(["November", "January"]);

    // Find missing challans among prior installments
    const missingPriorInsts = priorPlanInsts.filter(pInst => {
      const hasChallan = Boolean(
        pInst.challanGenerated ||
        student.challans.some(c => c.status !== "VOID" && c.installmentNumber === pInst.installmentNumber)
      );
      return !hasChallan;
    });

    expect(missingPriorInsts).toHaveLength(1);
    expect(missingPriorInsts[0].month).toBe("January");

    const isBlocked = missingPriorInsts.length > 0;
    const missingMonthName = missingPriorInsts[0].month;
    const blockedReason = `Previous installment (${missingMonthName}) challan not generated yet. Please generate ${missingMonthName} challan first.`;

    expect(isBlocked).toBe(true);
    expect(blockedReason).toBe("Previous installment (January) challan not generated yet. Please generate January challan first.");
  });
});

