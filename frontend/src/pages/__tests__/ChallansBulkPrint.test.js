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
});
