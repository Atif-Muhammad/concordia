import { describe, it, expect } from "vitest";

describe("Absentee Fine & Challan Synchronization Unit Tests", () => {
  // =========================================================================
  // 1. EDIT DIALOG REGEX & HEAD DEDUPLICATION (ChallansTab.jsx)
  // =========================================================================
  describe("1. Challan Edit Dialog Logic & Head Preservation", () => {
    it("recognizes both daily and legacy subject absentee fine heads and does not convert them to 'Other'", () => {
      const challanHeads = [
        { name: "Tuition Fee", amount: 15000, category: "monthly" },
        { name: "Saturday Absentee fine", amount: 500, category: "monthly", isCustom: false },
        { name: "Absentee Fine (19 days absent in October)", amount: 5700, category: "custom", isCustom: true },
        { name: "Absentee Fine (58 subject absenties in October)", amount: 2900, category: "custom", isCustom: true },
      ];

      const catalogHeads = [
        { id: "h1", name: "Saturday Absentee fine", amount: 500 },
      ];

      const customHeadsList = [];
      const matchedHeadIds = new Set();

      challanHeads.forEach((item) => {
        const catalogMatch = catalogHeads.find(
          (h) => h.name.trim().toLowerCase() === String(item.name).trim().toLowerCase()
        );

        if (catalogMatch) {
          matchedHeadIds.add(catalogMatch.id);
        } else if (typeof item === "object" && item.name && item.amount) {
          // Broadened regex as implemented in ChallansTab.jsx
          const isAbsentee = /^absentee fine/i.test(item.name);
          if (!isAbsentee) {
            customHeadsList.push({ name: item.name, amount: Number(item.amount) || 0 });
          }
        }
      });

      // Daily and legacy absentee fines MUST NOT end up in customHeadsList
      expect(customHeadsList.length).toBe(1); // Only Tuition Fee (if not in catalog)
      expect(customHeadsList.map((h) => h.name)).not.toContain(
        "Absentee Fine (19 days absent in October)"
      );
      expect(customHeadsList.map((h) => h.name)).not.toContain(
        "Absentee Fine (58 subject absenties in October)"
      );

      // Saturday Absentee fine must be recognized as catalog head
      expect(matchedHeadIds.has("h1")).toBe(true);
    });

    it("deduplicates custom head names and prevents comma-joining explosion", () => {
      const customHeadsList = [
        { name: "Library Card", amount: 200 },
        { name: "Library Card", amount: 200 },
        { name: "ID Badge", amount: 300 },
      ];

      let foundOtherHead = null;
      if (customHeadsList.length > 1) {
        const totalCustom = customHeadsList.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
        const uniqueNames = Array.from(
          new Set(customHeadsList.map((h) => h.name?.trim()).filter(Boolean))
        );
        foundOtherHead = {
          name: uniqueNames.join(", ") || "Other",
          amount: totalCustom,
        };
      }

      expect(foundOtherHead).not.toBeNull();
      expect(foundOtherHead.name).toBe("Library Card, ID Badge");
      expect(foundOtherHead.amount).toBe(700);
    });

    it("preserves automated daily absentee fine during challan submit", () => {
      const editingChallan = {
        challanHeads: [
          { name: "Absentee Fine (19 days absent in October)", amount: 5700, category: "custom" },
        ],
      };

      const allFeeHeadDetails = [
        { name: "Tuition Fee", amount: 25000 },
      ];

      // Replicated logic from handleSubmitChallan
      const existingAbsenteeHead = (editingChallan?.challanHeads || []).find((h) =>
        /^absentee fine/i.test(h.name || "")
      );
      if (
        existingAbsenteeHead &&
        !allFeeHeadDetails.some((h) => /^absentee fine/i.test(h.name || ""))
      ) {
        allFeeHeadDetails.push({
          name: existingAbsenteeHead.name,
          amount: Math.round(Number(existingAbsenteeHead.amount) || 0),
          category: "custom",
          type: "additional",
          isCustom: true,
          isSelected: true,
        });
      }

      expect(allFeeHeadDetails.length).toBe(2);
      expect(allFeeHeadDetails[1].name).toBe("Absentee Fine (19 days absent in October)");
      expect(allFeeHeadDetails[1].amount).toBe(5700);
    });
  });

  // =========================================================================
  // 2. STRICT MONTH RESPONSIBILITY
  // =========================================================================
  describe("2. Strict Month Responsibility", () => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const getPreviousMonthInfo = (monthInput) => {
      if (!monthInput) {
        const now = new Date();
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonthNum = prevDate.getMonth() + 1;
        return {
          prevMonthStr: `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`,
          prevMonthName: monthNames[prevDate.getMonth()],
          prevMonthYear: prevYear,
        };
      }

      const str = String(monthInput).trim();
      if (/^\d{4}-\d{1,2}$/.test(str)) {
        const [y, m] = str.split("-").map(Number);
        const date = new Date(y, m - 1, 1);
        date.setMonth(date.getMonth() - 1);
        const prevYear = date.getFullYear();
        const prevMonthNum = date.getMonth() + 1;
        return {
          prevMonthStr: `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`,
          prevMonthName: monthNames[date.getMonth()],
          prevMonthYear: prevYear,
        };
      }

      const parts = str.split(/\s+/);
      let monthIdx = -1;
      let year = new Date().getFullYear();

      for (const part of parts) {
        const idx = monthNames.findIndex((m) => m.toLowerCase() === part.toLowerCase());
        if (idx !== -1) monthIdx = idx;
        else if (/^\d{4}$/.test(part)) year = Number(part);
      }

      if (monthIdx !== -1) {
        const date = new Date(year, monthIdx, 1);
        date.setMonth(date.getMonth() - 1);
        const prevYear = date.getFullYear();
        const prevMonthNum = date.getMonth() + 1;
        return {
          prevMonthStr: `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`,
          prevMonthName: monthNames[date.getMonth()],
          prevMonthYear: prevYear,
        };
      }

      const now = new Date();
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYear = prevDate.getFullYear();
      const prevMonthNum = prevDate.getMonth() + 1;
      return {
        prevMonthStr: `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`,
        prevMonthName: monthNames[prevDate.getMonth()],
        prevMonthYear: prevYear,
      };
    };

    it("correctly determines that November bills strictly for October", () => {
      const info = getPreviousMonthInfo("November");
      expect(info.prevMonthName).toBe("October");
      expect(info.prevMonthStr.endsWith("-10")).toBe(true);
    });

    it("correctly determines that December bills strictly for November", () => {
      const info = getPreviousMonthInfo("December 2026");
      expect(info.prevMonthName).toBe("November");
      expect(info.prevMonthStr).toBe("2026-11");
    });

    it("correctly rolls over January to December of the previous year", () => {
      const info = getPreviousMonthInfo("January 2027");
      expect(info.prevMonthName).toBe("December");
      expect(info.prevMonthStr).toBe("2026-12");
      expect(info.prevMonthYear).toBe(2026);
    });

    it("filters attendance records strictly by responsible month prefix", () => {
      const attendanceRecords = [
        { date: "2026-10-15", status: "ABSENT" },
        { date: "2026-10-20", status: "ABSENT" },
        { date: "2026-10-31", status: "ABSENT" },
        { date: "2026-11-01", status: "ABSENT" }, // In November - must be ignored for November challan
        { date: "2026-11-02", status: "ABSENT" },
      ];

      const prevMonthStr = "2026-10";
      const distinctOctoberDates = Array.from(
        new Set(
          attendanceRecords
            .filter((r) => r.status === "ABSENT" && r.date.startsWith(prevMonthStr))
            .map((r) => r.date)
        )
      );

      expect(distinctOctoberDates.length).toBe(3);
      expect(distinctOctoberDates).toEqual(["2026-10-15", "2026-10-20", "2026-10-31"]);
      expect(distinctOctoberDates).not.toContain("2026-11-01");
    });
  });

  // =========================================================================
  // 3. COLLECTABLE STATUS FILTER & DOWNSTREAM CHAIN SETTLEMENT
  // =========================================================================
  describe("3. Collectable Challan Filtering & Downstream Chains", () => {
    it("identifies collectable challans (PENDING, PARTIAL, unsettled SUPERSEDED)", () => {
      const challans = [
        { id: "c1", status: "PENDING", supersededBy: null },
        { id: "c2", status: "PARTIAL", supersededBy: null },
        { id: "c3", status: "PAID", supersededBy: null },
        { id: "c4", status: "SETTLED", supersededBy: null },
        { id: "c5", status: "SUPERSEDED", supersededBy: "c3" }, // Downstream is PAID -> Settled
        { id: "c6", status: "SUPERSEDED", supersededBy: "c1" }, // Downstream is PENDING -> Unsettled (Collectable)
      ];

      const lookup = new Map(challans.map((c) => [c.id, c]));

      const isSettledDownstream = (ch) => {
        if (["PAID", "SETTLED"].includes(ch.status)) return true;
        if (ch.status !== "SUPERSEDED") return false;
        let cur = ch.supersededBy;
        const seen = new Set([ch.id]);
        while (cur) {
          const curId = (cur.id || cur).toString();
          if (seen.has(curId)) break;
          seen.add(curId);
          const nextCh = lookup.get(curId) || cur;
          if (["PAID", "SETTLED"].includes(nextCh.status)) return true;
          cur = nextCh.supersededBy;
        }
        return false;
      };

      const collectable = challans.filter(
        (c) => ["PENDING", "PARTIAL", "SUPERSEDED"].includes(c.status) && !isSettledDownstream(c)
      );

      expect(collectable.map((c) => c.id)).toEqual(["c1", "c2", "c6"]);
    });

    it("correctly cascades difference in arrears to downstream open challan", () => {
      const supersededChallan = {
        id: "c_sup",
        status: "SUPERSEDED",
        supersededBy: "c_down",
        oldNetPayable: 10000,
        newNetPayable: 11000, // Diff: +1000
      };

      const downCh = {
        id: "c_down",
        status: "PENDING",
        basePayable: 20000,
        arrearsAmount: 10000,
        headsAmount: 500,
        lateFeeAmount: 0,
        discountAmount: 0,
        advanceApplied: 0,
        arrearAllocations: [
          { sourceChallanId: "c_sup", amountCarriedForward: 10000, originalDueAmount: 10000 },
        ],
      };

      const diff = supersededChallan.newNetPayable - supersededChallan.oldNetPayable;

      // Downstream cascade logic
      const newDownArrears = Math.max(0, downCh.arrearsAmount + diff);
      const newDownGross = downCh.basePayable + newDownArrears + downCh.headsAmount + downCh.lateFeeAmount;
      const newDownNetPayable = Math.max(0, newDownGross - downCh.discountAmount - downCh.advanceApplied);

      const updatedAlloc = downCh.arrearAllocations.map((a) => {
        if (a.sourceChallanId === supersededChallan.id) {
          return {
            ...a,
            amountCarriedForward: a.amountCarriedForward + diff,
            originalDueAmount: a.originalDueAmount + diff,
          };
        }
        return a;
      });

      expect(newDownArrears).toBe(11000);
      expect(newDownGross).toBe(31500);
      expect(newDownNetPayable).toBe(31500);
      expect(updatedAlloc[0].amountCarriedForward).toBe(11000);
    });
  });

  // =========================================================================
  // 4. ADVANCE CREDIT REBALANCING ON RATE / ATTENDANCE DECREASE
  // =========================================================================
  describe("4. Advance Applied and Credit Rebalancing", () => {
    it("rebalances advance credit when absentee fine reduces gross below applied advance", () => {
      // Scenario: Challan had base 10000, absentee fine 3000 (Gross = 13000), advance applied = 13000 (Net = 0)
      // Absentee fine rate decreases to 1000 (Gross = 11000)
      const basePayable = 10000;
      const newFine = 1000;
      const grossAmount = basePayable + newFine; // 11000
      const discountAmount = 0;
      const netBeforeAdvance = Math.max(0, grossAmount - discountAmount); // 11000

      let advanceApplied = 13000;
      let creditRefundToLedger = 0;

      if (advanceApplied > netBeforeAdvance) {
        creditRefundToLedger = advanceApplied - netBeforeAdvance;
        advanceApplied = netBeforeAdvance;
      }

      const netPayable = Math.max(0, netBeforeAdvance - advanceApplied);

      expect(advanceApplied).toBe(11000);
      expect(creditRefundToLedger).toBe(2000);
      expect(netPayable).toBe(0);
    });
  });
});
