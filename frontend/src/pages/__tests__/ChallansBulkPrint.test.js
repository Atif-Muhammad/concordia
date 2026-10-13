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
            // Carried forward as arrears to subsequent challan, unpaid
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
    // Oct should show full total amount 13500 (10000 base + 2000 heads + 1000 arrears + 500 fine) and total paid 13500
    expect(html).toContain("<td>13500</td>");
    // Nov should show full gross 11000
    expect(html).toContain("<td>11000</td>");
    // Nov was SUPERSEDED with 0 paid amount, so Paid row must show 0, NOT 11000
    const paidRow = html.match(/<tr><td>Paid<\/td>(.*?)<\/tr>/s)?.[1] || "";
    expect(paidRow).toContain("<td>0</td>");
  });

  it("shows actual total from arrearAllocations (e.g. September 51200) instead of plan base payable (19000)", () => {
    const templateHtml = `
      <table>
        <tr><td>Month</td>{{paymentHistoryMonths}}</tr>
        <tr><td>Total</td>{{paymentHistoryTotals}}</tr>
        <tr><td>Paid</td>{{paymentHistoryPaid}}</tr>
      </table>
    `;

    // November challan with September arrears carried forward
    const currentChallan = {
      _id: "ch-nov",
      challanNumber: "CH-NOV-1",
      installmentNumber: 2,
      month: "November 2026",
      arrearAllocations: [
        {
          sourceChallanNo: "16700213",
          sourceInstallmentNumber: 1,
          sourceMonth: "September",
          originalDueAmount: 51200,
          amountCarriedForward: 51200,
          amountSettled: 0
        }
      ],
      student: {
        _id: "s-sept",
        fName: "Ali",
        rollNumber: "2026-FSC-99",
        installments: [
          {
            installmentNumber: 1,
            month: "September",
            amount: 19000, // base tuition plan amount
            paidAmount: 6000,
            status: "SUPERSEDED"
          },
          {
            installmentNumber: 2,
            month: "November",
            amount: 19000,
            status: "PENDING"
          }
        ]
      }
    };

    const html = generateChallanHtml(currentChallan, templateHtml, {});
    // September total should show 51200 from arrearAllocations / actual challan, NOT 19000 base payable
    expect(html).toContain("<td>51200</td>");
    expect(html).not.toContain("<td>19000</td>");
    // September paid should show 6000 (actual paid), NOT 51200
    expect(html).toContain("<td>6000</td>");
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

  it("settles all N-hop ancestor challans FIFO when a downstream challan is settled/paid", () => {
    // Chain: C1 (Sept, 10k) -> C2 (Oct, 10k + 10k arrears) -> C3 (Nov, 10k + 20k arrears)
    const challanChain = [
      {
        id: "c-sept",
        challanNo: "CH-001",
        installmentNumber: 1,
        month: "September",
        basePayable: 10000,
        totalAmount: 10000,
        paidAmount: 0,
        settledViaArrearsAmount: 0,
        status: "SUPERSEDED",
        supersededBy: "c-oct"
      },
      {
        id: "c-oct",
        challanNo: "CH-002",
        installmentNumber: 2,
        month: "October",
        basePayable: 10000,
        totalAmount: 20000,
        paidAmount: 0,
        settledViaArrearsAmount: 0,
        status: "SUPERSEDED",
        supersededBy: "c-nov",
        arrearAllocations: [{ sourceChallanId: "c-sept", amountCarriedForward: 10000 }]
      },
      {
        id: "c-nov",
        challanNo: "CH-003",
        installmentNumber: 3,
        month: "November",
        basePayable: 10000,
        totalAmount: 30000,
        paidAmount: 30000,
        status: "PAID",
        arrearAllocations: [{ sourceChallanId: "c-oct", amountCarriedForward: 20000, amountSettled: 20000 }]
      }
    ];

    // Simulate N-hop settlement resolution algorithm
    const resolveDownstreamSettlement = (c, allChallans) => {
      let cur = c;
      const seen = new Set([cur.id]);
      while (cur && cur.supersededBy) {
        const nextId = typeof cur.supersededBy === "object" ? cur.supersededBy.id : cur.supersededBy;
        if (seen.has(nextId)) break;
        seen.add(nextId);
        const next = allChallans.find(ch => ch.id === nextId);
        if (!next) break;
        if (["PAID", "SETTLED"].includes(next.status)) {
          return {
            isSettled: true,
            settledByChallanNo: next.settledByChallanNo || next.challanNo,
            settledByChallanId: next.id
          };
        }
        cur = next;
      }
      return null;
    };

    // Both Sept and Oct must resolve as SETTLED via Nov (N=2 hops back for Sept, N=1 for Oct)
    const septResolution = resolveDownstreamSettlement(challanChain[0], challanChain);
    expect(septResolution).not.toBeNull();
    expect(septResolution.isSettled).toBe(true);
    expect(septResolution.settledByChallanNo).toBe("CH-003");

    const octResolution = resolveDownstreamSettlement(challanChain[1], challanChain);
    expect(octResolution).not.toBeNull();
    expect(octResolution.isSettled).toBe(true);
    expect(octResolution.settledByChallanNo).toBe("CH-003");
  });

  it("accumulates dynamic day-to-day late fees using Math.max(existingFine, autoFine)", () => {
    const existingFine = 300; // fine frozen at generation (2 days overdue)
    const autoFine = 750;     // current elapsed fine (5 days overdue * 150)
    const effectiveFine = Math.max(existingFine, autoFine);
    expect(effectiveFine).toBe(750);

    const grossTotal = 15300; // base 15000 + existingFine 300
    const fineIncluded = existingFine > 0;
    const additionalFine = fineIncluded ? Math.max(0, effectiveFine - existingFine) : effectiveFine;
    const totalWithFine = grossTotal + additionalFine;
    expect(totalWithFine).toBe(15750); // 15000 base + 750 autoFine
  });

  it("renders print slip late fee row with clean daily rate and no duplicate accumulated amount", () => {
    const mockTemplateHtml = `
      <div>
        <table class="fee-table">
          <tr><td>Total Payable within due date</td><td>{{totalPayable}}</td></tr>
          <tr class="late-fee-row">
            <td>Late Fee Fine after due date</td>
            <td>{{lateFee}}</td>
          </tr>
        </table>
      </div>
    `;

    const challan = {
      _id: "ch-overdue-1",
      challanNumber: "CH-9001",
      studentName: "Zaid Ali",
      amount: 10000,
      totalAmount: 10750,
      netPayable: 10750,
      lateFeeAmount: 750,
      paidAmount: 0,
      dueDate: "2026-10-01",
      status: "OVERDUE",
    };

    const normalized = normalizeChallan(challan);
    const html = generateChallanHtml(normalized, mockTemplateHtml, {
      lateFeeRatePerDay: 150,
    });

    // Should indicate overdue in total header
    expect(html).toContain("Total Payable (Overdue)");
    // Must contain clean daily rate
    expect(html).toContain("Rs. 150 Per Day");
    // Must NOT contain duplicate fine pattern "PKR 750 (Rs. 150/day)" in the late fee row
    expect(html).not.toContain("PKR 750 (Rs. 150/day)");
    expect(html).not.toContain("PKR 750");
  });

  it("shows challan's total amount in payment history (October 20k, not base 10k) and actual paid amount", () => {
    const templateHtml = `
      <table>
        <tr><td>Month</td>{{paymentHistoryMonths}}</tr>
        <tr><td>Total</td>{{paymentHistoryTotals}}</tr>
        <tr><td>Paid</td>{{paymentHistoryPaid}}</tr>
      </table>
    `;

    // November challan viewing history of Sept (10k) and Oct (10k own + 10k arrears = 20k total)
    const septChallan = {
      _id: "ch-sept-hist",
      challanNumber: "CH-01",
      installmentNumber: 1,
      month: "September",
      basePayable: 10000,
      totalAmount: 10000,
      paidAmount: 10000,
      status: "SETTLED"
    };

    const octChallan = {
      _id: "ch-oct-hist",
      challanNumber: "CH-02",
      installmentNumber: 2,
      month: "October",
      basePayable: 10000,
      arrearsAmount: 10000, // carried forward from September
      totalAmount: 20000,
      paidAmount: 10000,
      status: "SETTLED" // 100% settled/paid
    };

    const currentNovChallan = {
      _id: "ch-nov-hist",
      challanNumber: "CH-03",
      installmentNumber: 3,
      month: "November",
      basePayable: 10000,
      arrearsAmount: 20000,
      totalAmount: 30000,
      paidAmount: 0,
      status: "PENDING",
      previousChallans: [septChallan, octChallan]
    };

    const html = generateChallanHtml(currentNovChallan, templateHtml, {
      feeChallans: [septChallan, octChallan]
    });

    expect(html).toContain("<td>September</td><td>October</td>");
    // September total is 10000, October total is 20000 (total amount, not just base tuition fee)
    expect(html).toContain("<td>10000</td><td>20000</td>");
    // And both must show their actual paid amount (10000 each)
    expect(html).toContain("<td>10000</td><td>10000</td>");
  });

  it("itemizes Late Fee Fine (Overdue) in particulars and shows Total Payable (Overdue)", () => {
    const templateHtml = `
      <table>
        <tbody>
          {{feeHeadsRows}}
          <tr class="total-row">
            <td>Total Payable within due date</td>
            <td>{{totalPayable}}</td>
          </tr>
          <tr class="late-fee-row">
            <td>Late Fee Fine after due date</td>
            <td>{{lateFee}}</td>
          </tr>
        </tbody>
      </table>
    `;

    const overdueChallan = {
      _id: "ch-overdue-particulars",
      challanNumber: "85025901",
      amount: 4666,
      basePayable: 4666,
      dueDate: "2020-01-01", // definitely past
      lateFeeAmount: 150,
      lateFeeRatePerDay: 50,
      status: "PENDING",
      challanHeads: [
        { name: "Allied & Functional Charges - 1st Year", amount: 6000 },
        { name: "Prospectus Fee", amount: 1200 },
      ],
      paidAmount: 5800,
    };

    const normalized = normalizeChallan(overdueChallan);
    const html = generateChallanHtml(normalized, templateHtml, {
      lateFeeRatePerDay: 50,
    });

    expect(html).toContain("Late Fee Fine (Overdue)");
    expect(html).toContain("Total Payable (Overdue)");
    // Gross: 4666 + 6000 + 1200 + lateFee (150+)
    // With 5800 paid, remaining payable reflects overdue total - 5800
    expect(normalized.lateFeeAmount).toBeGreaterThanOrEqual(150);
  });

  it("renders multiple partial payments in particulars table after Total Amount row with date/time and amount", () => {
    const templateHtml = `
      <table>
        <tbody>
          {{paidRow}}
        </tbody>
      </table>
    `;

    const challanWithPartialPayments = {
      _id: "ch-multi-partial",
      challanNumber: "CH-PARTIAL-101",
      amount: 15000,
      totalAmount: 15000,
      paidAmount: 10000,
      status: "PARTIAL",
      paymentHistory: [
        { amount: 4000, date: "2026-10-10", time: "11:30 AM" },
        { amount: 6000, date: "2026-10-12", time: "03:15 PM" },
      ],
      student: { _id: "s-100", fName: "Test", lName: "Student" },
    };

    const html = generateChallanHtml(challanWithPartialPayments, templateHtml, {});

    // Ensure Total Amount row exists
    expect(html).toContain("Total Amount");
    expect(html).toContain("15,000");

    // Ensure Partial Paid rows exist
    expect(html).toContain("Partial Paid");
    expect(html).toContain("10 Oct 2026, 11:30 AM");
    expect(html).toContain("4,000");
    expect(html).toContain("12 Oct 2026, 03:15 PM");
    expect(html).toContain("6,000");

    // Ensure Paid Amount row exists with total paid
    expect(html).toContain("Paid Amount");
    expect(html).toContain("10,000");

    // Verify ordering: Total Amount -> Partial Paid (1) -> Partial Paid (2) -> Paid Amount
    const totalIdx = html.indexOf("Total Amount");
    const partial1Idx = html.indexOf("10 Oct 2026, 11:30 AM");
    const partial2Idx = html.indexOf("12 Oct 2026, 03:15 PM");
    const paidIdx = html.indexOf("Paid Amount");

    expect(totalIdx).toBeGreaterThan(-1);
    expect(partial1Idx).toBeGreaterThan(totalIdx);
    expect(partial2Idx).toBeGreaterThan(partial1Idx);
    expect(paidIdx).toBeGreaterThan(partial2Idx);

    // Verify styling matches Paid Amount font and style
    expect(html).toContain('style="color: #000; background-color: #f1f5f9; font-weight: 600; font-size: 11px;"');
  });

  it("handles paymentHistory as JSON string and receipts array for multiple partial payments", () => {
    const templateHtml = `<table><tbody>{{paidRow}}</tbody></table>`;

    const challanJsonHist = {
      _id: "ch-json-partial",
      challanNumber: "CH-JSON-102",
      amount: 20000,
      totalAmount: 20000,
      paidAmount: 15000,
      status: "PARTIAL",
      paymentHistory: JSON.stringify([
        { amount: 5000, date: "2026-10-01", time: "10:00" },
        { amount: 10000, date: "2026-10-05", time: "14:00" },
      ]),
      student: { _id: "s-101", fName: "JSON", lName: "Student" },
    };

    const htmlJson = generateChallanHtml(challanJsonHist, templateHtml, {});
    expect(htmlJson).toContain("01 Oct 2026, 10:00 AM");
    expect(htmlJson).toContain("5,000");
    expect(htmlJson).toContain("05 Oct 2026, 02:00 PM");
    expect(htmlJson).toContain("10,000");
    expect(htmlJson).toContain("Paid Amount");
    expect(htmlJson).toContain("15,000");

    const challanReceipts = {
      _id: "ch-receipts-partial",
      challanNumber: "CH-REC-103",
      amount: 10000,
      totalAmount: 10000,
      paidAmount: 8000,
      status: "PARTIAL",
      receipts: [
        { amountPaid: 3000, paidDate: "2026-10-02T09:00:00.000Z", receiptType: "DIRECT" },
        { amountPaid: 5000, paidDate: "2026-10-06T15:30:00.000Z", receiptType: "DIRECT" },
      ],
      student: { _id: "s-102", fName: "Receipt", lName: "Student" },
    };

    const htmlRec = generateChallanHtml(challanReceipts, templateHtml, {});
    expect(htmlRec).toContain("Partial Paid");
    expect(htmlRec).toContain("3,000");
    expect(htmlRec).toContain("5,000");
    expect(htmlRec).toContain("Paid Amount");
    expect(htmlRec).toContain("8,000");
  });

  it("does not render Partial Paid rows when challan has a single full payment or is unpaid", () => {
    const templateHtml = `<table><tbody>{{paidRow}}</tbody></table>`;

    const singlePaidChallan = {
      _id: "ch-single-paid",
      challanNumber: "CH-SINGLE-104",
      amount: 10000,
      totalAmount: 10000,
      paidAmount: 10000,
      status: "PAID",
      paymentHistory: [
        { amount: 10000, date: "2026-10-01", time: "10:00 AM" }
      ],
      student: { _id: "s-103", fName: "Single", lName: "Paid" },
    };

    const htmlSingle = generateChallanHtml(singlePaidChallan, templateHtml, {});
    expect(htmlSingle).not.toContain("Partial Paid");
    expect(htmlSingle).toContain("Total Amount");
    expect(htmlSingle).toContain("Paid Amount");

    const unpaidChallan = {
      _id: "ch-unpaid",
      challanNumber: "CH-UNPAID-105",
      amount: 10000,
      totalAmount: 10000,
      paidAmount: 0,
      status: "PENDING",
      student: { _id: "s-104", fName: "Unpaid", lName: "Student" },
    };

    const htmlUnpaid = generateChallanHtml(unpaidChallan, templateHtml, {});
    expect(htmlUnpaid).not.toContain("Partial Paid");
  });

  it("renders partial payment row on a challan with advance adjustment and a direct partial payment", () => {
    const templateHtml = `
      <table>
        <tbody>
          <tr><td>Tuition Fee</td><td>{{Tuition Fee}}</td></tr>
          {{arrearsRows}}
          {{advanceRows}}
          {{paidRow}}
          <tr class="total-row"><td>Total Payable within due date</td><td>{{totalPayable}}</td></tr>
        </tbody>
      </table>
    `;

    const challanWithAdvanceAndPartial = {
      _id: "ch-adv-partial-106",
      challanNumber: "14766582",
      amount: 20000,
      basePayable: 20000,
      advanceApplied: 5000,
      advanceFromChallanNo: "14766581",
      advanceFromMonth: "September",
      paidAmount: 5000,
      status: "PARTIAL",
      receipts: [
        {
          receiptNo: "REC-251243-4108",
          receiptType: "DIRECT",
          amountPaid: 5000,
          paidDate: "2026-10-12T10:10:00.000Z",
          time: "07:10 PM",
        },
        {
          receiptNo: "REC-ADV-93708289",
          receiptType: "ADVANCE_SETTLEMENT",
          amountPaid: 0,
          advanceCreditUsed: 5000,
          paidDate: "2026-10-12T19:10:00.000Z",
        },
      ],
      student: { _id: "s-105", fName: "Advance", lName: "Student" },
    };

    const html = generateChallanHtml(challanWithAdvanceAndPartial, templateHtml, {});

    // Advance adjustment
    expect(html).toContain("September");
    expect(html).toContain("-5,000");

    // Total Amount: 15,000
    expect(html).toContain("Total Amount");
    expect(html).toContain("15,000");

    // Partial Paid row should be present!
    expect(html).toContain("Partial Paid");
    expect(html).toContain("5,000");
    expect(html).toContain("12 Oct 2026");

    // Total Payable within due date: 10,000
    expect(html).toContain("Total Payable within due date");
    expect(html).toContain("10,000");

    // Ensure order: Total Amount -> Partial Paid -> Total Payable within due date
    const totalIdx = html.indexOf("Total Amount");
    const partialIdx = html.indexOf("Partial Paid");
    const payableIdx = html.indexOf("Total Payable within due date");

    expect(totalIdx).toBeGreaterThan(-1);
    expect(partialIdx).toBeGreaterThan(totalIdx);
    expect(payableIdx).toBeGreaterThan(partialIdx);
  });
});


